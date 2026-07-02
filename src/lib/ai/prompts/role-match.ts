import type { ParsedResume } from '@/types/database'
import { RoleMatchSchema, type RoleMatchOutput } from '../schemas'
import { definePrompt } from './types'

export interface RoleMatchInput {
  parsedResume: ParsedResume
  targetRole: string
  industry: string
}

const MAX_INPUT_CHARACTERS = 10000

const SYSTEM = `You are a brutally honest career coach and former hiring manager. Your value is telling early-career candidates the truth about whether they are actually competitive for a target role — encouraging spin wastes their time and money.

How you work:
- You ground every matched skill, gap, strength, and recommendation in what the resume actually shows. You never credit the candidate with experience, tools, or scope they don't demonstrate.
- You name missing skills the way they actually appear in real job descriptions for the role, so the candidate can recognise them.
- You rank recommendations by impact — what closes the biggest gap fastest goes first — and each one is a concrete action, never "gain more experience" or "build your skills".
- Your timeline is realistic, not flattering. If the honest answer is 12-18 months, you say so.
- A content-match score measures fit between a background and a role's requirements. It is NOT a prediction of getting an interview or an offer, and you never imply it is.`

function userMessage(input: RoleMatchInput): string {
  const { parsedResume, targetRole, industry } = input
  return `TASK: assess how well this candidate's background matches ${targetRole} roles in
${industry}. Be honest and specific - do not soften the assessment to be encouraging.

TARGET ROLE: ${targetRole}
INDUSTRY: ${industry}

CANDIDATE BACKGROUND:
${JSON.stringify(parsedResume, null, 2).slice(0, MAX_INPUT_CHARACTERS)}

SCORING RUBRIC for match_score:
- 85-100: Ready to apply now, strong candidate
- 70-84: Good candidate with minor gaps fillable in 3-6 months
- 55-69: Real candidate but needs 6-12 months of targeted upskilling
- 40-54: Significant gaps, realistic path exists but takes 1-2 years
- Below 40: Wrong direction or major pivot needed

This match_score is a role-content match, not a hiring probability - do not imply it predicts
interview outcomes or offer likelihood, in this output or any field within it.

Return JSON:
{
  "match_score": number,
  "verdict": "ready_now" | "nearly_ready" | "developing" | "significant_gap" | "career_change",
  "matching_skills": ["Skills/experience that directly match ${targetRole} requirements"],
  "missing_skills": ["Specific skills common in ${targetRole} job descriptions that are absent or weak here"],
  "transferable_skills": ["Skills from a different context that apply to ${targetRole}"],
  "experience_gaps": ["Specific experience gaps that would concern a ${targetRole} hiring manager"],
  "strengths": ["Genuine differentiators or competitive advantages for ${targetRole}"],
  "recommendations": ["Specific, prioritized actions to close gaps - not generic advice"],
  "realistic_timeline": "Honest timeline to become a competitive ${targetRole} candidate",
  "strongest_asset": "The single most compelling thing about this candidate for ${targetRole}"
}`
}

export const roleMatchPrompt = definePrompt<RoleMatchInput, RoleMatchOutput>({
  id: 'role-match',
  version: '2.1.0',
  task: 'Assess fit between a parsed resume and a target role/industry, with an honest gap analysis and timeline.',
  routes: ['/api/ai/role-match'],
  modelTier: 'fast',
  temperature: 0.2,
  maxOutputTokens: 3000,
  maxInputCharacters: MAX_INPUT_CHARACTERS,
  outputSchema: RoleMatchSchema,
  schemaName: 'role_match',
  invariants: [
    'No fabricated interviewer-count or persona credential',
    'match_score explicitly labeled as role-content match, never a hiring-probability claim',
  ],
  reviewPolicy: 'none',
  buildMessages: (input) => [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userMessage(input) },
  ],
})
