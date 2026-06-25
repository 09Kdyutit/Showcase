import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { commitSessionUsage } from '@/lib/interviews/entitlements'
import { z } from 'zod'

const segmentSchema = z.object({
  speaker: z.enum(['interviewer', 'candidate']),
  content: z.string().min(1).max(10000),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  questionId: z.string().uuid().nullable(),
})

const submitSchema = z.object({
  segments: z.array(segmentSchema).min(1).max(500),
})

/**
 * Persists a completed Live voice conversation's transcript, generated entirely
 * client-side (the browser is the only party with both the real-time audio stream
 * and the question list needed to track which question is "currently active" as the
 * conversation progresses — see src/lib/interviews/live-voice-client.ts). Unlike
 * text/recorded mode, which answer one question per request, a live conversation is
 * submitted in one batch at the end of the call: the model naturally moves through
 * all planned questions in a single continuous session.
 *
 * Every questionId in the payload is verified to actually belong to this session
 * before any insert happens — a malicious client could otherwise attribute fake
 * "evidence" to an arbitrary question_id from a DIFFERENT session it doesn't own.
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
      .select('id, status, delivery_mode')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.delivery_mode !== 'voice') {
      return NextResponse.json({ error: 'This session is not configured for voice delivery.', code: 'INVALID_DELIVERY_MODE' }, { status: 409 })
    }
    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: `Session is ${session.status}, not in progress.`, code: 'INVALID_STATE' }, { status: 409 })
    }

    const { data: questions, error: questionsError } = await supabase
      .from('interview_questions')
      .select('id, order_index')
      .eq('session_id', id)
    if (questionsError) throw questionsError
    const realQuestionIds = new Set((questions ?? []).map((q) => q.id))

    for (const seg of parsed.data.segments) {
      if (seg.questionId && !realQuestionIds.has(seg.questionId)) {
        return NextResponse.json({ error: 'A transcript segment referenced a question that does not belong to this session.', code: 'INVALID_QUESTION_REFERENCE' }, { status: 400 })
      }
    }

    const segmentRows = parsed.data.segments.map((seg) => ({
      user_id: user.id, session_id: id, question_id: seg.questionId,
      speaker: seg.speaker, start_ms: seg.startMs, end_ms: seg.endMs,
      content: seg.content, source_mode: 'voice_live' as const,
    }))
    const { data: insertedSegments, error: insertError } = await supabase
      .from('interview_transcript_segments')
      .insert(segmentRows)
      .select('id, question_id, speaker')
    if (insertError) throw insertError

    // One answer row per question that has at least one candidate segment,
    // aggregating all of that question's candidate speech into one answer_text —
    // mirrors the one-row-per-question shape text/recorded mode both produce, so
    // the existing Results page and analysis pipeline need no live-specific logic.
    const candidateSegmentsByQuestion = new Map<string, { ids: string[]; texts: string[] }>()
    for (let i = 0; i < insertedSegments.length; i++) {
      const seg = insertedSegments[i]
      if (seg.speaker !== 'candidate' || !seg.question_id) continue
      const entry = candidateSegmentsByQuestion.get(seg.question_id) ?? { ids: [], texts: [] }
      entry.ids.push(seg.id)
      entry.texts.push(parsed.data.segments[i].content)
      candidateSegmentsByQuestion.set(seg.question_id, entry)
    }

    const answerRows = Array.from(candidateSegmentsByQuestion.entries()).map(([questionId, entry]) => ({
      user_id: user.id, session_id: id, question_id: questionId, attempt_number: 1,
      answer_text: entry.texts.join(' '), transcript_segment_ids: entry.ids,
    }))
    if (answerRows.length > 0) {
      const { error: answerError } = await supabase.from('interview_answers').insert(answerRows)
      if (answerError) throw answerError
      await commitSessionUsage(await createServiceClient(), id, user.id)
    }

    const answeredQuestionIds = Array.from(candidateSegmentsByQuestion.keys())
    if (answeredQuestionIds.length > 0) {
      const { error: markError } = await supabase
        .from('interview_questions')
        .update({ answered_at: new Date().toISOString() })
        .in('id', answeredQuestionIds)
      if (markError) throw markError
    }

    const { count: answeredCount } = await supabase
      .from('interview_questions')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', id)
      .not('answered_at', 'is', null)
    await supabase.from('interview_sessions').update({ completed_question_count: answeredCount ?? 0 }).eq('id', id)

    return NextResponse.json({ data: { segmentsSaved: insertedSegments.length, answersSaved: answerRows.length } }, { status: 201 })
  } catch (err) {
    console.error('[interviews/sessions/[id]/live-transcript POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to save live interview transcript.' }, { status: 500 })
  }
}
