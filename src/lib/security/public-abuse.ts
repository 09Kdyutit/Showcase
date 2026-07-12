import 'server-only'

import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

interface RateLimitRow {
  allowed: boolean
  current_count: number
  retry_after_seconds: number
}

export class PublicAbuseGuardError extends Error {
  constructor(message = 'Public request abuse protection could not be verified.') {
    super(message)
    this.name = 'PublicAbuseGuardError'
  }
}

export function clientFingerprint(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown'
  const configuredSalt = process.env.ABUSE_IP_HASH_SALT?.trim()
  const strongConfiguredSalt = configuredSalt && configuredSalt.length >= 32 ? configuredSalt : null

  if (!strongConfiguredSalt && process.env.NODE_ENV === 'production') {
    console.error('[security/public-abuse] fingerprint protection unavailable')
    throw new PublicAbuseGuardError()
  }

  const salt = strongConfiguredSalt ?? 'showcase-public-abuse-local-only'
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

  if (error || !data) {
    console.error('[security/public-abuse] atomic rate limit unavailable:', error?.message ?? 'no row')
    throw new PublicAbuseGuardError()
  }

  return data
}
