import 'server-only'
import { GoogleGenAI } from '@google/genai'
import { InterviewGeminiNotConfiguredError } from './errors.ts'

// Single cached client, same pattern as src/lib/ai/gemini.ts's getClient(). One
// GoogleGenAI instance for the whole module — analysis.ts and (when implemented)
// live.ts both call this rather than each constructing their own client.
let cachedClient: GoogleGenAI | null = null

export function getInterviewGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new InterviewGeminiNotConfiguredError('GEMINI_API_KEY is not set')
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey })
  }
  return cachedClient
}
