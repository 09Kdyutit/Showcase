import { z } from 'zod'

// Mirrors the `check` constraint on interview_sessions.session_type in migration 017  - 
// keep these two lists in sync by hand; there is no single source both Postgres and
// TypeScript read from in this codebase's current migration tooling.
export const SESSION_TYPES = [
  'recruiter_screen', 'behavioral', 'hiring_manager', 'portfolio_walkthrough',
  'project_deep_dive', 'technical_concept', 'case_problem_solving',
  'presentation_defense', 'job_specific_full_loop', 'rapid_fire_drill',
] as const
export type SessionType = (typeof SESSION_TYPES)[number]

export const DELIVERY_MODES = ['text', 'voice'] as const
export type DeliveryMode = (typeof DELIVERY_MODES)[number]

export const COACHING_MODES = ['guided', 'realistic'] as const
export type CoachingMode = (typeof COACHING_MODES)[number]

export const DIFFICULTIES = ['foundational', 'standard', 'challenging'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const INTERVIEWER_STYLES = ['warm', 'neutral', 'direct'] as const
export type InterviewerStyle = (typeof INTERVIEWER_STYLES)[number]

export const READINESS_BANDS = ['starting', 'building', 'practicing', 'interview_ready', 'strong'] as const
export type ReadinessBand = (typeof READINESS_BANDS)[number]

// Mirrors src/lib/interviews/rubrics.ts's DIMENSION_REGISTRY keys. Defined here (not
// derived from the registry) so this schema file has no import dependency on the
// rubric module  -  the rubric module imports DimensionId from here instead.
export const DIMENSION_IDS = [
  'answer_relevance', 'evidence_specificity', 'context_clarity', 'personal_ownership',
  'action_quality', 'outcome_and_impact', 'answer_structure', 'role_technical_depth',
  'problem_solving_process', 'follow_up_handling', 'concision', 'delivery_mechanics',
] as const
export type DimensionId = (typeof DIMENSION_IDS)[number]

// ── InterviewPlan ─────────────────────────────────────────────────────────────
// Server-authored, deterministic. Gemini never generates this  -  it personalizes
// question wording and asks follow-ups WITHIN the bounds this plan sets, but cannot
// redefine session type, dimensions, weights, limits, or evidence sources (mission's
// explicit "Gemini must not redefine" list).

export const EvidenceSourceRefSchema = z.object({
  sourceType: z.enum(['resume_experience', 'resume_skill', 'portfolio_project', 'story_bank', 'job_requirement', 'tailored_interview_brief']),
  sourceId: z.string(),
  label: z.string().max(200),
})
export type EvidenceSourceRef = z.infer<typeof EvidenceSourceRefSchema>

export const InterviewPlanQuestionSchema = z.object({
  templateId: z.string().nullable(),
  orderIndex: z.number().int().min(0),
  questionText: z.string().min(10).max(2000),
  competency: z.string().min(1).max(100),
  difficulty: z.enum(DIFFICULTIES),
  selectionReason: z.string().min(5).max(500),
  sourceReferences: z.array(EvidenceSourceRefSchema).max(10),
})
export type InterviewPlanQuestion = z.infer<typeof InterviewPlanQuestionSchema>

export const InterviewPlanSchema = z.object({
  sessionType: z.enum(SESSION_TYPES),
  targetRole: z.string().min(1).max(200),
  targetCompany: z.string().max(200).nullable(),
  competencies: z.array(z.string()).min(1).max(12),
  questions: z.array(InterviewPlanQuestionSchema).min(1).max(20),
  maxFollowUps: z.number().int().min(0).max(5),
  rubricId: z.string(),
  rubricVersion: z.string(),
  forbiddenTopics: z.array(z.string()),
  maxDurationSeconds: z.number().int().min(60).max(3600),
})
export type InterviewPlan = z.infer<typeof InterviewPlanSchema>

// ── AdaptiveFollowUp ───────────────────────────────────────────────────────────
// Gemini may propose ONE of these per triggering answer; the server enforces
// maxFollowUps and rejects triggers outside this fixed list (mission: "do not let
// follow-ups drift into unrelated personal information").
export const FOLLOW_UP_TRIGGERS = [
  'missing_specificity', 'unclear_ownership', 'absent_outcome', 'unexplained_tradeoff',
  'contradiction', 'unsupported_claim', 'incomplete_technical_reasoning',
] as const

export const AdaptiveFollowUpSchema = z.object({
  triggerReason: z.enum(FOLLOW_UP_TRIGGERS),
  sourceAnswerSegmentIds: z.array(z.string()).min(1).max(10),
  followUpQuestion: z.string().min(10).max(500),
  competency: z.string().min(1).max(100),
})
export type AdaptiveFollowUp = z.infer<typeof AdaptiveFollowUpSchema>

// ── TranscriptSegment ──────────────────────────────────────────────────────────
export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  speaker: z.enum(['interviewer', 'candidate']),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  content: z.string().min(1).max(10000),
  sourceMode: z.enum(['text', 'voice_live', 'voice_recorded']),
})
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>

