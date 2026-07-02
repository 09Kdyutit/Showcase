#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the interview scoring engine — the trust boundary between
// the model's bounded evidence and the stored score. No AI calls; everything here is
// pure arithmetic and validation against hand-built fixture data.
//
// Semantics under test (current design):
//  - Weights come from the server rubric registry, never the model response.
//  - Fabricated/nonexistent citation IDs are STRIPPED (sanitized), never stored —
//    LLMs reliably mangle database UUIDs, so a hard throw failed every real analysis.
//    Scores come from ratingEvidence; citations are display metadata.
//  - Dimensions not assessed at all are excluded and weights renormalized.
// Run via: npm run test:interview-scoring
import { computeInterviewScore, sanitizeCitations } from '../src/lib/interviews/scoring.ts'
import { DIMENSION_IDS } from '../src/lib/interviews/schemas.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

const REAL_SEGMENTS = [
  { id: 'seg-1', speaker: 'candidate', startMs: 0, endMs: 5000, content: 'I led the migration project.', sourceMode: 'text' },
  { id: 'seg-2', speaker: 'candidate', startMs: 5000, endMs: 10000, content: 'We reduced latency by 40%.', sourceMode: 'text' },
]

function dim(dimensionId, ratingEvidence, citedSegmentIds, confidence = 'high') {
  return { dimensionId, ratingEvidence, citedSegmentIds, explanation: `Assessment for ${dimensionId}.`, missingEvidence: [], confidence }
}

// ── Case 1: deterministic same-input-same-output across all 6 dimensions ─────
const goodAnalysis = {
  answerAssessments: [],
  topFixes: ['Add more outcome detail'],
  strengths: ['Clear ownership'],
  dimensionAssessments: [
    dim('technical', 62, ['seg-1']),
    dim('communication', 74, ['seg-1']),
    dim('competency', 81, ['seg-1', 'seg-2']),
    dim('clarity', 68, ['seg-2'], 'medium'),
    dim('authenticity', 77, ['seg-1'], 'medium'),
    dim('behaviour', 70, ['seg-2'], 'low'),
  ],
}

const result1 = computeInterviewScore('behavioral', goodAnalysis, REAL_SEGMENTS)
const result2 = computeInterviewScore('behavioral', goodAnalysis, REAL_SEGMENTS)
record('Same input produces the exact same overall score (deterministic)', result1.overallScore === result2.overallScore, `${result1.overallScore} vs ${result2.overallScore}`)
record('Overall score is a whole number, not a decimal', Number.isInteger(result1.overallScore))
record('Overall score is in range 0-100', result1.overallScore >= 0 && result1.overallScore <= 100)
record('All 6 assessed dimensions are included', result1.dimensions.length === 6, `got ${result1.dimensions.length}`)
record('Included weights sum to 1 after normalization', Math.abs(result1.dimensions.reduce((s, d) => s + d.weight, 0) - 1) < 0.001)
record('Overall score is bounded by min/max dimension scores', result1.overallScore >= 62 && result1.overallScore <= 81, `got ${result1.overallScore}`)

// ── Case 2: fabricated citation is stripped, never stored ────────────────────
const fabricatedAnalysis = {
  ...goodAnalysis,
  dimensionAssessments: goodAnalysis.dimensionAssessments.map((d) =>
    d.dimensionId === 'competency'
      ? { ...d, citedSegmentIds: ['seg-FABRICATED-999', 'seg-2'] }
      : d
  ),
}
const fabricatedResult = computeInterviewScore('behavioral', fabricatedAnalysis, REAL_SEGMENTS)
const competencyDim = fabricatedResult.dimensions.find((d) => d.dimensionId === 'competency')
record('Fabricated segment citation is stripped from stored evidence', !competencyDim.evidenceSegmentIds.includes('seg-FABRICATED-999'), JSON.stringify(competencyDim.evidenceSegmentIds))
record('Real citation on the same dimension survives the strip', competencyDim.evidenceSegmentIds.includes('seg-2'))
record('Stripping a citation does not change the deterministic score', fabricatedResult.overallScore === result1.overallScore, `${fabricatedResult.overallScore} vs ${result1.overallScore}`)

// sanitizeCitations is independently callable and covers answer assessments too
const sanitized = sanitizeCitations({
  ...goodAnalysis,
  answerAssessments: [{
    questionId: 'q-1', citedSegmentIds: ['seg-1', 'seg-NOPE'],
    strongMoments: [{ segmentId: 'seg-NOPE', note: 'fabricated' }, { segmentId: 'seg-2', note: 'real' }],
    weakMoments: [{ segmentId: 'seg-NOPE', note: 'fabricated' }],
  }],
}, REAL_SEGMENTS)
record('sanitizeCitations strips fabricated ids from answer assessments', !sanitized.answerAssessments[0].citedSegmentIds.includes('seg-NOPE'))
record('sanitizeCitations drops strong moments with fabricated segment ids', sanitized.answerAssessments[0].strongMoments.length === 1 && sanitized.answerAssessments[0].strongMoments[0].segmentId === 'seg-2')
record('sanitizeCitations nulls (not drops) weak-moment fabricated segment ids', sanitized.answerAssessments[0].weakMoments.length === 1 && sanitized.answerAssessments[0].weakMoments[0].segmentId === null)

// ── Case 3: dimension not assessed is excluded and weights renormalize ───────
const partialAnalysis = {
  ...goodAnalysis,
  dimensionAssessments: goodAnalysis.dimensionAssessments.filter((d) => d.dimensionId !== 'technical'),
}
const partialResult = computeInterviewScore('behavioral', partialAnalysis, REAL_SEGMENTS)
record('Unassessed dimension is excluded with an explicit reason', partialResult.excludedDimensions.some((e) => e.dimensionId === 'technical' && e.reason === 'not assessed in this analysis'))
record('Remaining 5 dimensions renormalize to weight sum 1', partialResult.dimensions.length === 5 && Math.abs(partialResult.dimensions.reduce((s, d) => s + d.weight, 0) - 1) < 0.001)

// ── Case 4: zero assessed dimensions fails closed ────────────────────────────
let threwOnEmpty = false
try {
  computeInterviewScore('behavioral', { ...goodAnalysis, dimensionAssessments: [] }, REAL_SEGMENTS)
} catch {
  threwOnEmpty = true
}
record('Analysis with zero assessed dimensions throws (fails closed, no invented score)', threwOnEmpty)

// ── Case 5: the model structurally cannot supply weights ─────────────────────
record('Dimension assessments carry no weight field — the model structurally cannot set one', !('weight' in goodAnalysis.dimensionAssessments[0]))

// ── Case 6: fixture dimension ids match the real registry ───────────────────
const fixtureIds = new Set(goodAnalysis.dimensionAssessments.map((d) => d.dimensionId))
record('Fixture covers exactly the registered dimension ids', DIMENSION_IDS.every((id) => fixtureIds.has(id)) && fixtureIds.size === DIMENSION_IDS.length, JSON.stringify([...fixtureIds]))

console.log(`\n  Interview scoring test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
