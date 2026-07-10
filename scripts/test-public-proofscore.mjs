#!/usr/bin/env node --experimental-strip-types

import { readFileSync } from 'node:fs'
import { buildPublicProofScore } from '../src/lib/proofscore/public-tool.ts'
import { buildReferralMessage, buildReferralUrl } from '../src/lib/referrals/share.ts'

let passed = 0
let failed = 0

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

function fixture() {
  return {
    name: 'Alex Example',
    email: 'alex.private@example.com',
    phone: null,
    location: 'New York',
    summary: 'Software engineer building reliable web products for small teams.',
    skills: ['TypeScript', 'React', 'Postgres', 'Node.js'],
    experience: [{
      company: 'Acme',
      role: 'Software Engineer',
      period: '2023–Present',
      bullets: [
        'Built internal tools for the support team.',
        'Reduced report preparation time from 4 hours to 45 minutes.',
      ],
      metrics: ['4 hours to 45 minutes'],
      has_metrics: true,
    }],
    education: [],
    projects: [{
      title: 'Support dashboard',
      description: 'Created a dashboard for the support team to review customer issues.',
      technologies: ['React'],
      links: [],
      has_outcome: false,
    }],
    certifications: [],
    links: { linkedin: null, github: null, website: null, portfolio: null },
    weak_bullets: ['Built internal tools for the support team.'],
    missing_proof: ['No measured outcome for the support dashboard.'],
    possible_case_studies: ['Support dashboard'],
    overall_resume_quality: 'average',
    years_of_experience: 2,
    seniority_level: 'junior',
  }
}

console.log('── Public ProofScore determinism ──')
{
  const first = buildPublicProofScore(fixture(), 'Frontend Engineer', 'Technology')
  const second = buildPublicProofScore(fixture(), 'Frontend Engineer', 'Technology')
  assert(JSON.stringify(first) === JSON.stringify(second), 'identical structured input returns byte-identical output')
}

console.log('\n── Honest 11-score surface and two-fix gate ──')
{
  const result = buildPublicProofScore(fixture(), 'Frontend Engineer', 'Technology')
  const unlocked = result.categories.filter((category) => !category.gated)
  const gated = result.categories.filter((category) => category.gated)
  assert(result.categories.length === 11, 'all 11 engine categories are returned')
  assert(result.categories.every((category) => Number.isInteger(category.score) && category.score >= 0 && category.score <= 100), 'all 11 category scores are visible numeric values')
  assert(unlocked.length === 2, 'exactly the two worst fixes are unlocked')
  assert(unlocked.every((category) => category.fix && category.explanation && category.example && category.evidence?.length), 'both unlocked categories contain complete evidence and fixes')
  assert(gated.length === 9, 'the remaining nine categories are gated')
  assert(gated.every((category) => category.fix === null && category.explanation === null && category.example === null && category.evidence === null), 'gated fixes are not serialized to the browser payload')

  const ranked = [...result.categories].sort((a, b) => a.score - b.score || b.weight - a.weight || a.priority - b.priority)
  assert(unlocked.map((category) => category.key).sort().join(',') === ranked.slice(0, 2).map((category) => category.key).sort().join(','), 'unlocked fixes correspond to the two lowest scores')

  const weighted = Math.round(result.categories.reduce((sum, category) => sum + category.score * category.weight, 0) / 100)
  assert(result.overallScore === weighted, 'overall score is the fixed weighted average of all 11 visible scores')
  assert(result.categories.find((category) => category.key === 'case_study_quality')?.score === 0, 'missing resume-only case study is scored zero instead of guessed')
}

console.log('\n── Privacy and truth-safe copy ──')
{
  const serialized = JSON.stringify(buildPublicProofScore(fixture(), 'Frontend Engineer', 'Technology'))
  assert(!serialized.includes('alex.private@example.com'), 'result payload does not echo the candidate email')
  assert(!serialized.includes('Alex Example'), 'result payload does not echo the candidate name')
  assert(serialized.includes('[verified'), 'fix examples use explicit verified placeholders rather than invented outcomes')
}

console.log('\n── Referral sharing stays explicit and editable ──')
{
  const url = buildReferralUrl('https://tryshowcase.ink/', 'A B+C')
  const message = buildReferralMessage(url)
  assert(url === 'https://tryshowcase.ink/signup?ref=A%20B%2BC', 'referral URL is normalized and encoded')
  assert(message.includes(url), 'editable share message contains the explicit referral URL')
  assert(!message.toLowerCase().includes('auto'), 'share copy makes no automatic-send claim')
}

console.log('\n── Spend and reservation guardrails stay in front of the provider call ──')
{
  const route = readFileSync(new URL('../src/app/api/proofscore/score/route.ts', import.meta.url), 'utf8')
  const migration = readFileSync(new URL('../supabase/migrations/040_proofscore_public_capacity.sql', import.meta.url), 'utf8')
  const ipIndex = route.indexOf('await enforceAtomicLimit(')
  const capacityIndex = route.indexOf('await claimDailyCapacity(')
  const providerIndex = route.indexOf('await runPrompt(')
  assert(ipIndex >= 0 && ipIndex < providerIndex, 'IP quota is claimed before the AI provider call')
  assert(capacityIndex >= 0 && capacityIndex < providerIndex, 'global daily capacity is claimed before the AI provider call')
  assert(route.includes('recordPromptCost({ userId: null, meta })'), 'anonymous provider tokens enter the cost ledger')
  assert(migration.includes("pg_advisory_xact_lock(hashtextextended('proofscore-capacity:'"), 'daily claims and reservations serialize under the same advisory lock')
  assert(migration.includes('25 - v_reserved'), 'reserved slots are removed from general next-day capacity first')
  assert(migration.includes("status <> 'reserved'"), 'reservation links are enforced as one-use')
  assert(migration.includes('reserved_for < v_today'), 'reservation email rows are deleted after their audit day')
}

console.log(`\nPublic ProofScore test: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
