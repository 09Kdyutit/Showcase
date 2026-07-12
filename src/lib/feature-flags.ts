// Emergency kill switches - env vars only, no code deploy needed to flip them on a
// host like Vercel. The legacy feature switches default to enabled when unset; Gemini is
// the deliberate exception below and defaults closed until its dollar guard is complete.
// Examples: a bug causing runaway OpenAI spend, a Stripe incident where checkout
// should be paused without blocking existing customers, an abused jobs provider
// integration, or a need to freeze new public portfolio publishing while
// investigating abuse.
export function isAIEnabled(): boolean {
  return process.env.KILL_SWITCH_AI !== 'true'
}

// Gemini currently has provider paths outside the atomic OpenAI reservation ledger.
// Unlike the older switches, this one fails closed: production must explicitly set the
// value to "false" only after every Gemini path has atomic dollar reservations and a
// staging concurrency proof. Missing/malformed values keep Google spend disabled.
export function isGeminiEnabled(): boolean {
  return process.env.KILL_SWITCH_GEMINI === 'false'
}

export function isCheckoutEnabled(): boolean {
  return process.env.KILL_SWITCH_CHECKOUT !== 'true'
}

export function isJobsProviderEnabled(): boolean {
  return process.env.KILL_SWITCH_JOBS_PROVIDER !== 'true'
}

export function isPublishingEnabled(): boolean {
  return process.env.KILL_SWITCH_PUBLISHING !== 'true'
}

export const KILL_SWITCH_MESSAGE = 'This feature is temporarily unavailable. Please try again shortly.'
