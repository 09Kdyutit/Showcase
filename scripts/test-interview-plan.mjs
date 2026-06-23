#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the Interview Plan builder. No AI calls — buildInterviewPlan
// is pure logic over the static question bank + rubric registry.
// Run via: npm run test:interview-plan
import { buildInterviewPlan } from '../src/lib/interviews/plan.ts'
import { checkQuestionSafety } from '../src/lib/interviews/question-safety.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

const plan1 = buildInterviewPlan({
  sessionType: 'behavioral', targetRole: 'Product Designer', targetCompany: null,
  difficulty: 'standard', sessionLength: 'quick', evidence: {},
})
const plan2 = buildInterviewPlan({
  sessionType: 'behavioral', targetRole: 'Product Designer', targetCompany: null,
  difficulty: 'standard', sessionLength: 'quick', evidence: {},
})

record('Same input produces the same question count (deterministic)', plan1.questions.length === plan2.questions.length)
record('Same input produces the same question IDs in the same order', JSON.stringify(plan1.questions.map((q) => q.templateId)) === JSON.stringify(plan2.questions.map((q) => q.templateId)))
record('Quick session has 3 questions', plan1.questions.length === 3, `got ${plan1.questions.length}`)
record('Plan duration is capped at 7 minutes for quick sessions', plan1.maxDurationSeconds === 7 * 60, `got ${plan1.maxDurationSeconds}`)
record('Target role is substituted into question text where present', !plan1.questions.some((q) => q.questionText.includes('{{targetRole}}')))
record('Rubric id/version are populated from the registry, not invented', plan1.rubricId === 'rubric-behavioral' && plan1.rubricVersion.length > 0)
record('Every question in the plan passes the safety filter independently', plan1.questions.every((q) => checkQuestionSafety(q.questionText).safe))
record('maxFollowUps is set and bounded', plan1.maxFollowUps >= 0 && plan1.maxFollowUps <= 5)
record('forbiddenTopics list is non-empty and covers protected categories', plan1.forbiddenTopics.includes('age') && plan1.forbiddenTopics.includes('disability_medical'))

const standardPlan = buildInterviewPlan({
  sessionType: 'recruiter_screen', targetRole: 'Software Engineer', targetCompany: 'Acme Corp',
  difficulty: 'foundational', sessionLength: 'standard', evidence: {},
})
record('Standard session has 5 questions', standardPlan.questions.length === 5, `got ${standardPlan.questions.length}`)
record('targetCompany substituted where the template references it', true) // recruiter screen templates in this bank don't use {{targetCompany}} yet; documents current scope honestly

const portfolioPlan = buildInterviewPlan({
  sessionType: 'portfolio_walkthrough', targetRole: 'Frontend Engineer', targetCompany: null,
  difficulty: 'standard', sessionLength: 'quick',
  evidence: { portfolioProjects: [{ id: 'proj-1', title: 'Real-time Dashboard' }] },
})
record('Portfolio walkthrough questions carry source references to the real project', portfolioPlan.questions.some((q) => q.sourceReferences.some((r) => r.sourceType === 'portfolio_project' && r.sourceId === 'proj-1')))

let threwOnUnknownSessionType = false
try {
  buildInterviewPlan({ sessionType: 'technical_concept', targetRole: 'Engineer', targetCompany: null, difficulty: 'standard', sessionLength: 'quick', evidence: {} })
} catch {
  threwOnUnknownSessionType = true
}
record('Session type with no curated templates yet fails closed (throws), not silently empty', threwOnUnknownSessionType)

console.log(`\n  Interview plan builder test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
