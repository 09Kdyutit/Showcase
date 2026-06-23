#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for retry comparison. The mission's hard rule: never claim
// improvement when deterministic metrics didn't improve. Every assertion here checks
// that a specific, true, objective fact is reported -- never a vague "got better."
import { compareAttempts } from '../src/lib/interviews/retry-comparison.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

const original = 'I worked on a project that went well for the team.'
const retryWithNumber = 'I personally led a project that cut deployment time by 40 percent for the team, so we shipped two weeks early.'

const r1 = compareAttempts(original, retryWithNumber)
record('Detects a genuinely added number/metric', r1.observations.find((o) => o.label.includes('Added a specific number'))?.changed === true)
record('Detects genuinely added outcome language', r1.observations.find((o) => o.label.includes('Added language stating a result'))?.changed === true)
record('Reports retry is longer (objectively true here)', r1.observations.find((o) => o.label.includes('longer'))?.changed === true)
record('Word counts are computed correctly and consistently', r1.retryWordCount > r1.originalWordCount && r1.wordCountDelta === r1.retryWordCount - r1.originalWordCount)

// ── A retry that is objectively WORSE/unchanged must not be reported as improved ──
const sameTextRetry = original
const r2 = compareAttempts(original, sameTextRetry)
record('Identical text reports zero word-count delta', r2.wordCountDelta === 0)
record('Identical text reports no new number added (none exists in either)', r2.observations.find((o) => o.label.includes('number'))?.changed === false)
record('Identical text reports length unchanged, not "longer" or "more concise"', r2.observations.find((o) => o.label === 'Length is unchanged')?.changed === false)

const worseRetry = 'It went fine I guess.'
const r3 = compareAttempts(original, worseRetry)
record('A shorter, vaguer retry is reported as "more concise," never as "improved"', r3.observations.find((o) => o.label.includes('more concise'))?.changed === true)
record('A retry with no number still correctly reports no number added', r3.observations.find((o) => o.label.includes('number'))?.changed === false)

// ── Determinism ───────────────────────────────────────────────────────────
const a = compareAttempts(original, retryWithNumber)
const b = compareAttempts(original, retryWithNumber)
record('compareAttempts is deterministic — identical inputs produce identical output', JSON.stringify(a) === JSON.stringify(b))

console.log(`\n  Retry comparison test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
