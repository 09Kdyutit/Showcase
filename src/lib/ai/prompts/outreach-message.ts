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
- Open with a specific, human hook (a real detail about their work or a genuine reason for reaching out), never "I hope this message finds you well", "I came across your profile", or empty flattery ("I'm a huge fan of your work").
- One clear ask. Make it easy to say yes to (a quick chat, a referral, a pointer to the right person). Never ask for more than one thing.
- Ban corporate slop: "passionate", "team player", "synergy", "leverage", "proven track record", "reach out", "circle back", "touch base", "hit the ground running", "wanted to connect".
- The message must be ready to send AS-IS. No bracketed placeholders of any kind — not "[Your Name]", not "[Company]", and NOT "[Recruiter's Name]"/"[Hiring Manager]". You do not know the recipient's name, so open with "Hi there," (or, for a referral ask to someone the candidate clearly knows, a warm neutral greeting) — never a bracketed name to fill in. Use the real role/company given; the platform adds the sender's name at the end.
- subject: a channel-appropriate line ≤ 8 words — an email subject or a LinkedIn connection-note opener. Make it specific to the role or proof point (e.g. "Checkout redesign → your Sr. PD role"), never filler like "Opportunity", "Checking in", or "Following up".`

// Gold-standard style references — one per type. Fictional on purpose: they anchor
// STRUCTURE and TONE for the fast-tier model, which follows examples far better than
// abstract rules. The prompt forbids borrowing any of their facts.
const EXAMPLES: Record<OutreachType, string> = {
  recruiter_dm:
    'GOOD EXAMPLE (style only — do NOT reuse its facts):\n' +
    '"Hi Priya — saw you\'re hiring the Senior Product Designer on the payments team. I spent two years on checkout at Northwind, where a first-run redesign lifted activation 18%. Payments UX is exactly the problem I want to go deeper on — open to a 15-minute chat this week?"\n' +
    'Why it works: names the exact role, leads with one real proof point, single low-friction ask, zero flattery or slop.',
  networking:
    'GOOD EXAMPLE (style only — do NOT reuse its facts):\n' +
    '"Hi Marcus — I came across your work on Acme\'s growth team while reading about how you run activation experiments. I\'m a PM at Northwind focused on the same thing; last quarter an onboarding test I ran moved D7 retention 9 points. I\'m not asking about any specific opening — I\'d just value 15 minutes to hear how your team frames early-lifecycle growth. Happy to work around your schedule."\n' +
    'Why it works: curious not pitchy, one real proof point, an explicit soft ask, and it defuses the "are you just after a job" worry.',
  referral_ask:
    'GOOD EXAMPLE (style only — do NOT reuse its facts):\n' +
    '"Hi Dana — Acme just posted a Backend Engineer role on the payments team and it\'s a strong fit. At Northwind I\'ve spent two years on payment services in Go, including a migration that cut reconciliation errors by a third. Would you be comfortable referring me, or pointing me to the right person? I\'ve pasted a one-line blurb below you can forward as-is — no work on your end."\n' +
    'Why it works: makes saying yes effortless (forwardable blurb), a concrete fit, one clear ask.',
}

function userMessage(input: OutreachMessageInput): string {
  const typeNote = input.outreachType === 'recruiter_dm'
    ? 'A LinkedIn/email DM to a RECRUITER or hiring manager for this specific role. 45-90 words. Warm, confident, one clear ask for a quick conversation. Reference the role by name.'
    : input.outreachType === 'referral_ask'
    ? 'A message asking someone in the candidate\'s network for a REFERRAL to this role/company. 70-130 words. Make it low-effort for them to help — offer a one-line blurb they can forward.'
    : 'A "cold" NETWORKING message to someone who works at the company (not the recruiter) to learn about the team and get on their radar. 70-130 words. Curious and specific, not a hard pitch. Soft ask (a 15-minute chat).'

  return `Write a ${input.outreachType.replace(/_/g, ' ')} outreach message for ${input.candidateName || 'the candidate'}, targeting the "${input.role}" role${input.company ? ` at ${input.company}` : ''}.

STYLE: ${typeNote}

${EXAMPLES[input.outreachType]}

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
  version: '1.1.0',
  task: 'Generate a short, human, résumé-grounded outreach message (recruiter DM / networking note / referral ask) for a specific job.',
  routes: ['/api/ai/outreach'],
  modelTier: 'fast',
  // 0.5 keeps outreach warm and varied across regenerations while trimming the tail where
  // the fast model occasionally slips a bracketed placeholder or a slop phrase.
  temperature: 0.5,
  maxOutputTokens: 700,
  maxInputCharacters: MAX_RESUME + MAX_JOB,
  outputSchema: OutreachMessageSchema,
  schemaName: 'outreach_message',
  invariants: [
    'Never invents employers, projects, metrics, or skills not in the résumé',
    'Never borrows facts from the in-prompt style example (fictional, structure/tone only)',
    'Short by design (recruiter DM 45-90 words; networking/referral 70-130)',
    'One clear, easy-to-say-yes-to ask; bans corporate slop and generic openers',
    'Subject line is specific and ≤ 8 words, never filler ("Opportunity", "Checking in")',
    'Job description and résumé are treated as untrusted data, not instructions',
  ],
  reviewPolicy: 'none',
  buildMessages: (input) => [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userMessage(input) },
  ],
})
