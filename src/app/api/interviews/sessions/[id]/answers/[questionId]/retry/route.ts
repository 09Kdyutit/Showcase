import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { compareAttempts } from '@/lib/interviews/retry-comparison'
import { z } from 'zod'

const retrySchema = z.object({
  answerText: z.string().min(1).max(10000),
})

/**
 * Retries an already-answered question after the session has ended. Stores the
 * retry as a NEW attempt (never overwrites the original — mission's explicit
 * requirement), and returns a deterministic, non-AI comparison against the most
 * recent prior attempt. Works on a completed session deliberately: retry is a
 * results-page action, not a mid-interview one.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { id, questionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = retrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.status !== 'completed') {
      return NextResponse.json({ error: 'Only a completed session\'s answers can be retried.', code: 'INVALID_STATE' }, { status: 409 })
    }

    const { data: question, error: questionError } = await supabase
      .from('interview_questions')
      .select('id')
      .eq('id', questionId)
      .eq('session_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (questionError) throw questionError
    if (!question) return NextResponse.json({ error: 'Question not found in this session.' }, { status: 404 })

    const { data: previousAnswers, error: previousError } = await supabase
      .from('interview_answers')
      .select('id, attempt_number, answer_text')
      .eq('question_id', questionId)
      .order('attempt_number', { ascending: false })
      .limit(1)
    if (previousError) throw previousError
    const previous = previousAnswers?.[0]
    if (!previous) return NextResponse.json({ error: 'This question has no original answer to retry.' }, { status: 409 })

    const attemptNumber = previous.attempt_number + 1
    // Retries happen after the session has already ended, so elapsed-session timing
    // is not meaningful here — unlike the live transcript route, which derives
    // start_ms/end_ms from the in-progress session's clock.
    const { data: segment, error: segmentError } = await supabase
      .from('interview_transcript_segments')
      .insert({
        user_id: user.id, session_id: id, question_id: questionId,
        speaker: 'candidate', start_ms: 0, end_ms: 0,
        content: parsed.data.answerText, source_mode: 'text',
      })
      .select('id')
      .single()
    if (segmentError) throw segmentError

    const { data: retryAnswer, error: retryError } = await supabase
      .from('interview_answers')
      .insert({
        user_id: user.id, session_id: id, question_id: questionId, attempt_number: attemptNumber,
        answer_text: parsed.data.answerText, transcript_segment_ids: [segment.id],
      })
      .select('*')
      .single()
    if (retryError) throw retryError

    const comparison = compareAttempts(previous.answer_text ?? '', parsed.data.answerText)

    return NextResponse.json({ data: { retryAnswer, previousAnswer: previous, comparison } }, { status: 201 })
  } catch (err) {
    console.error('[interviews/sessions/[id]/answers/[questionId]/retry POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to submit retry.' }, { status: 500 })
  }
}
