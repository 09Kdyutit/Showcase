// Pure, deterministic readiness computation — no DB/network access, fully unit
// testable. Caller (hub-data.ts) is responsible for fetching real rows and mapping
// them into ReadinessInputSession before calling computeReadinessGroups().
//
// Mission rule this file exists to enforce: "Do not average unrelated session
// types." A single readiness number that blends a Behavioral session with a
// Technical Concept session is not honest — they measure different things against
// different rubric weights. So readiness is computed per (targetRole, sessionType)
// pair, and the Hub shows the pair with the most comparable data as the headline,
// with every other pair inspectable via a breakdown view.
import { RUBRIC_REGISTRY_VERSION, getRubricProfile } from './rubrics.ts'
import { DIMENSION_REGISTRY } from './rubrics.ts'
import { scoreToBand } from './rubrics.ts'
import type { CoachingMode, DimensionId, ReadinessBand, SessionType } from './schemas.ts'

export interface ReadinessInputSession {
  sessionId: string
  targetRole: string
  sessionType: SessionType
  coachingMode: CoachingMode
  completedAt: string
  evaluation: {
    overallScore: number
    rubricVersion: string
    createdAt: string
  } | null
  dimensionScores: { dimensionId: DimensionId; score: number }[]
}

export interface DimensionReadout {
  id: DimensionId
  label: string
  score: number
  weight: number
}

export interface ReadinessGroup {
  targetRole: string
  sessionType: SessionType
  coachingMode: CoachingMode
  score: number
  band: ReadinessBand
  comparableSessionCount: number
  excludedStaleRubricCount: number
  excludedModeMismatchCount: number
  sampleLabel: string
  trend: 'up' | 'down' | 'flat' | 'insufficient_data'
  dimensions: DimensionReadout[]
  strongest: DimensionReadout | null
  priority: DimensionReadout | null
  weakDimensionIds: DimensionId[]
  latestCompletedAt: string
  rubricVersion: string
}

const MIN_SAMPLES_FOR_TREND = 2
const RECENT_SCORES_WINDOW = 5
const WEAK_SCORE_THRESHOLD = 70

function sampleLabel(comparable: number, sessionType: string, targetRole: string): string {
  const typeLabel = sessionType.replace(/_/g, ' ')
  if (comparable === 1) return `Early estimate based on 1 ${typeLabel} session for ${targetRole}.`
  return `Based on your last ${Math.min(comparable, RECENT_SCORES_WINDOW)} of ${comparable} ${typeLabel} sessions for ${targetRole}.`
}

/** Groups valid sessions by (targetRole, sessionType), picks the dominant coaching
 *  mode per group (the mode with more sessions), and excludes everything else —
 *  visibly, via the excluded* counters, never silently. */
export function computeReadinessGroups(sessions: ReadinessInputSession[]): ReadinessGroup[] {
  const byKey = new Map<string, ReadinessInputSession[]>()
  for (const s of sessions) {
    if (!s.evaluation) continue // analysis pending/failed/skipped — not a valid data point
    const key = `${s.targetRole}::${s.sessionType}`
    byKey.set(key, [...(byKey.get(key) ?? []), s])
  }

  const groups: ReadinessGroup[] = []
  for (const [, groupSessions] of byKey) {
    const { targetRole, sessionType } = groupSessions[0]

    const currentRubricSessions = groupSessions.filter((s) => s.evaluation!.rubricVersion === RUBRIC_REGISTRY_VERSION)
    const excludedStaleRubricCount = groupSessions.length - currentRubricSessions.length
    if (currentRubricSessions.length === 0) continue

    const modeCounts = new Map<CoachingMode, number>()
    for (const s of currentRubricSessions) modeCounts.set(s.coachingMode, (modeCounts.get(s.coachingMode) ?? 0) + 1)
    const dominantMode = [...modeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const comparable = currentRubricSessions.filter((s) => s.coachingMode === dominantMode)
    const excludedModeMismatchCount = currentRubricSessions.length - comparable.length

    comparable.sort((a, b) => new Date(b.evaluation!.createdAt).getTime() - new Date(a.evaluation!.createdAt).getTime())
    const recent = comparable.slice(0, RECENT_SCORES_WINDOW)
    const score = Math.round(recent.reduce((sum, s) => sum + s.evaluation!.overallScore, 0) / recent.length)

    let trend: ReadinessGroup['trend'] = 'insufficient_data'
    if (comparable.length >= MIN_SAMPLES_FOR_TREND) {
      const delta = comparable[0].evaluation!.overallScore - comparable[1].evaluation!.overallScore
      trend = delta > 3 ? 'up' : delta < -3 ? 'down' : 'flat'
    }

    const byDimension = new Map<DimensionId, number[]>()
    for (const s of recent) {
      for (const d of s.dimensionScores) byDimension.set(d.dimensionId, [...(byDimension.get(d.dimensionId) ?? []), d.score])
    }
    const weights = getRubricProfile(sessionType).weights
    const dimensions: DimensionReadout[] = [...byDimension.entries()].map(([id, scores]) => ({
      id, label: DIMENSION_REGISTRY[id].label,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      weight: weights[id] ?? 0,
    })).sort((a, b) => b.weight - a.weight)

    const ranked = [...dimensions].sort((a, b) => b.score - a.score)
    const weakDimensionIds = dimensions.filter((d) => d.score < WEAK_SCORE_THRESHOLD).map((d) => d.id)

    groups.push({
      targetRole, sessionType, coachingMode: dominantMode,
      score, band: scoreToBand(score),
      comparableSessionCount: comparable.length,
      excludedStaleRubricCount, excludedModeMismatchCount,
      sampleLabel: sampleLabel(comparable.length, sessionType, targetRole),
      trend, dimensions,
      strongest: ranked[0] ?? null,
      priority: ranked[ranked.length - 1] ?? null,
      weakDimensionIds,
      latestCompletedAt: comparable[0].completedAt,
      rubricVersion: RUBRIC_REGISTRY_VERSION,
    })
  }
  return groups
}

/** The headline readiness shown in the Hub's command header — the group with the
 *  most comparable sessions, ties broken by most recent activity. Never picks an
 *  arbitrary or averaged-across-everything number. */
export function pickPrimaryReadinessGroup(groups: ReadinessGroup[], preferredTargetRole?: string | null): ReadinessGroup | null {
  if (groups.length === 0) return null
  const pool = preferredTargetRole ? groups.filter((g) => g.targetRole === preferredTargetRole) : groups
  const candidates = pool.length > 0 ? pool : groups
  return [...candidates].sort((a, b) => {
    if (b.comparableSessionCount !== a.comparableSessionCount) return b.comparableSessionCount - a.comparableSessionCount
    return new Date(b.latestCompletedAt).getTime() - new Date(a.latestCompletedAt).getTime()
  })[0]
}
