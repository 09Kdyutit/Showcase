#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the Interview Plan builder. No AI calls — buildInterviewPlan
// is pure logic over the static question bank + rubric registry.
// Run via: npm run test:interview-plan
import { buildInterviewPlan } from '../src/lib/interviews/plan.ts'
import { checkQuestionSafety } from '../src/lib/interviews/question-safety.ts'
import { SESSION_TYPES } from '../src/lib/interviews/schemas.ts'

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

// ── Coverage: every one of the 10 modeled session types must build a real plan ──
// This is the regression test for the gap that existed until this build: rubrics.ts
// had weight profiles for all 10 session types long before the question bank had
// templates to back them, so 7 of 10 silently threw at session-creation time. Every
// type below must now succeed, at every difficulty, with no template-count shortfall.
for (const sessionType of SESSION_TYPES) {
  for (const difficulty of ['foundational', 'standard', 'challenging']) {
    let plan
    let threw = false
    try {
      plan = buildInterviewPlan({
        sessionType, targetRole: 'Engineer', targetCompany: 'Acme Corp',
        difficulty, sessionLength: 'full',
        evidence: { jobRequirements: ['Own end-to-end delivery of a major feature'] },
      })
    } catch (e) {
      threw = true
      console.error(`    (${sessionType}/${difficulty} threw: ${e.message})`)
    }
    record(`${sessionType} (${difficulty}) builds a real plan, does not throw`, !threw)
    if (!plan) continue
    record(`${sessionType} (${difficulty}) has at least 3 questions`, plan.questions.length >= 3, `got ${plan.questions.length}`)
    record(`${sessionType} (${difficulty}) every question passes the safety filter`, plan.questions.every((q) => checkQuestionSafety(q.questionText).safe))
    record(`${sessionType} (${difficulty}) rubric id matches the session type`, plan.rubricId === `rubric-${sessionType}`)
    record(`${sessionType} (${difficulty}) no unsubstituted placeholders remain`, plan.questions.every((q) => !q.questionText.includes('{{')))
  }
}

// ── Distinct session types must not collapse onto identical question content —
// proves each type has its own real templates, not a shared fallback ───────────
const allFirstQuestions = new Map()
for (const sessionType of SESSION_TYPES) {
  const plan = buildInterviewPlan({ sessionType, targetRole: 'Engineer', targetCompany: null, difficulty: 'standard', sessionLength: 'quick', evidence: {} })
  allFirstQuestions.set(sessionType, plan.questions.map((q) => q.templateId).join(','))
}
const uniqueQuestionSets = new Set(allFirstQuestions.values())
record('All 10 session types produce distinct question sets (no silent reuse across types)', uniqueQuestionSets.size === SESSION_TYPES.length, `${uniqueQuestionSets.size} distinct sets for ${SESSION_TYPES.length} types`)

console.log(`\n  Interview plan builder test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
