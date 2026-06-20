#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the ProofScore scoring engine. No AI calls — computeProofScore is
// pure arithmetic over structured resume/portfolio data, so every case here is reproducible
// and exact. Run via: npm run test:proofscore
import { computeProofScore, CATEGORY_DEFINITIONS } from '../src/lib/proofscore/engine.ts'

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
  const a = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology', true)
  const b = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology', true)
  assert(JSON.stringify(a) === JSON.stringify(b), 'Identical input produces an identical result (deterministic, not AI-judged)')
}

console.log('\n── Category coverage ──')
{
  const result = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology', true)
  assert(result.categories.length === 11, 'Exactly 11 fixed categories returned', `got ${result.categories.length}`)
  assert(CATEGORY_DEFINITIONS.reduce((s, c) => s + c.weight, 0) === 100, 'Category weights sum to exactly 100')
  assert(result.categories.every((c) => typeof c.name === 'string' && c.name.length > 0), 'Every category has a fixed, non-empty name')
}

console.log('\n── Empty resume scores low, not null/crash ──')
{
  const result = computeProofScore(emptyResume(), null, 'Software Engineer', 'Technology', true)
  assert(result.overall_score < 30, 'Empty resume scores low overall', `got ${result.overall_score}`)
  const contact = result.categories.find((c) => c.key === 'contact_readiness')
  assert(contact.score === 0, 'Contact readiness is 0 with no email/links', `got ${contact.score}`)
  assert(contact.evidence.length > 0, 'Low score still includes evidence explaining why')
}

console.log('\n── Strong resume scores meaningfully higher than empty ──')
{
  const strong = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology', true)
  const empty = computeProofScore(emptyResume(), null, 'Software Engineer', 'Technology', true)
  assert(strong.overall_score > empty.overall_score + 30, 'Strong resume scores substantially higher than empty', `strong=${strong.overall_score} empty=${empty.overall_score}`)
}

console.log('\n── Quantified impact reflects real bullet metrics ──')
{
  const withMetrics = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology', true)
  const noMetricsResume = strongResume()
  noMetricsResume.experience[0].bullets = ['Worked on backend systems.', 'Helped the team ship features.', 'Participated in code reviews.']
  noMetricsResume.experience[0].metrics = []
  const noMetrics = computeProofScore(noMetricsResume, null, 'Software Engineer', 'Technology', true)
  const qiWith = withMetrics.categories.find((c) => c.key === 'quantified_impact').score
  const qiWithout = noMetrics.categories.find((c) => c.key === 'quantified_impact').score
  assert(qiWith > qiWithout, 'Bullets with numbers score higher on quantified impact than bullets without', `with=${qiWith} without=${qiWithout}`)
}

console.log('\n── Free tier hides Pro-only categories (null, not zero) ──')
{
  const result = computeProofScore(strongResume(), null, 'Software Engineer', 'Technology', false)
  const proOnly = result.categories.find((c) => c.key === 'quantified_impact')
  const freeTier = result.categories.find((c) => c.key === 'role_positioning')
  assert(proOnly.score === null, 'Pro-only category is null on free tier (not a fake score)', `got ${proOnly.score}`)
  assert(freeTier.score !== null, 'Free-tier category still has a real score on free tier')
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
  const result = computeProofScore(null, portfolio, 'Product Designer', 'Tech', true)
  const evidenceStrength = result.categories.find((c) => c.key === 'evidence_strength')
  const caseStudy = result.categories.find((c) => c.key === 'case_study_quality')
  assert(evidenceStrength.score === null, 'evidence_strength is null without a resume, not a fabricated number', `got ${evidenceStrength.score}`)
  assert(caseStudy.score !== null && caseStudy.score > 0, 'case_study_quality computes from real portfolio project data', `got ${caseStudy.score}`)
}

console.log(`\nProofScore engine test: ${PASS} passed, ${FAIL} failed`)
process.exit(FAIL > 0 ? 1 : 0)
