import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/ai/rate-limit'
import { isInterviewAnalysisEnabled } from '@/lib/interviews/config'
import { runInterviewAnalysis } from '@/lib/interviews/analysis'
import { interviewAnalysisPrompt } from '@/lib/ai/prompts/interview-analysis'
import { computeInterviewScore } from '@/lib/interviews/scoring'
import { DIMENSION_REGISTRY } from '@/lib/interviews/rubrics'
import { assertWithinBudget, recordCostEvent, costFromTokens, RATES, BudgetExceededError } from '@/lib/interviews/budget'
import type { InterviewPlan, TranscriptSegment, SessionType, DimensionId } from '@/lib/interviews/schemas'
import { buildExchanges } from '@/lib/interviews/conversation'

/**
 * Runs (or, if isInterviewAnalysisEnabled() is false, honestly declines to run)
 * post-session analysis. Analysis itself calls OpenAI (gpt-5-mini by default - see
 * src/lib/interviews/analysis.ts and src/lib/ai/openai.ts), not Gemini; the gate flag
 * names in config.ts are Gemini-named for historical reasons but still apply as the
 * human attestation required before this feature runs for real. Live voice interviews
 * are a separate feature on Gemini (src/lib/interviews/gemini/live.ts) and are not
 * affected by this route. When disabled, this route marks the session
 * analysis_status='skipped' and tells the user truthfully that scored evaluation isn't
 * available yet, rather than fabricate a score or silently leave the session pending.
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

    const { data: session, error: fetchError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.status !== 'completed') {
      return NextResponse.json({ error: `Session is ${session.status}, not yet completed.`, code: 'INVALID_STATE' }, { status: 409 })
    }

    if (!isInterviewAnalysisEnabled()) {
      await supabase.from('interview_sessions').update({ analysis_status: 'skipped' }).eq('id', id)
      return NextResponse.json({
        data: { analysisAvailable: false },
        message: 'AI-powered evidence analysis is not yet enabled for Showcase Interview Lab. Your transcript and answers are saved and you can review them, but a scored evaluation is not available yet.',
      })
    }

    await supabase.from('interview_sessions').update({ analysis_status: 'running' }).eq('id', id)

    const [{ data: transcriptRows }, { data: questions }] = await Promise.all([
      supabase.from('interview_transcript_segments').select('*').eq('session_id', id).order('start_ms'),
      supabase.from('interview_questions').select('*').eq('session_id', id).order('order_index'),
    ])

    const transcript: TranscriptSegment[] = (transcriptRows ?? []).map((s) => ({
      id: s.id, speaker: s.speaker as 'interviewer' | 'candidate', startMs: s.start_ms, endMs: s.end_ms,
      content: s.content, sourceMode: s.source_mode as 'text' | 'voice_live' | 'voice_recorded',
    }))

    const plan = session.session_plan as InterviewPlan
    const sessionType = session.session_type as SessionType
    const dimensionIds = Object.keys(DIMENSION_REGISTRY).filter((d) =>
      DIMENSION_REGISTRY[d as DimensionId].appliesTo.includes(sessionType)
    ) as DimensionId[]

    let verifiedResumeEvidence: Record<string, unknown> = {}
    if (session.resume_id) {
      const { data: resume } = await supabase.from('resumes').select('parsed_json').eq('id', session.resume_id).eq('user_id', user.id).maybeSingle()
      verifiedResumeEvidence = (resume?.parsed_json as Record<string, unknown>) ?? {}
    }
    let verifiedPortfolioEvidence: Record<string, unknown> = {}
    if (session.portfolio_id) {
      const { data: projects } = await supabase.from('projects').select('title, summary, problem, process, outcome, metrics').eq('portfolio_id', session.portfolio_id).eq('user_id', user.id)
      verifiedPortfolioEvidence = { projects: projects ?? [] }
    }

    // Worst-case estimate (chars/4 ~ tokens) using the prompt spec's own declared
    // ceilings, so this stays correct automatically if those ceilings ever change.
    const worstCaseEstimateUsd = costFromTokens(
      interviewAnalysisPrompt.maxInputCharacters / 4,
      interviewAnalysisPrompt.maxOutputTokens,
      RATES.gpt5MiniInPerM, RATES.gpt5MiniOutPerM
    )

    let result
    try {
      await assertWithinBudget(user.id, worstCaseEstimateUsd, await isProUser(user.id))
      // Coaching must cover EVERY real answer. A live interview asks adaptive questions
      // that never match the planned list, so we anchor answerAssessments to the actual
      // conversation exchanges (keyed by interviewer segment id) instead of planned
      // questions. Fall back to planned questions only for older text sessions with no
      // reconstructable exchanges.
      // Cap the per-answer coaching at 16 exchanges: a long (30-min) interview can have 20+
      // exchanges, and one detailed coaching block each overflows the model's output budget
      // and fails the whole analysis. The dimension scores still reflect the FULL transcript;
      // only per-answer coaching is bounded. 16 covers the vast majority of sessions.
      const exchanges = buildExchanges(transcript).slice(0, 16)
      const assessable = exchanges.length > 0
        ? exchanges.map((e, i) => ({ id: e.id, questionText: e.question || 'Opening', orderIndex: i }))
        : (questions ?? []).map((q) => ({
            id: q.id as string,
            questionText: q.question_text as string,
            orderIndex: q.order_index as number,
          }))
      result = await runInterviewAnalysis({
        plan, transcript, verifiedResumeEvidence, verifiedPortfolioEvidence,
        targetJobRequirements: [], dimensionIds,
        questions: assessable,
      })
      await recordCostEvent({
        userId: user.id, sessionId: id, feature: 'analysis', provider: result.meta.provider, model: result.meta.model,
        costUsd: costFromTokens(result.meta.inputTokens, result.meta.outputTokens, RATES.gpt5MiniInPerM, RATES.gpt5MiniOutPerM),
        estimated: false,
      })
    } catch (err) {
      await supabase.from('interview_sessions').update({ analysis_status: 'failed' }).eq('id', id)
      if (err instanceof BudgetExceededError) {
        console.error('[interviews/analyze] budget exceeded', err.message)
        return NextResponse.json({ error: err.message, code: 'BUDGET_EXCEEDED' }, { status: 503 })
      }
      const m = err instanceof Error ? (err.message || String(err)) : String(err)
      console.error('[interviews/analyze] analysis failed', m, err)
      return NextResponse.json({ error: `Analysis failed: ${m}`, code: 'ANALYSIS_FAILED' }, { status: 502 })
    }

    let scoreResult
    try {
      scoreResult = computeInterviewScore(sessionType, result.data, transcript)
    } catch (err) {
      await supabase.from('interview_sessions').update({ analysis_status: 'failed' }).eq('id', id)
      const m = err instanceof Error ? (err.message || String(err)) : String(err)
      console.error('[interviews/analyze] scoring rejected the analysis', m, err)
      return NextResponse.json({ error: `Scoring failed: ${m}`, code: 'ANALYSIS_REJECTED' }, { status: 502 })
    }

    const { data: evaluation, error: evalError } = await supabase
      .from('interview_evaluations')
      .insert({
        user_id: user.id, session_id: id, prompt_id: 'interview-analysis', prompt_version: '1',
        provider: result.meta.provider, model: result.meta.model, rubric_id: session.rubric_id, rubric_version: session.rubric_version,
        overall_score: scoreResult.overallScore, readiness_band: scoreResult.readinessBand,
        result: result.data, analysis_cost_metadata: { latencyMs: result.meta.latencyMs },
      })
      .select('*')
      .single()
    if (evalError) throw evalError

    const dimensionRows = scoreResult.dimensions.map((d) => ({
      user_id: user.id, session_id: id, evaluation_id: evaluation.id,
      dimension_id: d.dimensionId, score: d.score, weight: d.weight,
      evidence_segment_ids: d.evidenceSegmentIds, explanation: d.explanation, confidence: d.confidence,
    }))
    if (dimensionRows.length > 0) {
      const { error: dimError } = await supabase.from('interview_dimension_scores').insert(dimensionRows)
      if (dimError) throw dimError
    }

    await supabase.from('interview_sessions').update({ analysis_status: 'completed' }).eq('id', id)
    void questions // referenced for future per-question evaluation linkage; not yet used beyond this build's session-level scoring

    return NextResponse.json({ data: { analysisAvailable: true, evaluation, dimensions: scoreResult.dimensions, model: result.meta.model } })
  } catch (err) {
    const msg = err instanceof Error ? (err.message || String(err)) : String(err)
    console.error('[interviews/sessions/[id]/analyze POST]', msg, err)
    // Mark failed so the results page shows a clear "retry" state instead of being stuck on
    // 'running' (which renders the confusing generic "not available" message). Best-effort.
    try {
      const { id } = await params
      const supabase = await createClient()
      await supabase.from('interview_sessions').update({ analysis_status: 'failed' }).eq('id', id)
    } catch { /* ignore */ }
    return NextResponse.json({ error: `Analysis failed: ${msg}`, code: 'ANALYSIS_ERROR' }, { status: 500 })
  }
}
