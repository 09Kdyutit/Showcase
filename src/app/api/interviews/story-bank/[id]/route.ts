import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  competencies: z.array(z.string()).min(1).max(10).optional(),
  situation: z.string().max(1000).nullable().optional(),
  task: z.string().max(1000).nullable().optional(),
  actions: z.array(z.string().max(500)).max(10).optional(),
  outcome: z.string().max(1000).nullable().optional(),
  reflection: z.string().max(1000).nullable().optional(),
  verifiedMetrics: z.array(z.string().max(200)).max(10).optional(),
  lastPracticedAt: z.string().datetime().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { verifiedMetrics, lastPracticedAt, ...rest } = parsed.data
    const updates: Record<string, unknown> = { ...rest }
    if (verifiedMetrics !== undefined) updates.verified_metrics = verifiedMetrics
    if (lastPracticedAt !== undefined) updates.last_practiced_at = lastPracticedAt

    const { data, error } = await supabase
      .from('interview_story_bank')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[interviews/story-bank/[id] PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to update story.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error, count } = await supabase
      .from('interview_story_bank')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) throw error
    if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[interviews/story-bank/[id] DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to delete story.' }, { status: 500 })
  }
}
