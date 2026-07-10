import { InterviewPlanSchema, type InterviewPlan, type InterviewPlanQuestion, type EvidenceSourceRef, type SessionType, type Difficulty } from './schemas.ts'
import { getQuestionsForSessionType, QUESTION_BANK_VERSION } from './question-bank/index.ts'
import { getRubricProfile } from './rubrics.ts'
import { filterUnsafeQuestions } from './question-safety.ts'
import { getMaxSessionMinutes } from './config.ts'

// Valid interview lengths, in minutes. Voice and text both use these.
export const DURATION_TIERS = [5, 10, 15, 20, 25, 30] as const
export type DurationMinutes = (typeof DURATION_TIERS)[number]

// Number of backbone topics to plan for a given length. The live interviewer treats
// these as topics to cover and layers adaptive follow-ups on top, so longer sessions
// get more ground to cover, not just more time on the same few questions.
export function primaryQuestionCount(durationMinutes: number): number {
  if (durationMinutes <= 5) return 3
  if (durationMinutes <= 10) return 5
  if (durationMinutes <= 15) return 7
  if (durationMinutes <= 20) return 9
  if (durationMinutes <= 25) return 11
  return 13
}

export interface PlanEvidenceInput {
  portfolioProjects?: { id: string; title: string }[]
  resumeExperience?: { id: string; company: string; role: string }[]
  storyBankEntries?: { id: string; title: string; competencies: string[] }[]
  jobRequirements?: string[]
}

export interface BuildPlanInput {
  sessionType: SessionType
  targetRole: string
  targetCompany: string | null
  difficulty: Difficulty
  durationMinutes: number
  evidence: PlanEvidenceInput
  deliveryMode?: 'voice' | 'text'
  /** Pre-generated questions from AI (question-gen.ts). When provided, skips the
   *  static bank lookup entirely and uses these instead. Safety filter still runs. */
  aiGeneratedQuestions?: InterviewPlanQuestion[]
  /** Written interviews are question-count driven, not time driven: when set, this is the
   *  exact number of primary questions the user chose (5-30), overriding the duration→count
   *  mapping. Still clamped by the tier's maxPrimaryQuestions ceiling. */
  questionCountOverride?: number
  /** Tier-derived hard ceilings (see entitlements/plans.ts). Omitted only by tests
   *  that don't go through the real session-creation route; every real caller must
   *  pass the caller's actual plan limits so Free/Pro question/follow-up counts are
   *  enforced where the plan is built, not just hoped for downstream. */
  planLimits?: { maxPrimaryQuestions: number; maxAdaptiveFollowUps: number; maxSessionMinutes: number }
}

function substitutePlaceholders(template: string, targetRole: string, targetCompany: string | null): string {
  return template
    .replaceAll('{{targetRole}}', targetRole)
    .replaceAll('{{targetCompany}}', targetCompany ?? 'this role')
}

/** Maps a question template's competency/sessionType to whatever evidence the server
 *  already has on file. This is what makes a question "traceable to its reason for
 *  inclusion" (mission requirement) - every question's sourceReferences points at real,
 *  already-verified data, never at something invented for the occasion. Portfolio
 *  walkthrough questions reference every listed project so a downstream consumer (the
 *  live interviewer prompt, or the results page) can show "this question relates to
 *  these projects" without re-deriving it. */
function buildSourceReferences(sessionType: SessionType, evidence: PlanEvidenceInput): EvidenceSourceRef[] {
  const refs: EvidenceSourceRef[] = []
  if (sessionType === 'portfolio_walkthrough' || sessionType === 'project_deep_dive') {
    for (const p of evidence.portfolioProjects ?? []) {
      refs.push({ sourceType: 'portfolio_project', sourceId: p.id, label: p.title })
    }
  }
  if (sessionType === 'job_specific_full_loop') {
    for (const req of evidence.jobRequirements ?? []) {
      refs.push({ sourceType: 'job_requirement', sourceId: req.slice(0, 40), label: req })
    }
  }
  for (const exp of evidence.resumeExperience ?? []) {
    refs.push({ sourceType: 'resume_experience', sourceId: exp.id, label: `${exp.role} at ${exp.company}` })
  }
  return refs.slice(0, 10)
}

/**
 * Builds the deterministic Interview Plan that governs a session before it starts.
 * This is server-authored end to end - no Gemini call happens here. Gemini may later
 * personalize question WORDING and propose follow-ups, but never touches session type,
 * competencies, question count, rubric, weights, or duration limits (mission's "Gemini
 * must not redefine" list); those are all fixed by this function and stored in
 * interview_sessions.session_plan before any live interaction begins.
 */
