import 'server-only'
import OpenAI from 'openai'

// Fail loud at startup in production if key is absent
if (!process.env.OPENAI_API_KEY && process.env.NODE_ENV === 'production') {
  throw new Error(
    'OPENAI_API_KEY is not configured. Set it in your environment variables and restart.'
  )
}

// Server-only singleton. Never import this from a client component.
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? 'key-not-configured',
  timeout: 90_000,
  maxRetries: 2,
})

// Model routing — configurable via env, with safe fallbacks
export const MODELS = {
  // Fast: resume parsing, bullet improvement, role match, free ProofScore preview
  fast: process.env.OPENAI_MODEL_FAST ?? 'gpt-4o-mini',
  // Main: full ProofScore audit, complete portfolio generation
  main: process.env.OPENAI_MODEL_MAIN ?? 'gpt-4o',
  // Premium: optional final-polish pass only — not used automatically
  premium: process.env.OPENAI_MODEL_PREMIUM ?? 'gpt-4o',
} as const

export type ModelTier = keyof typeof MODELS
