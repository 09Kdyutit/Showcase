import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRateLimiter } from '@/lib/rate-limit'
import { recordTrustedEvent } from '@/lib/growth/trusted-events'

const schema = z.object({ portfolio_id: z.string().uuid() })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid portfolio' }, { status: 400 })

  const limiter = await getRateLimiter().check(`growth-portfolio-event:${user.id}`, 30, 3600)
  if (!limiter.allowed) return NextResponse.json({ success: true })

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id, ai_generated_at')
    .eq('id', parsed.data.portfolio_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })
  if (!portfolio.ai_generated_at) {
    return NextResponse.json({ error: 'Portfolio has not been generated' }, { status: 409 })
  }

  const service = await createServiceClient()
  const occurredAt = new Date().toISOString()
  await Promise.all([
    recordTrustedEvent({
      idempotencyKey: `portfolio-preview-viewed:${user.id}:${portfolio.id}`,
      eventName: 'portfolio_preview_viewed',
      userId: user.id,
      entityType: 'portfolio',
      entityId: portfolio.id,
      source: 'authenticated_builder_preview',
      occurredAt,
    }, service),
    recordTrustedEvent({
      idempotencyKey: `portfolio-completed:${user.id}:${portfolio.id}`,
      eventName: 'portfolio_completed',
      userId: user.id,
      entityType: 'portfolio',
      entityId: portfolio.id,
      source: 'authenticated_builder_preview',
      occurredAt,
      metadata: { generated_at: portfolio.ai_generated_at },
    }, service),
  ])

  return NextResponse.json({ success: true })
}
