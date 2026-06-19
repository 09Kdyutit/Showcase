#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the Truth Ledger export guard and ATS coverage scan used by
// /api/resume/export. These are the gates that stop a fabricated claim from reaching a
// downloaded DOCX. Run via: npm run test:truth-ledger
import { getUnconfirmedFabricationRisks, computeCoverage, extractTextFromDocx, slugify } from '../src/lib/jobs/truth-ledger.ts'

let PASS = 0
let FAIL = 0

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✅ ${label}`)
    PASS++
  } else {
    console.log(`  ❌ ${label} — expected ${e}, got ${a}`)
    FAIL++
  }
}

// ── Case 1: export blocked — fabrication risk awaiting confirmation ───────────
{
  const truthMap = [{ requires_confirmation: true, user_confirmed: null }]
  assertEqual(getUnconfirmedFabricationRisks(truthMap).length, 1, 'Case 1: unconfirmed (null) entry blocks export')
}

// ── Case 2: export blocked — user explicitly flagged statement as inaccurate ──
{
  const truthMap = [{ requires_confirmation: true, user_confirmed: false }]
  assertEqual(getUnconfirmedFabricationRisks(truthMap).length, 1, 'Case 2: explicitly-rejected (false) entry blocks export')
}

// ── Case 3: export allowed — entry confirmed accurate ──────────────────────────
{
  const truthMap = [{ requires_confirmation: true, user_confirmed: true }]
  assertEqual(getUnconfirmedFabricationRisks(truthMap).length, 0, 'Case 3: confirmed (true) entry does not block export')
}

// ── Case 4: export allowed — entry never required confirmation ────────────────
{
  const truthMap = [{ requires_confirmation: false, user_confirmed: null }]
  assertEqual(getUnconfirmedFabricationRisks(truthMap).length, 0, 'Case 4: entry not requiring confirmation never blocks export')
}

// ── Case 5: mixed truth map — only unconfirmed entries counted ────────────────
{
  const truthMap = [
    { requires_confirmation: true, user_confirmed: true },
    { requires_confirmation: true, user_confirmed: null },
    { requires_confirmation: false, user_confirmed: null },
    { requires_confirmation: true, user_confirmed: false },
  ]
  assertEqual(getUnconfirmedFabricationRisks(truthMap).length, 2, 'Case 5: mixed truth map blocks on exactly the 2 unresolved entries')
}

// ── Case 6: full parsed resume reaches 100% ATS coverage ───────────────────────
{
  const parsed = {
    name: 'Alex Chen', email: 'alex@example.com', phone: '555-1234', location: 'NYC',
    summary: 'Senior product designer with 5 years of experience leading 0-to-1 launches.',
    skills: ['Figma', 'Design systems'],
    experience: [{ company: 'Stripe', role: 'Product Designer', period: '2020 — 2022', bullets: ['Redesigned checkout, increasing completion 24%'] }],
    education: [{ institution: 'NYU', degree: 'BFA Design' }],
  }
  const text = extractTextFromDocx(null, parsed)
  const coverage = computeCoverage(text, null, parsed)
  assertEqual(coverage.coverage_pct, 100, 'Case 6: complete parsed resume reaches 100% coverage')
  assertEqual(coverage.sections_missing.length, 0, 'Case 6: no sections missing')
}

// ── Case 6b: tailored content can never show "education" — it has no field for it ─
{
  const content = {
    professional_summary: 'Senior product designer with 5 years experience',
    skills: ['Figma', 'Design systems'],
    experience: [{
      company: 'Stripe', role: 'Product Designer', period: '2020 — 2022',
      tailored_bullets: [{ tailored: 'Redesigned checkout, increasing completion 24% in 2021', accepted: true }],
    }],
    cover_letter: null,
  }
  const text = extractTextFromDocx(content, null)
  const coverage = computeCoverage(text, content, null)
  assertEqual(coverage.sections_missing.includes('education'), true, 'Case 6b: tailored-content exports always flag "education" missing (no source field)')
}

// ── Case 7: parsed resume missing education is flagged ────────────────────────
{
  const parsed = {
    name: 'Alex Chen', email: 'alex@example.com', phone: '', location: '',
    summary: 'Product designer with strong UX research background',
    skills: ['Figma'],
    experience: [{ company: 'Figma', role: 'Designer', period: '2022—Present', bullets: ['Led design for core editor'] }],
    education: [],
  }
  const text = extractTextFromDocx(null, parsed)
  const coverage = computeCoverage(text, null, parsed)
  assertEqual(coverage.sections_missing.includes('education'), true, 'Case 7: empty education array is flagged missing')
}

// ── Case 8: source mapping — rejected bullets are excluded from exported text ─
{
  const content = {
    professional_summary: 'Summary',
    skills: [],
    experience: [{
      company: 'Acme', role: 'Engineer', period: '2021—2023',
      tailored_bullets: [
        { tailored: 'Shipped feature X used by 1M users', accepted: true },
        { tailored: 'Invented a fabricated claim about revenue', accepted: false },
      ],
    }],
    cover_letter: null,
  }
  const text = extractTextFromDocx(content, null)
  assertEqual(text.includes('Shipped feature X'), true, 'Case 8: accepted bullet is present in exported text')
  assertEqual(text.includes('fabricated claim'), false, 'Case 8: rejected (accepted=false) bullet is excluded from exported text')
}

// ── Case 9: filename slugification is safe and bounded ────────────────────────
{
  assertEqual(slugify('Senior Product Manager, Platform!!'), 'senior-product-manager-platform', 'Case 9: slugify lowercases and strips punctuation')
  assertEqual(slugify('--leading and trailing--'), 'leading-and-trailing', 'Case 9: slugify trims leading/trailing hyphens')
  assertEqual(slugify('x'.repeat(80)).length, 50, 'Case 9: slugify truncates to 50 chars')
}

// ── Case 10: missing 4-digit years flags the "dates" section ──────────────────
{
  const content = {
    professional_summary: 'A designer with strong taste',
    skills: ['Figma'],
    experience: [{ company: 'Acme', role: 'Designer', period: 'Recently', tailored_bullets: [{ tailored: 'Did great work', accepted: true }] }],
    cover_letter: null,
  }
  const text = extractTextFromDocx(content, null)
  const coverage = computeCoverage(text, content, null)
  assertEqual(coverage.sections_missing.includes('dates'), true, 'Case 10: no 4-digit year anywhere flags "dates" missing')
}

console.log(`\n  Truth Ledger: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
