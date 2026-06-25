'use client'

// Real-time browser client for Gemini Live voice interviews. Connects DIRECTLY to
// Gemini using only the short-lived ephemeral token from /live-token — the real
// GEMINI_API_KEY never reaches the browser, and the interviewer's system
// instruction (persona + question list) is locked into the token server-side, not
// sent from here.
//
// AudioContext lifecycle: the caller MUST call preInitAudio() synchronously in the
// user-gesture handler (before any await) to unlock the Web Audio API. Browsers
// block audio playback created outside a user gesture chain; the
// ScriptProcessorNode also requires the capture context to be unlocked. Without
// this, the interviewer is connected but silent and no transcript appears.

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
  onClosed?: () => void
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
      callbacks: {
        onopen: () => this.callbacks.onConnected?.(),
        onmessage: (message) => this.handleMessage(message),
        onerror: (e) => this.callbacks.onError?.(e instanceof Error ? e.message : 'Live connection error'),
        onclose: () => this.callbacks.onClosed?.(),
      },
      // config is intentionally omitted — it's locked into the ephemeral token
      // server-side (liveConnectConstraints), so the browser cannot alter it.
    })
  }

  // Call AFTER connect() and startMicCapture() are both done.
  // Sending the kickoff BEFORE mic is ready can cause the model's greeting audio
  // to overlap with mic initialization and get interrupted or dropped.
  sendKickoff(): void {
    if (!this.session) return
    this.session.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text: 'Please begin the interview now. Introduce yourself briefly as the interviewer and ask the first question.' }],
      }],
      turnComplete: true,
    })
  }

  private handleMessage(message: LiveServerMessage) {
    if (process.env.NODE_ENV !== 'production') {
      const oT = message.serverContent?.outputTranscription
      const iT = message.serverContent?.inputTranscription
      if (oT || iT || message.serverContent?.turnComplete) {
        console.debug('[live-voice] message', JSON.stringify({
          outputTranscription: oT ? { text: oT.text, finished: oT.finished } : undefined,
          inputTranscription: iT ? { text: iT.text, finished: iT.finished } : undefined,
          turnComplete: message.serverContent?.turnComplete,
        }))
      }
    }

    if (message.data) this.playAudioChunk(message.data)

    const serverContent = message.serverContent
    if (!serverContent) return

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
      const input = event.inputBuffer.getChannelData(0)
      const downsampled = downsample(input, this.captureContext!.sampleRate, CAPTURE_SAMPLE_RATE)
      const base64 = float32ToBase64Pcm16(downsampled)
      this.session?.sendRealtimeInput({ audio: { data: base64, mimeType: `audio/pcm;rate=${CAPTURE_SAMPLE_RATE}` } })
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
