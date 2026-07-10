import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { isPublishingEnabled, KILL_SWITCH_MESSAGE } from '@/lib/feature-flags'
import { z } from 'zod'
import { recordTrustedEventSafe } from '@/lib/growth/trusted-events'
import { randomUUID } from 'node:crypto'

const schema = z.object({
  portfolioId: z.string().uuid(),
  action: z.enum(['publish', 'unpublish']),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const service = await createServiceClient()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { portfolioId, action } = parsed.data

    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id, user_id, status')
      .eq('id', portfolioId)
      .eq('user_id', user.id)
      .single()

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })
    }

    trackAsync(user.id, 'portfolio_publish_attempted', {
      portfolio_id: portfolioId,
      action,
    })

    if (action === 'publish') {
      // Unpublishing is never blocked by this switch - taking content down must always
      // stay available, including during the exact incident that would justify flipping it.
      if (!isPublishingEnabled()) {
        return NextResponse.json({ error: KILL_SWITCH_MESSAGE }, { status: 503 })
      }
      const isPro = await isProUser(user.id)
      if (!isPro) {
        await recordTrustedEventSafe({
          idempotencyKey: `publish-paywall:${user.id}:${portfolioId}:${randomUUID()}`,
          eventName: 'publish_paywall_viewed',
          userId: user.id,
          entityType: 'portfolio',
          entityId: portfolioId,
          source: 'portfolio_publish_route',
          metadata: { entry_point: 'builder' },
        }, service)
        return NextResponse.json(
          { error: 'Pro subscription required to publish portfolios publicly.', code: 'PRO_REQUIRED' },
          { status: 403 }
        )
      }
    }

    const newStatus = action === 'publish' ? 'published' : 'draft'
    // Publication state is a server-authority field (migration 041); mutate it with the
    // service client only after the cookie-bound client authenticated and owner-checked
    // the request above.
    const { error } = await service
      .from('portfolios')
      .update({
        status: newStatus,
        published_at: action === 'publish' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', portfolioId)
      .eq('user_id', user.id)

    if (error) throw error

    if (action === 'publish') {
      trackAsync(user.id, 'portfolio_published', { portfolio_id: portfolioId })
      await recordTrustedEventSafe({
        idempotencyKey: `portfolio-published:${user.id}:${portfolioId}`,
        eventName: 'portfolio_published',
        userId: user.id,
        entityType: 'portfolio',
        entityId: portfolioId,
        source: 'portfolio_publish_route',
      }, service)
    }

    return NextResponse.json({ status: newStatus })
  } catch (err) {
    console.error('[portfolio/publish]', err)
    return NextResponse.json({ error: 'Failed to update portfolio status.' }, { status: 500 })
  }
}
