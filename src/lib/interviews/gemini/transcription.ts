import 'server-only'
import { isInterviewAnalysisEnabled } from '../config.ts'
import { getInterviewGeminiClient } from './client.ts'
import { getAnalysisModel } from './models.ts'
import {
  InterviewGeminiDisabledError,
  InterviewGeminiTimeoutError,
  InterviewGeminiProviderError,
} from './errors.ts'

const TRANSCRIPTION_TIMEOUT_MS = 30_000

const TRANSCRIPTION_PROMPT =
  'Transcribe this audio recording exactly as spoken, verbatim. Do not summarize, ' +
  'correct grammar, or add commentary. Return ONLY the transcribed text — no ' +
  'preamble, no quotation marks, no labels. If the audio is silent, unintelligible, ' +
  'or contains no speech, return exactly: [no speech detected]'

/**
 * Transcribes a Recorded Mode answer. Gated the same way as runInterviewAnalysis()
 * (same flag, isInterviewAnalysisEnabled — Recorded Mode transcription is part of
 * "AI analysis" for gating purposes, not a separate legal surface) and follows the
 * same fail-closed-first, typed-error, abort-on-timeout shape established there.
 * Real audio in, real verbatim text out — never a fabricated transcript.
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  if (!isInterviewAnalysisEnabled()) {
    throw new InterviewGeminiDisabledError('Recorded Mode transcription requires the same analysis gate as scoring — see config.ts')
  }

  const client = getInterviewGeminiClient()
  const model = getAnalysisModel()
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS)

  try {
    const response = await client.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [
          { text: TRANSCRIPTION_PROMPT },
          { inlineData: { mimeType, data: audioBuffer.toString('base64') } },
        ],
      }],
      config: {
        temperature: 0,
        maxOutputTokens: 4096,
        abortSignal: controller.signal,
        httpOptions: { timeout: TRANSCRIPTION_TIMEOUT_MS },
      },
    })
    const text = response.text?.trim()
    if (!text) throw new InterviewGeminiProviderError()
    return text
  } catch (err) {
    if (err instanceof InterviewGeminiProviderError) throw err
    if (controller.signal.aborted) throw new InterviewGeminiTimeoutError()
    console.error('[interviews/gemini/transcription] provider call failed', { model })
    throw new InterviewGeminiProviderError()
  } finally {
    clearTimeout(timeoutHandle)
  }
}
