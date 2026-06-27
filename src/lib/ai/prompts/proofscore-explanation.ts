import { AuditExplanationResultSchema, type AuditExplanationResultOutput } from '../schemas'
import { definePrompt } from './types'
import { untrustedDataNotice } from './shared-rules'

export interface ProofScoreExplanationInput {
  resumeText: string | null
  portfolioContent: Record<string, unknown> | null
  targetRole: string
  industry: string
  categories: Array<{ key: string; name: string; score: number | null; evidence: string[] }>
}

const MAX_RESUME_CHARACTERS = 10000
const MAX_PORTFOLIO_CHARACTERS = 6000

function userMessage(input: ProofScoreExplanationInput): string {
  const { resumeText, portfolioContent, targetRole, industry, categories } = input
  const context: string[] = []
  if (resumeText) context.push(`RESUME TEXT:\n${resumeText.slice(0, MAX_RESUME_CHARACTERS)}`)
  if (portfolioContent) context.push(`PORTFOLIO CONTENT:\n${JSON.stringify(portfolioContent, null, 2).slice(0, MAX_PORTFOLIO_CHARACTERS)}`)

  const categoryBlock = categories
    .filter((c) => c.score !== null)
    .map((c) => `- "${c.key}" (${c.name}): score=${c.score}/100. Computed evidence: ${c.evidence.join(' | ')}`)
    .join('\n')

  return `TASK: explain category scores that a deterministic engine already computed, for a
candidate being reviewed against ${targetRole} in ${industry}. You cannot change any number  - 
the response schema you must fill has no score field at all, so there is no field to put a
revised number into even if you wanted to.

${untrustedDataNotice('resume and portfolio content below')}

TARGET ROLE: ${targetRole}
INDUSTRY: ${industry}

${context.join('\n\n')}

ALREADY-COMPUTED SCORES (authoritative - explain these, do not contradict or imply a different number):
${categoryBlock}

DECISION PROCEDURE - for each category above, write:
- "explanation": why this score makes sense given the computed evidence listed - cite the
  actual evidence given, never invent new evidence not in that list or the source content
- "issues": specific issues found, referencing actual content from the resume/portfolio above
- "fix": one specific, actionable instruction (not "improve it")
- "example": a concrete before/after rewrite or specific suggestion grounded in the
  candidate's real content - never invent facts, metrics, or claims not present above

FAILURE BEHAVIOR: if the computed evidence for a category is thin (one short phrase), write a
correspondingly short, honest explanation rather than padding it with generic career advice.

Return JSON:
{
  "summary": "2-3 sentence honest summary of the biggest strength and the single most urgent problem, consistent with the computed scores",
  "categories": [
    { "key": string, "explanation": string, "issues": [string], "fix": string, "example": string }
  ],
  "missing_evidence": ["Specific claims in the content that lack supporting proof"],
  "top_priorities": ["Top 3-5 specific actions ranked by impact on ${targetRole} hiring, consistent with the lowest-scoring categories"]
}`
}

export const proofScoreExplanationPrompt = definePrompt<ProofScoreExplanationInput, AuditExplanationResultOutput>({
  id: 'proofscore-explanation',
  version: '2.0.0',
  task: 'Explain deterministically-computed ProofScore category scores in plain language with grounded, actionable fixes. Never assigns or changes a score.',
  routes: ['/api/ai/audit-portfolio'],
  modelTier: 'main',
  temperature: 0.2,
  maxOutputTokens: 6000,
  maxInputCharacters: MAX_RESUME_CHARACTERS + MAX_PORTFOLIO_CHARACTERS,
  outputSchema: AuditExplanationResultSchema,
  schemaName: 'audit_explanation',
  invariants: [
    'Output schema has no score field - structurally cannot change a deterministic score',
    'Explanations cite only the precomputed evidence list, never invented evidence',
    'Never presents ProofScore as scientifically validated or as a hiring-outcome predictor',
  ],
  reviewPolicy: 'shadow',
  buildMessages: (input) => [
    { role: 'user', content: userMessage(input) },
  ],
})
