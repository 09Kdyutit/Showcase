'use client'

// Real-time browser client for Gemini Live voice interviews. Connects DIRECTLY to
// Gemini using only the short-lived ephemeral token from /live-token — the real
// GEMINI_API_KEY never reaches the browser. The system instruction is built
// server-side from the session's real questions and passed to connect() explicitly
// so the browser can include it in the config (more reliable than liveConnectConstraints).
//
// AudioContext lifecycle: the caller MUST call preInitAudio() synchronously in the
// user-gesture handler (before any await) to unlock the Web Audio API. Browsers
// block audio playback created outside a user gesture chain; the
// ScriptProcessorNode also requires the capture context to be unlocked. Without
// this, the interviewer is connected but silent and no transcript appears.
//
// Kickoff timing: the SDK's connect() resolves as soon as the WebSocket opens —
// before the server sends setupComplete. Sending the kickoff turn before setupComplete
// means the server may ignore it. We detect setupComplete in handleMessage and only
// then fire the kickoff via sendRealtimeInput (better for audio mode than sendClientContent).

import { GoogleGenAI, type Session, type LiveServerMessage } from '@google/genai'

const CAPTURE_SAMPLE_RATE = 16000
const PLAYBACK_SAMPLE_RATE = 24000

export interface LiveQuestionRef {
  id: string
  questionText: string
}

export interface LiveTranscriptSegment {
  speaker: 'interviewer' | 'candidate'
  content: string
  startMs: number
  endMs: number
  questionId: string | null
  pending?: boolean // true while the turn is still streaming — replaced on flush
}

export interface LiveInterviewCallbacks {
  onTranscriptUpdate?: (segments: LiveTranscriptSegment[]) => void
  onInterviewComplete?: () => void
  onError?: (message: string) => void
  onConnected?: () => void
  onClosed?: (wasError: boolean) => void
  onDebugEvent?: (event: string) => void
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Int16Array(bytes.buffer)
}

function float32ToBase64Pcm16(samples: Float32Array): string {
  const int16 = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  const bytes = new Uint8Array(int16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function downsample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input
  const ratio = inputRate / outputRate
  const outputLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    output[i] = input[Math.floor(i * ratio)]
  }
  return output
}

export class LiveInterviewEngine {
  private session: Session | null = null
  private playbackContext: AudioContext | null = null
  private captureContext: AudioContext | null = null
  private micStream: MediaStream | null = null
  private processorNode: ScriptProcessorNode | null = null
  private nextPlaybackTime = 0
  private startedAt = 0
  private messageCount = 0
  private closeWasError = false
  // Gate: audio chunks must not be sent until the server confirms setup is done.
  // Sending audio before setupComplete causes the server to close the connection.
  private readyToSendAudio = false

  private currentQuestionIndex = 0
  private pendingInterviewerText = ''
  private pendingCandidateText = ''
  private segments: LiveTranscriptSegment[] = []

  constructor(
    private readonly questions: LiveQuestionRef[],
    private readonly completionPhrase: string,
    private readonly callbacks: LiveInterviewCallbacks
  ) {}

