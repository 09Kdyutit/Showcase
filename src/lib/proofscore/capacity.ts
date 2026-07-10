import 'server-only'

import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const PUBLIC_PROOFSCORE_DAILY_CAP = 25
export const PUBLIC_PROOFSCORE_IP_LIMIT = 3

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

interface RateLimitRow {
  allowed: boolean
  current_count: number
  retry_after_seconds: number
}

interface CapacityClaimRow {
  allowed: boolean
  remaining: number
  reservation_used: boolean
  denial_reason: string | null
}

interface ReservationRow {
  allowed: boolean
  reservation_token: string | null
  reservation_date: string
  already_reserved: boolean
  remaining: number
}

export class ProofScoreCapacityError extends Error {
  constructor(message = 'ProofScore capacity could not be verified.') {
    super(message)
    this.name = 'ProofScoreCapacityError'
  }
}

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function nextUtcDate(date = new Date()): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
  return utcDate(next)
}

export function nextUtcReset(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)).toISOString()
}

export function clientFingerprint(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown'
  const salt = process.env.PROOFSCORE_IP_HASH_SALT
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-32)
    ?? 'showcase-proofscore-local'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export async function enforceAtomicLimit(
  service: ServiceClient,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitRow> {
  const { data, error } = await service
    .rpc('rate_limit_increment', {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    })
    .single() as { data: RateLimitRow | null; error: { message?: string } | null }

  // Public AI spend must fail closed: an accounting outage may make the tool unavailable,
  // but it must never silently turn a 25/day cap into an unlimited provider bill.
  if (error || !data) {
    console.error('[proofscore/capacity] atomic rate limit unavailable:', error?.message ?? 'no row')
    throw new ProofScoreCapacityError()
  }
  return data
}

export async function getCapacitySnapshot(service: ServiceClient, day = utcDate()) {
  const [usage, reservations] = await Promise.all([
    service
      .from('proofscore_daily_usage')
      .select('general_used')
      .eq('usage_date', day)
      .maybeSingle(),
    service
      .from('proofscore_reservations')
      .select('token', { count: 'exact', head: true })
      .eq('reserved_for', day),
  ])

  if (usage.error || reservations.error) {
    console.error(
      '[proofscore/capacity] snapshot unavailable:',
      usage.error?.message ?? reservations.error?.message ?? 'unknown error',
    )
    throw new ProofScoreCapacityError()
  }

  const generalUsed = Number((usage.data as { general_used?: number } | null)?.general_used ?? 0)
  const reserved = reservations.count ?? 0
  return {
    cap: PUBLIC_PROOFSCORE_DAILY_CAP,
    remaining: Math.max(0, PUBLIC_PROOFSCORE_DAILY_CAP - generalUsed - reserved),
    date: day,
    resetsAt: nextUtcReset(),
  }
}

export type ReservationState = 'ready' | 'early' | 'used' | 'expired' | 'invalid'

export async function getReservationState(
  service: ServiceClient,
  token: string,
  day = utcDate(),
): Promise<{ state: ReservationState; reservedFor: string | null }> {
  const { data, error } = await service
    .from('proofscore_reservations')
    .select('reserved_for, status')
    .eq('token', token)
    .maybeSingle()

  if (error) throw new ProofScoreCapacityError()
  const row = data as { reserved_for: string; status: string } | null
  if (!row) return { state: 'invalid', reservedFor: null }
  if (row.status !== 'reserved') return { state: 'used', reservedFor: row.reserved_for }
  if (row.reserved_for > day) return { state: 'early', reservedFor: row.reserved_for }
  if (row.reserved_for < day) return { state: 'expired', reservedFor: row.reserved_for }
  return { state: 'ready', reservedFor: row.reserved_for }
}

export async function claimDailyCapacity(
  service: ServiceClient,
  reservationToken?: string,
): Promise<CapacityClaimRow> {
  const { data, error } = await service
    .rpc('claim_proofscore_capacity', {
      p_usage_date: utcDate(),
      p_reservation_token: reservationToken ?? null,
    })
    .single() as { data: CapacityClaimRow | null; error: { message?: string } | null }

  if (error || !data) {
    console.error('[proofscore/capacity] daily claim unavailable:', error?.message ?? 'no row')
    throw new ProofScoreCapacityError()
  }
  return data
}

export async function reserveTomorrow(
  service: ServiceClient,
  email: string,
): Promise<ReservationRow> {
  const { data, error } = await service
    .rpc('reserve_proofscore_slot', {
      p_email: email,
      p_reserved_for: nextUtcDate(),
    })
    .single() as { data: ReservationRow | null; error: { message?: string } | null }

  if (error || !data) {
    console.error('[proofscore/capacity] reservation unavailable:', error?.message ?? 'no row')
    throw new ProofScoreCapacityError()
  }
  return data
}