// ── Gemini analysis output ────────────────────────────────────────────────────
// Gemini returns BOUNDED EVIDENCE ASSESSMENTS, never a final score (mission: "Gemini
// may not assign the final score directly... the server computes final scores
// deterministically"). The server validates every citation against real segment IDs
// before trusting any of this  -  see src/lib/interviews/scoring.ts.

export const AnswerEvidenceAssessmentSchema = z.object({
  questionId: z.string(),
  citedSegmentIds: z.array(z.string()).max(20),
  strongMoments: z.array(z.object({ segmentId: z.string(), note: z.string().max(500) })).max(10),
  weakMoments: z.array(z.object({ segmentId: z.string().nullable(), note: z.string().max(500) })).max(10),
  missingEvidence: z.array(z.string().max(300)).max(10),
  suggestedStructure: z.string().max(1000).nullable(),
})
export type AnswerEvidenceAssessment = z.infer<typeof AnswerEvidenceAssessmentSchema>

export const InterviewDimensionAssessmentSchema = z.object({
  dimensionId: z.enum(DIMENSION_IDS),
  // Gemini's RAW bounded rating (0-100)  -  this is evidence for the server's weighted
  // calculation, not the dimension's stored final score. The server still validates
  // range and citations; "bounded" refers to the 0-100 clamp plus the requirement
  // that every claim cite a real segment, not to any additional softening.
  ratingEvidence: z.number().int().min(0).max(100),
  citedSegmentIds: z.array(z.string()).min(0).max(20),
  explanation: z.string().min(10).max(1000),
  missingEvidence: z.array(z.string().max(300)).max(10),
  confidence: z.enum(['low', 'medium', 'high']),
})
export type InterviewDimensionAssessment = z.infer<typeof InterviewDimensionAssessmentSchema>

export const InterviewAnalysisSchema = z.object({
  summaryParagraph: z.string().min(40).max(2000),
  answerAssessments: z.array(AnswerEvidenceAssessmentSchema).max(30),
  dimensionAssessments: z.array(InterviewDimensionAssessmentSchema).min(1).max(DIMENSION_IDS.length),
  topFixes: z.array(z.string().max(500)).min(1).max(5),
  strengths: z.array(z.string().max(500)).max(5),
})
export type InterviewAnalysis = z.infer<typeof InterviewAnalysisSchema>

// ── Server-computed outputs (never produced directly by Gemini) ──────────────

export const InterviewReadinessSummarySchema = z.object({
  targetRole: z.string(),
  sessionType: z.enum(SESSION_TYPES).nullable(),
  score: z.number().int().min(0).max(100),
  band: z.enum(READINESS_BANDS),
  sessionCount: z.number().int().min(0),
  sampleLabel: z.string(),
  trend: z.enum(['up', 'down', 'flat', 'insufficient_data']),
  strongestDimension: z.string().nullable(),
  priorityDimension: z.string().nullable(),
})
export type InterviewReadinessSummary = z.infer<typeof InterviewReadinessSummarySchema>

export const AnswerRetryComparisonSchema = z.object({
  questionId: z.string(),
  originalAttempt: z.number().int(),
  retryAttempt: z.number().int(),
  scoreDelta: z.number().int().nullable(),
  evidenceAdded: z.array(z.string()),
  remainingWeakness: z.array(z.string()),
  improved: z.boolean(),
})
export type AnswerRetryComparison = z.infer<typeof AnswerRetryComparisonSchema>

export const StoryBankSuggestionSchema = z.object({
  title: z.string().min(1).max(200),
  competencies: z.array(z.string()).min(1).max(10),
  situation: z.string().max(1000).nullable(),
  task: z.string().max(1000).nullable(),
  actions: z.array(z.string().max(500)).max(10),
  outcome: z.string().max(1000).nullable(),
  reflection: z.string().max(1000).nullable(),
  // Every metric must trace to a real source the server already verified  -  Gemini
  // cannot invent a number that doesn't appear in the cited source material.
  verifiedMetrics: z.array(z.object({ metric: z.string().max(200), sourceSegmentId: z.string().nullable() })).max(10),
})
export type StoryBankSuggestion = z.infer<typeof StoryBankSuggestionSchema>

export const DrillRecommendationSchema = z.object({
  drillType: z.string(),
  competency: z.string(),
  reason: z.string().max(300),
  priority: z.number().int().min(1).max(3),
})
export type DrillRecommendation = z.infer<typeof DrillRecommendationSchema>
