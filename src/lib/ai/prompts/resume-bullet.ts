import { ImprovedBulletSchema, type ImprovedBulletOutput } from '../schemas'
import { definePrompt } from './types'

export interface ResumeBulletInput {
  bullet: string
  role: string
  context: string
}

const MAX_INPUT_CHARACTERS = 2000

function userMessage(input: ResumeBulletInput): string {
  const { bullet, role, context } = input
  return `TASK: improve the clarity of one resume bullet for someone targeting ${role} roles,
using the XYZ formula (Accomplished [X] by doing [Y] resulting in [Z]) - without changing what
actually happened.

ORIGINAL BULLET: "${bullet.slice(0, MAX_INPUT_CHARACTERS)}"
ROLE CONTEXT: ${role}
ADDITIONAL CONTEXT: ${context || 'None provided'}

NON-NEGOTIABLE RULES:
- NEVER invent or fabricate metrics, percentages, dollar amounts, team sizes, or timeframes
  not in the original
- NEVER change the factual claims - only improve how they're expressed
- If no metrics exist: restructure for maximum clarity and impact WITHOUT adding fake numbers
- If a metric could be added but isn't stated: add "[Add: X%]" as a placeholder, never a number
- Use a strong action verb at the start
- Keep under 2 lines

Return JSON:
{
  "improved": "The improved bullet point",
  "explanation": "Brief explanation of what changed and why",
  "missing_info": ["What additional details would make this bullet stronger (team size, timeline, metrics, tools used, etc.)"],
  "could_be_case_study": boolean
}`
}

export const resumeBulletPrompt = definePrompt<ResumeBulletInput, ImprovedBulletOutput>({
  id: 'resume-bullet',
  version: '2.0.0',
  task: 'Rewrite a single resume bullet for clarity/impact using the XYZ formula, preserving every factual claim exactly.',
  routes: ['/api/ai/improve-resume'],
  modelTier: 'fast',
  temperature: 0.3,
  maxOutputTokens: 1500,
  maxInputCharacters: MAX_INPUT_CHARACTERS,
  outputSchema: ImprovedBulletSchema,
  schemaName: 'improved_bullet',
  invariants: [
    'Never adds a metric, percentage, dollar amount, team size, or timeframe not in the original',
    'Missing metrics become "[Add: X%]" placeholders, never invented numbers',
  ],
  reviewPolicy: 'none',
  buildMessages: (input) => [
    { role: 'user', content: userMessage(input) },
  ],
})
