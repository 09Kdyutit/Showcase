#!/usr/bin/env node
// Unit tests for evals/lib/graders.mjs itself — specifically proving checkNoUnsupportedNumbers
// correctly distinguishes three cases that look superficially similar but are not:
//   (1) a genuinely invented number with no basis in source at all -> must FAIL
//   (2) a direct source number reused verbatim -> must PASS
//   (3) a percentage that is a real, exact derived computation from two literal source
//       numbers (e.g. "4s to 600ms" -> "85% reduction") -> must PASS
//   (4) a percentage that resembles a derived computation but doesn't match any real pair
//       of source numbers -> must FAIL (the grader doesn't just wave through any "%" value)
import { checkNoUnsupportedNumbers } from '../evals/lib/graders.mjs'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

const NO_PROJECT_SOURCE = `Backend Engineer, Ferrowave (2020-present)
- Rebuilt the order-processing service, cutting average processing time from 4s to 600ms
- On-call lead for the payments team for 2 years with zero missed SLA incidents`

// Case 1: genuinely invented number, zero basis in source.
{
  const result = checkNoUnsupportedNumbers('Drove a 92% increase in customer satisfaction.', NO_PROJECT_SOURCE)
  record('Case 1: invented "92%" with no source basis is flagged unsupported', !result.pass, JSON.stringify(result.unsupported))
}

// Case 2: direct reuse of a literal source number — must pass.
{
  const result = checkNoUnsupportedNumbers('Cut processing time to 600ms.', NO_PROJECT_SOURCE)
  record('Case 2: literal source number "600" reused verbatim passes', result.pass)
}

// Case 3: the exact real-world case this fix targets — a correct derived percentage.
{
  const result = checkNoUnsupportedNumbers('Reduced processing time by 85% (4s to 600ms).', NO_PROJECT_SOURCE)
  record('Case 3: verified derived "85%" (exactly (4000-600)/4000) passes', result.pass, JSON.stringify(result.unsupported))
}

// Case 4: a percentage that LOOKS like it could be derived but doesn't match any real pair —
// the grader must not become a rubber stamp for any "%" value once arithmetic checking exists.
{
  const result = checkNoUnsupportedNumbers('Reduced processing time by 73%.', NO_PROJECT_SOURCE)
  record('Case 4: unverifiable "73%" (no source pair produces it) is still flagged unsupported', !result.pass, JSON.stringify(result.unsupported))
}

// Case 5: a different real derived pair — sanity check the arithmetic isn't hardcoded to 85.
{
  const source = 'Grew the team from 12 to 65 people across 3 offices.'
  const result = checkNoUnsupportedNumbers('Grew headcount by 442%.', source) // (65-12)/12 = 4.4166... -> rounds to 442
  record('Case 5: a different verified derived percentage (442% from 12->65) passes', result.pass, JSON.stringify(result.unsupported))
}

// Case 6: real eval-discovered case — a derived percentage the model truncated instead of
// rounding. (6.8-4.1)/4.1*100 = 65.85...%; "65%" is the floor, "66%" would be the round. Both
// describe the exact same source-grounded computation and must both pass.
{
  const source = 'Increased trial-to-paid conversion from 4.1% to 6.8% via 11 shipped experiments.'
  const truncated = checkNoUnsupportedNumbers('Drove a 65% relative increase in conversion.', source)
  const rounded = checkNoUnsupportedNumbers('Drove a 66% relative increase in conversion.', source)
  record('Case 6a: truncated derived "65%" (floor of 65.85%) passes', truncated.pass, JSON.stringify(truncated.unsupported))
  record('Case 6b: rounded derived "66%" (round of 65.85%) also passes', rounded.pass, JSON.stringify(rounded.unsupported))
}

// Case 7: the ±1 tolerance must not become a rubber stamp — a percentage 2+ points off any
// real source pair is still flagged.
{
  const source = 'Increased trial-to-paid conversion from 4.1% to 6.8% via 11 shipped experiments.'
  const result = checkNoUnsupportedNumbers('Drove a 70% relative increase in conversion.', source)
  record('Case 7: "70%" (4 points off the real 65.85%) is still flagged unsupported', !result.pass, JSON.stringify(result.unsupported))
}

console.log(`\n  Eval grader tests: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
