import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRateLimiter } from '@/lib/rate-limit'
import { recordTrustedEvent } from '@/lib/growth/trusted-events'

const schema = z.object({ session_id: z.string().uuid() })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid session' }, { status: 400 })

  const limiter = await getRateLimiter().check(`growth-attribution:${user.id}`, 10, 3600)
  if (!limiter.allowed) return NextResponse.json({ success: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, created_at')
    .eq('id', user.id)
    .maybeSingle()
  const service = await createServiceClient()
  const { data: claimed, error } = await service.rpc('claim_growth_attribution', {
    p_session_id: parsed.data.session_id,
    p_user_id: user.id,
    p_email: profile?.email ?? user.email ?? null,
  })
  if (error) return NextResponse.json({ error: 'Attribution unavailable' }, { status: 503 })

  if (claimed) {
    await recordTrustedEvent({
      idempotencyKey: `signup-completed:${user.id}`,
      eventName: 'signup_completed',
      userId: user.id,
      entityType: 'profile',
      entityId: user.id,
      source: 'authenticated_attribution_claim',
      occurredAt: profile?.created_at ?? user.created_at,
    }, service)
  }

  return NextResponse.json({ success: true, claimed: Boolean(claimed) })
}
