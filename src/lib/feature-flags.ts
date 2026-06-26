// Emergency kill switches  -  env vars only, no code deploy needed to flip them on a
// host like Vercel. Default (unset) is always "enabled": setting any of these
// requires deliberate action during an incident, never accidental opt-in.
// Examples: a bug causing runaway OpenAI spend, a Stripe incident where checkout
// should be paused without blocking existing customers, an abused jobs provider
// integration, or a need to freeze new public portfolio publishing while
// investigating abuse.
export function isAIEnabled(): boolean {
  return process.env.KILL_SWITCH_AI !== 'true'
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
