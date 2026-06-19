import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'

const schema = z.object({
  portfolioId: z.string().uuid(),
  action: z.enum(['publish', 'unpublish']),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      const isPro = await isProUser(user.id)
      if (!isPro) {
        return NextResponse.json(
          { error: 'Pro subscription required to publish portfolios publicly.', code: 'PRO_REQUIRED' },
          { status: 403 }
        )
      }
    }

    const newStatus = action === 'publish' ? 'published' : 'draft'
    const { error } = await supabase
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
    }

    return NextResponse.json({ status: newStatus })
  } catch (err) {
    console.error('[portfolio/publish]', err)
    return NextResponse.json({ error: 'Failed to update portfolio status.' }, { status: 500 })
  }
}
