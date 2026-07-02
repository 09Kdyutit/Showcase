import type { ParsedResume, JobListing } from '@/types/database'
import { MatchExplanationSchema, type MatchExplanationOutput } from '../schemas'
import { definePrompt } from './types'

export interface MatchExplanationInput {
  parsedResume: ParsedResume
  job: JobListing
  deterministicScore: number
  matchedSkills: string[]
  missingSkills: string[]
}

const SYSTEM = `You are a precise hiring analyst. In a few tight sentences you explain why a candidate's background does or doesn't line up with a specific job, citing the concrete matched and missing skills you are given. You are honest and never inflate the fit, you never invent a skill the candidate lacks, and you always frame the number as a role-content match — not a hiring probability or interview prediction. Every sentence earns its place; no filler, no hedging, no generic advice.`

function userMessage(input: MatchExplanationInput): string {
  const { parsedResume, job, deterministicScore, matchedSkills, missingSkills } = input
  return `TASK: write a brief, honest explanation of a role-content match score that has
already been computed deterministically. You are not computing or revising the score.

The system has already computed a role-content match score of ${deterministicScore}/100 using
deterministic skill and experience matching.

IMPORTANT: this match score is NOT a hiring probability. Label it clearly as "role-content
match." Do NOT claim it predicts interview outcomes, hiring decisions, or ATS results.

JOB:
Title: ${job.title}
Company: ${job.company}
Seniority: ${job.seniority ?? 'not specified'}
Required skills: ${(job.structured_data?.required_skills ?? []).join(', ') || 'not specified'}
Domain: ${job.structured_data?.domain ?? 'not specified'}

CANDIDATE:
Skills matched: ${matchedSkills.join(', ') || 'none identified'}
Skills missing: ${missingSkills.join(', ') || 'none identified'}
Experience: ${parsedResume.years_of_experience ?? '?'} years, ${parsedResume.seniority_level ?? 'unknown'} level
Strongest area: ${parsedResume.experience[0]?.role ?? 'not available'} at ${parsedResume.experience[0]?.company ?? 'not available'}

Return JSON:
{
  "score_justification": "2 sentences explaining the ${deterministicScore}/100 score honestly",
  "top_strength": "The single strongest match signal - be specific",
  "primary_gap": "The most significant gap to address - be specific and actionable",
  "recommended_action": "One specific next step to improve this match - not generic advice"
}`
}

export const matchExplanationPrompt = definePrompt<MatchExplanationInput, MatchExplanationOutput>({
  id: 'match-explanation',
  version: '2.1.0',
  task: 'Explain a deterministically-computed job-match score in plain language. Never assigns or changes the score.',
  routes: ['/api/jobs/match'],
  modelTier: 'fast',
  temperature: 0.2,
  maxOutputTokens: 800,
  maxInputCharacters: 4000,
  outputSchema: MatchExplanationSchema,
  schemaName: 'match_explanation',
  invariants: [
    'Never presents the match score as a hiring-probability or interview-outcome prediction',
    'Cannot change the deterministic score - schema has no score field',
  ],
  reviewPolicy: 'none',
  buildMessages: (input) => [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userMessage(input) },
  ],
})
