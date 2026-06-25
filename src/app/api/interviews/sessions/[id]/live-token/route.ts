import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/ai/rate-limit'
import { isInterviewLiveEnabled } from '@/lib/interviews/config'
import { createLiveEphemeralToken } from '@/lib/interviews/gemini/live'

/**
 * Issues a short-lived Gemini Live ephemeral token for a voice session. Runs every
 * check — ownership, delivery mode, session state, entitlement — BEFORE the feature
 * gate, then before calling Gemini, so the gate is proven to fail closed at the LAST
 * possible step rather than accidentally earlier for an unrelated reason. The
 * interviewer's system instruction (persona + exact question list) is built
 * server-side from this session's real planned questions and locked into the token
 * itself — the browser never sees the prompt, only the resulting token.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, user_id, status, delivery_mode, max_duration_seconds, target_role')
      .eq('id', id)
      .eq('user_id', user.id) // ownership — a token can never be issued for another user's session
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.delivery_mode !== 'voice') {
      return NextResponse.json({ error: 'This session is not configured for voice delivery.', code: 'INVALID_DELIVERY_MODE' }, { status: 409 })
    }
    if (session.status !== 'planned' && session.status !== 'in_progress') {
      return NextResponse.json({ error: `Session is ${session.status}, cannot issue a live token.`, code: 'INVALID_STATE' }, { status: 409 })
    }

    const isPro = await isProUser(user.id)
    if (!isPro) {
      return NextResponse.json({ error: 'Voice interviews require a Pro subscription.', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    if (!isInterviewLiveEnabled()) {
      return NextResponse.json({
        error: 'Voice interviews are not yet available. Please use Text Mode.',
        code: 'LIVE_NOT_ENABLED',
      }, { status: 403 })
    }

    const { data: questions, error: questionsError } = await supabase
      .from('interview_questions')
      .select('question_text, competency')
      .eq('session_id', id)
      .order('order_index')
    if (questionsError) throw questionsError
    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'This session has no planned questions.', code: 'NO_QUESTIONS' }, { status: 409 })
    }

    const token = await createLiveEphemeralToken({
      sessionId: id, userId: user.id, maxDurationSeconds: session.max_duration_seconds,
      targetRole: session.target_role, questions: questions.map((q) => ({ questionText: q.question_text, competency: q.competency })),
    })
    return NextResponse.json({ data: token })
  } catch (err) {
    console.error('[interviews/sessions/[id]/live-token POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to issue live session token.' }, { status: 500 })
  }
}
