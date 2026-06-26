import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { commitSessionUsage } from '@/lib/interviews/entitlements'
import { z } from 'zod'

const submitSchema = z.object({
  questionId: z.string().uuid(),
  answerText: z.string().min(1).max(10000),
})

/**
 * Text-mode answer submission. Appends a candidate transcript segment, records the
 * answer, and returns the next question (or null if the candidate has reached the
 * end of the plan  -  the client should call .../complete next). Voice modes would post
 * here too once Live/Recorded are implemented, with source_mode set accordingly; this
 * build only exercises 'text'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, status, expires_at, started_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: `Session is ${session.status}, not in progress.`, code: 'INVALID_STATE' }, { status: 409 })
    }
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from('interview_sessions').update({ status: 'expired' }).eq('id', id)
      return NextResponse.json({ error: 'This session has expired its maximum duration.', code: 'SESSION_EXPIRED' }, { status: 409 })
    }

    const { data: question, error: questionError } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('id', parsed.data.questionId)
      .eq('session_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (questionError) throw questionError
    if (!question) return NextResponse.json({ error: 'Question not found in this session.' }, { status: 404 })

    const { count: existingAttempts } = await supabase
      .from('interview_answers')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', question.id)
    const attemptNumber = (existingAttempts ?? 0) + 1

    const elapsedMs = session.started_at ? Date.now() - new Date(session.started_at).getTime() : 0
    const startMs = Math.max(0, elapsedMs - parsed.data.answerText.length * 10) // coarse estimate; real timing comes from voice modes
    const endMs = elapsedMs

    const { data: segment, error: segmentError } = await supabase
      .from('interview_transcript_segments')
      .insert({
        user_id: user.id, session_id: id, question_id: question.id,
        speaker: 'candidate', start_ms: startMs, end_ms: endMs,
        content: parsed.data.answerText, source_mode: 'text',
      })
      .select('id')
      .single()
    if (segmentError) throw segmentError

    const { data: answer, error: answerError } = await supabase
      .from('interview_answers')
      .insert({
        user_id: user.id, session_id: id, question_id: question.id, attempt_number: attemptNumber,
        answer_text: parsed.data.answerText, transcript_segment_ids: [segment.id],
      })
      .select('*')
      .single()
    if (answerError) throw answerError

    await supabase.from('interview_questions').update({ answered_at: new Date().toISOString() }).eq('id', question.id)

    // The first real accepted answer is the exact moment a reservation becomes a
    // genuine, non-refundable session  -  see entitlements/reconcile.ts. Idempotent on
    // every later answer in the same session, so calling it unconditionally here is
    // safe and simpler than tracking "was this the first answer" separately.
    if (attemptNumber === 1) {
      await commitSessionUsage(await createServiceClient(), id, user.id)
    }

    const { data: nextQuestion } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('session_id', id)
      .gt('order_index', question.order_index)
      .order('order_index')
      .limit(1)
      .maybeSingle()

    const { count: answeredCount } = await supabase
      .from('interview_questions')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', id)
      .not('answered_at', 'is', null)

    await supabase.from('interview_sessions').update({ completed_question_count: answeredCount ?? 0 }).eq('id', id)

    return NextResponse.json({ data: { answer, nextQuestion: nextQuestion ?? null } })
  } catch (err) {
    console.error('[interviews/sessions/[id]/transcript POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to submit answer. Please try again.' }, { status: 500 })
  }
}
