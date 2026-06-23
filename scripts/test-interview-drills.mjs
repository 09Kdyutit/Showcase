#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the drill catalog and its scoring. No AI calls — every
// check is a pure textual function, scored the same way every time on the same input.
import { DRILL_CATALOG, getDrillDefinition, recommendDrillsForDimensions } from '../src/lib/interviews/drills.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

record('Catalog has 15 drills', DRILL_CATALOG.length === 15, `got ${DRILL_CATALOG.length}`)
record('Every drill id is unique', new Set(DRILL_CATALOG.map((d) => d.id)).size === DRILL_CATALOG.length)
record('Every drill has minWords < maxWords', DRILL_CATALOG.every((d) => d.minWords < d.maxWords))
record('Every drill has a positive time limit', DRILL_CATALOG.every((d) => d.timeLimitSeconds > 0))
record('Every drill has a non-empty prompt and instructions', DRILL_CATALOG.every((d) => d.prompt.length > 0 && d.instructions.length > 0))

// ── Determinism: same input -> same output, every time ─────────────────────
const sample = DRILL_CATALOG[0]
const r1 = sample.check('I introduced myself clearly and connected my background to the role I want next.')
const r2 = sample.check('I introduced myself clearly and connected my background to the role I want next.')
record('check() is deterministic — same text produces the same score', r1.score === r2.score && r1.passed === r2.passed)

// ── Each drill must be genuinely satisfiable — a deliberately well-formed answer
// passes all of its own checks. This is the test that would have caught any drill
// whose criteria are accidentally impossible to meet. ─────────────────────────
const goodAnswers = {
  intro_60s: 'I am a product engineer with six years of experience building developer tools, and I am looking for a senior role where I can own a problem end to end. I have spent the last three years leading a small team, and before that I worked directly with customers to ship features that mattered to them. I am interested in this role because it combines technical depth with real customer impact, which is exactly the kind of work I do best.',
  tell_me_about_yourself: 'I started my career as a backend engineer at a logistics startup, where I learned how to build systems that had to stay reliable under real operational pressure. After about three years there, I moved into a role leading a small platform team, where I focused on developer experience and internal tooling, and where I first started mentoring more junior engineers on the team. I have always been drawn to problems where reliability and speed both matter, which is part of why I am looking for a role like this one. I want a next step where I can own a meaningful piece of infrastructure end to end, work closely with the teams who depend on it day to day, and keep growing into more technical leadership over time. I think the responsibilities described for this role line up closely with that direction, and that is why I am excited to be talking with you today.',
  star_structure: 'We had a critical client deadline with two days left and a key integration still broken. I personally took ownership of diagnosing the root cause overnight instead of waiting for the on-call rotation to pick it up the next morning. I traced the failure to a configuration mismatch between our staging and production environments, wrote a fix, and added a regression test so the same mismatch could never silently reappear. I also kept the account team updated every few hours so they could manage the client relationship with accurate information. As a result, we shipped on time, the integration has not broken the same way since, and the client renewed their contract the following quarter.',
  context_no_rambling: 'Our team was migrating a legacy billing system off a deprecated provider with a hard sixty day deadline before the old provider shut down entirely, and a huge share of our revenue depended on that migration going smoothly.',
  personal_ownership: 'I personally led the redesign of our onboarding flow after noticing a significant drop-off in the signup funnel data. I wrote the technical proposal myself, built the first working version on my own before looping anyone else in, and then brought in two other engineers once the direction was validated. I made the final call on how we sequenced the rollout, and I personally owned communicating the risks and the rollback plan to the rest of the team before we shipped anything to real users.',
  quantify_impact: 'After I rebuilt the caching layer for our highest-traffic pages, page load times dropped from about 4 seconds down to under 600 milliseconds, which works out to roughly an 85 percent improvement, and it directly reduced the number of support tickets we were getting about slow page loads during peak hours.',
  explain_tradeoffs: 'We could either ship a fully custom solution or adopt an existing library. The custom approach gave us more control, but it would have taken twice as long; instead we adopted the library and accepted less flexibility in exchange for shipping three weeks sooner.',
  clarify_question: 'Before I answer, can I confirm whether "faster" means page load time, server response time, or something else? Once I know which metric matters most, I can give you a much more specific answer.',
  follow_up_handling: 'I disagree with that read of it. The approach worked because we tested it against real production traffic for two weeks before rolling it out fully, and the data showed a clear improvement across every cohort we measured.',
  technical_explanation: 'A cache is like a small desk next to your filing cabinet — instead of walking all the way to the cabinet every single time you need a document, you keep the ones you use most often sitting on the desk where they are much faster to reach. That is similar to how a CPU cache keeps the most frequently used data close to the processor instead of fetching it from much slower main memory every time, which is part of why caching can make such a large difference for overall system performance.',
  portfolio_opening: 'The problem was that new users were abandoning signup halfway through the flow because the form asked for too much information up front, and our support team was fielding constant complaints from confused customers who gave up partway through and never came back to finish.',
  failure_reflection: 'I shipped a feature without enough testing and it caused a real outage for a few hours, which affected a noticeable share of our active users during a busy period. I learned that I had been moving too fast on a change that touched a critical path, and that I had skipped a review step I normally would not skip. Since then I always require a second review and a staging soak period before anything touches billing code, and I have not had a repeat incident of that kind.',
  conflict_no_blame: 'A teammate and I disagreed strongly about which database to use for a new service, and the disagreement got fairly tense for a couple of days. Instead of escalating it, we each wrote up our reasoning separately, walked through the real tradeoffs together in a shared document, and ultimately we agreed on a hybrid approach that addressed both of our underlying concerns about reliability and development speed.',
  closing_questions: 'What does success look like for this role after the first six months?',
  time_boxed_answer: 'I have shipped production systems end to end, I take ownership of problems beyond my immediate scope, and I communicate clearly under pressure. Those three things consistently show up in how I work.',
}

for (const drill of DRILL_CATALOG) {
  const answer = goodAnswers[drill.id]
  if (!answer) { record(`${drill.id}: has a good-answer fixture`, false); continue }
  const result = drill.check(answer)
  record(`${drill.id}: a well-formed answer passes all of its own checks`, result.passed, JSON.stringify(result.checks.filter((c) => !c.passed)))
}

// ── A clearly inadequate answer should fail at least one check for every drill ──
for (const drill of DRILL_CATALOG) {
  const result = drill.check('no.')
  record(`${drill.id}: a one-word non-answer fails at least one check`, !result.passed)
}

// ── Lookup + recommendation ─────────────────────────────────────────────────
record('getDrillDefinition finds a real drill by id', getDrillDefinition('star_structure')?.label === 'STAR Structure')
record('getDrillDefinition returns undefined for an unknown id', getDrillDefinition('not_a_real_drill') === undefined)

const recommended = recommendDrillsForDimensions(['outcome_and_impact'])
record('Recommending against a real weak competency returns matching drills', recommended.length > 0 && recommended.every((d) => d.competency === 'outcome_and_impact'))

const fallback = recommendDrillsForDimensions([])
record('Recommending with no weakness data falls back to foundational drills, not empty', fallback.length > 0)

console.log(`\n  Interview drills test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
