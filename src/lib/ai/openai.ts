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

// Model routing - configurable via env, with safe fallbacks
export const MODELS = {
  // Fast: resume parsing, bullet improvement, role match, free ProofScore preview
  fast: process.env.OPENAI_MODEL_FAST ?? 'gpt-4o-mini',
  // Main: full ProofScore audit, complete portfolio generation
  main: process.env.OPENAI_MODEL_MAIN ?? 'gpt-4o',
  // Premium: optional final-polish pass only - not used automatically
  premium: process.env.OPENAI_MODEL_PREMIUM ?? 'gpt-4o',
  // Interview analysis: post-session coaching/evidence assessment. gpt-5-mini for its
  // nuanced judgment (calibrated scoring, spotting weak moments, non-generic feedback) — but
  // run at reasoning.effort='low' (see client.ts) so it stays sharp WITHOUT the 20-30s
  // "thinking" delay that made grading feel slow. Best of both: smart and fast. Live voice
  // interviews stay on Gemini.
  interviewAnalysis: process.env.OPENAI_MODEL_INTERVIEW_ANALYSIS ?? 'gpt-5-mini',
} as const

export type ModelTier = keyof typeof MODELS

// Reasoning-tier models (o1, o3, o4-mini, gpt-5-mini, etc.) reject the `temperature`
// parameter outright with a 400 -- "Unsupported parameter: 'temperature' is not
// supported with this model." Confirmed by direct testing against gpt-5-mini before
// this fix existed. callStructured() checks this before deciding whether to include
// temperature in the request at all, rather than sending a value these models reject.
const REASONING_TIER_MODEL_PREFIXES = ['o1', 'o3', 'o4-mini', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.4-mini', 'gpt-5.4-nano']

export function modelSupportsTemperature(model: string): boolean {
  return !REASONING_TIER_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix))
}

// A reasoning-tier model (gpt-5-mini, o-series, …). These accept a `reasoning.effort` dial;
// turning it down keeps the model's capability but cuts the seconds it spends "thinking"
// before answering — the difference between a fast and a slow post-session analysis.
export function isReasoningModel(model: string): boolean {
  return REASONING_TIER_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix))
}
