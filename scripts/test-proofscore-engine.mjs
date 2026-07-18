#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the ProofScore scoring engine. No AI calls — computeProofScore is
// pure arithmetic over structured resume/portfolio data, so every case here is reproducible
// and exact. Run via: npm run test:proofscore
import {
  CATEGORY_DEFINITIONS,
  FALLBACK_FIXES,
  PROOF_SCORE_DIMENSION_COUNT,
  computeProofScore,
  mergeAuditExplanation,
} from '../src/lib/proofscore/engine.ts'

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

function emptyResume(overrides = {}) {
  return {
    name: null, email: null, phone: null, location: null, summary: null,
    skills: [], experience: [], education: [], projects: [], certifications: [],
    links: {}, weak_bullets: [], missing_proof: [], possible_case_studies: [],
    overall_resume_quality: null, years_of_experience: null, seniority_level: null,
    ...overrides,
  }
}

function strongResume() {
  return emptyResume({
    name: 'Alex Chen',
    email: 'alex@example.com',
    summary: 'Senior software engineer specializing in backend systems and platform reliability.',
    skills: ['typescript', 'postgres', 'aws', 'react', 'node.js', 'kubernetes'],
    experience: [
      {
        company: 'Acme Corp', role: 'Senior Software Engineer', period: '2021 - Present',
        bullets: [
          'Reduced API latency by 42% by redesigning the caching layer.',
          'Led migration of 12 services to Kubernetes, cutting infra cost by $80k/year.',
          'Mentored 3 junior engineers on system design.',
        ],
        metrics: ['42% latency reduction', '$80k/year saved'],
      },
    ],
    education: [{ institution: 'State University', degree: 'B.S. Computer Science', year: '2018' }],
    projects: [{ title: 'OSS contribution', description: 'Maintained a popular open-source library used by thousands of projects.', technologies: ['typescript'], links: ['https://github.com/x'], has_outcome: true }],
    certifications: ['AWS Certified Solutions Architect'],
    links: { linkedin: 'https://linkedin.com/in/alexchen', github: 'https://github.com/alexchen' },
    weak_bullets: [],
    years_of_experience: 6,
    seniority_level: 'senior',
  })
}

console.log('── Reproducibility ──')
{
  const a = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology')
  const b = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology')
  assert(JSON.stringify(a) === JSON.stringify(b), 'Identical input produces an identical result (deterministic, not AI-judged)')
  assert(computeProofScore.length === 4, 'Scoring accepts content and target context only, with no plan parameter')
}

console.log('\n── Category coverage ──')
{
  const result = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology')
  const uniqueKeys = new Set(result.categories.map((category) => category.key))
  assert(result.categories.length === PROOF_SCORE_DIMENSION_COUNT, 'Exactly 11 fixed categories returned', `got ${result.categories.length}`)
  assert(uniqueKeys.size === PROOF_SCORE_DIMENSION_COUNT, 'All 11 category keys are unique', `got ${uniqueKeys.size}`)
  assert(CATEGORY_DEFINITIONS.reduce((s, c) => s + c.weight, 0) === 100, 'Category weights sum to exactly 100')
  assert(result.categories.every((c) => typeof c.name === 'string' && c.name.length > 0), 'Every category has a fixed, non-empty name')
  assert(result.categories.every((c) => c.gated === false), 'No Evidence Audit dimension is plan-gated')
}

console.log('\n── Empty resume scores low, not null/crash ──')
{
  const result = computeProofScore(emptyResume(), null, 'Software Engineer', 'Technology')
  assert(result.overall_score < 30, 'Empty resume scores low overall', `got ${result.overall_score}`)
  const contact = result.categories.find((c) => c.key === 'contact_readiness')
  assert(contact.score === 0, 'Contact readiness is 0 with no email/links', `got ${contact.score}`)
  assert(contact.evidence.length > 0, 'Low score still includes evidence explaining why')
}

console.log('\n── Strong resume scores meaningfully higher than empty ──')
{
  const strong = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology')
  const empty = computeProofScore(emptyResume(), null, 'Software Engineer', 'Technology')
  assert(strong.overall_score > empty.overall_score + 30, 'Strong resume scores substantially higher than empty', `strong=${strong.overall_score} empty=${empty.overall_score}`)
}

console.log('\n── Quantified impact reflects real bullet metrics ──')
{
  const withMetrics = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology')
  const noMetricsResume = strongResume()
  noMetricsResume.experience[0].bullets = ['Worked on backend systems.', 'Helped the team ship features.', 'Participated in code reviews.']
  noMetricsResume.experience[0].metrics = []
  const noMetrics = computeProofScore(noMetricsResume, null, 'Software Engineer', 'Technology')
  const qiWith = withMetrics.categories.find((c) => c.key === 'quantified_impact').score
  const qiWithout = noMetrics.categories.find((c) => c.key === 'quantified_impact').score
  assert(qiWith > qiWithout, 'Bullets with numbers score higher on quantified impact than bullets without', `with=${qiWith} without=${qiWithout}`)
}

