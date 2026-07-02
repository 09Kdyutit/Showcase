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
  intro_60s: 'I am a product engineer with six years of experience building developer tools. For the last three years I led a small platform team, where I built the internal deployment system our whole engineering organisation now relies on, and before that I worked directly with customers to ship features that measurably improved retention. I care most about owning a problem end to end, from the first messy conversation with a user to the shipped, measured result. That is exactly the shape of this role, which is why I am here: I am looking to take the depth I have built in developer tooling and apply it to a product where the customer impact is direct and visible.',
  tell_me_about_yourself: 'I started my career as a backend engineer at a logistics startup, where I learned how to build systems that had to stay reliable under real operational pressure. After that, I moved into a role leading a small platform team of five engineers, where I focused on developer experience and internal tooling, and where I first started mentoring more junior engineers on the team. Currently I spend most of my time on infrastructure reliability work, and I have always been drawn to problems where reliability and speed both matter, which is part of why I am looking to make this move. I want a next step where I can own a meaningful piece of infrastructure end to end, work closely with the teams who depend on it day to day, and keep growing into more technical leadership over time. The responsibilities described for this role line up closely with that direction, and that is why I am excited to be talking with you today.',
  star_structure: 'We were two days from a critical client deadline and a key integration was still broken. I decided to take ownership of diagnosing the root cause overnight instead of waiting for the on-call rotation to pick it up the next morning. I identified a configuration mismatch between our staging and production environments, I wrote a fix, and I added a regression test so the same mismatch could never silently reappear. I also kept the account team updated every few hours so they could manage the client relationship with accurate information. As a result, we shipped on time, the integration has not broken the same way since, and the client renewed their contract the following quarter.',
  context_no_rambling: 'Our team was migrating a legacy billing system off a deprecated provider with a hard sixty day deadline before the old provider shut down entirely, and a huge share of our revenue depended on that migration going smoothly.',
  personal_ownership: 'I personally led the redesign of our onboarding flow after noticing a significant drop-off in the signup funnel data. I wrote the technical proposal myself and I built the first working version on my own before looping anyone else in. I decided to sequence the rollout behind a feature flag rather than launch it all at once, and I owned communicating the risks and the rollback plan to the rest of the team. As a result, signup completion improved noticeably within the first month, and the same rollout pattern was adopted for the two launches that followed.',
  quantify_impact: 'After I rebuilt the caching layer for our highest-traffic pages, page load times dropped from about 4 seconds down to under 600 milliseconds, roughly an 85 percent improvement. That number mattered because slow page loads were our single biggest source of support tickets at the time, and the rebuild directly reduced ticket volume during peak hours while lifting conversion on our two most important landing pages.',
  explain_tradeoffs: 'We had two options for the new reporting feature: either build a fully custom rendering engine or adopt an existing charting library. The custom approach would have given us complete control over the visual output, but it would have taken roughly twice as long to ship. I chose the library. We gave up fine-grained control over some edge-case layouts, and we knew we would hit customisation limits eventually. The reason was simple: at the time, shipping three weeks sooner mattered more than pixel-perfect control, because the feature was blocking two enterprise deals and the design team had confirmed the library covered the vast majority of what they needed.',
  clarify_question: 'Before I dive in, can I confirm what "slow" means here - page load time, API response time, or something users just perceive as sluggish? I ask because the fix would be completely different for each, and without knowing which metric matters most I might spend the week optimising the wrong thing entirely.',
  follow_up_handling: 'The concern is fair - a simpler solution was actually the first thing we considered. The reason I went with this approach is that we already knew traffic would triple within six months, and the simpler version would have needed a rewrite at exactly the moment we could least afford one. So the extra complexity was a deliberate tradeoff: we paid a known cost up front to avoid an unplanned migration later. In hindsight the growth projections held, and the system absorbed the load without a rewrite.',
  technical_explanation: 'Caching exists to solve a real problem: without it, every single request has to go all the way to the slowest part of the system, and everything you use feels sluggish. A cache is like a small desk next to your filing cabinet - instead of walking to the cabinet every time you need a document, you keep the ones you use most often sitting on the desk where they are much faster to reach. Computers do the same thing: the data you ask for most often is kept somewhere fast and close, so in practice the pages and apps you use every day respond in a fraction of the time they otherwise would.',
  portfolio_opening: 'New users were abandoning signup halfway through the flow because the form asked for too much information up front, and our support team was fielding constant complaints from confused customers who gave up partway through and never came back. The problem was expensive: every week we were losing signups we had already paid to acquire, so the cost showed up directly in our acquisition numbers. That is the gap this project was built to close.',
  failure_reflection: 'I shipped a feature without enough testing and it caused a real outage for a few hours, which affected a noticeable share of our active users during a busy period. I underestimated how risky a change touching the billing path was, and I didn\'t test it against realistic production-shaped data before shipping. The specific lesson was not "be more careful" - it was that critical-path changes need a different bar than everything else. Since then I always require a second review and a staging soak period before anything touches billing code, and I have not had a repeat incident of that kind.',
  conflict_no_blame: 'A teammate and I disagreed strongly about which database to use for a new service, and the disagreement got fairly tense for a couple of days. Instead of escalating it, I suggested we each write up our reasoning separately, and once I read his write-up I could see why he preferred the relational option - his concern was consistency guarantees under concurrent writes, which my proposal handled less cleanly. We walked through the real tradeoffs together in a shared document, and ultimately we agreed on a hybrid approach that addressed his consistency concern and my concern about development speed.',
  closing_questions: 'What does success look like for this role after the first six months, and what would make you say the hire exceeded expectations? Also, what is the hardest part of this job that I would not learn from the description alone?',
  time_boxed_answer: 'I have shipped production systems end to end, I take ownership of problems beyond my immediate scope, and I communicate clearly under pressure. You should hire me because those three things are exactly what this role demands: I led the last migration my team shipped, reduced our deploy time by half, and kept stakeholders informed the whole way through. That is why I am confident I can contribute from the first week rather than the first quarter.',
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
