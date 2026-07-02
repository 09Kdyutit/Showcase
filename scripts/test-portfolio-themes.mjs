#!/usr/bin/env node --experimental-strip-types
// Pure logic tests for the theme registry — no DB, no AI calls. Actual visual rendering of
// the three .tsx theme components is verified separately via real Playwright screenshots
// (capture:screenshots / the visual QA pass), since JSX can't be exercised by Node's
// type-stripping the way these plain .ts modules can.
import { THEME_IDS, THEME_REGISTRY, THEME_LIST, DEFAULT_THEME_ID, coerceThemeId } from '../src/lib/portfolio/themes.ts'

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

// The registry grew from 3 hand-built themes to 10 built-ins + 30 preset-engine themes.
// Don't hardcode the count — assert internal consistency instead.
assert(THEME_IDS.length >= 3, 'At least the 3 core themes registered', `(got ${THEME_IDS.length})`)
assert(new Set(THEME_IDS).size === THEME_IDS.length, 'No duplicate theme ids')
assert(Object.keys(THEME_REGISTRY).length === THEME_IDS.length, 'THEME_REGISTRY covers every THEME_ID exactly', `(registry ${Object.keys(THEME_REGISTRY).length} vs ids ${THEME_IDS.length})`)
assert((THEME_IDS).includes('executive-dark'), 'executive-dark is registered')
assert((THEME_IDS).includes('clean-editorial'), 'clean-editorial is registered')
assert((THEME_IDS).includes('creative-case-study'), 'creative-case-study is registered')

for (const id of THEME_IDS) {
  const meta = THEME_REGISTRY[id]
  assert(!!meta, `${id} has a registry entry`)
  assert(typeof meta?.name === 'string' && meta.name.length > 0, `${id} has a non-empty name`)
  assert(typeof meta?.description === 'string' && meta.description.length > 20, `${id} has a real description`)
  assert(Array.isArray(meta?.recommendedRoles) && meta.recommendedRoles.length >= 3, `${id} lists at least 3 recommended roles`)
  assert(!!meta?.swatch?.bg && !!meta?.swatch?.accent && !!meta?.swatch?.text, `${id} has a complete swatch`)
}

// Descriptions and recommended-role sets must genuinely differ — guards against three
// entries that are really the same theme with different names.
const descriptions = new Set(THEME_IDS.map((id) => THEME_REGISTRY[id].description))
assert(descriptions.size === THEME_IDS.length, 'All theme descriptions are distinct')
const roleSets = THEME_IDS.map((id) => THEME_REGISTRY[id].recommendedRoles.join('|'))
assert(new Set(roleSets).size === THEME_IDS.length, 'All theme recommended-role sets are distinct')

assert(THEME_LIST.length === THEME_IDS.length, 'THEME_LIST matches THEME_IDS length')
assert(THEME_LIST.every((m, i) => m.id === THEME_IDS[i]), 'THEME_LIST order matches THEME_IDS order')

// coerceThemeId — the actual safety net every render path depends on
for (const id of THEME_IDS) {
  assert(coerceThemeId(id) === id, `coerceThemeId passes through valid id "${id}"`)
}
assert(coerceThemeId('dark') === 'executive-dark', 'Legacy "dark" value aliases to executive-dark')
assert(coerceThemeId(null) === DEFAULT_THEME_ID, 'coerceThemeId(null) falls back to default')
assert(coerceThemeId(undefined) === DEFAULT_THEME_ID, 'coerceThemeId(undefined) falls back to default')
assert(coerceThemeId('') === DEFAULT_THEME_ID, 'coerceThemeId("") falls back to default')
assert(coerceThemeId('totally-made-up-theme') === DEFAULT_THEME_ID, 'coerceThemeId(unknown) falls back to default')
assert(coerceThemeId('Executive-Dark') === DEFAULT_THEME_ID, 'coerceThemeId is case-sensitive, not case-fuzzy-matched (falls back rather than guessing)')
assert((THEME_IDS).includes(DEFAULT_THEME_ID), 'DEFAULT_THEME_ID is itself a real, valid theme')

console.log(`\n  Portfolio theme registry test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
