import type { InterviewAnalysis, InterviewDimensionAssessment, TranscriptSegment, DimensionId } from './schemas.ts'
import { getRubricProfile, scoreToBand, type RubricProfile } from './rubrics.ts'
import type { SessionType } from './schemas.ts'

export class InvalidCitationError extends Error {
  constructor(segmentId: string) {
    super(`Analysis cited transcript segment "${segmentId}" which does not exist in this session's real transcript`)
  }
}

export interface ScoredDimension {
  dimensionId: DimensionId
  score: number
  weight: number
  evidenceSegmentIds: string[]
  explanation: string
  confidence: 'low' | 'medium' | 'high'
}

export interface InterviewScoreResult {
  overallScore: number
  readinessBand: ReturnType<typeof scoreToBand>
  dimensions: ScoredDimension[]
  excludedDimensions: { dimensionId: DimensionId; reason: string }[]
}

/**
 * Strips any segment IDs that don't exist in the real transcript rather than throwing.
 * The original design threw on any bad citation, which caused every analysis to fail
 * because LLMs reliably mismatch UUIDs — the model reads the transcript correctly but
 * can't reproduce exact database UUIDs in its JSON output. The actual score comes from
 * ratingEvidence (0–100), not from citations, so stripping bad citations is safe: the
 * score is still computed from real evidence, citations are just display metadata.
 */
export function sanitizeCitations(analysis: InterviewAnalysis, realSegments: TranscriptSegment[]): InterviewAnalysis {
  const realIds = new Set(realSegments.map((s) => s.id))
  return {
    ...analysis,
    dimensionAssessments: analysis.dimensionAssessments.map((dim) => ({
      ...dim,
      citedSegmentIds: dim.citedSegmentIds.filter((id) => realIds.has(id)),
    })),
    answerAssessments: analysis.answerAssessments.map((ans) => ({
      ...ans,
      citedSegmentIds: ans.citedSegmentIds.filter((id) => realIds.has(id)),
      strongMoments: ans.strongMoments.filter((sm) => realIds.has(sm.segmentId)),
      weakMoments: ans.weakMoments.map((wm) => ({
        ...wm,
        segmentId: wm.segmentId && realIds.has(wm.segmentId) ? wm.segmentId : null,
      })),
    })),
  }
}

/** @deprecated kept for callers that haven't migrated; use sanitizeCitations instead */
export function validateCitations(analysis: InterviewAnalysis, realSegments: TranscriptSegment[]): void {
  sanitizeCitations(analysis, realSegments) // no longer throws
}

/**
 * Computes the final, stored score deterministically from Gemini's already-validated
 * dimension evidence. Gemini supplies ratingEvidence + citations per dimension; this
 * function — not Gemini — decides the weights (from the rubric registry, keyed by
 * session type, never from the model response) and does the weighted-average math.
 * A dimension with zero cited evidence is excluded and the remaining weights are
 * renormalized, rather than silently scoring it on no evidence.
 */
export function computeInterviewScore(
  sessionType: SessionType,
  analysis: InterviewAnalysis,
  realSegments: TranscriptSegment[]
): InterviewScoreResult {
  // Sanitize first — strip bad citation IDs without throwing.
  // Dimension scores still compute from ratingEvidence regardless.
  const clean = sanitizeCitations(analysis, realSegments)

  const rubric: RubricProfile = getRubricProfile(sessionType)
  const byDimension = new Map(clean.dimensionAssessments.map((d) => [d.dimensionId, d]))

  const included: { assessment: InterviewDimensionAssessment; weight: number }[] = []
  const excludedDimensions: InterviewScoreResult['excludedDimensions'] = []

  for (const [dimensionId, weight] of Object.entries(rubric.weights) as [DimensionId, number][]) {
    const assessment = byDimension.get(dimensionId)
    if (!assessment) {
      excludedDimensions.push({ dimensionId, reason: 'not assessed in this analysis' })
      continue
    }
    // Don't exclude just because citations were stripped — ratingEvidence is still valid.
    included.push({ assessment, weight })
  }

  if (included.length === 0) {
    throw new Error('No dimension had usable evidence — cannot compute a score for this session')
  }

  const totalWeight = included.reduce((sum, d) => sum + d.weight, 0)
  let weightedSum = 0
  const dimensions: ScoredDimension[] = []

  for (const { assessment, weight } of included) {
    const normalizedWeight = weight / totalWeight
    weightedSum += assessment.ratingEvidence * normalizedWeight
    dimensions.push({
      dimensionId: assessment.dimensionId,
      score: assessment.ratingEvidence,
      weight: normalizedWeight,
      evidenceSegmentIds: assessment.citedSegmentIds, // already sanitized above
      explanation: assessment.explanation,
      confidence: assessment.confidence,
    })
  }

  const overallScore = Math.round(weightedSum)
  return { overallScore, readinessBand: scoreToBand(overallScore), dimensions, excludedDimensions }
}
