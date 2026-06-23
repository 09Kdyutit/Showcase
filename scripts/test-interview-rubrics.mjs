#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the rubric registry. Run via: npm run test:interview-rubrics
import { RUBRIC_PROFILES, DIMENSION_REGISTRY, scoreToBand } from '../src/lib/interviews/rubrics.ts'
import { SESSION_TYPES, DIMENSION_IDS } from '../src/lib/interviews/schemas.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

for (const sessionType of SESSION_TYPES) {
  const profile = RUBRIC_PROFILES[sessionType]
  record(`Rubric profile exists for ${sessionType}`, !!profile)
  const total = Object.values(profile.weights).reduce((a, b) => a + b, 0)
  record(`${sessionType} weights sum to 1.0`, Math.abs(total - 1) < 0.001, `got ${total}`)
  for (const dimId of Object.keys(profile.weights)) {
    record(`${sessionType}: dimension "${dimId}" is in DIMENSION_IDS`, DIMENSION_IDS.includes(dimId))
    record(`${sessionType}: dimension "${dimId}" applies to this session type per its definition`, DIMENSION_REGISTRY[dimId].appliesTo.includes(sessionType), `appliesTo=${DIMENSION_REGISTRY[dimId].appliesTo.join(',')}`)
  }
}

record('Every DIMENSION_IDS entry has a registry definition', DIMENSION_IDS.every((id) => !!DIMENSION_REGISTRY[id]))

// scoreToBand boundaries — whole-number bands, no decimal pseudo-precision anywhere in this module
record('scoreToBand(0) = starting', scoreToBand(0) === 'starting')
record('scoreToBand(34) = starting', scoreToBand(34) === 'starting')
record('scoreToBand(35) = building', scoreToBand(35) === 'building')
record('scoreToBand(54) = building', scoreToBand(54) === 'building')
record('scoreToBand(55) = practicing', scoreToBand(55) === 'practicing')
record('scoreToBand(69) = practicing', scoreToBand(69) === 'practicing')
record('scoreToBand(70) = interview_ready', scoreToBand(70) === 'interview_ready')
record('scoreToBand(84) = interview_ready', scoreToBand(84) === 'interview_ready')
record('scoreToBand(85) = strong', scoreToBand(85) === 'strong')
record('scoreToBand(100) = strong', scoreToBand(100) === 'strong')

console.log(`\n  Interview rubric test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
