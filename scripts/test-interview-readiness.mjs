#!/usr/bin/env node
// Deterministic tests for the readiness model — no DB, no network. Verifies the
// mission's core rule: never average unrelated session types, never silently mix
// coaching modes, never include stale-rubric or unscored sessions, and never invent
// a confident-sounding number from too little data.
import { computeReadinessGroups, pickPrimaryReadinessGroup } from '../src/lib/interviews/readiness.ts'
import { computeEvidenceCoverage } from '../src/lib/interviews/evidence-coverage.ts'
import { RUBRIC_REGISTRY_VERSION } from '../src/lib/interviews/rubrics.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

function session(overrides) {
  return {
    sessionId: crypto.randomUUID(), targetRole: 'Product Designer', sessionType: 'behavioral',
    coachingMode: 'guided', completedAt: new Date().toISOString(),
    evaluation: { overallScore: 70, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: new Date().toISOString() },
    dimensionScores: [{ dimensionId: 'communication', score: 70 }],
    ...overrides,
  }
}

console.log('── No sessions ──')
{
  const groups = computeReadinessGroups([])
  record('Zero sessions produces zero groups (not a fabricated 0%)', groups.length === 0)
  record('pickPrimaryReadinessGroup(empty) returns null, not a fake group', pickPrimaryReadinessGroup(groups) === null)
}

console.log('\n── One valid session ──')
{
  const groups = computeReadinessGroups([session({})])
  record('Exactly one group produced', groups.length === 1)
  record('Sample label says "Early estimate" for n=1', groups[0].sampleLabel.includes('Early estimate'))
  record('comparableSessionCount is 1', groups[0].comparableSessionCount === 1)
  record('Score is a whole number (no pseudo-precision)', Number.isInteger(groups[0].score))
}

console.log('\n── Unrelated session types are never averaged together ──')
{
  const sessions = [
    session({ sessionType: 'behavioral', evaluation: { overallScore: 90, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: new Date().toISOString() } }),
    session({ sessionType: 'technical_concept', evaluation: { overallScore: 30, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: new Date().toISOString() } }),
  ]
  const groups = computeReadinessGroups(sessions)
  record('Two distinct session types produce two distinct groups, not one blended average', groups.length === 2)
  const behavioral = groups.find((g) => g.sessionType === 'behavioral')
  const technical = groups.find((g) => g.sessionType === 'technical_concept')
  record('Behavioral group score is exactly 90, unaffected by the technical session', behavioral.score === 90)
  record('Technical group score is exactly 30, unaffected by the behavioral session', technical.score === 30)
}

console.log('\n── Unrelated target roles are never averaged together ──')
{
  const sessions = [
    session({ targetRole: 'Product Designer', evaluation: { overallScore: 80, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: new Date().toISOString() } }),
    session({ targetRole: 'Software Engineer', evaluation: { overallScore: 20, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: new Date().toISOString() } }),
  ]
  const groups = computeReadinessGroups(sessions)
  record('Two distinct roles produce two distinct groups', groups.length === 2)
}

console.log('\n── Stale rubric versions are excluded, not silently blended ──')
{
  const sessions = [
    session({ evaluation: { overallScore: 90, rubricVersion: 'old-version-2020', createdAt: new Date().toISOString() } }),
    session({ evaluation: { overallScore: 50, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: new Date().toISOString() } }),
  ]
  const groups = computeReadinessGroups(sessions)
  record('Exactly one group (the stale-rubric session is excluded from scoring)', groups.length === 1)
  record('Score reflects only the current-rubric session (50), not blended with the stale one', groups[0].score === 50)
  record('excludedStaleRubricCount records the exclusion visibly', groups[0].excludedStaleRubricCount === 1)
}

console.log('\n── Guided and Realistic modes are not silently mixed ──')
{
  const sessions = [
    session({ coachingMode: 'guided', evaluation: { overallScore: 80, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: new Date().toISOString() } }),
    session({ coachingMode: 'guided', evaluation: { overallScore: 85, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: new Date().toISOString() } }),
    session({ coachingMode: 'realistic', evaluation: { overallScore: 20, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: new Date().toISOString() } }),
  ]
  const groups = computeReadinessGroups(sessions)
  record('Exactly one group (dominant mode wins, minority mode excluded)', groups.length === 1)
  record('Dominant mode is guided (2 vs 1)', groups[0].coachingMode === 'guided')
  record('excludedModeMismatchCount records the 1 excluded realistic session', groups[0].excludedModeMismatchCount === 1)
  record('Score reflects only the 2 guided sessions (82-83), not dragged down by the realistic 20', groups[0].score >= 80)
}

console.log('\n── Sessions with no evaluation (pending/failed analysis) are excluded entirely ──')
{
  const sessions = [session({ evaluation: null }), session({ evaluation: null })]
  const groups = computeReadinessGroups(sessions)
  record('Zero groups when no session has a real evaluation', groups.length === 0)
}

console.log('\n── Trend computation ──')
{
  const older = session({ evaluation: { overallScore: 50, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: '2026-01-01T00:00:00Z' } })
  const newer = session({ evaluation: { overallScore: 70, rubricVersion: RUBRIC_REGISTRY_VERSION, createdAt: '2026-02-01T00:00:00Z' } })
  const groups = computeReadinessGroups([older, newer])
  record('Trend is "up" when the most recent score is meaningfully higher', groups[0].trend === 'up')
}

console.log('\n── pickPrimaryReadinessGroup picks the group with the most data ──')
{
  const sessions = [
    session({ sessionType: 'behavioral' }),
    session({ sessionType: 'technical_concept' }),
    session({ sessionType: 'technical_concept' }),
    session({ sessionType: 'technical_concept' }),
  ]
  const groups = computeReadinessGroups(sessions)
  const primary = pickPrimaryReadinessGroup(groups)
  record('Primary group is the one with 3 comparable sessions, not the one with 1', primary.sessionType === 'technical_concept')
}

console.log('\n── Evidence coverage (deterministic, real Story Bank rows only) ──')
{
  const stories = [
    { id: 's1', title: 'Led a redesign', competencies: ['leadership', 'ownership'], outcome: 'Conversion up 12%', verifiedMetrics: ['12%'], resumeSourceId: 'r1', projectSourceId: null, lastPracticedAt: '2026-06-01T00:00:00Z' },
    { id: 's2', title: 'Disagreed with PM', competencies: ['conflict'], outcome: null, verifiedMetrics: [], resumeSourceId: null, projectSourceId: null, lastPracticedAt: null },
  ]
  const coverage = computeEvidenceCoverage(stories)
  record('leadership and ownership and conflict are covered', ['leadership', 'ownership', 'conflict'].every((c) => coverage.covered.find((x) => x.competency === c).covered))
  record('failure, ambiguity, collaboration etc. are correctly reported as missing (no story claims them)', coverage.missingCompetencies.includes('failure') && coverage.missingCompetencies.includes('ambiguity'))
  record('storiesNeedingOutcome counts exactly the 1 story with no outcome', coverage.storiesNeedingOutcome === 1)
  record('strongestStory is the one with outcome+metrics+source+practiced (s1), not s2', coverage.strongestStory.id === 's1')
  record('verifiedMetricCount sums real metrics across all stories', coverage.verifiedMetricCount === 1)
}
{
  const coverage = computeEvidenceCoverage([])
  record('Zero stories: every canonical competency reported as missing, none fabricated as covered', coverage.covered.every((c) => !c.covered))
  record('Zero stories: strongestStory is null, not a fabricated placeholder', coverage.strongestStory === null)
}

console.log(`\n  Interview readiness/evidence test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
