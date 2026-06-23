import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/ai/rate-limit'
import { PostgresRateLimiter } from '@/lib/rate-limit/postgres'
import { buildInterviewPlan, type SessionLength } from '@/lib/interviews/plan'
import { SESSION_TYPES, DELIVERY_MODES, COACHING_MODES, DIFFICULTIES } from '@/lib/interviews/schemas'
import { z } from 'zod'

const SECONDS_PER_30_DAYS = 30 * 24 * 60 * 60
const sessionCreateLimiter = new PostgresRateLimiter()

// Only the three session types this build has a curated question bank for. Expanding
// this list is mechanical (add templates to question-bank/index.ts) but should not be
// silently implied as "supported" until the templates actually exist — buildInterviewPlan
// throws for any other type, and this allowlist gives that a clean 400 instead of a 500.
const IMPLEMENTED_SESSION_TYPES = ['recruiter_screen', 'behavioral', 'portfolio_walkthrough'] as const

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

const FREE_SESSIONS_PER_MONTH = 1
const PRO_SESSIONS_PER_MONTH = 30 // generous; the real cost-bearing constraint is Gemini analysis, gated off entirely in this build

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

    if (!(IMPLEMENTED_SESSION_TYPES as readonly string[]).includes(input.sessionType)) {
      return NextResponse.json({
        error: `Session type "${input.sessionType}" does not have curated questions yet in this build. Available: ${IMPLEMENTED_SESSION_TYPES.join(', ')}.`,
        code: 'SESSION_TYPE_NOT_IMPLEMENTED',
      }, { status: 400 })
    }

    // Voice mode requires the Live-voice Gemini gate, which is off in every environment
    // today (see src/lib/interviews/config.ts) — fail closed with a clear message
    // rather than create a session the user can never actually start in voice mode.
    if (input.deliveryMode === 'voice') {
      return NextResponse.json({
        error: 'Voice interviews are not yet available. Please use Text Mode.',
        code: 'VOICE_NOT_ENABLED',
      }, { status: 403 })
    }

    const { data: profile } = await supabase
      .from('interview_profiles')
      .select('age_eligibility_confirmed')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile?.age_eligibility_confirmed) {
      return NextResponse.json({
        error: 'Please confirm you are 18 or older before starting an interview.',
        code: 'AGE_CONFIRMATION_REQUIRED',
      }, { status: 403 })
    }

    const isPro = await isProUser(user.id)
    const monthlyLimit = isPro ? PRO_SESSIONS_PER_MONTH : FREE_SESSIONS_PER_MONTH

    // Atomic, race-proof check via the same Postgres rate_limit_increment() RPC that
    // backs the non-AI rate limiter — a non-atomic SELECT-COUNT-then-INSERT here would
    // be exactly the class of bug already found and fixed once this session in the AI
    // quota path (10 parallel requests all reading the same pre-insert count). A
    // 30-day rolling window is an honest approximation of "per month," not perfectly
    // calendar-aligned, but atomic, which matters more for correctness here.
    const rl = await sessionCreateLimiter.check(`interview:session:${user.id}`, monthlyLimit, SECONDS_PER_30_DAYS)
    if (!rl.allowed) {
      return NextResponse.json({
        error: `You've used your ${monthlyLimit} interview session${monthlyLimit === 1 ? '' : 's'} for this period. ${isPro ? 'Try again later.' : 'Upgrade to Pro for more sessions.'}`,
        code: 'PRO_REQUIRED',
      }, { status: 403 })
    }

    // ── Gather real, already-verified evidence (never invented) ──────────────
    let resumeExperience: { id: string; company: string; role: string }[] = []
    if (input.resumeId) {
      const { data: resume } = await supabase
        .from('resumes')
        .select('id, parsed_json')
        .eq('id', input.resumeId)
        .eq('user_id', user.id)
        .maybeSingle()
      const parsedExperience = (resume?.parsed_json as { experience?: { company?: string; role?: string }[] } | null)?.experience ?? []
      resumeExperience = parsedExperience
        .filter((e) => e.company && e.role)
        .map((e, i) => ({ id: `${input.resumeId}-exp-${i}`, company: e.company!, role: e.role! }))
    }

    let portfolioProjects: { id: string; title: string }[] = []
    if (input.portfolioId) {
      let query = supabase.from('projects').select('id, title').eq('user_id', user.id).eq('portfolio_id', input.portfolioId)
      if (input.selectedProjectIds?.length) query = query.in('id', input.selectedProjectIds)
      const { data: projects } = await query.limit(10)
      portfolioProjects = (projects ?? []).map((p) => ({ id: p.id, title: p.title }))
    }

    const plan = buildInterviewPlan({
      sessionType: input.sessionType,
      targetRole: input.targetRole,
      targetCompany: input.targetCompany ?? null,
      difficulty: input.difficulty,
      sessionLength: input.sessionLength as SessionLength,
      evidence: { resumeExperience, portfolioProjects },
    })

    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: user.id,
        saved_job_id: input.savedJobId ?? null,
        resume_id: input.resumeId ?? null,
        portfolio_id: input.portfolioId ?? null,
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
    if (sessionError) throw sessionError

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