  // Call this SYNCHRONOUSLY inside the button click handler, before any await.
  // Creates and resumes both audio contexts while the browser considers us "in a
  // user gesture", unlocking audio playback for the session's lifetime.
  preInitAudio(): void {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE })
    }
    if (this.playbackContext.state === 'suspended') {
      void this.playbackContext.resume()
    }
    if (!this.captureContext) {
      this.captureContext = new AudioContext()
    }
    if (this.captureContext.state === 'suspended') {
      void this.captureContext.resume()
    }
  }

  getTranscript(): LiveTranscriptSegment[] {
    // Return committed segments only (no pending ones)
    return this.segments.filter((s) => !s.pending)
  }

  private elapsedMs(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0
  }

  private currentQuestionId(): string | null {
    return this.questions[this.currentQuestionIndex]?.id ?? null
  }

  private maybeAdvanceQuestion(interviewerText: string) {
    const next = this.questions[this.currentQuestionIndex + 1]
    if (!next) return
    const probe = next.questionText.slice(0, 30).toLowerCase()
    if (interviewerText.toLowerCase().includes(probe)) {
      this.currentQuestionIndex++
    }
  }

  async connect(ephemeralToken: string, model: string): Promise<void> {
    if (!this.playbackContext) {
      // Fallback if preInitAudio() wasn't called — less reliable on Safari/mobile
      this.playbackContext = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE })
    }

    const client = new GoogleGenAI({ apiKey: ephemeralToken, httpOptions: { apiVersion: 'v1alpha' } })
    this.startedAt = Date.now()

    this.session = await client.live.connect({
      model,
      // config intentionally omitted: responseModalities, systemInstruction, and
      // transcription are locked into the token via liveConnectConstraints on the
      // server side. The BidiGenerateContentConstrained endpoint applies them
      // automatically; passing them here too would attempt to override locked fields.
      callbacks: {
        onopen: () => {
          this.callbacks.onDebugEvent?.('ws:open')
          this.callbacks.onConnected?.()
        },
        onmessage: (message) => this.handleMessage(message),
        onerror: (e) => {
          const msg = e instanceof Error ? e.message : String(e)
          this.closeWasError = true
          this.callbacks.onDebugEvent?.(`ws:error:${msg}`)
          this.callbacks.onError?.(msg)
        },
        onclose: () => {
          // Null the session immediately so the ScriptProcessorNode's onaudioprocess
          // stops trying to send() on an already-closed WebSocket — that causes a
          // flood of "WebSocket is already in CLOSING or CLOSED state" errors.
          this.session = null
          this.readyToSendAudio = false
          this.callbacks.onDebugEvent?.(`ws:close wasError=${this.closeWasError}`)
          this.callbacks.onClosed?.(this.closeWasError)
        },
      },
    })
  }

  // Fired internally when the server sends setupComplete, meaning it's fully ready
  // to receive input. Using sendRealtimeInput (not sendClientContent) because
  // the session is in realtime audio mode — sendRealtimeInput triggers immediate
  // generation and is the correct path for audio-output Live sessions.
  private sendKickoff(): void {
    if (!this.session) return
    this.callbacks.onDebugEvent?.('kickoff:sending')
    this.session.sendRealtimeInput({
      text: 'Please begin the interview now.',
    })
  }

  private handleMessage(message: LiveServerMessage) {
    this.messageCount++

    // Server signals it's fully ready — open the audio gate and send the kickoff.
    // The SDK's connect() resolves on WebSocket open (before setupComplete arrives),
    // so the ScriptProcessorNode was already capturing audio — but gated from sending
    // until now. Sending audio or content before setupComplete causes the server to
    // close the connection immediately.
    if (message.setupComplete) {
      this.readyToSendAudio = true
      this.callbacks.onDebugEvent?.(`setupComplete msgCount=${this.messageCount}`)
      this.sendKickoff()
      return
    }

    if (message.data) {
      this.callbacks.onDebugEvent?.(`audio len=${message.data.length}`)
      this.playAudioChunk(message.data)
    }

    const serverContent = message.serverContent
    if (!serverContent) {
      this.callbacks.onDebugEvent?.(`msg#${this.messageCount} keys=${Object.keys(message).join(',')}`)
      return
    }

    const oT = serverContent.outputTranscription
    const iT = serverContent.inputTranscription
    this.callbacks.onDebugEvent?.(
      `msg#${this.messageCount} outTx=${oT?.text?.slice(0,30) ?? '-'} inTx=${iT?.text?.slice(0,20) ?? '-'} tc=${serverContent.turnComplete ?? false}`
    )
    if (process.env.NODE_ENV !== 'production') {
      if (oT || iT || serverContent.turnComplete) {
        console.debug('[live-voice] message', JSON.stringify({
          outputTranscription: oT ? { text: oT.text, finished: oT.finished } : undefined,
          inputTranscription: iT ? { text: iT.text, finished: iT.finished } : undefined,
          turnComplete: serverContent.turnComplete,
        }))
      }
    }

    if (serverContent.interrupted) {
      this.nextPlaybackTime = 0
    }

    if (serverContent.outputTranscription?.text) {
      if (this.pendingCandidateText) this.flushCandidate()
      this.pendingInterviewerText += serverContent.outputTranscription.text
      this.maybeAdvanceQuestion(this.pendingInterviewerText)
      // Push a live-preview pending segment so the UI updates while the
      // interviewer is still speaking — replaced by the committed version on flush.
      this.emitLivePreview()
    }

    if (serverContent.inputTranscription?.text) {
      this.pendingCandidateText += serverContent.inputTranscription.text
    }

    if (serverContent.turnComplete) {
      this.flushInterviewer()
    }
  }

  // Emits the current in-progress interviewer text as a temporary pending segment
  // so the UI can show text as it streams, not just after the full turn ends.
  private emitLivePreview() {
    if (!this.pendingInterviewerText) return
    const withoutPending = this.segments.filter((s) => !s.pending)
    const preview: LiveTranscriptSegment = {
      speaker: 'interviewer',
      content: this.pendingInterviewerText.trim(),
      startMs: this.elapsedMs(),
      endMs: this.elapsedMs(),
      questionId: this.currentQuestionId(),
      pending: true,
    }
    this.callbacks.onTranscriptUpdate?.([...withoutPending, preview])
  }

  private flushInterviewer() {
    if (!this.pendingInterviewerText) return
    const text = this.pendingInterviewerText
    this.pendingInterviewerText = ''
    this.commitSegment('interviewer', text)
    if (text.includes(this.completionPhrase)) this.callbacks.onInterviewComplete?.()
  }

  private flushCandidate() {
    if (!this.pendingCandidateText) return
    const text = this.pendingCandidateText
    this.pendingCandidateText = ''
    this.commitSegment('candidate', text)
  }

  private commitSegment(speaker: 'interviewer' | 'candidate', content: string) {
    const trimmed = content.trim()
    if (!trimmed) return
    const endMs = this.elapsedMs()
    // Remove any pending preview for this speaker before committing the final
    const withoutPending = this.segments.filter((s) => !s.pending)
    withoutPending.push({ speaker, content: trimmed, startMs: endMs, endMs, questionId: this.currentQuestionId() })
    this.segments = withoutPending
    this.callbacks.onTranscriptUpdate?.(this.segments)
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext) return
    const ctx = this.playbackContext

    // Resume if suspended (autoplay policy may have suspended after creation)
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const int16 = base64ToInt16Array(base64Data)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000

    const buffer = ctx.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE)
    buffer.copyToChannel(float32, 0)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    const now = ctx.currentTime
    const startAt = Math.max(now, this.nextPlaybackTime)
    source.start(startAt)
    this.nextPlaybackTime = startAt + buffer.duration
  }

  async startMicCapture(): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (!this.captureContext) {
      this.captureContext = new AudioContext()
    }
    if (this.captureContext.state === 'suspended') {
      await this.captureContext.resume()
    }
    const source = this.captureContext.createMediaStreamSource(this.micStream)
    this.processorNode = this.captureContext.createScriptProcessor(4096, 1, 1)
    this.processorNode.onaudioprocess = (event) => {
      if (!this.session || !this.readyToSendAudio) return
      const input = event.inputBuffer.getChannelData(0)
      const downsampled = downsample(input, this.captureContext!.sampleRate, CAPTURE_SAMPLE_RATE)
      const base64 = float32ToBase64Pcm16(downsampled)
      try {
        this.session.sendRealtimeInput({ audio: { data: base64, mimeType: `audio/pcm;rate=${CAPTURE_SAMPLE_RATE}` } })
      } catch {
        // WebSocket may close mid-session; the onclose handler nulls session to stop future calls
      }
    }
    source.connect(this.processorNode)
    // ScriptProcessorNode must be connected to destination to fire onaudioprocess.
    // The actual audio routed here is the mic signal, not the playback — it does
    // create a faint echo path but ScriptProcessorNode offers no alternative.
    this.processorNode.connect(this.captureContext.destination)
  }

  stopMicCapture() {
    this.processorNode?.disconnect()
    this.processorNode = null
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null
    this.captureContext?.close()
    this.captureContext = null
  }

  close() {
    this.flushInterviewer()
    this.flushCandidate()
    this.stopMicCapture()
    this.session?.close()
    this.session = null
    this.playbackContext?.close()
    this.playbackContext = null
  }
}
