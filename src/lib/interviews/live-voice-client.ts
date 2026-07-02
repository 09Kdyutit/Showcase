'use client'

// Real-time browser client for Gemini Live voice interviews.
//
// Connection path:
//   browser → Supabase Edge Function (live-interview-ws, validated JWT auth)
//           → Gemini BidiGenerateContent (real API key, never in browser)
//
// WHY a proxy instead of connecting to Gemini directly:
//   Gemini ephemeral tokens (auth_tokens/xxx) only work with the
//   BidiGenerateContentConstrained endpoint, whose model registry uses the v1main
//   (stable) catalog. gemini-2.0-flash-live-001 is not in that catalog - it
//   requires BidiGenerateContent with a real API key. We cannot send the real key
//   to the browser, so the Edge Function (supabase/functions/live-interview-ws)
//   holds the key as a Supabase secret and proxies all messages transparently.
//   The browser sends the same Gemini JSON wire format it would send directly;
//   the proxy is invisible to this client.
//
// AudioContext lifecycle: the caller MUST call preInitAudio() synchronously inside
// the user-gesture handler (before any await) to unlock the Web Audio API. Browsers
// block audio playback created outside a user gesture chain.
//
// Kickoff timing: the WebSocket opens before Gemini sends setupComplete.
// Sending audio or content before setupComplete causes an immediate close.
// We gate all sends on readyToSendAudio, which is set on setupComplete.

const CAPTURE_SAMPLE_RATE = 16000
const PLAYBACK_SAMPLE_RATE = 24000

// Gemini Live API wire format types (raw JSON, not SDK types)
interface GeminiSetupMessage {
  setup: {
    model: string
    systemInstruction?: { parts: Array<{ text: string }> }
    generationConfig?: {
      responseModalities?: string[]
    }
    inputAudioTranscription?: Record<string, never>
    outputAudioTranscription?: Record<string, never>
    contextWindowCompression?: { slidingWindow: Record<string, never> }
  }
}

interface GeminiRealtimeInputMessage {
  realtimeInput: {
    audio?: { data: string; mimeType: string }
    text?: string
  }
}

// Appended to the conversation as context WITHOUT triggering a model response
// (turnComplete:false) — used to feed the interviewer silent time cues so it paces
// itself and only wraps up when told, instead of guessing at the clock.
interface GeminiClientContentMessage {
  clientContent: {
    turns: Array<{ role: string; parts: Array<{ text: string }> }>
    turnComplete: boolean
  }
}

