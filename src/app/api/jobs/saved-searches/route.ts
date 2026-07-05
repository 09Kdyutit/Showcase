import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const maxDuration = 15

// Saved job searches. Fails soft if migration 033 hasn't been applied yet (relation missing) —
// returns an empty list / a friendly message instead of a 500, so the feature can ship ahead
// of the migration and light up the moment the table exists.
const TABLE_MISSING = '42P01'

const createSchema = z.object({
  label: z.string().min(1).max(80),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  alertsEnabled: z.boolean().default(true),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('saved_searches')
      .select('id, label, filters, alerts_enabled, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
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
    if (!parsed.success) return NextResponse.json({ error: 'Invalid search' }, { status: 400 })

    // Cap at 20 saved searches per user.
    const { count } = await supabase.from('saved_searches').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if ((count ?? 0) >= 20) return NextResponse.json({ error: 'You can save up to 20 searches.' }, { status: 400 })

    const { data, error } = await supabase
      .from('saved_searches')
      .insert({ user_id: user.id, label: parsed.data.label, filters: parsed.data.filters, alerts_enabled: parsed.data.alertsEnabled })
      .select('id, label, filters, alerts_enabled, created_at')
      .single()
    if (error) {
      if (error.code === TABLE_MISSING) return NextResponse.json({ error: 'Saved searches are rolling out — try again shortly.', code: 'PENDING' }, { status: 503 })
      throw error
    }
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Could not save that search.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await supabase.from('saved_searches').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
