import { InterviewPlanSchema, type InterviewPlan, type InterviewPlanQuestion, type EvidenceSourceRef, type SessionType, type Difficulty } from './schemas.ts'
import { getQuestionsForSessionType, QUESTION_BANK_VERSION } from './question-bank/index.ts'
import { getRubricProfile } from './rubrics.ts'
import { filterUnsafeQuestions } from './question-safety.ts'
import { getMaxSessionMinutes } from './config.ts'

export type SessionLength = 'quick' | 'standard' | 'full'

const QUESTION_COUNT_BY_LENGTH: Record<SessionLength, number> = { quick: 3, standard: 5, full: 8 }

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
  sessionLength: SessionLength
  evidence: PlanEvidenceInput
  deliveryMode?: 'voice' | 'text'
  /** Pre-generated questions from AI (question-gen.ts). When provided, skips the
   *  static bank lookup entirely and uses these instead. Safety filter still runs. */
  aiGeneratedQuestions?: InterviewPlanQuestion[]
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
 *  inclusion" (mission requirement) — every question's sourceReferences points at real,
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
 * This is server-authored end to end — no Gemini call happens here. Gemini may later
 * personalize question WORDING and propose follow-ups, but never touches session type,
 * competencies, question count, rubric, weights, or duration limits (mission's "Gemini
 * must not redefine" list); those are all fixed by this function and stored in
 * interview_sessions.session_plan before any live interaction begins.
 */
export function buildInterviewPlan(input: BuildPlanInput): InterviewPlan {
  const rubric = getRubricProfile(input.sessionType)
  const targetCount = Math.min(QUESTION_COUNT_BY_LENGTH[input.sessionLength], input.planLimits?.maxPrimaryQuestions ?? Infinity)

  let candidateQuestions: InterviewPlanQuestion[]

  if (input.aiGeneratedQuestions && input.aiGeneratedQuestions.length > 0) {
    // AI-generated path: use the pre-built questions, honour the target count ceiling
    candidateQuestions = input.aiGeneratedQuestions.slice(0, targetCount)
  } else {
    // Static bank fallback
    const available = getQuestionsForSessionType(input.sessionType)
    if (available.length === 0) {
      throw new Error(`No curated question templates exist yet for session type "${input.sessionType}" (question bank version ${QUESTION_BANK_VERSION})`)
    }
    const matching = available.filter((t) => t.difficulty === input.difficulty)
    const rest = available.filter((t) => t.difficulty !== input.difficulty)
    const selected = [...matching, ...rest].slice(0, targetCount)
    candidateQuestions = selected.map((template, index) => ({
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
        : `Filled from available bank — no more ${input.difficulty} templates for ${input.sessionType.replace(/_/g, ' ')}`,
      sourceReferences: buildSourceReferences(input.sessionType, input.evidence),
    }))
  }

  // Defense in depth: every question — even from the already-vetted static bank — is
  // re-checked here, since this function is also the path Gemini-personalized wording
  // would flow through in a future iteration. A question failing this is dropped, not
  // shown with a warning; the mission's filter is "deterministic prohibited-question
  // filtering," not "best-effort."
  const { safeQuestions, blocked } = filterUnsafeQuestions(candidateQuestions)
  if (blocked.length > 0) {
    console.error('[interviews/plan] blocked unsafe question(s) at plan-build time', blocked.map((b) => ({ templateId: b.question.templateId, category: b.result.category })))
  }
  if (safeQuestions.length === 0) {
    throw new Error('All candidate questions were blocked by the safety filter — cannot build a plan')
  }

  const tierCeilingMinutes = Math.min(getMaxSessionMinutes(), input.planLimits?.maxSessionMinutes ?? getMaxSessionMinutes())
  const maxDurationSeconds = Math.min(
    tierCeilingMinutes * 60,
    input.sessionLength === 'quick' ? 7 * 60 : input.sessionLength === 'standard' ? 15 * 60 : tierCeilingMinutes * 60
  )

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
  }

  // Fail closed rather than store a malformed plan — this is the same discipline as
  // the analysis-output validation in scoring.ts, applied to the server's own output.
  return InterviewPlanSchema.parse(plan)
}
