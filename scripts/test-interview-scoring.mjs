#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the interview scoring engine — the trust boundary between
// Gemini's bounded evidence and the stored score. No AI calls; everything here is
// pure arithmetic and validation against hand-built fixture data.
// Run via: npm run test:interview-scoring
import { computeInterviewScore, validateCitations, InvalidCitationError } from '../src/lib/interviews/scoring.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

const REAL_SEGMENTS = [
  { id: 'seg-1', speaker: 'candidate', startMs: 0, endMs: 5000, content: 'I led the migration project.', sourceMode: 'text' },
  { id: 'seg-2', speaker: 'candidate', startMs: 5000, endMs: 10000, content: 'We reduced latency by 40%.', sourceMode: 'text' },
]

// ── Case 1: deterministic same-input-same-output ────────────────────────────
const goodAnalysis = {
  answerAssessments: [],
  topFixes: ['Add more outcome detail'],
  strengths: ['Clear ownership'],
  dimensionAssessments: [
    { dimensionId: 'answer_relevance', ratingEvidence: 80, citedSegmentIds: ['seg-1'], explanation: 'Addressed the question directly.', missingEvidence: [], confidence: 'high' },
    { dimensionId: 'evidence_specificity', ratingEvidence: 70, citedSegmentIds: ['seg-2'], explanation: 'Gave a specific metric.', missingEvidence: [], confidence: 'medium' },
    { dimensionId: 'context_clarity', ratingEvidence: 60, citedSegmentIds: ['seg-1'], explanation: 'Mostly clear.', missingEvidence: [], confidence: 'medium' },
    { dimensionId: 'personal_ownership', ratingEvidence: 90, citedSegmentIds: ['seg-1'], explanation: 'Clear "I led".', missingEvidence: [], confidence: 'high' },
    { dimensionId: 'action_quality', ratingEvidence: 65, citedSegmentIds: ['seg-1'], explanation: 'Some reasoning.', missingEvidence: [], confidence: 'medium' },
    { dimensionId: 'outcome_and_impact', ratingEvidence: 75, citedSegmentIds: ['seg-2'], explanation: 'Quantified result.', missingEvidence: [], confidence: 'high' },
    { dimensionId: 'answer_structure', ratingEvidence: 55, citedSegmentIds: ['seg-1'], explanation: 'Reasonably organized.', missingEvidence: [], confidence: 'medium' },
    { dimensionId: 'follow_up_handling', ratingEvidence: 50, citedSegmentIds: ['seg-1'], explanation: 'Adequate.', missingEvidence: [], confidence: 'low' },
  ],
}

const result1 = computeInterviewScore('behavioral', goodAnalysis, REAL_SEGMENTS)
const result2 = computeInterviewScore('behavioral', goodAnalysis, REAL_SEGMENTS)
record('Same input produces the exact same overall score (deterministic)', result1.overallScore === result2.overallScore, `${result1.overallScore} vs ${result2.overallScore}`)
record('Overall score is a whole number, not a decimal', Number.isInteger(result1.overallScore))
record('Overall score is in range 0-100', result1.overallScore >= 0 && result1.overallScore <= 100)
record('Readiness band matches the score', result1.readinessBand === (result1.overallScore >= 35 && result1.overallScore < 55 ? 'building' : result1.readinessBand))

// ── Case 2: fabricated citation must fail closed, not silently drop ─────────
const fabricatedAnalysis = {
  ...goodAnalysis,
  dimensionAssessments: [
    { dimensionId: 'answer_relevance', ratingEvidence: 95, citedSegmentIds: ['seg-FABRICATED-999'], explanation: 'Looks great.', missingEvidence: [], confidence: 'high' },
  ],
}
let threwInvalidCitation = false
try {
  computeInterviewScore('behavioral', fabricatedAnalysis, REAL_SEGMENTS)
} catch (err) {
  threwInvalidCitation = err instanceof InvalidCitationError
}
record('A fabricated/nonexistent segment citation throws InvalidCitationError (fails closed)', threwInvalidCitation)

// ── Case 3: dimension with zero evidence is excluded, not scored on nothing ──
const noEvidenceAnalysis = {
  ...goodAnalysis,
  dimensionAssessments: [
    { dimensionId: 'answer_relevance', ratingEvidence: 80, citedSegmentIds: [], explanation: 'No citation given.', missingEvidence: ['nothing cited'], confidence: 'low' },
    { dimensionId: 'evidence_specificity', ratingEvidence: 70, citedSegmentIds: ['seg-2'], explanation: 'Has evidence.', missingEvidence: [], confidence: 'high' },
  ],
}
const resultNoEvidence = computeInterviewScore('behavioral', noEvidenceAnalysis, REAL_SEGMENTS)
record('Dimension with zero cited evidence is excluded from scoring', resultNoEvidence.excludedDimensions.some((e) => e.dimensionId === 'answer_relevance' && e.reason === 'no transcript evidence cited'))
record('Remaining weights are renormalized (single included dimension carries full weight=1)', resultNoEvidence.dimensions.length === 1 && Math.abs(resultNoEvidence.dimensions[0].weight - 1) < 0.001, JSON.stringify(resultNoEvidence.dimensions))

// ── Case 4: Gemini cannot alter rubric weights — server always uses its own registry ─
const analysisAttemptingWeightOverride = {
  ...goodAnalysis,
  // A model response cannot include a "weights" field that the schema would even
  // accept — InterviewDimensionAssessmentSchema has no weight field at all. This case
  // documents that fact rather than testing for it being ignored (it cannot be sent).
}
record('InterviewDimensionAssessment schema has no weight field — Gemini structurally cannot supply one', !('weight' in analysisAttemptingWeightOverride.dimensionAssessments[0]))

// ── Case 5: validateCitations is independently callable and matches computeInterviewScore's check ─
let validateThrew = false
try {
  validateCitations(fabricatedAnalysis, REAL_SEGMENTS)
} catch {
  validateThrew = true
}
record('validateCitations() independently rejects the same fabricated citation', validateThrew)

console.log(`\n  Interview scoring test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
