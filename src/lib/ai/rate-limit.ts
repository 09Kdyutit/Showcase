import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isAIEnabled, KILL_SWITCH_MESSAGE } from '@/lib/feature-flags'

const LIMITS = {
  free: {
    resume_analyzed: { max: 3, windowHours: 24 },
    audit_completed: { max: 1, windowHours: 24 },
    portfolio_generated: { max: 0, windowHours: 24 },
    bullet_improved: { max: 5, windowHours: 24 },
    role_matched: { max: 2, windowHours: 24 },
    job_imported: { max: 3, windowHours: 24 },
    job_matched: { max: 5, windowHours: 24 },
    job_tailored: { max: 1, windowHours: 24 },
    ats_checked: { max: 1, windowHours: 24 },
    voice_profiled: { max: 1, windowHours: 168 }, // once per week
    resume_pdf_vision: { max: 2, windowHours: 24 },
  },
  pro: {
    resume_analyzed: { max: 25, windowHours: 24 },
    audit_completed: { max: 10, windowHours: 24 },
    portfolio_generated: { max: 10, windowHours: 24 },
    bullet_improved: { max: 50, windowHours: 24 },
    role_matched: { max: 20, windowHours: 24 },
    job_imported: { max: 50, windowHours: 24 },
    job_matched: { max: 100, windowHours: 24 },
    job_tailored: { max: 15, windowHours: 24 },
    ats_checked: { max: 20, windowHours: 24 },
    voice_profiled: { max: 5, windowHours: 24 },
    resume_pdf_vision: { max: 10, windowHours: 24 },
  },
} as const

type EventName = keyof typeof LIMITS.free

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfter?: string }

export async function checkRateLimit(
  userId: string,
  eventName: EventName,
  isPro: boolean
): Promise<RateLimitResult> {
  // Kill switch first, before any quota math — every AI-quota-gated route funnels
  // through this function, making it the single choke point to halt AI spend
  // during an incident without a code deploy.
  if (!isAIEnabled()) {
    return { allowed: false, reason: KILL_SWITCH_MESSAGE }
  }

  const tier = isPro ? 'pro' : 'free'
  const limit = LIMITS[tier][eventName]

  if (limit.max === 0) {
    return {
      allowed: false,
      reason: isPro
        ? `You have reached the limit for ${eventName}. Contact support.`
        : 'This feature requires a Pro subscription. Upgrade to unlock it.',
    }
  }

  try {
    const supabase = await createServiceClient()
    const windowStart = new Date(Date.now() - limit.windowHours * 60 * 60 * 1000).toISOString()

    const { count } = await supabase
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_name', eventName)
      .gte('created_at', windowStart)

    const used = count ?? 0
    if (used >= limit.max) {
      const retryAt = new Date(Date.now() + limit.windowHours * 60 * 60 * 1000)
      return {
        allowed: false,
        reason: `You have reached your ${tier} limit of ${limit.max} ${eventName.replace(/_/g, ' ')} per ${limit.windowHours} hours. ${isPro ? 'Try again later.' : 'Upgrade to Pro for higher limits.'}`,
        retryAfter: retryAt.toISOString(),
      }
    }

    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}

export async function isProUser(userId: string): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .single()

    if (!data) return false
    const now = new Date()
    const periodEnd = data.current_period_end ? new Date(data.current_period_end) : null
    return !periodEnd || periodEnd > now
  } catch {
    return false
  }
}

export function rateLimitResponse(result: Extract<RateLimitResult, { allowed: false }>) {
  return NextResponse.json(
    { error: result.reason, code: 'RATE_LIMITED', retryAfter: result.retryAfter },
    { status: 429 }
  )
}
