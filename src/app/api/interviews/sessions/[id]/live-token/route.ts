import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/ai/rate-limit'
import { isInterviewLiveEnabled } from '@/lib/interviews/config'
import { createLiveEphemeralToken } from '@/lib/interviews/gemini/live'
import { assertWithinBudget, estimateLiveVoiceCostUsd, BudgetExceededError } from '@/lib/interviews/budget'

// Browser connects DIRECTLY to Gemini's constrained Live endpoint with the ephemeral
// token — no Supabase Edge Function proxy in the audio path (that proxy's wall-clock
// limit was killing sessions mid-interview with a 1006 abnormal close). The real API
// key is never exposed: the token is server-minted, single-use, time-boxed, and has
// the interviewer config + system instruction locked in.
const GEMINI_LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage' +
  '.v1alpha.GenerativeService.BidiGenerateContentConstrained'

/**
 * Returns the model ID + system instruction needed for a live voice session.
 * All access checks happen here so the Edge Function only receives connections
 * from sessions already cleared for voice delivery.
 *
 * The session's systemInstruction is built server-side from the real planned
 * questions so the browser cannot fabricate a different prompt - but the real
 * GEMINI_API_KEY never reaches the browser. It lives only in the Supabase Edge
 * Function (live-interview-ws) as a secret.
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
      .select('id, user_id, status, delivery_mode, max_duration_seconds, target_role, target_company')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.delivery_mode !== 'voice') {
      return NextResponse.json({ error: 'This session is not configured for voice delivery.', code: 'INVALID_DELIVERY_MODE' }, { status: 409 })
    }
    if (session.status !== 'planned' && session.status !== 'in_progress') {
      return NextResponse.json({ error: `Session is ${session.status}, cannot start a live session.`, code: 'INVALID_STATE' }, { status: 409 })
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

    // Live voice is the dominant Interview Lab cost driver (Gemini Live audio output
    // is billed far higher than text) and the only feature where this app's server
    // never observes real per-call token usage (the WebSocket is proxied transparently
    // by supabase/functions/live-interview-ws). This is therefore the one place a
    // pre-flight worst-case check actually matters: refuse to even hand out the model
    // name + system instruction (without which the browser cannot open the live
    // WebSocket at all) if running the full session length would breach budget.
    try {
      await assertWithinBudget(user.id, estimateLiveVoiceCostUsd(session.max_duration_seconds), isPro)
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        return NextResponse.json({ error: err.message, code: 'BUDGET_EXCEEDED' }, { status: 503 })
      }
      throw err
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

    const tokenResult = await createLiveEphemeralToken({
      sessionId: id,
      userId: user.id,
      maxDurationSeconds: session.max_duration_seconds,
      targetRole: session.target_role,
      targetCompany: session.target_company,
      questions: questions.map((q) => ({ questionText: q.question_text, competency: q.competency })),
    })

    // Browser opens: `${wsUrl}?access_token=${token}` straight to Gemini — no proxy.
    return NextResponse.json({
      data: { token: tokenResult.ephemeralToken, model: tokenResult.model, wsUrl: GEMINI_LIVE_WS_URL },
    })
  } catch (err) {
    console.error('[interviews/sessions/[id]/live-token POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to prepare live session.' }, { status: 500 })
  }
}
