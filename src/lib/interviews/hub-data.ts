import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeReadinessGroups, pickPrimaryReadinessGroup, type ReadinessGroup, type ReadinessInputSession } from './readiness.ts'
import { computeEvidenceCoverage, type EvidenceCoverageSummary } from './evidence-coverage.ts'
import { computeNextActions, type RecommendedAction } from './recommendations.ts'
import { recommendDrillsForDimensions, type DrillDefinition } from './drills.ts'
import type { CanonicalCompetency } from './competencies.ts'
import { isInterviewLiveEnabled } from './config.ts'
import { isProUser } from '../ai/rate-limit.ts'
import { getUsageSnapshot, type UsageSnapshot } from './entitlements/index.ts'
import type { SessionType } from './schemas.ts'

export interface HubSessionSummary {
  id: string
  sessionType: SessionType
  targetRole: string
  targetCompany: string | null
  deliveryMode: 'text' | 'voice'
  status: string
  analysisStatus: string
  createdAt: string
  completedAt: string | null
  overallScore: number | null
  strongestDimensionLabel: string | null
  priorityDimensionLabel: string | null
}

export interface HubSelectedJob {
  savedJobId: string
  targetRole: string
  targetCompany: string | null
}

export interface HubData {
  isNewUser: boolean
  displayName: string
  hasResume: boolean
  hasPortfolio: boolean
  inProgressSession: HubSessionSummary | null
  pendingAnalysisSession: HubSessionSummary | null
  failedAnalysisSession: HubSessionSummary | null
  readinessGroups: ReadinessGroup[]
  primaryReadiness: ReadinessGroup | null
  nextActions: RecommendedAction[]
  evidenceCoverage: EvidenceCoverageSummary
  recommendedDrills: DrillDefinition[]
  recentSessions: HubSessionSummary[]
  selectedJob: HubSelectedJob | null
  storyCount: number
  isPro: boolean
  usage: UsageSnapshot
  liveVoiceAvailable: boolean
  privacy: { transcriptRetentionDays: number; rawAudioRetentionEnabled: boolean }
}

