import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { commitSessionUsage } from '@/lib/interviews/entitlements'
import { isInterviewRecordingEnabled, isInterviewAnalysisEnabled } from '@/lib/interviews/config'
import { validateAudioUpload, buildAudioStoragePath, CANONICAL_MIME_FOR_EXTENSION } from '@/lib/interviews/audio-validation'
import { transcribeAudio } from '@/lib/interviews/gemini/transcription'

/**
 * Recorded Mode answer upload + transcription. Ownership/session-state/question-
 * existence are all checked BEFORE the feature gate, same ordering as live-token, so
 * that gate-flip-later changes nothing about authorization. The recording is
 * uploaded and persisted FIRST, independent of transcription succeeding  -  a
 * transcription failure (provider timeout, etc.) never loses the candidate's actual
 * recording, it just means the question isn't marked answered yet and the client
 * should offer a retry or a fall back to typing. No transcript is ever fabricated:
 * if Gemini fails, this route fails closed and says so.
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

    // Ownership, session state, and question existence are all checked BEFORE the
    // feature gate  -  same ordering as live-token's "every check the mission requires
    // before reaching the point where a real implementation would act," so that
    // ownership enforcement is provable independently of whether the gate happens to
    // be open or closed, and opening the gate later changes nothing about this order.
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: `Session is ${session.status}, not in progress.`, code: 'INVALID_STATE' }, { status: 409 })
    }

    const { data: question, error: questionError } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('id', questionId)
      .eq('session_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (questionError) throw questionError
    if (!question) return NextResponse.json({ error: 'Question not found in this session.' }, { status: 404 })

    if (!isInterviewRecordingEnabled()) {
      return NextResponse.json({
        error: 'Recorded answers are not yet available. Please use Text Mode.',
        code: 'RECORDING_NOT_ENABLED',
      }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

    const filename = file instanceof File ? file.name : 'recording.webm'
    const buffer = Buffer.from(await file.arrayBuffer())
    const validation = validateAudioUpload(buffer, filename, file.type)
    if (!validation.valid || !validation.extension) {
      return NextResponse.json({ error: validation.error ?? 'Invalid audio file.' }, { status: 400 })
    }

    const { count: existingAttempts } = await supabase
      .from('interview_answers')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', questionId)
    const attemptNumber = (existingAttempts ?? 0) + 1

    const storagePath = buildAudioStoragePath(user.id, id, questionId, attemptNumber, validation.extension)
    const { error: uploadError } = await supabase.storage
      .from('interview-recordings')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError

    const { data: answer, error: answerError } = await supabase
      .from('interview_answers')
      .insert({
        user_id: user.id, session_id: id, question_id: questionId, attempt_number: attemptNumber,
        audio_storage_path: storagePath,
      })
      .select('*')
      .single()
    if (answerError) throw answerError

    if (!isInterviewAnalysisEnabled()) {
      return NextResponse.json({
        data: answer,
        message: 'Recording saved. Transcription will run once AI analysis is enabled for this account.',
      }, { status: 201 })
    }

    // Transcribe now, synchronously, so the client gets a real answer (or a real
    // failure) in this same response rather than polling for an async job. The
    // recording above is already durably saved regardless of what happens next.
    let transcript: string
    try {
      transcript = await transcribeAudio(buffer, CANONICAL_MIME_FOR_EXTENSION[validation.extension])
    } catch (err) {
      console.error('[interviews/sessions/[id]/answers/[questionId]/recording] transcription failed', err instanceof Error ? err.message : err)
      return NextResponse.json({
        data: answer,
        error: 'Your recording was saved, but transcription failed. Try recording again, or switch to Text Mode for this question.',
        code: 'TRANSCRIPTION_FAILED',
      }, { status: 502 })
    }

    const elapsedMs = 0 // precise start/end timing isn't derivable from the audio file alone; text-mode segments are similarly a coarse estimate, not exact
    const { data: segment, error: segmentError } = await supabase
      .from('interview_transcript_segments')
      .insert({
        user_id: user.id, session_id: id, question_id: questionId,
        speaker: 'candidate', start_ms: elapsedMs, end_ms: elapsedMs,
        content: transcript, source_mode: 'voice_recorded',
      })
      .select('id')
      .single()
    if (segmentError) throw segmentError

    const { data: updatedAnswer, error: updateError } = await supabase
      .from('interview_answers')
      .update({ answer_text: transcript, transcript_segment_ids: [segment.id] })
      .eq('id', answer.id)
      .select('*')
      .single()
    if (updateError) throw updateError

    await supabase.from('interview_questions').update({ answered_at: new Date().toISOString() }).eq('id', questionId)

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

    return NextResponse.json({ data: { answer: updatedAnswer, nextQuestion: nextQuestion ?? null } }, { status: 201 })
  } catch (err) {
    console.error('[interviews/sessions/[id]/answers/[questionId]/recording POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to upload recording.' }, { status: 500 })
  }
}