interface GeminiServerMessage {
  setupComplete?: Record<string, unknown>
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        inlineData?: { data: string; mimeType: string }
        text?: string
      }>
    }
    outputTranscription?: { text?: string; finished?: boolean }
    inputTranscription?: { text?: string; finished?: boolean }
    turnComplete?: boolean
    interrupted?: boolean
  }
  toolCall?: unknown
  toolCallCancellation?: unknown
}

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
  pending?: boolean
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
  private ws: WebSocket | null = null
  private playbackContext: AudioContext | null = null
  private captureContext: AudioContext | null = null
  private micStream: MediaStream | null = null
  private processorNode: ScriptProcessorNode | null = null
  private nextPlaybackTime = 0
  private startedAt = 0
  private messageCount = 0
  private closeWasError = false
  // Gate: audio must not be sent until the server confirms setup is complete.
  private readyToSendAudio = false

  private currentQuestionIndex = 0
  private pendingInterviewerText = ''
  private pendingCandidateText = ''
  private segments: LiveTranscriptSegment[] = []

  private durationSeconds = 0
  private noteTimers: ReturnType<typeof setTimeout>[] = []

  constructor(
    private readonly questions: LiveQuestionRef[],
    private readonly completionPhrase: string,
    private readonly callbacks: LiveInterviewCallbacks,
    durationSeconds = 0
  ) {
    this.durationSeconds = durationSeconds
  }

  // Send out-of-band context. The Live API only accepts user-role clientContent turns, so
  // we use role:'user' with turnComplete:false. The danger is sending one while the model is
  // waiting with no real answer pending — it then treats the note as the candidate's turn
  // and fabricates a reply. We avoid that by only ever sending the clock AFTER a real
  // candidate answer (see maybeSendClock), so the model's next response is anchored to a real
  // turn. Notes are scrubbed from the transcript as a safety net.
  private sendContext(text: string): void {
    if (!this.ws || !this.readyToSendAudio) return
    const msg: GeminiClientContentMessage = {
      clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: false },
    }
    try { this.ws.send(JSON.stringify(msg)) } catch { /* ws may be closed */ }
  }

  // One explicit wrap signal near the very end. Pacing is otherwise handled by the system
  // prompt; the platform hard-ends the session at 0:00.
  private scheduleTimeCues(): void {
    const d = this.durationSeconds
    if (!d || d < 120) return
    this.noteTimers.push(setTimeout(() => {
      this.sendContext(`[[WRAP NOW]] Time is almost up. Finish your current point in one sentence, then invite any final question from the candidate and WAIT for them. Do not invent their reply. After they respond (or if they stay silent), give your warm one-line closing and stop.`)
      this.callbacks.onDebugEvent?.('wrap-cue sent')
    }, Math.max(0, (d - 45)) * 1000))
  }

  // Remove any telemetry / cues the model may have echoed into its speech so they never
  // appear in the saved or live transcript.
  private static scrubSpoken(text: string): string {
    return text
      .replace(/\[\[[\s\S]*?\]\]/g, '')
      .replace(/\[(?:director'?s note|stage direction|wrap now|clock)[\s\S]*?\]/gi, '')
      .replace(/\((?:quiet )?stage direction[\s\S]*?\)/gi, '')
      .replace(/\s{2,}/g, ' ')
  }

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

  // wsUrl: Gemini's constrained Live endpoint with the ephemeral token appended
  // (wss://generativelanguage.googleapis.com/...BidiGenerateContentConstrained?access_token=...).
  // The interviewer config + system instruction are LOCKED into the token server-side,
  // so the browser only sends a minimal setup naming the model.
  async connect(wsUrl: string, model: string): Promise<void> {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE })
    }

    this.startedAt = Date.now()

    const ws = new WebSocket(wsUrl)
    // Gemini Live API sends JSON payloads inside binary WebSocket frames.
    // Setting arraybuffer lets us decode them synchronously with TextDecoder.
    ws.binaryType = 'arraybuffer'
    this.ws = ws

    ws.onopen = () => {
      this.callbacks.onDebugEvent?.('ws:open')
      // Send setup immediately - server expects the setup message right after open.
      // Config (system instruction, modalities, transcription, context-window
      // compression) is locked into the ephemeral token, so the browser cannot alter it
      // and only needs to name the model here.
      const setupMsg: GeminiSetupMessage = {
        setup: { model: `models/${model}` },
      }
      ws.send(JSON.stringify(setupMsg))
      this.callbacks.onDebugEvent?.('setup:sent')
      this.callbacks.onConnected?.()
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        // Gemini sends binary frames; decode ArrayBuffer → string before parsing.
        const raw: string =
          event.data instanceof ArrayBuffer
            ? new TextDecoder().decode(event.data)
            : (event.data as string)
        const msg: GeminiServerMessage = JSON.parse(raw)
        this.handleMessage(msg)
      } catch (e) {
        this.callbacks.onDebugEvent?.(`msg:parseError ${String(e)}`)
      }
    }

    ws.onerror = (e) => {
      const msg = (e as ErrorEvent)?.message ?? 'WebSocket error'
      this.closeWasError = true
      this.callbacks.onDebugEvent?.(`ws:error ${msg}`)
      this.callbacks.onError?.(msg)
    }

    ws.onclose = (e: CloseEvent) => {
      // Null ws immediately to stop the ScriptProcessorNode from trying to
      // send on a closed WebSocket (which would flood the console with errors).
      this.ws = null
      this.readyToSendAudio = false
      const detail = `code=${e.code ?? '?'} reason=${e.reason ?? ''} clean=${e.wasClean ?? '?'}`
      this.callbacks.onDebugEvent?.(`ws:close ${detail} wasError=${this.closeWasError}`)
      this.callbacks.onClosed?.(this.closeWasError)
    }
  }

  private sendKickoff(): void {
    if (!this.ws) return
    this.callbacks.onDebugEvent?.('kickoff:sending')
    const msg: GeminiRealtimeInputMessage = {
      realtimeInput: { text: 'Please begin the interview now.' },
    }
    this.ws.send(JSON.stringify(msg))
    this.scheduleTimeCues()
  }

  private handleMessage(msg: GeminiServerMessage) {
    this.messageCount++

    if (msg.setupComplete) {
      this.readyToSendAudio = true
      this.callbacks.onDebugEvent?.(`setupComplete msgCount=${this.messageCount}`)
      this.sendKickoff()
      return
    }

    const serverContent = msg.serverContent
    if (!serverContent) {
      this.callbacks.onDebugEvent?.(`msg#${this.messageCount} keys=${Object.keys(msg).join(',')}`)
      return
    }

    const oT = serverContent.outputTranscription
    const iT = serverContent.inputTranscription
    this.callbacks.onDebugEvent?.(
      `msg#${this.messageCount} outTx=${oT?.text?.slice(0, 30) ?? '-'} inTx=${iT?.text?.slice(0, 20) ?? '-'} tc=${serverContent.turnComplete ?? false}`
    )

    // Audio arrives in modelTurn.parts[].inlineData.data as base64 PCM.
    // Play each part independently to preserve ordering.
    if (serverContent.modelTurn?.parts) {
      for (const part of serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.playAudioChunk(part.inlineData.data)
        }
      }
    }

    if (serverContent.interrupted) {
      this.nextPlaybackTime = 0
    }

    if (serverContent.outputTranscription?.text) {
      if (this.pendingCandidateText) this.flushCandidate()
      this.pendingInterviewerText += serverContent.outputTranscription.text
      this.maybeAdvanceQuestion(this.pendingInterviewerText)
      this.emitLivePreview()
    }

    if (serverContent.inputTranscription?.text) {
      this.pendingCandidateText += serverContent.inputTranscription.text
    }

    if (serverContent.turnComplete) {
      this.flushInterviewer()
    }
  }

  private emitLivePreview() {
    if (!this.pendingInterviewerText) return
    const withoutPending = this.segments.filter((s) => !s.pending)
    const preview: LiveTranscriptSegment = {
      speaker: 'interviewer',
      content: LiveInterviewEngine.scrubSpoken(this.pendingInterviewerText).trim(),
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
    // End on the normal completion phrase OR the misconduct phrase (a distinctive fragment
    // of it), so a conduct violation the model catches ends the session immediately.
    if (text.includes(this.completionPhrase) || /ending this interview now|boundary has been crossed/i.test(text)) {
      this.callbacks.onInterviewComplete?.()
    }
  }

  private flushCandidate() {
    if (!this.pendingCandidateText) return
    const text = this.pendingCandidateText
    this.pendingCandidateText = ''
    this.commitSegment('candidate', text)
  }

  private commitSegment(speaker: 'interviewer' | 'candidate', content: string) {
    const trimmed = (speaker === 'interviewer' ? LiveInterviewEngine.scrubSpoken(content) : content).trim()
    if (!trimmed) return
    const endMs = this.elapsedMs()
    const withoutPending = this.segments.filter((s) => !s.pending)
    withoutPending.push({ speaker, content: trimmed, startMs: endMs, endMs, questionId: this.currentQuestionId() })
    this.segments = withoutPending
    this.callbacks.onTranscriptUpdate?.(this.segments)
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext) return
    const ctx = this.playbackContext

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
      if (!this.ws || !this.readyToSendAudio) return
      const input = event.inputBuffer.getChannelData(0)
      const downsampled = downsample(input, this.captureContext!.sampleRate, CAPTURE_SAMPLE_RATE)
      const base64 = float32ToBase64Pcm16(downsampled)
      try {
        const msg: GeminiRealtimeInputMessage = {
          realtimeInput: { audio: { data: base64, mimeType: `audio/pcm;rate=${CAPTURE_SAMPLE_RATE}` } },
        }
        this.ws.send(JSON.stringify(msg))
      } catch {
        // WebSocket may close mid-session; onclose nulls ws to stop future calls
      }
    }
    source.connect(this.processorNode)
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
    this.noteTimers.forEach(clearTimeout)
    this.noteTimers = []
    this.flushInterviewer()
    this.flushCandidate()
    this.stopMicCapture()
    this.ws?.close()
    this.ws = null
    this.playbackContext?.close()
    this.playbackContext = null
  }
}
