import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlanLimits, type PlanTier } from './plans.ts'
import { freeCalendarMonthPeriod, proBillingPeriod, type UsagePeriod } from './limits.ts'
import { isProUser } from '../../ai/rate-limit.ts'

export interface PlanContext {
  tier: PlanTier
  period: UsagePeriod
}

// Resolves the user's real, server-verified tier and the matching usage period in one
// place, so every caller (session creation, retry, the Hub usage display, the Lobby)
// derives the exact same answer from the exact same source - never a tier string
// trusted from the request body or a client-held value.
//
// Tier itself is delegated to isProUser() - the SAME canonical Pro check every other
// Showcase module uses (it also rejects an 'active' row whose current_period_end has
// already passed, which a naive `status === 'active'` check here would have missed).
// Entitlements only adds period-boundary math on top of that shared answer; it must
// never re-derive tier with even slightly different logic.
export async function resolvePlanContext(supabase: SupabaseClient, userId: string): Promise<PlanContext> {
  const isPro = await isProUser(userId)
  if (!isPro) return { tier: 'free', period: freeCalendarMonthPeriod() }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('current_period_end, price_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!sub?.current_period_end) return { tier: 'free', period: freeCalendarMonthPeriod() }
  return { tier: 'pro', period: proBillingPeriod({ currentPeriodEnd: new Date(sub.current_period_end), priceId: sub.price_id }) }
}

export interface UsageSnapshot {
  tier: PlanTier
  sessions: { used: number; limit: number; remaining: number }
  audioSessions: { used: number; limit: number; remaining: number }
  retries: { used: number; limit: number | 'per_session_one'; remaining: number | null }
  periodLabel: string
  periodResetsAt: string
}

// Real counts from the reservation ledger - 'reserved' and 'committed' both count
// (a reservation that's still pending answer acceptance already holds a real slot),
// 'released' rows never count. This is the single source of truth the Hub, New
// Interview, Lobby, and limit-reached state all read from - never a separate,
// possibly-drifted client-side counter.
export async function getUsageSnapshot(supabase: SupabaseClient, userId: string): Promise<UsageSnapshot> {
  const { tier, period } = await resolvePlanContext(supabase, userId)
  const limits = getPlanLimits(tier)

  const [sessionsRes, audioRes] = await Promise.all([
    supabase.from('interview_usage_reservations').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('kind', 'session').in('status', ['reserved', 'committed'])
      .eq('period_start', period.start.toISOString()),
    supabase.from('interview_usage_reservations').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('kind', 'audio_session').in('status', ['reserved', 'committed'])
      .eq('period_start', period.start.toISOString()),
  ])

  const sessionsUsed = sessionsRes.count ?? 0
  const audioUsed = audioRes.count ?? 0

  let retriesUsed = 0
  const retriesLimit: number | 'per_session_one' = limits.retriesPerPeriod
  if (tier === 'pro') {
    const retryRes = await supabase.from('interview_usage_reservations').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('kind', 'retry').in('status', ['reserved', 'committed'])
      .eq('period_start', period.start.toISOString())
    retriesUsed = retryRes.count ?? 0
  }

  return {
    tier,
    sessions: { used: sessionsUsed, limit: limits.sessionsPerPeriod, remaining: Math.max(0, limits.sessionsPerPeriod - sessionsUsed) },
    audioSessions: { used: audioUsed, limit: limits.audioSessionsPerPeriod, remaining: Math.max(0, limits.audioSessionsPerPeriod - audioUsed) },
    retries: {
      used: retriesUsed, limit: retriesLimit,
      remaining: typeof retriesLimit === 'number' ? Math.max(0, retriesLimit - retriesUsed) : null,
    },
    periodLabel: period.label,
    periodResetsAt: period.end.toISOString(),
  }
}
