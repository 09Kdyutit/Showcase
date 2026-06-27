import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { compareAttempts } from '@/lib/interviews/retry-comparison'
import { reserveRetryUsage, releaseSpecificReservation, EntitlementError } from '@/lib/interviews/entitlements'
import { z } from 'zod'

const retrySchema = z.object({
  answerText: z.string().min(1).max(10000),
})

/**
 * Retries an already-answered question after the session has ended. Stores the
 * retry as a NEW attempt (never overwrites the original - mission's explicit
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

    // "1 retry per completed session" (Free) / "30 retries per billing period" (Pro)
    // is counted across the WHOLE session, not per question - a retry on question 2
    // after already retrying question 1 in the same session is still the user's
    // second retry of that session, and Free only gets one. This decision is made
    // ATOMICALLY inside the interview_reserve_retry RPC (migration 027), serialized
    // per (user_id, session_id), so two simultaneous retries on different questions of
    // the same session can no longer both read a stale count and both slip through  - 
    // the IL-17 gap (b) bypass. The non-atomic priorRetryCount SELECT that used to live
    // here is gone; the browser never decides retry allowance.
    let retryReservationId: string | null = null
    try {
      const reserved = await reserveRetryUsage(await createServiceClient(), user.id, id)
      retryReservationId = reserved.reservationId
    } catch (e) {
      if (e instanceof EntitlementError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus })
      throw e
    }

    const attemptNumber = previous.attempt_number + 1
    // Retries happen after the session has already ended, so elapsed-session timing
    // is not meaningful here - unlike the live transcript route, which derives
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
    if (retryError) {
      await supabase.from('interview_transcript_segments').delete().eq('id', segment.id)
      // The reservation taken above was for a retry that did NOT actually happen (lost
      // the race below) - release exactly that one reservation (never every 'reserved'
      // row for the session, which could include an earlier, genuinely successful
      // retry) so neither a Free user's one-per-session slot nor a Pro user's pooled
      // retry count is burned for nothing. Every successful reserveRetryUsage now
      // returns a real reservation id (Free included - migration 027), so this releases
      // it for both tiers.
      if (retryReservationId) await releaseSpecificReservation(await createServiceClient(), retryReservationId, user.id)
      if (retryError.code === '23505') {
        // Two retries on the SAME answer raced past the priorRetryCount check above
        // (a non-atomic SELECT, same class of race the entitlement RPCs were built to
        // close - found via adversarial parallel testing, see test:interview-limits)
        // and both tried to claim the same attempt_number. The database's own unique
        // constraint is the real, final arbiter here; this just turns the resulting
        // 500 into an honest, expected response instead of a raw error.
        return NextResponse.json({ error: 'Another retry for this answer was submitted at the same moment. Please try again.', code: 'RETRY_RACE_LOST' }, { status: 409 })
      }
      throw retryError
    }

    const comparison = compareAttempts(previous.answer_text ?? '', parsed.data.answerText)

    return NextResponse.json({ data: { retryAnswer, previousAnswer: previous, comparison } }, { status: 201 })
  } catch (err) {
    console.error('[interviews/sessions/[id]/answers/[questionId]/retry POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to submit retry.' }, { status: 500 })
  }
}
