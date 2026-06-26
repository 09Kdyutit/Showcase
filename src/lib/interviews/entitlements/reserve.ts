import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlanLimits } from './plans.ts'
import { resolvePlanContext } from './usage.ts'
import { EntitlementError } from './errors.ts'
import { getMaxConcurrentSessions } from '../config.ts'

export interface ReserveSessionResult {
  sessionReservationId: string
  audioReservationId: string | null
  tier: 'free' | 'pro'
}

// The ONLY function allowed to decide whether a new session may be created. Called
// with the service-role client (interview_usage_reservations has no authenticated
// insert policy  -  by design, so the browser cannot reserve its own slot). Reserves
// the overall 'session' slot, and  -  for voice/recorded  -  the 'audio_session' sub-slot
// too, atomically and in that order; if the audio reservation fails, the session
// reservation is released immediately so a half-reserved state never persists.
export async function reserveSessionUsage(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string | null,
  isAudioMode: boolean,
): Promise<ReserveSessionResult> {
  const { tier, period } = await resolvePlanContext(supabase, userId)
  const limits = getPlanLimits(tier)

  if (isAudioMode && limits.audioSessionsPerPeriod === 0) {
    throw new EntitlementError('AUDIO_LIMIT_REACHED', 'Voice and Recorded interviews require Pro.')
  }

  const periodStartIso = period.start.toISOString()
  const periodEndIso = period.end.toISOString()

  // Concurrency is checked INSIDE this RPC's own pg_advisory_xact_lock scope (migration
  // 023)  -  a separate application-level "SELECT count() then proceed" pre-check was
  // tried first and proven racy under real parallel load (scripts/test-interview-limits.mjs
  // caught it directly: it under-delivered the real period quota during a burst). This
  // is not airtight against every conceivable race either  -  the new session row itself
  // is still inserted by the caller after this RPC returns, outside this transaction  - 
  // but it closes the specific race that was actually observed and is a real improvement
  // over the prior non-atomic check.
  type ReserveRpcResult = { allowed: boolean; current_count: number; reservation_id: string | null; denial_reason: 'concurrent_limit' | 'period_limit' | null }
  const { data: sessionRes, error: sessionErr } = await supabase.rpc('interview_reserve_usage', {
    p_user_id: userId, p_kind: 'session', p_session_id: sessionId,
    p_period_start: periodStartIso, p_period_end: periodEndIso, p_limit: limits.sessionsPerPeriod,
    p_max_concurrent: getMaxConcurrentSessions(),
  }).single() as { data: ReserveRpcResult | null, error: { message: string } | null }

  if (sessionErr || !sessionRes) {
    // Fail CLOSED here, unlike the generic abuse-prevention rate limiter  -  an outage
    // in the entitlement ledger must not silently grant unlimited free sessions.
    throw new EntitlementError('SESSION_LIMIT_REACHED', 'Could not verify your interview usage right now. Please try again in a moment.', 503)
  }
  if (!sessionRes.allowed) {
    if (sessionRes.denial_reason === 'concurrent_limit') {
      throw new EntitlementError('CONCURRENT_SESSION_LIMIT', 'You have an interview already in progress. Finish or leave it before starting another.')
    }
    const resetDate = period.end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    throw new EntitlementError('SESSION_LIMIT_REACHED', `You've used your ${limits.sessionsPerPeriod} interview session${limits.sessionsPerPeriod === 1 ? '' : 's'} for this period. Resets ${resetDate}.`)
  }

  let audioReservationId: string | null = null
  if (isAudioMode) {
    // Always pass p_max_concurrent explicitly (null = no concurrency check for audio)
    // so PostgREST unambiguously routes to the 7-param function. Omitting it causes
    // "function is not unique" ambiguity because the old 6-param overload from
    // migration 022 still exists and matches when the 7th param is absent.
    type AudioRpcResult = { allowed: boolean; current_count: number; reservation_id: string | null; denial_reason: string | null }
    const { data: audioRes, error: audioErr } = await supabase.rpc('interview_reserve_usage', {
      p_user_id: userId, p_kind: 'audio_session', p_session_id: sessionId,
      p_period_start: periodStartIso, p_period_end: periodEndIso, p_limit: limits.audioSessionsPerPeriod,
      p_max_concurrent: null,
    }).single() as { data: AudioRpcResult | null, error: { message: string } | null }

    if (audioErr || !audioRes) {
      // RPC failed (e.g. DB unreachable)  -  fail CLOSED and be honest about the cause.
      await supabase.rpc('interview_release_usage', { p_reservation_id: sessionRes.reservation_id, p_user_id: userId, p_allow_committed_release: false })
      throw new EntitlementError('AUDIO_LIMIT_REACHED', 'Could not verify your voice/recorded interview usage right now. Please try again in a moment.', 503)
    }
    if (!audioRes.allowed) {
      // Genuine quota denial  -  roll back the session slot and give the user an accurate count.
      await supabase.rpc('interview_release_usage', { p_reservation_id: sessionRes.reservation_id, p_user_id: userId, p_allow_committed_release: false })
      const resetDate = period.end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      throw new EntitlementError('AUDIO_LIMIT_REACHED', `You've used your ${limits.audioSessionsPerPeriod} voice/recorded interview${limits.audioSessionsPerPeriod === 1 ? '' : 's'} for this period. Resets ${resetDate}.`)
    }
    audioReservationId = audioRes.reservation_id
  }

  return { sessionReservationId: sessionRes.reservation_id!, audioReservationId, tier }
}

