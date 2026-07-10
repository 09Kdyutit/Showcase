import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getRateLimiter } from '@/lib/rate-limit'
import { track } from '@/lib/analytics/track'

const schema = z.object({ channel: z.enum(['copy', 'native_share']) })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid event' }, { status: 400 })

  const limit = await getRateLimiter().check(`referral-share:${user.id}`, 20, 86400)
  if (!limit.allowed) return NextResponse.json({ ok: true })

  // This is an authenticated operational observation, not a trusted launch-gate fact:
  // browsers can prove that copy/share UI succeeded, but not that a recipient saw it.
  await track(user.id, 'referral_invite_shared', { channel: parsed.data.channel })
  return NextResponse.json({ ok: true })
}
