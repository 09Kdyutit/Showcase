import 'server-only'
import { GoogleGenAI } from '@google/genai'
import { InterviewGeminiNotConfiguredError } from './errors.ts'

// Single cached client, same pattern as src/lib/ai/gemini.ts's getClient(). One
// GoogleGenAI instance for the whole module - analysis.ts and live.ts both call this
// rather than each constructing their own client.
let cachedClient: GoogleGenAI | null = null

export function getInterviewGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new InterviewGeminiNotConfiguredError('GEMINI_API_KEY is not set')
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey })
  }
  return cachedClient
}

// Ephemeral token minting (live.ts) specifically requires the v1alpha API
// version - confirmed by direct testing: the default (stable) API version 404s on
// authTokens.create(), v1alpha succeeds. Kept as a separate client instance so the
// stable-version client above (used for analysis/transcription) is never
// accidentally pinned to an alpha API surface it doesn't need.
let cachedTokenClient: GoogleGenAI | null = null

export function getInterviewGeminiTokenClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new InterviewGeminiNotConfiguredError('GEMINI_API_KEY is not set')
  if (!cachedTokenClient) {
    cachedTokenClient = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } })
  }
  return cachedTokenClient
}
