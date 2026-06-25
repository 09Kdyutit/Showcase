import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: session, error: fetchError } = await supabase
      .from('interview_sessions')
      .select('id, status, max_duration_seconds')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Already in_progress → idempotent resume. The client landed here after a
    // drop/refresh and just needs the session + first unanswered question back.
    if (session.status === 'in_progress') {
      const { data: fullSession } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      const { data: firstUnanswered } = await supabase
        .from('interview_questions')
        .select('*')
        .eq('session_id', id)
        .is('answered_at', null)
        .order('order_index')
        .limit(1)
        .maybeSingle()

      return NextResponse.json({ data: { session: fullSession, firstQuestion: firstUnanswered, resumed: true } })
    }

    if (session.status !== 'planned') {
      return NextResponse.json({ error: `Session is ${session.status} and cannot be started.`, code: 'INVALID_STATE' }, { status: 409 })
    }

    const startedAt = new Date()
    // Server-enforced expiry — "the browser cannot increase them." A session that
    // never receives a /complete call is simply unusable past this point; no client
    // request can extend it.
    const expiresAt = new Date(startedAt.getTime() + session.max_duration_seconds * 1000)

    const { data: updated, error: updateError } = await supabase
      .from('interview_sessions')
      .update({ status: 'in_progress', started_at: startedAt.toISOString(), expires_at: expiresAt.toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()
    if (updateError) throw updateError

    const { data: firstQuestion } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('session_id', id)
      .order('order_index')
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ data: { session: updated, firstQuestion } })
  } catch (err) {
    console.error('[interviews/sessions/[id]/start POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to start interview session.' }, { status: 500 })
  }
}
