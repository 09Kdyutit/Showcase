#!/usr/bin/env node --experimental-strip-types
// Proves the "For You" feed's hard role-family filter actually rejects unrelated role
// families, not just low skill-overlap scores. Run via: npm run test:taxonomy
import { classifyRoleFamily, isSameOrAdjacentFamily, isAdjacentFamily } from '../src/lib/jobs/role-taxonomy.ts'

let PASS = 0
let FAIL = 0

function assertEqual(actual, expected, label) {
  if (actual === expected) { console.log(`  ✅ ${label}`); PASS++ }
  else { console.log(`  ❌ ${label} — expected ${expected}, got ${actual}`); FAIL++ }
}

// ── Classification ───────────────────────────────────────────────────────────
assertEqual(classifyRoleFamily('Senior Software Engineer'), 'engineering', 'Software Engineer classifies as engineering')
assertEqual(classifyRoleFamily('Wastewater Process Engineer'), 'industrial_engineering', 'Wastewater Process Engineer classifies as industrial_engineering, not engineering')
assertEqual(classifyRoleFamily('Product Designer'), 'design', 'Product Designer classifies as design')
assertEqual(classifyRoleFamily('Senior Product Manager, Platform'), 'product', 'Product Manager classifies as product')
assertEqual(classifyRoleFamily('Mechanical Engineer'), 'industrial_engineering', 'Mechanical Engineer classifies as industrial_engineering, not engineering')
assertEqual(classifyRoleFamily('Data Engineer'), 'data', 'Data Engineer classifies as data, not engineering')
assertEqual(classifyRoleFamily('Some Completely Novel Made-Up Title'), null, 'Unrecognized title classifies as null (uncertain, not excluded)')

// ── The prompt's explicit examples ───────────────────────────────────────────
const swe = classifyRoleFamily('Software Engineer')
const wastewater = classifyRoleFamily('Wastewater Process Engineer')
const designer = classifyRoleFamily('Product Designer')
const pm = classifyRoleFamily('Product Manager')

assertEqual(isSameOrAdjacentFamily(swe, wastewater, false), false, 'Software Engineer and Wastewater Process Engineer: NOT same/adjacent (strict mode)')
assertEqual(isSameOrAdjacentFamily(swe, wastewater, true), false, 'Software Engineer and Wastewater Process Engineer: NOT adjacent even with toggle on')
assertEqual(isSameOrAdjacentFamily(designer, wastewater, true), false, 'Product Designer and Wastewater Process Engineer: NOT adjacent even with toggle on')
assertEqual(isSameOrAdjacentFamily(swe, pm, true), false, 'Software Engineer and Product Manager: NOT adjacent even with toggle on (not automatically interchangeable)')

// ── Legitimate adjacency (sparse, conservative) ──────────────────────────────
const designFamily = classifyRoleFamily('UX Designer')
assertEqual(isSameOrAdjacentFamily(pm, designFamily, false), false, 'Product and Design: excluded in strict mode')
assertEqual(isSameOrAdjacentFamily(pm, designFamily, true), true, 'Product and Design: included when adjacent toggle is on')
assertEqual(isAdjacentFamily(pm, designFamily), true, 'Product/Design correctly flagged as adjacent (for the UI badge)')
assertEqual(isAdjacentFamily(swe, classifyRoleFamily('Data Engineer')), true, 'Engineering/Data correctly flagged as adjacent')

// ── Same family always passes regardless of toggle ───────────────────────────
assertEqual(isSameOrAdjacentFamily(swe, classifyRoleFamily('Staff Engineer'), false), true, 'Same family (engineering) passes in strict mode')
assertEqual(isAdjacentFamily(swe, classifyRoleFamily('Staff Engineer')), false, 'Same family is not flagged as "adjacent" (it is an exact match)')

console.log(`\n  Role taxonomy: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
