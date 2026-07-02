// Pure, deterministic next-action engine. Gemini analysis may supply validated
// weaknesses (real dimension scores with real evidence); this module - not the
// model - decides which action the Hub recommends and in what order. No network
// access here; hub-data.ts fetches real rows and maps them into HubActionInput.
import type { ReadinessGroup } from './readiness.ts'
import { DIMENSION_REGISTRY } from './rubrics.ts'
import { recommendDrillsForDimensions } from './drills.ts'
import { CANONICAL_COMPETENCY_LABELS, type CanonicalCompetency } from './competencies.ts'
import type { SessionType } from './schemas.ts'

export interface HubActionInput {
  hasAnyCompletedSession: boolean
  inProgressSession: { id: string; sessionType: SessionType; targetRole: string } | null
  pendingAnalysisSession: { id: string } | null
  failedAnalysisSession: { id: string } | null
  primaryReadinessGroup: ReadinessGroup | null
  retryOpportunity: { sessionId: string; questionId: string; questionText: string; weakDimensionLabel: string } | null
  storyBankGaps: { missingCompetencies: CanonicalCompetency[]; storiesNeedingOutcome: number }
  overdueDrills: { drillType: string; label: string; competency: string }[]
  selectedJob: { savedJobId: string; targetRole: string; targetCompany: string | null } | null
  liveVoiceAvailable: boolean
  quotaReached: boolean
}

export interface RecommendedAction {
  id: string
  priority: number
  title: string
  reason: string
  source: 'real_weakness' | 'incomplete_work' | 'evidence_gap' | 'baseline' | 'job_requirement' | 'sample_size'
  destination: string
  estimatedMinutes: number
}

/** Returns at most `limit` actions, ranked by priority (lower = more urgent).
 *  Every action's `reason` is built from real input data - never a fixed string
 *  pretending to be personalized. */
export function computeNextActions(input: HubActionInput, limit = 3): RecommendedAction[] {
  const actions: RecommendedAction[] = []

  if (input.inProgressSession) {
    actions.push({
      id: 'resume_session', priority: 0,
      title: `Resume your ${input.inProgressSession.sessionType.replace(/_/g, ' ')} session`,
      reason: `You have an interview in progress for ${input.inProgressSession.targetRole}.`,
      source: 'incomplete_work', destination: `/interviews/${input.inProgressSession.id}/lobby`,
      estimatedMinutes: 10,
    })
  }

  if (input.pendingAnalysisSession) {
    actions.push({
      id: 'pending_analysis', priority: 1,
      title: 'Your last session is still being scored',
      reason: 'Analysis is in progress - check back shortly for your results.',
      source: 'incomplete_work', destination: `/interviews/${input.pendingAnalysisSession.id}/results`,
      estimatedMinutes: 1,
    })
  }

  if (input.failedAnalysisSession) {
    actions.push({
      id: 'failed_analysis', priority: 1,
      title: 'Scoring failed on your last session',
      reason: 'Your answers are saved - you can view the transcript, or start a new session.',
      source: 'incomplete_work', destination: `/interviews/${input.failedAnalysisSession.id}/results`,
      estimatedMinutes: 1,
    })
  }

  if (input.retryOpportunity) {
    actions.push({
      id: 'retry_answer', priority: 2,
      title: 'Strengthen a weak answer',
      reason: `Your answer to "${input.retryOpportunity.questionText.slice(0, 70)}${input.retryOpportunity.questionText.length > 70 ? '…' : ''}" scored low on ${input.retryOpportunity.weakDimensionLabel}.`,
      source: 'real_weakness', destination: `/interviews/${input.retryOpportunity.sessionId}/results`,
      estimatedMinutes: 5,
    })
  }

  if (!input.hasAnyCompletedSession) {
    actions.push({
      id: 'start_baseline', priority: 3,
      title: 'Start a baseline interview',
      reason: 'Complete one practice session to create your first readiness estimate.',
      source: 'baseline', destination: '/interviews/new',
      estimatedMinutes: 12,
    })
  } else if (input.primaryReadinessGroup) {
    const g = input.primaryReadinessGroup
    if (g.comparableSessionCount === 1) {
      actions.push({
        id: 'more_sessions_for_confidence', priority: 4,
        title: `Practice another ${g.sessionType.replace(/_/g, ' ')} session`,
        reason: `Your readiness for ${g.targetRole} is based on only 1 session - one more will make it a more reliable estimate.`,
        source: 'sample_size', destination: '/interviews/new',
        estimatedMinutes: 12,
      })
    }
    if (g.priority && g.weakDimensionIds.length > 0) {
      const drills = recommendDrillsForDimensions(g.weakDimensionIds, 1)
      // Cite whichever weak dimension the chosen drill actually targets - not always
      // the single lowest-scoring one, since the catalog may have no drill for that
      // exact dimension. Citing the wrong dimension would be a real, if small,
      // trust-breaking inconsistency between the reason text and the recommendation.
      const targetedDimension = g.dimensions.find((d) => d.id === drills[0]?.competency) ?? g.priority
      if (drills[0]) {
        actions.push({
          id: `drill_${drills[0].id}`, priority: 3,
          title: `Drill: ${drills[0].label}`,
          reason: `${DIMENSION_REGISTRY[targetedDimension.id]?.label ?? targetedDimension.label} was a low-scoring dimension (${targetedDimension.score}/100) in your last ${g.sessionType.replace(/_/g, ' ')} session.`,
          source: 'real_weakness', destination: '/interviews/drills',
          estimatedMinutes: 2,
        })
      }
    }
  }

  if (input.storyBankGaps.missingCompetencies.length > 0) {
    const comp = input.storyBankGaps.missingCompetencies[0]
    actions.push({
      id: 'add_story', priority: 5,
      title: `Add a story for ${CANONICAL_COMPETENCY_LABELS[comp]}`,
      reason: 'You don\'t have a Story Bank entry covering this competency yet.',
      source: 'evidence_gap', destination: '/interviews/story-bank',
      estimatedMinutes: 5,
    })
  } else if (input.storyBankGaps.storiesNeedingOutcome > 0) {
    actions.push({
      id: 'strengthen_story', priority: 5,
      title: 'Add outcomes to your stories',
      reason: `${input.storyBankGaps.storiesNeedingOutcome} ${input.storyBankGaps.storiesNeedingOutcome === 1 ? 'story is' : 'stories are'} missing a stated result.`,
      source: 'evidence_gap', destination: '/interviews/story-bank',
      estimatedMinutes: 5,
    })
  }

  if (input.selectedJob) {
    actions.push({
      id: 'job_specific_session', priority: 2,
      title: `Practice for ${input.selectedJob.targetRole}${input.selectedJob.targetCompany ? ` at ${input.selectedJob.targetCompany}` : ''}`,
      reason: 'Practice based on this job description.',
      source: 'job_requirement',
      destination: `/interviews/new?savedJobId=${input.selectedJob.savedJobId}&targetRole=${encodeURIComponent(input.selectedJob.targetRole)}${input.selectedJob.targetCompany ? `&targetCompany=${encodeURIComponent(input.selectedJob.targetCompany)}` : ''}`,
      estimatedMinutes: 12,
    })
  }

  if (input.overdueDrills.length > 0) {
    const d = input.overdueDrills[0]
    actions.push({
      id: `overdue_drill_${d.drillType}`, priority: 6,
      title: `Drill: ${d.label}`,
      reason: 'Recommended but not yet attempted.',
      source: 'evidence_gap', destination: '/interviews/drills',
      estimatedMinutes: 2,
    })
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, limit)
}