console.log('\n── Plan-independent complete audit ──')
{
  // Extra legacy arguments are ignored by JavaScript. This guards against an old caller
  // accidentally reintroducing plan-dependent output while all typed callers use four args.
  const freeCall = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology', false)
  const proCall = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology', true)
  assert(JSON.stringify(freeCall) === JSON.stringify(proCall), 'The same evidence produces identical Free and Pro scores')
  assert(freeCall.categories.every((category) => category.gated === false), 'Free receives no gated category rows')
}

console.log('\n── Every dimension gets a dimension-specific fallback fix ──')
{
  const deterministic = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology')
  const merged = mergeAuditExplanation(deterministic, {
    summary: '',
    categories: [
      { key: 'role_positioning', explanation: '', issues: [], fix: '   ', example: '' },
      { key: 'unknown_dimension', explanation: 'Ignore me', issues: [], fix: 'Ignore me', example: '' },
      { key: 'role_positioning', explanation: 'Duplicate', issues: [], fix: 'Duplicate', example: '' },
    ],
    missing_evidence: [],
    top_priorities: [],
  })
  const uniqueKeys = new Set(merged.categories.map((category) => category.key))
  assert(merged.categories.length === 11 && uniqueKeys.size === 11, 'Missing, duplicate, or unknown AI rows cannot alter the 11 dimensions')
  assert(merged.categories.every((category) => category.gated === false), 'Merged audit has no gated rows')
  assert(merged.categories.every((category) => category.fix.trim().length > 0), 'Every merged dimension has a concrete non-empty fix')
  assert(merged.categories.every((category) => category.fix === FALLBACK_FIXES[category.key]), 'Missing or blank AI fixes use the matching dimension fallback')
  assert(new Set(Object.values(FALLBACK_FIXES)).size === 11, 'All 11 fallback fixes are dimension-specific')
  assert(merged.top_priorities.length === 3, 'Empty AI priorities fall back to the three highest-impact dimension fixes')
}

console.log('\n── No resume, portfolio only: resume-dependent categories degrade to null, not a guess ──')
{
  const portfolio = {
    hero: { headline: 'Product Designer', subheadline: 'I design products people love.', tagline: '' },
    about: { bio: '', values: [] },
    skills: [], experience: [],
    projects: [{ title: 'Redesign', role: 'Lead', summary: null, problem: 'Users were confused', process: 'Ran 10 interviews', outcome: 'Conversion up 18%', metrics: ['18%'], links: [{ label: 'Case study', url: 'https://x.com' }], tags: null }],
    proof: [], contact: { email: 'x@y.com', linkedin: null, github: null, website: null },
    cta: { headline: '', buttonLabel: '' },
  }
  const result = computeProofScore(null, portfolio, 'Product Designer', 'Tech')
  const evidenceStrength = result.categories.find((c) => c.key === 'evidence_strength')
  const caseStudy = result.categories.find((c) => c.key === 'case_study_quality')
  assert(evidenceStrength.score === null, 'evidence_strength is null without a resume, not a fabricated number', `got ${evidenceStrength.score}`)
  assert(caseStudy.score !== null && caseStudy.score > 0, 'case_study_quality computes from real portfolio project data', `got ${caseStudy.score}`)
}

console.log('\n── Private portfolio is sufficient for case-study context ──')
{
  const withoutPortfolio = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology')
  const caseStudy = withoutPortfolio.categories.find((category) => category.key === 'case_study_quality')
  assert(caseStudy.evidence.some((line) => /private draft is enough/i.test(line)), 'Missing case-study context explicitly accepts a private draft')
  assert(caseStudy.evidence.every((line) => !/publish.*unlock/i.test(line)), 'Case-study scoring never requires publication')
}

console.log('\n── Resume and selected portfolio contact signals merge without discarding real data ──')
{
  const resume = strongResume()
  resume.email = ''
  resume.links = { linkedin: '', github: '', website: '', portfolio: '' }
  const portfolio = {
    hero: { headline: '', subheadline: '', summary: '', location: '' },
    about: { bio: '', values: [] }, skills: [], experience: [], projects: [], proof: [],
    contact: {
      email: 'portfolio@example.com',
      linkedin: 'https://linkedin.com/in/portfolio-owner',
      github: '', website: '',
    },
    cta: { headline: '', buttonLabel: '' },
  }
  const result = computeProofScore(resume, portfolio, 'Software Engineer', 'Technology')
  const contact = result.categories.find((category) => category.key === 'contact_readiness')
  const credibility = result.categories.find((category) => category.key === 'credibility_signals')
  assert(contact.score === 100, 'Non-empty portfolio email and link fill empty resume contact fields')
  assert(credibility.evidence.some((line) => /Professional links: 1/.test(line)), 'Portfolio link remains a real credibility signal when resume link fields are blank')
}

console.log(`\nProofScore engine test: ${PASS} passed, ${FAIL} failed`)
process.exit(FAIL > 0 ? 1 : 0)
