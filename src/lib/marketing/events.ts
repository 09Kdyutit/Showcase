// Shared between the client tracker and the API route - the allowlist IS the
// validation. An event name or metadata key not listed here is rejected, not
// silently accepted, so this file is the only place the funnel can grow from.

export const MARKETING_EVENTS = [
  'landing_viewed',
  'hero_primary_cta_clicked',
  'hero_secondary_cta_clicked',
  'product_demo_started',
  'product_demo_completed',
  'audience_section_viewed',
  'comparison_viewed',
  'pricing_viewed',
  'billing_period_selected',
  'waitlist_submitted',
  'signup_started',
] as const
// checkout_started/checkout_completed and the rest of the post-signup funnel
// (resume_uploaded, portfolio_generated, proofscore_viewed, portfolio_published,
// signup_completed) already have a real user_id by the time they fire and are
// tracked server-side via src/lib/analytics/track.ts's BetaEvent union instead  - 
// this file only covers the anonymous, pre-account part of the journey.

export type MarketingEvent = (typeof MARKETING_EVENTS)[number]

// Metadata is intentionally restricted to small, enumerable values - never free text,
// never anything that could carry a resume fragment, name, or email.
export type MarketingEventMetadata = Record<string, string | number | boolean | null>

export const ALLOWED_METADATA_KEYS = new Set([
  'route',
  'launch_mode',
  'billing_period',
  'viewport',
  'experiment_variant',
  'cta_label',
  'already_joined',
])
