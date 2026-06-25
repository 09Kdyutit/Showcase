import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildInterviewPlan, type SessionLength } from '@/lib/interviews/plan'
import { isInterviewLiveEnabled } from '@/lib/interviews/config'
import { SESSION_TYPES, DELIVERY_MODES, COACHING_MODES, DIFFICULTIES } from '@/lib/interviews/schemas'
import { resolvePlanContext, reserveSessionUsage, getPlanLimits, isSessionTypeAllowed, EntitlementError, attachSessionToReservations } from '@/lib/interviews/entitlements'
import { z } from 'zod'

const createSchema = z.object({
  sessionType: z.enum(SESSION_TYPES),
  deliveryMode: z.enum(DELIVERY_MODES),
  coachingMode: z.enum(COACHING_MODES),
  difficulty: z.enum(DIFFICULTIES).default('standard'),
  sessionLength: z.enum(['quick', 'standard', 'full']).default('standard'),
  targetRole: z.string().min(1).max(200),
  targetCompany: z.string().max(200).nullable().optional(),
  savedJobId: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
  portfolioId: z.string().uuid().optional(),
  selectedProjectIds: z.array(z.string().uuid()).max(10).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const input = parsed.data

    // Voice mode requires the Live-voice Gemini gate. Previously this unconditionally
    // 403'd regardless of the flag's actual value — a real bug that would have kept
    // rejecting voice sessions even after isInterviewLiveEnabled() was flipped on.
    if (input.deliveryMode === 'voice' && !isInterviewLiveEnabled()) {
      return NextResponse.json({
        error: 'Voice interviews are not yet available. Please use Text Mode.',
        code: 'VOICE_NOT_ENABLED',
      }, { status: 403 })
    }

    // Age eligibility is intentionally NOT checked at creation time — the product
    // flow is New Interview (configure) -> Lobby (privacy notice) -> Start, and the
    // Lobby only exists after a session is created. /start is the real downstream
    // gate — see sessions/[id]/start/route.ts. (No age-eligibility check exists
    // there either: the account owner explicitly removed Interview Lab's age gate in
    // migration 019 and reconfirmed that decision when this entitlements system was
    // built — see security/release-gate.json IL-10.)

    const serviceSupabase = await createServiceClient()
    const { tier } = await resolvePlanContext(supabase, user.id)
    const limits = getPlanLimits(tier)

    // Server-authoritative plan/tier gates — the browser's request body is never
    // trusted for any of these, only re-derived facts (subscription status) decide.
    if (!isSessionTypeAllowed(tier, input.sessionType)) {
      return NextResponse.json({ error: `${input.sessionType.replace(/_/g, ' ')} requires Pro.`, code: 'SESSION_TYPE_REQUIRES_PRO' }, { status: 403 })
    }
    if (!(limits.difficulties as readonly string[]).includes(input.difficulty)) {
      return NextResponse.json({ error: `${input.difficulty} difficulty requires Pro.`, code: 'DIFFICULTY_REQUIRES_PRO' }, { status: 403 })
    }
    if (!(limits.coachingModes as readonly string[]).includes(input.coachingMode)) {
      return NextResponse.json({ error: `${input.coachingMode} coaching mode requires Pro.`, code: 'COACHING_MODE_REQUIRES_PRO' }, { status: 403 })
    }
    if (tier === 'free' && input.sessionLength === 'full') {
      return NextResponse.json({ error: 'Full-length sessions require Pro. Try Quick or Standard.', code: 'QUESTION_COUNT_EXCEEDS_PLAN' }, { status: 403 })
    }

    // Atomic, race-proof, fail-closed reservation against the real ledger — see
    // src/lib/interviews/entitlements/. Reserved BEFORE the session row exists (using
    // a null session_id, attached right after insert below) so a denied reservation
    // never leaves an orphaned session row behind.
    let reservation
    try {
      reservation = await reserveSessionUsage(serviceSupabase, user.id, null, input.deliveryMode !== 'text')
    } catch (e) {
      if (e instanceof EntitlementError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus })
      throw e
    }

    // ── Gather real, already-verified evidence (never invented) ──────────────
    // A resumeId/portfolioId that doesn't exist or doesn't belong to this user is
    // treated as "none provided," not an error — silently dropping an invalid/foreign
    // ID here is what prevents both a 500 (interview_sessions.resume_id has a real FK
    // constraint, which a nonexistent ID would violate at insert time) and any
    // possibility of the insert succeeding with a foreign owner's ID attached.
    let verifiedResumeId: string | null = null
    let resumeExperience: { id: string; company: string; role: string }[] = []
    if (input.resumeId) {
      const { data: resume } = await supabase
        .from('resumes')
        .select('id, parsed_json')
        .eq('id', input.resumeId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (resume) {
        verifiedResumeId = resume.id
        const parsedExperience = (resume.parsed_json as { experience?: { company?: string; role?: string }[] } | null)?.experience ?? []
        resumeExperience = parsedExperience
          .filter((e) => e.company && e.role)
          .map((e, i) => ({ id: `${resume.id}-exp-${i}`, company: e.company!, role: e.role! }))
      }
    }

    let verifiedPortfolioId: string | null = null
    let portfolioProjects: { id: string; title: string }[] = []
    if (input.portfolioId) {
      const { data: portfolio } = await supabase.from('portfolios').select('id').eq('id', input.portfolioId).eq('user_id', user.id).maybeSingle()
      if (portfolio) {
        verifiedPortfolioId = portfolio.id
        let query = supabase.from('projects').select('id, title').eq('user_id', user.id).eq('portfolio_id', portfolio.id)
        if (input.selectedProjectIds?.length) query = query.in('id', input.selectedProjectIds)
        const { data: projects } = await query.limit(10)
        portfolioProjects = (projects ?? []).map((p) => ({ id: p.id, title: p.title }))
      }
    }

    let verifiedSavedJobId: string | null = null
    if (input.savedJobId) {
      const { data: savedJob } = await supabase.from('saved_jobs').select('id').eq('id', input.savedJobId).eq('user_id', user.id).maybeSingle()
      if (savedJob) verifiedSavedJobId = savedJob.id
    }

    const plan = buildInterviewPlan({
      sessionType: input.sessionType,
      targetRole: input.targetRole,
      targetCompany: input.targetCompany ?? null,
      difficulty: input.difficulty,
      sessionLength: input.sessionLength as SessionLength,
      deliveryMode: input.deliveryMode,
      evidence: { resumeExperience, portfolioProjects },
      planLimits: { maxPrimaryQuestions: limits.maxPrimaryQuestions, maxAdaptiveFollowUps: limits.maxAdaptiveFollowUps, maxSessionMinutes: limits.maxSessionMinutes },
    })

    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: user.id,
        saved_job_id: verifiedSavedJobId,
        resume_id: verifiedResumeId,
        portfolio_id: verifiedPortfolioId,
        session_type: input.sessionType,
        delivery_mode: input.deliveryMode,
        coaching_mode: input.coachingMode,
        difficulty: input.difficulty,
        target_role: input.targetRole,
        target_company: input.targetCompany ?? null,
        session_plan: plan,
        rubric_id: plan.rubricId,
        rubric_version: plan.rubricVersion,
        planned_question_count: plan.questions.length,
        max_follow_ups: plan.maxFollowUps,
        max_duration_seconds: plan.maxDurationSeconds,
        status: 'planned',
      })
      .select('*')
      .single()
    if (sessionError) {
      // The reservation already succeeded — release it so a session that was never
      // actually created doesn't permanently consume a real, scarce quota slot.
      const idsToRelease = [reservation.sessionReservationId, ...(reservation.audioReservationId ? [reservation.audioReservationId] : [])]
      for (const id of idsToRelease) await serviceSupabase.rpc('interview_release_usage', { p_reservation_id: id, p_user_id: user.id })
      throw sessionError
    }

    await attachSessionToReservations(
      serviceSupabase,
      [reservation.sessionReservationId, ...(reservation.audioReservationId ? [reservation.audioReservationId] : [])],
      session.id, user.id,
    )

    const questionRows = plan.questions.map((q) => ({
      user_id: user.id,
      session_id: session.id,
      template_id: q.templateId,
      order_index: q.orderIndex,
      question_text: q.questionText,
      competency: q.competency,
      difficulty: q.difficulty,
      selection_reason: q.selectionReason,
      source_references: q.sourceReferences,
    }))
    const { error: questionsError } = await supabase.from('interview_questions').insert(questionRows)
    if (questionsError) throw questionsError

    return NextResponse.json({ data: session }, { status: 201 })
  } catch (err) {
    console.error('[interviews/sessions POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to create interview session. Please try again.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('interview_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[interviews/sessions GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load interview sessions.' }, { status: 500 })
  }
}
