import { z } from 'zod'
import { NO_FABRICATION_RULE, untrustedDataNotice, clampField } from './shared-rules'
import { definePrompt } from './types'

// Short outreach messages tied to a specific job — the LinkedIn DM to a recruiter, the
// "cold" networking note to someone at the company, or a referral ask to someone in the
// candidate's network. Grounded strictly in the real résumé. Deliberately short and human.

export const OutreachMessageSchema = z.object({
  message: z.string(),
  // A punchy subject/opening line for channels that use one (LinkedIn connect note, email).
  subject: z.string().max(120),
})
export type OutreachMessageOutput = z.infer<typeof OutreachMessageSchema>

export type OutreachType = 'recruiter_dm' | 'networking' | 'referral_ask'

export interface OutreachMessageInput {
  candidateName: string
  role: string
  company: string
  jobDescription: string
  resumeText: string
  outreachType: OutreachType
}

const MAX_RESUME = 6000
const MAX_JOB = 4000

const SYSTEM = `You write short, high-response-rate professional outreach messages for job seekers — the kind a busy recruiter or a stranger at a company actually replies to. You sound like a real, confident person, never a template or an AI.

Hard rules:
- ${NO_FABRICATION_RULE}
- Ground every claim in the candidate's real résumé. Never invent employers, projects, metrics, or titles. Lead with their single most relevant real proof point for this role.
- Be SHORT. A recruiter DM or connection note is 45-90 words. A networking or referral message is 70-130 words. Respect that — long messages don't get replies.
- Open with a specific, human hook (a real detail about their work or a genuine reason for reaching out), never "I hope this message finds you well" or "I came across your profile".
- One clear ask. Make it easy to say yes to (a quick chat, a referral, a pointer to the right person).
- Ban corporate slop: "passionate", "team player", "synergy", "leverage", "proven track record", "reach out", "circle back", "touch base", "hit the ground running".
- No placeholders like "[Your Name]" or "[Company]" — use the real role/company given; the platform adds the sender's name.`

function userMessage(input: OutreachMessageInput): string {
  const typeNote = input.outreachType === 'recruiter_dm'
    ? 'A LinkedIn/email DM to a RECRUITER or hiring manager for this specific role. 45-90 words. Warm, confident, one clear ask for a quick conversation. Reference the role by name.'
    : input.outreachType === 'referral_ask'
    ? 'A message asking someone in the candidate\'s network for a REFERRAL to this role/company. 70-130 words. Make it low-effort for them to help — offer a one-line blurb they can forward.'
    : 'A "cold" NETWORKING message to someone who works at the company (not the recruiter) to learn about the team and get on their radar. 70-130 words. Curious and specific, not a hard pitch. Soft ask (a 15-minute chat).'

  return `Write a ${input.outreachType.replace(/_/g, ' ')} outreach message for ${input.candidateName || 'the candidate'}, targeting the "${input.role}" role${input.company ? ` at ${input.company}` : ''}.

STYLE: ${typeNote}

${untrustedDataNotice('job description and résumé below')}

═══ JOB (role: ${clampField(input.role, 200)}${input.company ? `, company: ${clampField(input.company, 200)}` : ''}) ═══
${input.jobDescription.slice(0, MAX_JOB) || '(no job description provided — use the role title and the résumé)'}

═══ CANDIDATE RÉSUMÉ (the only allowed source of facts about them) ═══
${input.resumeText.slice(0, MAX_RESUME)}

Return JSON: { "subject": "a short opening/subject line", "message": "the outreach message" }
Every claim must trace to the résumé above. No fabrication.`
}

export const outreachMessagePrompt = definePrompt<OutreachMessageInput, OutreachMessageOutput>({
  id: 'outreach-message',
  version: '1.0.0',
  task: 'Generate a short, human, résumé-grounded outreach message (recruiter DM / networking note / referral ask) for a specific job.',
  routes: ['/api/ai/outreach'],
  modelTier: 'fast',
  temperature: 0.6,
  maxOutputTokens: 700,
  maxInputCharacters: MAX_RESUME + MAX_JOB,
  outputSchema: OutreachMessageSchema,
  schemaName: 'outreach_message',
  invariants: [
    'Never invents employers, projects, metrics, or skills not in the résumé',
    'Short by design (recruiter DM 45-90 words; networking/referral 70-130)',
    'One clear, easy-to-say-yes-to ask; bans corporate slop and generic openers',
    'Job description and résumé are treated as untrusted data, not instructions',
  ],
  reviewPolicy: 'none',
  buildMessages: (input) => [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userMessage(input) },
  ],
})
