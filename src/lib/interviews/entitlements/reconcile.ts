import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// Releases exactly ONE specific reservation by id — for cases (like a retry that lost
// a database-level race after its reservation was already taken) where releasing
// every 'reserved' row for the session would be wrong, since other still-valid
// reservations (e.g. an earlier, genuinely successful retry on the same session) may
// also be sitting in 'reserved' state and must not be touched.
export async function releaseSpecificReservation(supabase: SupabaseClient, reservationId: string, userId: string): Promise<void> {
  await supabase.rpc('interview_release_usage', { p_reservation_id: reservationId, p_user_id: userId, p_allow_committed_release: false })
}

// Reservations are taken before the session row exists (so a denied reservation never
// leaves an orphaned session behind) — this attaches the real session_id immediately
// after the session is actually created, so later commit/release-by-session-id lookups
// work. Called once, right after the insert, for every reservation id this session's
// creation produced (session + audio, if applicable).
export async function attachSessionToReservations(supabase: SupabaseClient, reservationIds: string[], sessionId: string, userId: string): Promise<void> {
  if (reservationIds.length === 0) return
  await supabase.from('interview_usage_reservations').update({ session_id: sessionId }).in('id', reservationIds).eq('user_id', userId)
}

// Called the moment the FIRST real answer for a session is accepted (text transcript
// or recorded-audio answer route) — this is the exact instant a reservation becomes a
// genuine, non-refundable session per the product definition. Idempotent: committing
// an already-committed row is a no-op.
export async function commitSessionUsage(supabase: SupabaseClient, sessionId: string, userId: string): Promise<void> {
  const { data: reservations } = await supabase
    .from('interview_usage_reservations')
    .select('id, kind, status')
    .eq('session_id', sessionId).eq('user_id', userId).eq('status', 'reserved')
  for (const r of reservations ?? []) {
    await supabase.rpc('interview_commit_usage', { p_reservation_id: r.id, p_user_id: userId })
  }
}

// Refunds the session+audio reservations for a session that never received a real
// answer — abandoned in the Lobby, provider connection failed before the first
// question, or the session was deleted pre-answer. Only releases rows still in
// 'reserved' state; a session that already has a committed reservation is a genuine
// used session and is NOT touched here.
export async function releaseAbandonedSessionUsage(supabase: SupabaseClient, sessionId: string, userId: string): Promise<void> {
  const { data: reservations } = await supabase
    .from('interview_usage_reservations')
    .select('id').eq('session_id', sessionId).eq('user_id', userId).eq('status', 'reserved')
  for (const r of reservations ?? []) {
    await supabase.rpc('interview_release_usage', { p_reservation_id: r.id, p_user_id: userId, p_allow_committed_release: false })
  }
}

// Narrow, deliberate exception: refunds a session even though it was already
// committed (the user did answer), because post-session analysis permanently failed —
// the user completed real work but received no usable product outcome. This is a
// known, explicitly-logged residual abuse vector (a user could in principle try to
// induce repeated analysis failures to farm free sessions); mitigating that with
// anomaly detection is out of scope for this pass and is called out in the release
// report rather than silently accepted.
export async function reconcileFailedAnalysis(supabase: SupabaseClient, sessionId: string, userId: string): Promise<void> {
  const { data: reservations } = await supabase
    .from('interview_usage_reservations')
    .select('id').eq('session_id', sessionId).eq('user_id', userId).in('status', ['reserved', 'committed'])
  for (const r of reservations ?? []) {
    await supabase.rpc('interview_release_usage', { p_reservation_id: r.id, p_user_id: userId, p_allow_committed_release: true })
  }
}
