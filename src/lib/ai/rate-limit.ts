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
  // Kill switch first, before any quota math - every AI-quota-gated route funnels
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

    // Global daily ceiling, independent of per-user limits - bounds aggregate spend if
    // an attacker spreads calls across many accounts (each individually within its own
    // per-user limit). Default is generous (won't bind under normal usage) but finite;
    // override with AI_GLOBAL_DAILY_LIMIT for an incident. Checked before the per-user
    // counter so a tripped global ceiling fails every request the same way, not just new
    // users, and never advances the per-user counter for a call that wasn't going to run.
    const globalMax = Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 2000
    const { data: globalData, error: globalError } = await supabase
      .rpc('rate_limit_increment', { p_key: 'ai:global:daily', p_window_seconds: 86400, p_max: globalMax })
      .single() as { data: { allowed: boolean; current_count: number; retry_after_seconds: number } | null, error: { message: string } | null }
    if (!globalError && globalData && !globalData.allowed) {
      console.error(`[rate-limit/ai] GLOBAL daily AI ceiling reached: ${globalData.current_count}/${globalMax}`)
      return {
        allowed: false,
        reason: 'AI features are temporarily at capacity platform-wide. Please try again later.',
      }
    }

    // Atomic increment-and-check via rate_limit_increment() (migration 011) - a single
    // INSERT ... ON CONFLICT DO UPDATE statement, so concurrent requests serialize on the
    // row instead of racing a separate SELECT-count-then-INSERT (which a real adversarial
    // test proved lets 10 parallel requests all pass a limit of 3 - every request reads
    // the same pre-insert count before any of them has recorded their own usage). The
    // counter key is scoped per user+event, independent of usage_events, which remains a
    // pure analytics/audit log and is no longer load-bearing for quota enforcement.
    const key = `ai:${eventName}:${userId}`
    const windowSeconds = limit.windowHours * 60 * 60
    const { data, error } = await supabase
      .rpc('rate_limit_increment', { p_key: key, p_window_seconds: windowSeconds, p_max: limit.max })
      .single() as { data: { allowed: boolean; current_count: number; retry_after_seconds: number } | null, error: { message: string } | null }

    if (error || !data) {
      // Fail open on infrastructure error, same documented tradeoff as the Postgres
      // rate limiter for non-AI routes - an outage here must never take down the feature.
      return { allowed: true }
    }

    if (!data.allowed) {
      const retryAt = new Date(Date.now() + data.retry_after_seconds * 1000)
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
