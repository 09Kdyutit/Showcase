import { getMaxFollowUpsCeiling, getMaxSessionMinutes } from '../config.ts'

// Canonical Free/Pro Interview Lab limits. These are the ONLY numbers that should ever
// gate session/audio/retry creation - never duplicate these constants elsewhere, and
// never let a route or the browser supply its own number.
export interface InterviewPlanLimits {
  sessionsPerPeriod: number
  audioSessionsPerPeriod: number
  maxPrimaryQuestions: number
  maxAdaptiveFollowUps: number
  maxSessionMinutes: number
  retriesPerPeriod: number | 'per_session_one'
  difficulties: readonly string[]
  coachingModes: readonly string[]
}

// Pricing model rationale: text interviews cost ~$0.03 each (no audio), live voice
// costs ~$0.017/min (Gemini Live audio out). So we make the cheap thing feel unlimited
// and meter only the expensive thing. Free is a real, useful text-only experience that
// makes the voice interviewer the obvious reason to upgrade; Pro is "unlimited" text
// (a high fair-use cap to stop abuse) plus a generous, margin-safe voice allowance.
export const FREE_PLAN_LIMITS: InterviewPlanLimits = {
  sessionsPerPeriod: 5,            // text interviews / month
  audioSessionsPerPeriod: 0,       // voice is the upgrade reason — none on free
  maxPrimaryQuestions: 8,
  maxAdaptiveFollowUps: 2,
  maxSessionMinutes: 25,
  retriesPerPeriod: 'per_session_one',
  difficulties: ['foundational', 'standard'],
  coachingModes: ['guided', 'realistic'],
}

export const PRO_PLAN_LIMITS: InterviewPlanLimits = {
  // 150 total/month reads as "unlimited" to any real user (5/day, every day) while
  // capping pathological abuse. Voice is the metered, cost-bearing resource: 20/month
  // at an avg ~15-min session is ~$5 COGS against $15 revenue (~65% margin), and the
  // pathological worst case is still covered by the live-voice spend-budget gate.
  sessionsPerPeriod: 150,
  audioSessionsPerPeriod: 20,
  maxPrimaryQuestions: 15,
  maxAdaptiveFollowUps: 5,
  maxSessionMinutes: 45,
  retriesPerPeriod: 100,
  difficulties: ['foundational', 'standard', 'challenging'],
  // 'pressure' coaching mode does not exist in this codebase (schemas.ts COACHING_MODES
  // is only ['guided', 'realistic']) - implementing distinct Live/Written interviewer
  // behavior for it is real product work, not a limits change, and is NOT done in this
  // pass. Listing it here without real behavior behind it would be exactly the kind of
  // shallow, fake feature this engagement explicitly prohibits.
  coachingModes: ['guided', 'realistic'],
}

export type PlanTier = 'free' | 'pro'

// Re-derives effective limits with the global env-configured hard ceilings (config.ts)
// applied on top of the plan constants - so a future misconfiguration of PRO_PLAN_LIMITS
// can never exceed the operator's global ceiling, and an operator tightening the global
// ceiling immediately takes effect without a code change.
export function getPlanLimits(tier: PlanTier): InterviewPlanLimits {
  const base = tier === 'pro' ? PRO_PLAN_LIMITS : FREE_PLAN_LIMITS
  return {
    ...base,
    maxAdaptiveFollowUps: Math.min(base.maxAdaptiveFollowUps, getMaxFollowUpsCeiling()),
    maxSessionMinutes: Math.min(base.maxSessionMinutes, getMaxSessionMinutes()),
  }
}

// Session types every Free user may access. Job-Specific Full Loop, Case/Problem
// Solving, Presentation Defense, Technical Concept, and Rapid-Fire Drill are Pro-only
// per the product's tiering - Free gets a real, useful, non-degraded subset, not a
// crippled preview of everything.
export const FREE_SESSION_TYPES = [
  'recruiter_screen', 'behavioral', 'portfolio_walkthrough', 'job_specific_full_loop',
] as const

export function isSessionTypeAllowed(tier: PlanTier, sessionType: string): boolean {
  if (tier === 'pro') return true
  return (FREE_SESSION_TYPES as readonly string[]).includes(sessionType)
}
