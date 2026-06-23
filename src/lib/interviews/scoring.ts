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
 * The trust boundary between Gemini's output and the stored score. Gemini's
 * InterviewAnalysis has already passed Zod validation (range/shape), but that alone
 * doesn't prove the citations are real — a model can emit a syntactically valid
 * segment ID that doesn't exist in this session's actual transcript. This function
 * is the second, independent check: every cited segment ID is cross-referenced
 * against the real transcript before any score derived from it is trusted. Citing
 * even one nonexistent segment fails the entire analysis closed (throws), rather than
 * silently dropping the bad citation and scoring on the rest — a model that fabricates
 * one citation is not a source you can partially trust.
 */
export function validateCitations(analysis: InterviewAnalysis, realSegments: TranscriptSegment[]): void {
  const realIds = new Set(realSegments.map((s) => s.id))
  for (const dim of analysis.dimensionAssessments) {
    for (const id of dim.citedSegmentIds) {
      if (!realIds.has(id)) throw new InvalidCitationError(id)
    }
  }
  for (const ans of analysis.answerAssessments) {
    for (const id of ans.citedSegmentIds) {
      if (!realIds.has(id)) throw new InvalidCitationError(id)
    }
    for (const sm of ans.strongMoments) {
      if (!realIds.has(sm.segmentId)) throw new InvalidCitationError(sm.segmentId)
    }
    for (const wm of ans.weakMoments) {
      if (wm.segmentId && !realIds.has(wm.segmentId)) throw new InvalidCitationError(wm.segmentId)
    }
  }
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
  validateCitations(analysis, realSegments)

  const rubric: RubricProfile = getRubricProfile(sessionType)
  const byDimension = new Map(analysis.dimensionAssessments.map((d) => [d.dimensionId, d]))

  const included: { assessment: InterviewDimensionAssessment; weight: number }[] = []
  const excludedDimensions: InterviewScoreResult['excludedDimensions'] = []

  for (const [dimensionId, weight] of Object.entries(rubric.weights) as [DimensionId, number][]) {
    const assessment = byDimension.get(dimensionId)
    if (!assessment) {
      excludedDimensions.push({ dimensionId, reason: 'not assessed in this analysis' })
      continue
    }
    if (assessment.citedSegmentIds.length === 0) {
      excludedDimensions.push({ dimensionId, reason: 'no transcript evidence cited' })
      continue
    }
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
      evidenceSegmentIds: assessment.citedSegmentIds,
      explanation: assessment.explanation,
      confidence: assessment.confidence,
    })
  }

  const overallScore = Math.round(weightedSum)
  return { overallScore, readinessBand: scoreToBand(overallScore), dimensions, excludedDimensions }
}