export function buildInterviewPlan(input: BuildPlanInput): InterviewPlan {
  // Fail closed with a clear message rather than letting NaN flow into question-count
  // selection or the final schema parse
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
    throw new Error(`durationMinutes must be a positive number (got ${input.durationMinutes})`)
  }

  const rubric = getRubricProfile(input.sessionType)
  const baseCount = input.questionCountOverride ?? primaryQuestionCount(input.durationMinutes)
  const targetCount = Math.min(baseCount, input.planLimits?.maxPrimaryQuestions ?? Infinity)

  // AI-generated path: use the pre-built questions, honour the target count ceiling
  const aiCandidates = (input.aiGeneratedQuestions ?? []).slice(0, targetCount)

  // Static bank pool - the primary source when no AI questions exist, and the top-up
  // source when the AI under-delivered or the safety filter dropped some. Previously
  // `slice(0, targetCount)` could only shrink the selection, so a 10-question request
  // silently produced a 6-question session once the bank (or the AI) ran short.
  const available = getQuestionsForSessionType(input.sessionType)
  if (aiCandidates.length === 0 && available.length === 0) {
    throw new Error(`No curated question templates exist yet for session type "${input.sessionType}" (question bank version ${QUESTION_BANK_VERSION})`)
  }
  const matching = available.filter((t) => t.difficulty === input.difficulty)
  const rest = available.filter((t) => t.difficulty !== input.difficulty)
  const bankCandidates: InterviewPlanQuestion[] = [...matching, ...rest].map((template, index) => ({
    templateId: template.id,
    orderIndex: index,
    questionText: substitutePlaceholders(
      (input.deliveryMode === 'voice' && template.voicePromptTemplate) ? template.voicePromptTemplate : template.promptTemplate,
      input.targetRole,
      input.targetCompany,
    ),
    competency: template.competency,
    difficulty: template.difficulty,
    selectionReason: template.difficulty === input.difficulty
      ? `Matches requested difficulty (${input.difficulty}) for ${input.sessionType.replace(/_/g, ' ')}`
      : `Filled from available bank - no more ${input.difficulty} templates for ${input.sessionType.replace(/_/g, ' ')}`,
    sourceReferences: buildSourceReferences(input.sessionType, input.evidence),
  }))

  // Defense in depth: every question - even from the already-vetted static bank - is
  // re-checked here, since this function is also the path Gemini-personalized wording
  // would flow through in a future iteration. A question failing this is dropped, not
  // shown with a warning; the mission's filter is "deterministic prohibited-question
  // filtering," not "best-effort."
  const { safeQuestions: safeAi, blocked: blockedAi } = filterUnsafeQuestions(aiCandidates)
  const { safeQuestions: safeBank, blocked: blockedBank } = filterUnsafeQuestions(bankCandidates)
  const blocked = [...blockedAi, ...blockedBank]
  if (blocked.length > 0) {
    console.error('[interviews/plan] blocked unsafe question(s) at plan-build time', blocked.map((b) => ({ templateId: b.question.templateId, category: b.result.category })))
  }

  // AI questions first, then top up from the bank until the requested count is met or
  // the combined pool is exhausted. Dedupe on question text so an AI question that
  // happens to mirror a bank template is never asked twice.
  const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim()
  const safeQuestions: InterviewPlanQuestion[] = [...safeAi]
  const seenTexts = new Set(safeQuestions.map((q) => normalizeText(q.questionText)))
  for (const q of safeBank) {
    if (safeQuestions.length >= targetCount) break
    const key = normalizeText(q.questionText)
    if (seenTexts.has(key)) continue
    seenTexts.add(key)
    safeQuestions.push(q)
  }
  if (safeQuestions.length === 0) {
    throw new Error('All candidate questions were blocked by the safety filter - cannot build a plan')
  }

  const tierCeilingMinutes = Math.min(getMaxSessionMinutes(), input.planLimits?.maxSessionMinutes ?? getMaxSessionMinutes())
  // Honour the requested length, clamped to the plan/global ceiling. A free user who
  // somehow requests 30 is capped to their 25-minute limit rather than rejected.
  const maxDurationSeconds = Math.min(tierCeilingMinutes, Math.max(5, input.durationMinutes)) * 60

  const plan: InterviewPlan = {
    sessionType: input.sessionType,
    targetRole: input.targetRole,
    targetCompany: input.targetCompany,
    competencies: [...new Set(safeQuestions.map((q) => q.competency))],
    questions: safeQuestions.map((q, i) => ({ ...q, orderIndex: i })),
    maxFollowUps: input.planLimits?.maxAdaptiveFollowUps ?? 2,
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    forbiddenTopics: ['age', 'race_ethnicity', 'religion', 'pregnancy_family_plans', 'marital_status', 'disability_medical', 'sexual_orientation', 'citizenship_beyond_work_authorization', 'genetic_information', 'political_union_status', 'salary_history'],
    maxDurationSeconds,
    // Record what the user asked for (pre-clamp) so a shortfall - questions.length
    // below this - is persisted and surfaceable, never silent.
    requestedQuestionCount: baseCount,
  }

  // Fail closed rather than store a malformed plan - this is the same discipline as
  // the analysis-output validation in scoring.ts, applied to the server's own output.
  return InterviewPlanSchema.parse(plan)
}