function dimensionLabel(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function loadHubData(supabase: SupabaseClient, userId: string, displayName: string): Promise<HubData> {
  const [
    sessionsRes, evaluationsRes, storyBankRes, drillsRes, jobsRes, profileRes, proStatus, resumeCountRes, portfolioCountRes, usage,
  ] = await Promise.all([
    supabase.from('interview_sessions')
      .select('id, session_type, target_role, target_company, delivery_mode, coaching_mode, status, analysis_status, created_at, completed_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    supabase.from('interview_evaluations')
      .select('id, session_id, overall_score, rubric_version, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
    supabase.from('interview_story_bank')
      .select('id, title, competencies, outcome, verified_metrics, resume_source_id, project_source_id, last_practiced_at')
      .eq('user_id', userId),
    supabase.from('interview_drills')
      .select('drill_type, competency, status, best_score')
      .eq('user_id', userId).eq('status', 'recommended').order('created_at', { ascending: false }).limit(5),
    supabase.from('saved_jobs')
      .select('id, imported_title, imported_company, job_listing_id, job_listings_cache(title, company)')
      .eq('user_id', userId).not('status', 'in', '(archived,rejected,withdrawn)')
      .order('created_at', { ascending: false }).limit(1),
    supabase.from('interview_profiles')
      .select('raw_audio_retention_enabled, transcript_retention_days')
      .eq('user_id', userId).maybeSingle(),
    isProUser(userId),
    supabase.from('resumes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('portfolios').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    getUsageSnapshot(supabase, userId),
  ])

  const sessions = sessionsRes.data ?? []
  const evaluations = evaluationsRes.data ?? []
  const storyBank = storyBankRes.data ?? []
  const overdueDrillRows = drillsRes.data ?? []

  const evaluationsBySession = new Map(evaluations.map((e) => [e.session_id, e]))
  const evaluationIds = evaluations.map((e) => e.id)
  const { data: dimensionScores } = evaluationIds.length > 0
    ? await supabase.from('interview_dimension_scores').select('session_id, evaluation_id, answer_id, dimension_id, score').eq('user_id', userId).in('evaluation_id', evaluationIds)
    : { data: [] }
  const dimensionsBySession = new Map<string, { dimensionId: string; score: number }[]>()
  for (const d of dimensionScores ?? []) {
    dimensionsBySession.set(d.session_id, [...(dimensionsBySession.get(d.session_id) ?? []), { dimensionId: d.dimension_id, score: d.score }])
  }

  function toSummary(s: typeof sessions[number]): HubSessionSummary {
    const evaluation = evaluationsBySession.get(s.id)
    const dims = dimensionsBySession.get(s.id) ?? []
    const ranked = [...dims].sort((a, b) => b.score - a.score)
    return {
      id: s.id, sessionType: s.session_type, targetRole: s.target_role, targetCompany: s.target_company,
      deliveryMode: s.delivery_mode, status: s.status, analysisStatus: s.analysis_status,
      createdAt: s.created_at, completedAt: s.completed_at,
      overallScore: evaluation?.overall_score ?? null,
      strongestDimensionLabel: ranked[0] ? dimensionLabel(ranked[0].dimensionId) : null,
      priorityDimensionLabel: ranked[ranked.length - 1] ? dimensionLabel(ranked[ranked.length - 1].dimensionId) : null,
    }
  }

  const inProgressRow = sessions.find((s) => s.status === 'in_progress' || s.status === 'planned')
  const pendingAnalysisRow = sessions.find((s) => s.status === 'completed' && (s.analysis_status === 'pending' || s.analysis_status === 'running'))
  const failedAnalysisRow = sessions.find((s) => s.status === 'completed' && s.analysis_status === 'failed')
  const completedRows = sessions.filter((s) => s.status === 'completed')

  const readinessInputs: ReadinessInputSession[] = completedRows
    .filter((s) => evaluationsBySession.has(s.id))
    .map((s) => {
      const evaluation = evaluationsBySession.get(s.id)!
      return {
        sessionId: s.id, targetRole: s.target_role, sessionType: s.session_type, coachingMode: s.coaching_mode,
        completedAt: s.completed_at ?? s.created_at,
        evaluation: { overallScore: evaluation.overall_score, rubricVersion: evaluation.rubric_version, createdAt: evaluation.created_at },
        dimensionScores: (dimensionsBySession.get(s.id) ?? []).map((d) => ({ dimensionId: d.dimensionId as ReadinessInputSession['dimensionScores'][number]['dimensionId'], score: d.score })),
      }
    })

  const readinessGroups = computeReadinessGroups(readinessInputs)
  const preferredRole = inProgressRow?.target_role ?? completedRows[0]?.target_role ?? null
  const primaryReadiness = pickPrimaryReadinessGroup(readinessGroups, preferredRole)

  const evidenceCoverage = computeEvidenceCoverage(storyBank.map((s) => ({
    id: s.id, title: s.title, competencies: s.competencies as string[],
    outcome: s.outcome, verifiedMetrics: (s.verified_metrics as unknown[]) ?? [],
    resumeSourceId: s.resume_source_id, projectSourceId: s.project_source_id, lastPracticedAt: s.last_practiced_at,
  })))

  const retryOpportunity = await findRetryOpportunity(supabase, userId, completedRows[0]?.id, dimensionsBySession)

  const jobRow = jobsRes.data?.[0] as { id: string; imported_title: string | null; imported_company: string | null; job_listings_cache: { title: string; company: string } | null } | undefined
  const selectedJob: HubSelectedJob | null = jobRow ? {
    savedJobId: jobRow.id,
    targetRole: jobRow.job_listings_cache?.title ?? jobRow.imported_title ?? 'this role',
    targetCompany: jobRow.job_listings_cache?.company ?? jobRow.imported_company ?? null,
  } : null

  const missingCompetencies = evidenceCoverage.missingCompetencies as CanonicalCompetency[]

  const nextActions = computeNextActions({
    hasAnyCompletedSession: completedRows.length > 0,
    inProgressSession: inProgressRow ? { id: inProgressRow.id, sessionType: inProgressRow.session_type, targetRole: inProgressRow.target_role } : null,
    pendingAnalysisSession: pendingAnalysisRow ? { id: pendingAnalysisRow.id } : null,
    failedAnalysisSession: failedAnalysisRow ? { id: failedAnalysisRow.id } : null,
    primaryReadinessGroup: primaryReadiness,
    retryOpportunity,
    storyBankGaps: { missingCompetencies, storiesNeedingOutcome: evidenceCoverage.storiesNeedingOutcome },
    overdueDrills: overdueDrillRows.map((d) => ({ drillType: d.drill_type, label: d.drill_type.replace(/_/g, ' '), competency: d.competency })),
    selectedJob,
    liveVoiceAvailable: isInterviewLiveEnabled(),
    quotaReached: false,
  })

  const recommendedDrills = primaryReadiness ? recommendDrillsForDimensions(primaryReadiness.weakDimensionIds, 3) : recommendDrillsForDimensions([], 3)

  return {
    isNewUser: sessions.length === 0,
    displayName,
    hasResume: (resumeCountRes.count ?? 0) > 0,
    hasPortfolio: (portfolioCountRes.count ?? 0) > 0,
    inProgressSession: inProgressRow ? toSummary(inProgressRow) : null,
    pendingAnalysisSession: pendingAnalysisRow ? toSummary(pendingAnalysisRow) : null,
    failedAnalysisSession: failedAnalysisRow ? toSummary(failedAnalysisRow) : null,
    readinessGroups, primaryReadiness, nextActions, evidenceCoverage, recommendedDrills,
    recentSessions: sessions.slice(0, 8).map(toSummary),
    selectedJob,
    storyCount: storyBank.length,
    isPro: proStatus,
    usage,
    liveVoiceAvailable: isInterviewLiveEnabled(),
    privacy: {
      transcriptRetentionDays: profileRes.data?.transcript_retention_days ?? 30,
      rawAudioRetentionEnabled: profileRes.data?.raw_audio_retention_enabled ?? false,
    },
  }
}

/** Finds the single weakest answer in the user's most recent completed+scored
 *  session that has NOT already been retried (no higher attempt_number exists for
 *  that question)  -  real evidence, not a guess at what's weak. */
async function findRetryOpportunity(
  supabase: SupabaseClient, userId: string, mostRecentSessionId: string | undefined,
  dimensionsBySession: Map<string, { dimensionId: string; score: number }[]>
) {
  if (!mostRecentSessionId) return null
  const dims = dimensionsBySession.get(mostRecentSessionId) ?? []
  const weakest = [...dims].sort((a, b) => a.score - b.score)[0]
  if (!weakest || weakest.score >= 60) return null

  const { data: dimRows } = await supabase
    .from('interview_dimension_scores')
    .select('answer_id')
    .eq('user_id', userId).eq('session_id', mostRecentSessionId).eq('dimension_id', weakest.dimensionId)
    .order('score', { ascending: true }).limit(1)
  const answerId = dimRows?.[0]?.answer_id
  if (!answerId) return null

  const { data: answer } = await supabase.from('interview_answers').select('question_id, attempt_number').eq('id', answerId).maybeSingle()
  if (!answer) return null

  const { count: retryCount } = await supabase
    .from('interview_answers').select('id', { count: 'exact', head: true })
    .eq('question_id', answer.question_id).gt('attempt_number', answer.attempt_number)
  if ((retryCount ?? 0) > 0) return null // already retried

  const { data: question } = await supabase.from('interview_questions').select('question_text').eq('id', answer.question_id).maybeSingle()
  if (!question) return null

  return {
    sessionId: mostRecentSessionId, questionId: answer.question_id,
    questionText: question.question_text, weakDimensionLabel: dimensionLabel(weakest.dimensionId),
  }
}
