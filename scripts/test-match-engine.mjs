#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the role-content match engine. No AI calls — computeMatchScore
// is pure arithmetic over structured job data + parsed resume, so every case here has an
// exact expected score. Run via: npm run test:match
import { computeMatchScore } from '../src/lib/jobs/match.ts'

let PASS = 0
let FAIL = 0

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`)
    PASS++
  } else {
    console.log(`  ❌ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    FAIL++
  }
}

function makeJob(overrides = {}) {
  return {
    id: 'job-1',
    title: 'Test Role',
    company: 'Test Co',
    seniority: 'mid',
    structured_data: null,
    ...overrides,
  }
}

function makeResume(overrides = {}) {
  return {
    skills: [],
    experience: [],
    projects: [],
    years_of_experience: null,
    seniority_level: null,
    ...overrides,
  }
}

// ── Case 1: full skill + seniority match, score clamps to 95 ceiling ──────────
{
  const job = makeJob({
    seniority: 'mid',
    structured_data: {
      required_skills: ['React', 'TypeScript'],
      preferred_skills: ['Next.js'],
      experience_requirements: ['2–4 years of front-end engineering'],
      domain: 'Developer Tools',
    },
  })
  const resume = makeResume({
    skills: ['React', 'TypeScript', 'Next.js'],
    years_of_experience: 10,
    seniority_level: 'mid',
  })
  const { score, breakdown } = computeMatchScore(job, resume)
  // skill=100, exp(10>=2+2)=100, seniority exact=100, project(none)=60 -> 100*.4+100*.3+100*.2+60*.1=96 -> clamp 95
  assertEqual(score, 95, 'Case 1: overqualified candidate clamps to 95 ceiling')
  assertEqual(breakdown.seniority_match, 'exact', 'Case 1: seniority_match is exact')
  assertEqual(breakdown.missing_skills.length, 0, 'Case 1: no missing skills')
}

// ── Case 2: zero skill overlap + zero experience floors at 15 ─────────────────
{
  const job = makeJob({
    seniority: 'mid',
    structured_data: {
      required_skills: ['React', 'TypeScript', 'CSS', 'Testing', 'Git', 'REST APIs'],
      preferred_skills: [],
      experience_requirements: ['2–4 years of front-end engineering'],
      domain: 'Developer Tools',
    },
  })
  const resume = makeResume({ skills: ['Cooking', 'Gardening'] })
  const { score, breakdown } = computeMatchScore(job, resume)
  // skill=0, exp(0 years, min2 -> floor branch)=50, seniority unknown=70, project=60
  // 0*.4+50*.3+70*.2+60*.1 = 0+15+14+6=35 (above floor, sanity check exact arithmetic)
  assertEqual(score, 35, 'Case 2: no skill overlap, untouched experience tier scores 35')
  assertEqual(breakdown.missing_skills.length, 6, 'Case 2: all 6 required skills missing')
  assertEqual(breakdown.seniority_match, 'unknown', 'Case 2: seniority_match unknown with null seniority_level')
}

// ── Case 3: partial skill match, exact arithmetic (no clamp) ──────────────────
{
  const job = makeJob({
    seniority: 'senior',
    structured_data: {
      required_skills: ['Product management', 'Roadmapping', 'User research', 'Agile/Scrum', 'SQL basics', 'Stakeholder management'],
      preferred_skills: [],
      experience_requirements: ['3–5 years of product management experience'],
      domain: 'B2B SaaS',
    },
  })
  const resume = makeResume({
    skills: ['Product management', 'Roadmapping', 'User research', 'Agile/Scrum', 'SQL basics'],
    years_of_experience: 4,
    seniority_level: 'mid',
  })
  const { score, breakdown } = computeMatchScore(job, resume)
  // skill=round(5/6*100)=83, exp(4>=3,<5)=90, seniority mid(2) vs senior(3) -> below(jobRank-1)=75, project=60
  // 83*.4+90*.3+75*.2+60*.1 = 33.2+27+15+6=81.2 -> round 81
  assertEqual(score, 81, 'Case 3: partial skill + below seniority computes to 81')
  assertEqual(breakdown.seniority_match, 'below', 'Case 3: seniority_match below by one rank')
  assertEqual(breakdown.matched_skills.length, 5, 'Case 3: 5 of 6 required skills matched')
}

