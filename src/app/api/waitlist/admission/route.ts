import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { maskEmail, normalizeAdmissionToken } from '@/lib/growth/admission'

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

export async function GET(request: NextRequest) {
  const token = normalizeAdmissionToken(new URL(request.url).searchParams.get('token'))
  if (!token) {
    return NextResponse.json({ valid: false }, { headers: NO_STORE_HEADERS })
  }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('waitlist_signups')
    .select('email, invite_expires_at')
    .eq('invite_token', token)
    .eq('status', 'invited')
    .is('admission_redeemed_at', null)
    .gt('invite_expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ valid: false }, { headers: NO_STORE_HEADERS })
  }

  return NextResponse.json(
    { valid: true, emailHint: maskEmail(data.email), expiresAt: data.invite_expires_at },
    { headers: NO_STORE_HEADERS }
  )
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null)
  const tokenValue = body && typeof body === 'object' && 'token' in body
    ? (body as { token?: unknown }).token
    : null
  const token = normalizeAdmissionToken(typeof tokenValue === 'string' ? tokenValue : null)
  if (!token) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 400, headers: NO_STORE_HEADERS })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in with the invited email first' }, { status: 401, headers: NO_STORE_HEADERS })
  }

  if (user.app_metadata?.showcase_admitted === true) {
    return NextResponse.json({ data: { admitted: true } }, { headers: NO_STORE_HEADERS })
  }

  const service = await createServiceClient()
  const { data: redeemed, error } = await service.rpc('redeem_waitlist_admission', {
    p_token: token,
    p_user_id: user.id,
  })

  if (error) {
    console.error('[waitlist/admission] redemption failed', error.message)
    return NextResponse.json({ error: 'Could not redeem this invite' }, { status: 500, headers: NO_STORE_HEADERS })
  }
  if (redeemed !== true) {
    // A lost success response can leave the browser with a stale JWT even though the DB
    // committed admission. Confirm server-side before calling the token invalid so retries
    // are idempotent and the user can refresh their session.
    const { data: refreshed } = await service.auth.admin.getUserById(user.id)
    if (refreshed.user?.app_metadata?.showcase_admitted === true) {
      return NextResponse.json({ data: { admitted: true, alreadyAdmitted: true } }, { headers: NO_STORE_HEADERS })
    }
    return NextResponse.json(
      { error: 'This invite is expired, already used, or belongs to another email address' },
      { status: 403, headers: NO_STORE_HEADERS }
    )
  }

  return NextResponse.json({ data: { admitted: true } }, { headers: NO_STORE_HEADERS })
}
