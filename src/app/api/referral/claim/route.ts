import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 15

// Attributes a referral for the currently-signed-in (new) user. Called once, right after
// signup, with the code from the ?ref link. All the abuse checks (no self-referral, no
// re-attribution, bounded credit) live in the claim_referral() SECURITY DEFINER function —
// this route just authenticates the caller and passes their real user id (never client-supplied).
const schema = z.object({ code: z.string().min(4).max(16) })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

    const service = await createServiceClient()

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
    if (!profile || profile.referred_by) {
      // No profile yet (too early) or already attributed — nothing to do.
      return NextResponse.json({ data: { claimed: false } })
    }

    const { data: claimed } = await service.rpc('claim_referral', {
      p_new_user: user.id,
      p_code: parsed.data.code.trim().toUpperCase(),
    })

    return NextResponse.json({ data: { claimed: claimed === true } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
