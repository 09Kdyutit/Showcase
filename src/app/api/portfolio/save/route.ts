import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'

const schema = z.object({
  portfolioId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  targetRole: z.string().max(200).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
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

    const { portfolioId, title, targetRole, content } = parsed.data

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title !== undefined) updates.title = title
    if (targetRole !== undefined) updates.target_role = targetRole
    if (content !== undefined) updates.content = content

    const { error } = await supabase
      .from('portfolios')
      .update(updates)
      .eq('id', portfolioId)
      .eq('user_id', user.id)

    if (error) throw error

    trackAsync(user.id, 'portfolio_edit_saved', {
      portfolio_id: portfolioId,
      has_content_update: content !== undefined,
    })

    return NextResponse.json({ saved: true, at: updates.updated_at })
  } catch (err) {
    console.error('[portfolio/save]', err)
    return NextResponse.json({ error: 'Save failed.' }, { status: 500 })
  }
}
