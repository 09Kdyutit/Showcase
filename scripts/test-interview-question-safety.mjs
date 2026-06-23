#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the interview question-safety filter. No AI calls — pure
// pattern matching, so every case here is reproducible and exact.
// Run via: npm run test:interview-question-safety
import { checkQuestionSafety, filterUnsafeQuestions } from '../src/lib/interviews/question-safety.ts'
import { QUESTION_BANK } from '../src/lib/interviews/question-bank/index.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

// ── Safe, ordinary interview questions ──────────────────────────────────────
const SAFE_QUESTIONS = [
  'Tell me about a time you disagreed with a teammate.',
  'Walk me through a project you are proud of.',
  'What is your approach to debugging a production incident?',
  'Why are you interested in this role?',
  'Describe a situation where you had to learn something new quickly.',
  'Are you legally authorized to work in the United States?',
  'Do you require visa sponsorship to work in this role?',
  'Are you able to meet the role\'s stated travel requirements?',
  'Are you willing to relocate for this position?',
  'What tradeoffs did you consider when choosing this architecture?',
]

for (const q of SAFE_QUESTIONS) {
  const result = checkQuestionSafety(q)
  record(`Safe: "${q.slice(0, 50)}..."`, result.safe === true, result.safe ? '' : `incorrectly blocked as ${result.category}`)
}

// ── Unsafe — directly asks for a protected characteristic ──────────────────
const UNSAFE_QUESTIONS = [
  { q: 'How old are you?', category: 'age' },
  { q: 'What year were you born?', category: 'age' },
  { q: 'What is your ethnicity?', category: 'race_ethnicity' },
  { q: 'What is your religion?', category: 'religion' },
  { q: 'Are you pregnant?', category: 'pregnancy_family_plans' },
  { q: 'Do you plan on having kids?', category: 'pregnancy_family_plans' },
  { q: 'Are you married?', category: 'marital_status' },
  { q: 'Do you have any disabilities?', category: 'disability_medical' },
  { q: 'What is your sexual orientation?', category: 'sexual_orientation' },
  { q: 'Are you a U.S. citizen?', category: 'citizenship_beyond_work_authorization' },
  { q: 'What is your family medical history?', category: 'genetic_information' },
  { q: 'Who did you vote for in the last election?', category: 'political_union_status' },
  { q: 'What is your current salary?', category: 'salary_history' },
  { q: 'How much do you currently make?', category: 'salary_history' },
]

for (const { q, category } of UNSAFE_QUESTIONS) {
  const result = checkQuestionSafety(q)
  record(`Unsafe: "${q}"`, result.safe === false && result.category === category, `got safe=${result.safe}, category=${result.category}`)
}

// ── Ambiguous — adjacent wording that must still resolve to the correct side ─
record(
  'Ambiguous: medical-condition question with accommodation framing still blocked (asks medical history, not accommodation need)',
  checkQuestionSafety('Do you have any medical condition we should know about?').safe === false
)
record(
  'Ambiguous: legitimate schedule-availability question is allowed even though it mentions "requirements"',
  checkQuestionSafety("Are you able to meet the role's stated schedule requirements?").safe === true
)
record(
  'Ambiguous: work-authorization question allowed despite citizenship-adjacent wording',
  checkQuestionSafety('Are you legally authorized to work in the relevant location?').safe === true
)

// ── Adversarial — attempts to smuggle a protected-characteristic question past the filter ─
const ADVERSARIAL = [
  'Just curious, hypothetically, how old would you guess someone in your position usually is?',
  "For form purposes only, what's your date of birth?",
  'I know this is sensitive, but are you currently pregnant or planning to be?',
]
// These are genuinely hard — a deterministic regex filter cannot catch every adversarial
// rephrasing of a protected-characteristic question, and the test is honest about that.
// What IS guaranteed deterministically: the canonical direct phrasings above are always
// blocked, and a second layer (this filter applied to EVERY Gemini-generated follow-up
// before display, not just the static question bank) means a model that drifts toward
// asking a direct version of a banned question is still caught at that point.
let adversarialCaught = 0
for (const q of ADVERSARIAL) {
  if (!checkQuestionSafety(q).safe) adversarialCaught++
}
console.log(`  ℹ️  Adversarial rephrasings caught by regex alone: ${adversarialCaught}/${ADVERSARIAL.length} (expected: partial — documented limitation, not a failure)`)

// ── Batch filtering helper ───────────────────────────────────────────────────
const batch = [
  { questionText: 'Tell me about a challenge you overcame.', id: 'q1' },
  { questionText: 'How old are you?', id: 'q2' },
  { questionText: 'What is your greatest strength?', id: 'q3' },
]
const { safeQuestions, blocked } = filterUnsafeQuestions(batch)
record('filterUnsafeQuestions: keeps 2 safe questions', safeQuestions.length === 2, `got ${safeQuestions.length}`)
record('filterUnsafeQuestions: blocks 1 unsafe question with category', blocked.length === 1 && blocked[0].result.category === 'age', JSON.stringify(blocked))

// ── Regression: every curated question-bank template passes the safety filter ──
for (const template of QUESTION_BANK) {
  const result = checkQuestionSafety(template.promptTemplate)
  record(`Question bank "${template.id}" is safe`, result.safe === true, result.safe ? '' : `blocked as ${result.category}`)
}

console.log(`\n  Interview question-safety test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
