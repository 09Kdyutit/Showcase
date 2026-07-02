#!/usr/bin/env node
// Deterministic tests for the next-action recommendation engine. The mission's core
// rule this file enforces: the SERVER engine selects actions, not Gemini, and every
// action's reason must be traceable to a real field in the input — never a fixed
// generic string dressed up as personalization.
import { computeNextActions } from '../src/lib/interviews/recommendations.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

function baseInput(overrides = {}) {
  return {
    hasAnyCompletedSession: false, inProgressSession: null, pendingAnalysisSession: null,
    failedAnalysisSession: null, primaryReadinessGroup: null, retryOpportunity: null,
    storyBankGaps: { missingCompetencies: [], storiesNeedingOutcome: 0 },
    overdueDrills: [], selectedJob: null, liveVoiceAvailable: false, quotaReached: false,
    ...overrides,
  }
}

console.log('── Brand-new user: no data at all ──')
{
  const actions = computeNextActions(baseInput())
  record('Exactly one action: start a baseline session', actions.length === 1 && actions[0].id === 'start_baseline')
  record('Reason does not claim personalization that does not exist', !actions[0].reason.toLowerCase().includes('weakest'))
}

console.log('\n── In-progress session takes top priority over everything else ──')
{
  const actions = computeNextActions(baseInput({
    hasAnyCompletedSession: true,
    inProgressSession: { id: 'sess-1', sessionType: 'behavioral', targetRole: 'Product Designer' },
    storyBankGaps: { missingCompetencies: ['failure'], storiesNeedingOutcome: 2 },
  }))
  record('Resume action is first', actions[0].id === 'resume_session')
  record('Resume action links to the real session id', actions[0].destination.includes('sess-1'))
}

console.log('\n── Pending analysis is surfaced honestly, not hidden ──')
{
  const actions = computeNextActions(baseInput({ hasAnyCompletedSession: true, pendingAnalysisSession: { id: 'sess-2' } }))
  record('Pending-analysis action present', actions.some((a) => a.id === 'pending_analysis'))
}

console.log('\n── Failed analysis is surfaced honestly, never silently dropped ──')
{
  const actions = computeNextActions(baseInput({ hasAnyCompletedSession: true, failedAnalysisSession: { id: 'sess-3' } }))
  record('Failed-analysis action present', actions.some((a) => a.id === 'failed_analysis'))
}

console.log('\n── Real weakness drives a real drill recommendation, citing the real dimension and score ──')
{
  const actions = computeNextActions(baseInput({
    hasAnyCompletedSession: true,
    primaryReadinessGroup: {
      targetRole: 'Product Designer', sessionType: 'behavioral', comparableSessionCount: 3,
      weakDimensionIds: ['competency'],
      priority: { id: 'competency', label: 'Competency', score: 42, weight: 0.25 },
      strongest: { id: 'communication', label: 'Communication', score: 88, weight: 0.15 },
      dimensions: [
        { id: 'competency', label: 'Competency', score: 42, weight: 0.25 },
        { id: 'communication', label: 'Communication', score: 88, weight: 0.15 },
      ],
    },
  }), 5)
  const drillAction = actions.find((a) => a.id.startsWith('drill_'))
  record('A drill action exists', !!drillAction)
  record('Its reason cites the real score (42) of the real weak dimension', drillAction.reason.includes('42'))
  record('Its source is tagged real_weakness, not a generic fallback', drillAction.source === 'real_weakness')
}

console.log('\n── Single-sample readiness gets a confidence-building recommendation ──')
{
  const actions = computeNextActions(baseInput({
    hasAnyCompletedSession: true,
    primaryReadinessGroup: { targetRole: 'Product Designer', sessionType: 'behavioral', comparableSessionCount: 1, weakDimensionIds: [], priority: null, strongest: null },
  }))
  record('Recommends another session to firm up the n=1 estimate', actions.some((a) => a.id === 'more_sessions_for_confidence'))
}

console.log('\n── Story Bank gap: missing competency takes priority over "needs outcome" ──')
{
  const actions = computeNextActions(baseInput({
    hasAnyCompletedSession: true,
    storyBankGaps: { missingCompetencies: ['failure', 'ambiguity'], storiesNeedingOutcome: 3 },
  }))
  const storyAction = actions.find((a) => a.id === 'add_story')
  record('add_story action present and names the real missing competency', storyAction && storyAction.title.includes('Failure'))
  record('strengthen_story (outcome) is NOT also shown — missing competency is the more urgent gap', !actions.some((a) => a.id === 'strengthen_story'))
}

console.log('\n── No missing competencies, but stories need outcomes ──')
{
  const actions = computeNextActions(baseInput({
    hasAnyCompletedSession: true,
    storyBankGaps: { missingCompetencies: [], storiesNeedingOutcome: 4 },
  }))
  const action = actions.find((a) => a.id === 'strengthen_story')
  record('strengthen_story action cites the real count (4)', action && action.reason.includes('4'))
}

console.log('\n── Job-specific context produces a job-specific recommendation ──')
{
  const actions = computeNextActions(baseInput({
    hasAnyCompletedSession: true,
    selectedJob: { savedJobId: 'job-1', targetRole: 'Senior Designer', targetCompany: 'Acme' },
  }))
  const jobAction = actions.find((a) => a.id === 'job_specific_session')
  record('Job-specific action present and names the real role and company', jobAction && jobAction.title.includes('Senior Designer') && jobAction.title.includes('Acme'))
  record('Destination references the real saved job id', jobAction.destination.includes('job-1'))
}

console.log('\n── Retry opportunity cites the real question and dimension ──')
{
  const actions = computeNextActions(baseInput({
    hasAnyCompletedSession: true,
    retryOpportunity: { sessionId: 'sess-4', questionId: 'q-1', questionText: 'Tell me about a conflict with a teammate', weakDimensionLabel: 'Outcome and Impact' },
  }))
  const retryAction = actions.find((a) => a.id === 'retry_answer')
  record('Retry action present, cites the real question text and dimension', retryAction && retryAction.reason.includes('conflict') && retryAction.reason.includes('Outcome and Impact'))
}

console.log('\n── Action limit is respected ──')
{
  const actions = computeNextActions(baseInput({
    hasAnyCompletedSession: true,
    inProgressSession: { id: 's', sessionType: 'behavioral', targetRole: 'X' },
    retryOpportunity: { sessionId: 's', questionId: 'q', questionText: 'Q', weakDimensionLabel: 'D' },
    storyBankGaps: { missingCompetencies: ['failure'], storiesNeedingOutcome: 1 },
    selectedJob: { savedJobId: 'j', targetRole: 'R', targetCompany: null },
    overdueDrills: [{ drillType: 'star_structure', label: 'STAR Structure', competency: 'answer_structure' }],
  }), 3)
  record('Never returns more than the requested limit', actions.length <= 3)
}

console.log(`\n  Interview recommendation engine test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
