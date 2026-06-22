#!/usr/bin/env node --experimental-strip-types
// Pure logic tests for the AI-generation overwrite guard — the mechanism that decides
// whether regenerating a portfolio is safe or needs the user to confirm an overwrite first.
import { hasRealContent, isEditedSinceGeneration } from '../src/lib/portfolio/guard.ts'

let PASS = 0
let FAIL = 0

function assert(cond, label, detail = '') {
  if (cond) {
    console.log(`  ✅ ${label}`)
    PASS++
  } else {
    console.log(`  ❌ ${label} ${detail}`)
    FAIL++
  }
}

// ── hasRealContent ──────────────────────────────────────────────────────────
assert(hasRealContent({}) === false, 'Empty object has no real content')
assert(hasRealContent(null) === false, 'null has no real content')
assert(hasRealContent(undefined) === false, 'undefined has no real content')
assert(hasRealContent('not an object') === false, 'Non-object input has no real content')
assert(hasRealContent({ hero: null }) === false, 'Object with only null values has no real content')
assert(hasRealContent({ hero: {} }) === false, 'Object with only empty nested objects has no real content')
assert(hasRealContent({ hero: { headline: 'Senior Engineer' } }) === true, 'Object with a populated nested field has real content')
assert(hasRealContent({ proof: [] }) === false, 'Object with only empty arrays has no real content')

// ── isEditedSinceGeneration ──────────────────────────────────────────────────
const t0 = new Date('2026-01-01T00:00:00Z').toISOString()
const t0plus500ms = new Date('2026-01-01T00:00:00.5Z').toISOString()
const t0plus5s = new Date('2026-01-01T00:00:05Z').toISOString()

assert(
  isEditedSinceGeneration({}, t0, null) === false,
  'Never-generated empty draft does not require confirmation (first generation)'
)
assert(
  isEditedSinceGeneration({ hero: { headline: 'X' } }, t0, null) === true,
  'Never-generated but already-filled-in draft requires confirmation (hand-written content)'
)
assert(
  isEditedSinceGeneration({ hero: { headline: 'X' } }, t0, t0) === false,
  'Content untouched since the generation that produced it does not require confirmation'
)
assert(
  isEditedSinceGeneration({ hero: { headline: 'X' } }, t0plus500ms, t0) === false,
  'Sub-second clock skew between the same write does not falsely trigger confirmation'
)
assert(
  isEditedSinceGeneration({ hero: { headline: 'Y' } }, t0plus5s, t0) === true,
  'Content updated meaningfully after the last generation requires confirmation'
)

console.log(`\n  Generation overwrite-guard test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