// ── Case 4: candidate seniority exactly one rank above job ────────────────────
{
  const job = makeJob({ seniority: 'mid', structured_data: { required_skills: [], preferred_skills: [], experience_requirements: [], domain: null } })
  const resume = makeResume({ seniority_level: 'senior' })
  const { breakdown } = computeMatchScore(job, resume)
  assertEqual(breakdown.seniority_match, 'above', 'Case 4: senior candidate vs mid job is above by one rank')
}

// ── Case 5: candidate seniority far below job (>1 rank gap) ────────────────────
{
  const job = makeJob({ seniority: 'staff', structured_data: { required_skills: [], preferred_skills: [], experience_requirements: [], domain: null } })
  const resume = makeResume({ seniority_level: 'junior' }) // maps to 'entry', rank 1 vs staff rank 4
  const { breakdown } = computeMatchScore(job, resume)
  assertEqual(breakdown.seniority_match, 'below', 'Case 5: entry candidate vs staff job is below (multi-rank gap)')
}

// ── Case 6: candidate seniority far above job (>1 rank gap) ────────────────────
{
  const job = makeJob({ seniority: 'entry', structured_data: { required_skills: [], preferred_skills: [], experience_requirements: [], domain: null } })
  const resume = makeResume({ seniority_level: 'executive' }) // rank 7 vs entry rank 1
  const { breakdown } = computeMatchScore(job, resume)
  assertEqual(breakdown.seniority_match, 'above', 'Case 6: executive candidate vs entry job is above (multi-rank gap)')
}

// ── Case 7: empty required_skills defaults skillScore to 70 regardless of resume ──
{
  const jobNoSkills = makeJob({ structured_data: { required_skills: [], preferred_skills: [], experience_requirements: [], domain: null } })
  const richResume = makeResume({ skills: ['Anything', 'Goes', 'Here'] })
  const poorResume = makeResume({ skills: [] })
  const a = computeMatchScore(jobNoSkills, richResume).score
  const b = computeMatchScore(jobNoSkills, poorResume).score
  assertEqual(a, b, 'Case 7: empty required_skills produces same score regardless of resume skills')
}

// ── Case 8: missing required skills surface an add_evidence opportunity ───────
{
  const job = makeJob({
    structured_data: { required_skills: ['Kubernetes', 'Go'], preferred_skills: [], experience_requirements: [], domain: null },
  })
  const resume = makeResume({ skills: [] })
  const { breakdown } = computeMatchScore(job, resume)
  const hasAddEvidence = breakdown.opportunities.some(o => o.type === 'add_evidence')
  assertEqual(hasAddEvidence, true, 'Case 8: missing required skills produce an add_evidence opportunity')
}

// ── Case 9: matched preferred skills surface a move_bullet opportunity ────────
{
  const job = makeJob({
    structured_data: { required_skills: [], preferred_skills: ['Figma', 'Storybook'], experience_requirements: [], domain: null },
  })
  const resume = makeResume({ skills: ['Figma', 'Storybook'] })
  const { breakdown } = computeMatchScore(job, resume)
  const hasMoveBullet = breakdown.opportunities.some(o => o.type === 'move_bullet')
  assertEqual(hasMoveBullet, true, 'Case 9: matched preferred skills produce a move_bullet opportunity')
}

// ── Case 10: relevant project surfaces a highlight_project opportunity first ──
{
  const job = makeJob({
    structured_data: { required_skills: [], preferred_skills: [], experience_requirements: [], domain: 'Fintech / Payments' },
  })
  const resume = makeResume({
    projects: [{ title: 'Checkout Redesign', description: 'Rebuilt the fintech checkout flow', technologies: ['React'] }],
  })
  const { breakdown } = computeMatchScore(job, resume)
  assertEqual(breakdown.opportunities[0]?.type, 'highlight_project', 'Case 10: relevant project is the first opportunity listed')
  assertEqual(breakdown.matching_projects.includes('Checkout Redesign'), true, 'Case 10: matching project appears in matching_projects')
}

console.log(`\n  Match engine: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
