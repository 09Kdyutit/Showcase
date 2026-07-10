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
    cover_letter: { max: 3, windowHours: 24 },
    project_suggested: { max: 3, windowHours: 24 },
    ats_checked: { max: 1, windowHours: 24 },
    voice_profiled: { max: 1, windowHours: 168 }, // once per week
    resume_pdf_vision: { max: 2, windowHours: 24 },
    question_scored: { max: 20, windowHours: 24 }, // written/drill practice grading — cheap, frequent
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
    cover_letter: { max: 40, windowHours: 24 },
    project_suggested: { max: 30, windowHours: 24 },
    ats_checked: { max: 20, windowHours: 24 },
    voice_profiled: { max: 5, windowHours: 24 },
    resume_pdf_vision: { max: 10, windowHours: 24 },
    question_scored: { max: 150, windowHours: 24 },
  },
} as const

type EventName = keyof typeof LIMITS.free

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfter?: string; status?: 403 | 429 | 503 }

export async function checkRateLimit(
  userId: string,
  eventName: EventName,
  isPro: boolean
): Promise<RateLimitResult> {
  // Kill switch first, before any quota math - every AI-quota-gated route funnels
  // through this function, making it the single choke point to halt AI spend
  // during an incident without a code deploy.
  if (!isAIEnabled()) {
    return { allowed: false, reason: KILL_SWITCH_MESSAGE, status: 503 }
  }

  const tier = isPro ? 'pro' : 'free'
  const limit = LIMITS[tier][eventName]

  if (limit.max === 0) {
    return {
      allowed: false,
      reason: isPro
        ? `You have reached the limit for ${eventName}. Contact support.`
        : 'This feature requires a Pro subscription. Upgrade to unlock it.',
      status: isPro ? 429 : 403,
    }
  }

  try {
    const supabase = await createServiceClient()
    // The database consumes user quota, one optional referral credit, and global capacity
    // in one transaction. Over-limit spam never advances the global counter; a global
    // denial restores the user's counter/credit; concurrent bonus uses serialize on the
    // profile row. This makes "+5 credits" five calls total, not +5 to every feature forever.
    const configuredGlobalMax = Number(process.env.AI_GLOBAL_DAILY_LIMIT)
    const globalMax = Number.isFinite(configuredGlobalMax) && configuredGlobalMax > 0
      ? Math.min(Math.floor(configuredGlobalMax), 1_000_000)
      : 2000
    const windowSeconds = limit.windowHours * 60 * 60
    const { data, error } = await supabase
      .rpc('consume_ai_request_quota', {
        p_user_id: userId,
        p_event_name: eventName,
        p_window_seconds: windowSeconds,
        p_base_max: limit.max,
        p_global_max: globalMax,
        p_allow_bonus: !isPro,
      })
      .single() as {
        data: {
          allowed: boolean
          current_count: number
          retry_after_seconds: number
          denial_reason: 'user_limit' | 'global_limit' | null
          bonus_remaining: number
        } | null
        error: { message: string } | null
      }

    if (error || !data) {
      console.error('[rate-limit/ai] quota transaction unavailable:', error?.message ?? 'no result')
      return {
        allowed: false,
        reason: 'AI capacity could not be verified. Please try again shortly.',
        status: 503,
      }
    }

    if (!data.allowed) {
      const retryAt = new Date(Date.now() + data.retry_after_seconds * 1000)
      if (data.denial_reason === 'global_limit') {
        console.error(`[rate-limit/ai] global daily AI ceiling reached (${globalMax})`)
        return {
          allowed: false,
          reason: 'AI features are temporarily at capacity platform-wide. Please try again later.',
          retryAfter: retryAt.toISOString(),
          status: 503,
        }
      }
      return {
        allowed: false,
        reason: `You have reached your ${tier} limit of ${limit.max} ${eventName.replace(/_/g, ' ')} per ${limit.windowHours} hours. ${isPro ? 'Try again later.' : 'Upgrade to Pro for higher limits.'}`,
        retryAfter: retryAt.toISOString(),
        status: 429,
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('[rate-limit/ai] quota check failed:', error instanceof Error ? error.message : 'unknown error')
    return {
      allowed: false,
      reason: 'AI capacity could not be verified. Please try again shortly.',
      status: 503,
    }
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
    { status: result.status ?? 429 }
  )
}