// Retry has its own independent pool, enforced ATOMICALLY for both tiers through the
// interview_reserve_retry RPC (migration 027). The browser never decides retry
// allowance and the route never pre-counts retries with a non-atomic SELECT  -  the RPC
// serializes concurrent callers per (user_id, session_id) under a Postgres advisory
// transaction lock, so simultaneous retries on DIFFERENT questions of the same session
// (the IL-17 gap (b) bypass) collide and only the allowed number commit.
//
//   * Free: exactly one retry per completed session (per-session ceiling = 1).
//   * Pro:  a real period pool of 30 retries, counted across the whole period.
//
// A denial inserts no row, so a request that loses the race burns nothing. The returned
// reservationId is always non-null on success (Free included) so the route can release
// exactly the reservation it took if the subsequent answer insert loses a different
// race (e.g. the same-answer unique-constraint 23505).
export async function reserveRetryUsage(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<{ reservationId: string | null }> {
  const { tier, period } = await resolvePlanContext(supabase, userId)
  const limits = getPlanLimits(tier)

  const isPro = tier === 'pro'
  const { data, error } = await supabase.rpc('interview_reserve_retry', {
    p_user_id: userId,
    p_session_id: sessionId,
    p_period_start: period.start.toISOString(),
    p_period_end: period.end.toISOString(),
    p_session_limit: isPro ? null : 1,
    p_period_limit: isPro ? (limits.retriesPerPeriod as number) : 0,
    p_count_period: isPro,
  }).single() as { data: { allowed: boolean; session_count: number; period_count: number; reservation_id: string | null } | null, error: { message: string } | null }

  // Fail CLOSED  -  an outage in the retry ledger must not silently grant unlimited
  // retries, the same posture as session/audio reservation above.
  if (error || !data) {
    throw new EntitlementError('RETRY_LIMIT_REACHED', 'Could not verify your retry usage right now. Please try again in a moment.', 503)
  }
  if (!data.allowed) {
    if (isPro) {
      throw new EntitlementError('RETRY_LIMIT_REACHED', `You've used your ${limits.retriesPerPeriod} retries for this billing period.`)
    }
    throw new EntitlementError('RETRY_LIMIT_REACHED', 'Free includes 1 retry per completed session. Upgrade to Pro for more.')
  }
  return { reservationId: data.reservation_id }
}
