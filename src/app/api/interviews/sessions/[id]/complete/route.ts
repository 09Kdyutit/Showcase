import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordCostEvent, estimateLiveVoiceCostUsd } from '@/lib/interviews/budget'
import { getLiveModel } from '@/lib/interviews/gemini/models'

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
      .select('id, status, started_at, delivery_mode')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: `Session is ${session.status}, cannot complete.`, code: 'INVALID_STATE' }, { status: 409 })
    }

    const completedAt = new Date()
    const durationSeconds = session.started_at ? Math.round((completedAt.getTime() - new Date(session.started_at).getTime()) / 1000) : null

    const { data: updated, error: updateError } = await supabase
      .from('interview_sessions')
      .update({ status: 'completed', completed_at: completedAt.toISOString(), duration_seconds: durationSeconds })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()
    if (updateError) throw updateError

    // Live voice's actual per-call token usage is never observed by this server (see
    // the comment in live-token/route.ts) -- this records the same duration-based
    // estimate used for the pre-flight check, but using the session's REAL elapsed
    // duration rather than its worst-case max_duration_seconds, so the running ledger
    // total assertWithinBudget() reads reflects actual usage, not worst-case admission.
    if (session.delivery_mode === 'voice' && durationSeconds) {
      await recordCostEvent({
        userId: user.id, sessionId: id, feature: 'live_voice', provider: 'gemini', model: getLiveModel(),
        costUsd: estimateLiveVoiceCostUsd(durationSeconds), estimated: true,
      })
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('[interviews/sessions/[id]/complete POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to complete interview session.' }, { status: 500 })
  }
}
