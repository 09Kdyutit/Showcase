// Interview Lab's legal/cost/safety gate — every flag here defaults to the SAFEST,
// most-disabled state on an unset env var. This mirrors src/lib/ai/gemini.ts's
// isGeminiPrivateDataAllowed()/isGeminiReviewEnabled() pattern (the only other place
// in this codebase that talks to Gemini): multiple independent checks must ALL pass,
// and there is no single flag whose absence accidentally enables anything.
//
// As of this build, GEMINI_PAID_PROJECT_CONFIRMED and GEMINI_INTERVIEW_ENABLED are
// unset in every environment (no human has reviewed Gemini's ToS for this product,
// confirmed paid billing, or signed off on the age-gate/consent flow this session
// could not obtain). isInterviewLabRuntimeEnabled() is therefore false everywhere —
// by design, not by omission. Every route that would call Gemini checks this before
// doing anything else.

export function isGeminiPaidProjectConfirmed(): boolean {
  return process.env.GEMINI_PAID_PROJECT_CONFIRMED === 'true'
}

export function isGeminiInterviewEnabled(): boolean {
  return process.env.GEMINI_INTERVIEW_ENABLED === 'true'
}

/** The master runtime gate. Both must be explicitly 'true' — set by a human who has
 *  confirmed paid billing and reviewed the current Gemini API terms (mission gate
 *  items 1-2). Individual sub-feature flags below are checked IN ADDITION to this,
 *  never instead of it. */
export function isInterviewLabRuntimeEnabled(): boolean {
  return isGeminiPaidProjectConfirmed() && isGeminiInterviewEnabled()
}

export function isInterviewLiveEnabled(): boolean {
  return isInterviewLabRuntimeEnabled() && process.env.INTERVIEW_LIVE_ENABLED === 'true'
}

export function isInterviewAnalysisEnabled(): boolean {
  return isInterviewLabRuntimeEnabled() && process.env.INTERVIEW_ANALYSIS_ENABLED === 'true'
}

export function isInterviewRecordingEnabled(): boolean {
  return isInterviewLabRuntimeEnabled() && process.env.INTERVIEW_RECORDING_ENABLED === 'true'
}

export function getInterviewMinimumAge(): number {
  const n = Number(process.env.INTERVIEW_MINIMUM_AGE ?? '18')
  return Number.isFinite(n) && n >= 18 ? n : 18 // never allow this to be configured below 18
}

/** Raw audio retention is OFF by default (mission gate item 10) regardless of a
 *  user's own retention preference — this is the platform-wide ceiling; a user's
 *  interview_profiles.raw_audio_retention_enabled can only opt IN when this is true,
 *  never override it when false. */
export function isRawAudioRetentionAllowedPlatformWide(): boolean {
  return process.env.INTERVIEW_RAW_AUDIO_RETENTION === 'true'
}

/** Server-enforced hard ceiling on session length — "the browser cannot increase
 *  them" per the mission. Every session-creation route clamps to this regardless of
 *  what the client requests. */
export function getMaxSessionMinutes(): number {
  const n = Number(process.env.INTERVIEW_MAX_SESSION_MINUTES ?? '20')
  return Number.isFinite(n) && n > 0 ? Math.min(n, 30) : 20 // 30-minute absolute hard ceiling, no env can exceed it
}

export function getMaxConcurrentSessions(): number {
  const n = Number(process.env.INTERVIEW_MAX_CONCURRENT_SESSIONS ?? '1')
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** null = not configured, which callers should treat as "do not allow any
 *  cost-incurring call" rather than "unlimited" — the absence of a budget number is
 *  not the same as an infinite budget. */
export function getGlobalDailyBudgetUsd(): number | null {
  const raw = process.env.INTERVIEW_GLOBAL_DAILY_BUDGET_USD
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function getUserMonthlyBudgetUsd(): number | null {
  const raw = process.env.INTERVIEW_USER_MONTHLY_BUDGET_USD
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export const USD_TO_MICROUNITS = 1_000_000

export function usdToMicrounits(usd: number): bigint {
  return BigInt(Math.round(usd * USD_TO_MICROUNITS))
}
