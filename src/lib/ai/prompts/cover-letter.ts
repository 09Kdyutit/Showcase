import { z } from 'zod'
import { NO_FABRICATION_RULE, untrustedDataNotice } from './shared-rules'
import { definePrompt } from './types'

// Personalized cover-letter generation, grounded strictly in the candidate's real resume.
// Cheap (gpt-4o-mini / 'fast' tier) but tuned hard against generic AI-cover-letter slop.

export const CoverLetterSchema = z.object({
  coverLetter: z.string(),
  // 2-3 one-line reasons this candidate fits, surfaced under the letter as talking points.
  fitHighlights: z.array(z.string()).max(3),
})
export type CoverLetterOutput = z.infer<typeof CoverLetterSchema>

export interface CoverLetterInput {
  candidateName: string
  role: string
  company: string
  jobDescription: string
  resumeText: string
  tone: 'professional' | 'warm' | 'direct'
}

const MAX_RESUME = 8000
const MAX_JOB = 6000

const SYSTEM = `You are a senior recruiter and professional cover-letter writer who has read tens of thousands of applications and can spot AI-generated filler instantly. You write short, specific, human cover letters that make a hiring manager want to interview the candidate — never generic templates.

Hard rules:
- ${NO_FABRICATION_RULE}
- Use ONLY what the candidate's resume actually contains. Never invent employers, projects, metrics, or skills to match the job. If the candidate lacks something the job wants, lean on their closest real strength instead of fabricating.
- Open with a specific hook tied to THIS role/company and the candidate's most relevant real achievement — never "I am writing to express my interest in…".
- Pick the 2-3 resume facts that map most directly to the job's actual requirements and make them concrete. Quote real numbers/scope where they exist.
- Sound like a real person: clear, confident, warm. Ban corporate slop: "I am passionate", "team player", "fast-paced environment", "synergy", "leverage", "spearheaded", "proven track record", "hit the ground running", "wear many hats".
- 200-320 words, 3-4 short paragraphs. No address blocks or "[Your Name]" placeholders — the platform adds the name. End with a brief, confident closing line.`

function userMessage(input: CoverLetterInput): string {
  const toneNote = input.tone === 'warm' ? 'Warm and personable, while still professional.'
    : input.tone === 'direct' ? 'Direct and confident, minimal throat-clearing.'
    : 'Polished and professional.'
  return `Write a cover letter for ${input.candidateName || 'the candidate'} applying for the "${input.role}" role at ${input.company || 'the company'}. Tone: ${toneNote}

${untrustedDataNotice('job description and resume below')}

═══ JOB (role: ${input.role}${input.company ? `, company: ${input.company}` : ''}) ═══
${input.jobDescription.slice(0, MAX_JOB) || '(no job description provided — write a strong general cover letter for the role using the resume)'}

═══ CANDIDATE RESUME (the only allowed source of facts about them) ═══
${input.resumeText.slice(0, MAX_RESUME)}

Return JSON: { "coverLetter": "the letter, paragraphs separated by \\n\\n", "fitHighlights": ["one-line reason they fit", "..."] }
Every claim in the letter must trace to the resume above. No fabrication.`
}

export const coverLetterPrompt = definePrompt<CoverLetterInput, CoverLetterOutput>({
  id: 'cover-letter',
  version: '1.0.0',
  task: 'Generate a personalized, non-generic cover letter grounded strictly in the candidate\'s real resume and the target job.',
  routes: ['/api/ai/cover-letter'],
  modelTier: 'fast',
  temperature: 0.5,
  maxOutputTokens: 1500,
  maxInputCharacters: MAX_RESUME + MAX_JOB,
  outputSchema: CoverLetterSchema,
  schemaName: 'cover_letter',
  invariants: [
    'Never invents employers, projects, metrics, or skills not in the resume',
    'Opens with a specific hook, not a generic "I am writing to express interest" line',
    'Bans corporate slop phrases',
    '200-320 words, no placeholder address blocks',
  ],
  reviewPolicy: 'none',
  buildMessages: (input) => [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userMessage(input) },
  ],
})
