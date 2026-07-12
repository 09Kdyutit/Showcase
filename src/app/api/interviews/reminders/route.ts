import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const maxDuration = 15

// Interview practice reminders. Fails soft until 20260710033034_interview_reminders.sql applies (relation missing) so the
// widget can ship ahead of the migration and light up when the table exists.
const TABLE_MISSING = '42P01'

const createSchema = z.object({
  remindAt: z.string().datetime(),
  note: z.string().max(200).optional(),
  targetRole: z.string().max(200).optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data, error } = await supabase
      .from('interview_reminders')
      .select('id, remind_at, note, target_role, done')
      .eq('user_id', user.id)
      .eq('done', false)
      .order('remind_at', { ascending: true })
    if (error) {
      if (error.code === TABLE_MISSING) return NextResponse.json({ data: [], pending: true })
      throw error
    }
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json({ data: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid reminder' }, { status: 400 })

    const { count } = await supabase.from('interview_reminders').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('done', false)
    if ((count ?? 0) >= 10) return NextResponse.json({ error: 'You already have 10 upcoming reminders.' }, { status: 400 })

    const { data, error } = await supabase
      .from('interview_reminders')
      .insert({ user_id: user.id, remind_at: parsed.data.remindAt, note: parsed.data.note ?? null, target_role: parsed.data.targetRole ?? null })
      .select('id, remind_at, note, target_role, done')
      .single()
    if (error) {
      if (error.code === TABLE_MISSING) return NextResponse.json({ error: 'Reminders are rolling out — try again shortly.', code: 'PENDING' }, { status: 503 })
      throw error
    }
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Could not set that reminder.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await supabase.from('interview_reminders').update({ done: true }).eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
