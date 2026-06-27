import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { releaseAbandonedSessionUsage } from '@/lib/interviews/entitlements'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: session, error } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [{ data: questions }, { data: answers }, { data: transcript }, { data: evaluations }] = await Promise.all([
      supabase.from('interview_questions').select('*').eq('session_id', id).order('order_index'),
      supabase.from('interview_answers').select('*').eq('session_id', id).order('created_at'),
      supabase.from('interview_transcript_segments').select('*').eq('session_id', id).order('start_ms'),
      supabase.from('interview_evaluations').select('*').eq('session_id', id).order('created_at', { ascending: false }),
    ])

    let dimensionScores: unknown[] = []
    if (evaluations?.[0]) {
      const { data } = await supabase
        .from('interview_dimension_scores')
        .select('*')
        .eq('evaluation_id', evaluations[0].id)
      dimensionScores = data ?? []
    }

    return NextResponse.json({
      data: {
        session,
        questions: questions ?? [],
        answers: answers ?? [],
        transcript: transcript ?? [],
        latestEvaluation: evaluations?.[0] ?? null,
        dimensionScores,
      },
    })
  } catch (err) {
    console.error('[interviews/sessions/[id] GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load interview session.' }, { status: 500 })
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

    // Refund any still-'reserved' (never-answered) usage slot before deleting - a
    // session abandoned before the first real answer must not permanently cost the
    // user one of their scarce monthly/period sessions. A session that was already
    // 'committed' (genuinely answered) is intentionally left alone here: deleting a
    // completed session must never refund quota, or "complete, get full value,
    // delete, get the slot back" would be a real, repeatable exploit.
    await releaseAbandonedSessionUsage(await createServiceClient(), id, user.id)

    // Ownership re-checked explicitly via .eq('user_id', ...) even though RLS already
    // enforces it - defense in depth, same pattern as every other delete route in
    // this codebase. Child rows (questions/answers/transcript/evaluations/dimension
    // scores) cascade via their FK ON DELETE CASCADE to interview_sessions (migration 017).
    const { error, count } = await supabase
      .from('interview_sessions')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) throw error
    if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[interviews/sessions/[id] DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to delete interview session.' }, { status: 500 })
  }
}
