import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  ProofScoreCapacityError,
  clientFingerprint,
  enforceAtomicLimit,
} from '@/lib/proofscore/capacity'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.string().trim().regex(/^[A-F0-9]{32}$/)
const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(request.nextUrl.searchParams.get('code')?.toUpperCase() ?? '')
  if (!parsed.success) {
    return NextResponse.json({ valid: false, remaining: 0 }, { headers: NO_STORE })
  }

  try {
    const service = await createServiceClient()
    const limit = await enforceAtomicLimit(
      service,
      `referral-validate:${clientFingerprint(request)}`,
      30,
      60 * 60,
    )
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many invite checks. Try again later.' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retry_after_seconds) } },
      )
    }

    const { data, error } = await service
      .from('profiles')
      .select('referral_invite_limit, referral_invites_used')
      .eq('referral_code', parsed.data)
      .maybeSingle()

    if (error) throw error
    const remaining = data
      ? Math.max(0, Number(data.referral_invite_limit) - Number(data.referral_invites_used))
      : 0
    return NextResponse.json({ valid: remaining > 0, remaining }, { headers: NO_STORE })
  } catch (error) {
    if (!(error instanceof ProofScoreCapacityError)) {
      console.error('[referral/validate]', error instanceof Error ? error.message : 'unknown error')
    }
    return NextResponse.json({ error: 'Invite validation is unavailable' }, { status: 503, headers: NO_STORE })
  }
}
