import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Persisted project ideas the user chose to keep — so their pick survives a refresh
// (generated suggestions are ephemeral).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('saved_projects')
    .select('id, project, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Could not load saved projects.' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const project = body?.project
  if (!project || typeof project !== 'object' || !project.title) {
    return NextResponse.json({ error: 'A project is required.' }, { status: 400 })
  }

  // Cap saved projects per user so this can't be abused.
  const { count } = await supabase.from('saved_projects').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if ((count ?? 0) >= 50) {
    return NextResponse.json({ error: 'You\'ve saved the max (50). Remove some first.' }, { status: 429 })
  }

  const { data, error } = await supabase
    .from('saved_projects')
    .insert({ user_id: user.id, project })
    .select('id, project, created_at')
    .single()
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('saved_projects').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not remove.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
