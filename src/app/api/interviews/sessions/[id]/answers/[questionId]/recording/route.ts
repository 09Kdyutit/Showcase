import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isInterviewRecordingEnabled } from '@/lib/interviews/config'
import { validateAudioUpload, buildAudioStoragePath } from '@/lib/interviews/audio-validation'

/**
 * Recorded Mode answer upload. Gated on isInterviewRecordingEnabled() — false in
 * every environment today (see config.ts), so this route fails closed before ever
 * touching storage, exactly mirroring how /api/interviews/sessions/[id]/live-token
 * proves its own gate by running every other check first. The validation and storage
 * path below are real and fully wired so that opening the gate later requires no new
 * security plumbing — only flipping the flag once recording is actually approved for
 * real use.
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
    // feature gate — same ordering as live-token's "every check the mission requires
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
      .select('id')
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
      .select('id, audio_storage_path, attempt_number')
      .single()
    if (answerError) throw answerError

    // Transcription itself requires the Gemini analysis gate, which is also off in
    // every environment today (isInterviewAnalysisEnabled()) — this route stores the
    // validated recording and stops there. No fabricated transcript is ever created.
    return NextResponse.json({
      data: answer,
      message: 'Recording saved. Transcription will run once AI analysis is enabled for this account.',
    }, { status: 201 })
  } catch (err) {
    console.error('[interviews/sessions/[id]/answers/[questionId]/recording POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to upload recording.' }, { status: 500 })
  }
}
