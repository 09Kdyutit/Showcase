import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  PublicAbuseGuardError,
  clientFingerprint,
  enforceAtomicLimit,
} from '@/lib/security/public-abuse'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 15
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

// Attributes a referral for the currently-signed-in (new) user. Called once, right after
// signup, with the code from the ?ref link. All the abuse checks (no self-referral, no
// re-attribution, bounded credit) live in the claim_referral() SECURITY DEFINER function —
// this route just authenticates the caller and passes their real user id (never client-supplied).
const schema = z.object({ code: z.string().trim().regex(/^[A-Fa-f0-9]{32}$/) })

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > 2 * 1024) {
      return respond({ error: 'Request is too large' }, 413)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return respond({ error: 'Unauthorized' }, 401)

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return respond({ error: 'Invalid code' }, 400)

    const service = await createServiceClient()
    const fingerprint = clientFingerprint(request)
    const [userLimit, connectionLimit] = await Promise.all([
      enforceAtomicLimit(service, `referral-claim-user:${user.id}`, 10, 60 * 60),
      enforceAtomicLimit(service, `referral-claim-ip:${fingerprint}`, 30, 60 * 60),
    ])
    if (!userLimit.allowed || !connectionLimit.allowed) {
      const retryAfter = Math.max(userLimit.retry_after_seconds, connectionLimit.retry_after_seconds)
      return NextResponse.json(
        { error: 'Too many referral attempts. Try again later.' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(retryAfter) } },
      )
    }

    // Guard: only attribute once the caller's profile row actually exists. This is the
    // application-layer equivalent of the SECURITY DEFINER function's row-count check — it
    // guarantees the "new user profile exists" precondition, so claim_referral() can never
    // hit the edge case where a 0-row attribution still credits the referrer. Defense in
    // depth: the DB function enforces the same thing, and the app never even calls it early.
    const { data: profile } = await service
      .from('profiles')
      .select('id, referred_by')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile) {
      // Auth signup and its profile trigger normally commit together. Keep this transient
      // edge retryable instead of turning a valid invite into a permanent rejection.
      return respond({ error: 'Your account is still being prepared', code: 'PROFILE_PENDING' }, 503)
    }
    if (profile.referred_by) {
      // Retrying the same claim after a lost response must be safe and successful. Do not
      // treat a different code as success, though: that would hide an attempted re-attribute.
      const { data: referrer, error: referrerError } = await service
        .from('profiles')
        .select('referral_code')
        .eq('id', profile.referred_by)
        .maybeSingle()
      if (referrerError) throw referrerError
      if (referrer?.referral_code === parsed.data.code.toUpperCase()) {
        return respond({ data: { claimed: true, alreadyClaimed: true } })
      }
      return respond({ error: 'This account already used a different referral', code: 'ALREADY_ATTRIBUTED' }, 409)
    }

    const { data: claimed, error: claimError } = await service.rpc('claim_referral', {
      p_new_user: user.id,
      p_code: parsed.data.code.toUpperCase(),
    })
    if (claimError) throw claimError
    if (claimed !== true) {
      return respond({ error: 'This referral invite is no longer available', code: 'REFERRAL_UNAVAILABLE' }, 409)
    }

    return respond({ data: { claimed: true } })
  } catch (error) {
    if (!(error instanceof PublicAbuseGuardError)) {
      console.error('[referral/claim]', error instanceof Error ? error.message : 'unknown error')
    }
    return respond({ error: 'Referral claiming is temporarily unavailable' }, 503)
  }
}
