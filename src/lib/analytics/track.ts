import { createServiceClient } from '@/lib/supabase/server'

export type BetaEvent =
  | 'beta_invite_accepted'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'resume_uploaded'
  | 'resume_pasted'
  | 'resume_parsed'
  | 'portfolio_generation_started'
  | 'portfolio_generated'
  | 'proofscore_started'
  | 'proofscore_completed'
  | 'proofscore_viewed'
  | 'recommendation_clicked'
  | 'portfolio_edit_saved'
  | 'portfolio_publish_attempted'
  | 'portfolio_published'
  | 'feedback_started'
  | 'feedback_submitted'
  | 'signup_started'
  | 'signup_completed'
  | 'checkout_completed'

export type TrackMeta = Record<string, string | number | boolean | null | undefined>

/**
 * Server-side event tracking. Writes to usage_events via service client.
 * Always fails silently - never blocks the calling API route.
 *
 * Only call from server-side API routes, never from client components.
 * Do not pass resume text, portfolio content, or PII in metadata.
 */
export async function track(
  userId: string,
  event: BetaEvent | string,
  meta: TrackMeta = {}
): Promise<void> {
  try {
    const supabase = await createServiceClient()
    await supabase.from('usage_events').insert({
      user_id: userId,
      event_name: event,
      metadata: meta,
    })
  } catch {
    // Analytics must never crash the product
  }
}

/**
 * Fire-and-forget wrapper. Use inside API routes where you want
 * tracking but can't await without delaying the response.
 */
export function trackAsync(
  userId: string,
  event: BetaEvent | string,
  meta: TrackMeta = {}
): void {
  track(userId, event, meta).catch(() => {})
}
