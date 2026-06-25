'use client'

// Real-time browser client for Gemini Live voice interviews. Connects DIRECTLY to
// Gemini using only the short-lived ephemeral token from /live-token — the real
// GEMINI_API_KEY never reaches the browser, and the interviewer's system
// instruction (persona + question list) is locked into the token server-side, not
// sent from here. Verified against a real billed Gemini project before this file
// existed: token minting requires apiVersion 'v1alpha' (see gemini/client.ts), and
// connecting with ONLY the resulting token (no API key) successfully opens a real
// Live session.
//
// Mic capture uses a ScriptProcessorNode rather than the more modern AudioWorklet —
// simpler to wire up without a separate static worklet file, broadly supported
// despite being a deprecated API. A future iteration could migrate to
// AudioWorkletNode without changing this module's public interface.

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
  private audioContext: AudioContext | null = null
  private playbackContext: AudioContext | null = null
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

  getTranscript(): LiveTranscriptSegment[] {
    return this.segments
  }

  private elapsedMs(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0
  }

  private currentQuestionId(): string | null {
    return this.questions[this.currentQuestionIndex]?.id ?? null
  }

  /** Advances the "currently active question" pointer when the interviewer's own
   *  speech starts matching the next question in the script — a deterministic
   *  heuristic (not a guess at the candidate's intent) since the model is
   *  instructed to ask questions close to verbatim from a known, fixed list. */
  private maybeAdvanceQuestion(interviewerText: string) {
    const next = this.questions[this.currentQuestionIndex + 1]
    if (!next) return
    const probe = next.questionText.slice(0, 30).toLowerCase()
    if (interviewerText.toLowerCase().includes(probe)) {
      this.currentQuestionIndex++
    }
  }

  async connect(ephemeralToken: string, model: string): Promise<void> {
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
      // config is intentionally omitted here — it's already locked into the
      // ephemeral token server-side (liveConnectConstraints), so this client
      // cannot alter the interviewer's persona or question list even if compromised.
    })

    // With automatic activity detection (the default), the model only generates a
    // turn in response to client input — it will never speak first on its own just
    // because the system instruction says to "greet the candidate." This explicit
    // kickoff turn is what actually starts the interviewer talking.
    this.session.sendClientContent({ turns: 'Please begin the interview now.', turnComplete: true })
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
      this.nextPlaybackTime = 0 // candidate interrupted the model — drop queued audio
    }

    // Verified empirically against the real Live API: Transcription.finished never
    // actually arrives as true for this model, despite being documented as the
    // segment boundary. The real, observed boundaries are: serverContent.turnComplete
    // for the interviewer's side, and "a new output chunk has started" for the
    // candidate's side (proof their turn ended and the model began responding).
    if (serverContent.outputTranscription?.text) {
      if (this.pendingCandidateText) this.flushCandidate()
      this.pendingInterviewerText += serverContent.outputTranscription.text
      this.maybeAdvanceQuestion(this.pendingInterviewerText)
    }

    if (serverContent.inputTranscription?.text) {
      this.pendingCandidateText += serverContent.inputTranscription.text
    }

    if (serverContent.turnComplete) {
      this.flushInterviewer()
    }
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
    this.segments.push({ speaker, content: trimmed, startMs: endMs, endMs, questionId: this.currentQuestionId() })
    this.callbacks.onTranscriptUpdate?.(this.segments)
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE })
    }
    const ctx = this.playbackContext
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
    this.audioContext = new AudioContext()
    const source = this.audioContext.createMediaStreamSource(this.micStream)
    // 4096-sample buffer: small enough for reasonably low latency, large enough to
    // avoid excessive message overhead at typical capture sample rates.
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.processorNode.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      const downsampled = downsample(input, this.audioContext!.sampleRate, CAPTURE_SAMPLE_RATE)
      const base64 = float32ToBase64Pcm16(downsampled)
      this.session?.sendRealtimeInput({ audio: { data: base64, mimeType: `audio/pcm;rate=${CAPTURE_SAMPLE_RATE}` } })
    }
    source.connect(this.processorNode)
    this.processorNode.connect(this.audioContext.destination)
  }

  stopMicCapture() {
    this.processorNode?.disconnect()
    this.processorNode = null
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null
    this.audioContext?.close()
    this.audioContext = null
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
