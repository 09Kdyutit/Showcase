import type { ParsedResume } from '@/types/database'
import { PortfolioContentSchema, type PortfolioContentOutput } from '../schemas'
import { definePrompt } from './types'
import { NO_FABRICATION_RULE } from './shared-rules'

export interface PortfolioGenerationInput {
  parsedResume: ParsedResume
  targetRole: string
  industry: string
  portfolioGoal: string
  links: Record<string, string>
}

const MAX_INPUT_CHARACTERS = 16000

function userMessage(input: PortfolioGenerationInput): string {
  const { parsedResume, targetRole, industry, portfolioGoal, links } = input
  return `TASK: Transform the parsed resume data below into a complete portfolio draft for a
specific target role. Optimize for a hiring manager understanding, within 10 seconds, what
this person does, how good they are, and why they should talk to them — using only evidence
that is actually in the source data.

CONTEXT:
Target Role: ${targetRole}
Industry: ${industry}
Portfolio Goal: ${portfolioGoal}
Candidate Links: ${JSON.stringify(links)}

PARSED RESUME DATA (authorized source — already extracted from the candidate's resume,
already passed through fabrication checks once; you may restructure and reframe it, but
every fact must still trace back to something in this object):
${JSON.stringify(parsedResume, null, 2).slice(0, MAX_INPUT_CHARACTERS)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NON-NEGOTIABLE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ${NO_FABRICATION_RULE}
2. NEVER add a quantified claim that isn't stated (no "40% improvement" without proof)
3. If data is thin, write shorter honest copy — do not pad with filler or generic statements
4. If a field cannot be written honestly with available data, use "[Add: what to provide]"
5. Every bullet rewrite must keep the SAME meaning — only improve clarity, not inflate claims

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT LENGTH CONSTRAINTS — every character renders at real UI size; verbosity is visual
clutter, not thoroughness. These are hard limits, not targets to approach.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - hero.headline → MAX 14 words. Renders at ~60px. 5 words is often better than 14.
  - hero.subheadline → MAX 28 words. Renders at ~20px across full page width. One clean sentence.
  - hero.tagline → MAX 6 words. Renders as a small pill label.
  - featuredResult → MAX 10 words. Renders as a small highlighted badge. Start with the number.
  - about.bio paragraphs → MAX 4 sentences each, 3 paragraphs max.
  - about.values → MAX 12 words each.
  - projects[].summary → MAX 15 words. One sentence.
  - projects[].problem → MAX 3 sentences. Renders in a 3-column grid — do NOT exceed or it overflows.
  - projects[].process → MAX 3 sentences. Same grid constraint.
  - projects[].outcome → MAX 2 sentences. START with the number or change.
  - experience[].bullets → MAX 15 words each.
  - proof[].value → MAX 8 chars. Format: "+24%", "$180k/mo", "10M+", "3 days" — never spelled-out words.
  - proof[].label → MAX 5 words.

FORBIDDEN PATTERNS:
  - Long run-on sentences in any field
  - Bullets that start with "I am" or "I was"
  - Paragraphs longer than 5 sentences in any field
  - Proof metric values written as words instead of symbols
  - Starting outcome with "As a result,", "This led to", or "We were able to"
  - Generic adjectives with no evidence behind them: "passionate", "results-driven",
    "experienced", "innovative", "dynamic", "leveraged", "impactful"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PER-FIELD DECISION PROCEDURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HERO HEADLINE — role-specific and outcome-focused ("Checkout Designer who recovered $180k/month
at Stripe" — not "Passionate product designer"). If a strong metric exists in the resume, lead
with it: "The Designer Who Shipped Stripe's Checkout Redesign (+24% Completion)". A factual
statement, not a marketing slogan.

SUBHEADLINE — one sentence answering "why should I hire this person?": [what you do] + [who
specifically benefits] + [your specific method/differentiator], grounded in the actual resume
content, not generic capability claims.

TAGLINE — 3-5 words, a short identity label (e.g. "Lead Designer · B2B SaaS").

RECRUITER SUMMARY — one sentence for recruiters to copy-paste: "Available for [role type]
roles at [company stage/type]." [role type] and [company stage/type] may only be inferred from
things actually demonstrable from the resume (seniority level, industry, company sizes worked
at). Never invent a location or work-arrangement preference (remote/hybrid/onsite, specific
cities) unless the resume's location field or text explicitly states one — a resume's content
cannot tell you the candidate's work-mode preference, so guessing it is fabrication.

ABOUT BIO — 2-3 paragraphs, professional not personal. Paragraph 1: what you do, who for, the
specific problems you solve, referencing a signature project. Paragraph 2: how you think —
philosophy or approach, backed by evidence from the resume. Paragraph 3 (optional): what's
next, only if the resume signals a transition or career goal. Never write "I am a passionate
[role]..." or "In my [X] years of experience...".

WORKING VALUES — 3-5 principles the resume actually demonstrates. Bad: "User-centered design"
(generic). Good: "Evidence before aesthetics — every decision tied to a conversion metric"
(specific, backed by real work).

CASE STUDIES (projects) — each must feel like a real case study, not an expanded resume bullet:
  - Problem (2-3 sentences): the specific situation and stakes — only state context the resume
    actually implies (e.g. "low activation rate" if that's the metric being improved). Never
    invent a backstory detail (team size, deadline pressure, specific prior numbers) absent
    from the source bullet.
  - Process (2-3 sentences): decisions made, methods used, constraints navigated — use ONLY
    methods stated in that specific bullet or clearly implied by its wording. Do not borrow a
    method from the candidate's general skills list (e.g. "User Research" appearing in skills)
    and attribute it to a project that doesn't explicitly mention doing research — that
    fabricates process detail for this specific achievement, even though the skill itself is
    real. If the source bullet is short, write a short, honest process sentence.
  - Outcome (1-2 sentences): start with the number if one exists; be specific about what
    changed. If no outcome metric exists, write what specifically changed and prompt:
    "[Add: quantify the impact]".
  - If the resume has no dedicated "Projects" section: elevate the single most significant,
    most evidence-backed achievement from the experience section (clearest metric or scope)
    into a full Problem/Process/Outcome case study — same company/role, same facts, just
    reframed. This is restructuring a real achievement already in the resume, not inventing
    one. A portfolio with zero case studies is weaker than one built from experience — do not
    skip the projects array just because the source resume had no "Projects" heading.

BULLET REWRITES — improve clarity, never claims. "Led cross-functional team to deliver product
improvements" → "Coordinated design, engineering, and data teams to ship three product
improvements to the checkout flow" (same facts, more specific). "Improved performance metrics
across platform" → "Reduced load time of the main dashboard — [Add: by how much?]" (honest
about the missing number, doesn't invent one).

PROOF METRICS — the 2-5 most impressive quantified achievements, sorted by impact, using the
exact number from the resume (never rounded or estimated).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT CONTRACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return complete JSON:
{
  "hero": { "headline": string, "subheadline": string, "tagline": string },
  "recruiterSummary": "One sentence for recruiters to copy-paste into a sourcing note",
  "featuredResult": "Single most impressive achievement as <=10 words, starting with a number or symbol — ONLY if a real quantified achievement exists in parsedResume. If no number anywhere in the source supports one, set this to null. Do not invent a number to satisfy the format.",
  "about": { "bio": "2-3 paragraph bio (\\n\\n between paragraphs)", "values": string[] },
  "skills": [{ "name": string, "level": "Expert | Advanced | Proficient | Familiar", "category": string }],
  "experience": [{ "company": string, "role": string, "period": string, "bullets": string[], "metrics": string[] }],
  "projects": [{
    "title": string, "role": string, "summary": string,
    "problem": string, "process": string, "outcome": string,
    "metrics": string[], "links": [{ "label": string, "url": string }], "tags": string[]
  }],
  "proof": [{ "label": string, "value": string }],
  "contact": { "email": string, "linkedin": string, "github": string, "website": string },
  "cta": { "headline": "Specific headline for the contact section targeting ${targetRole} context", "buttonLabel": "Get in touch" }
}`
}

export const portfolioGenerationPrompt = definePrompt<PortfolioGenerationInput, PortfolioContentOutput>({
  id: 'portfolio-generation',
  version: '3.0.0',
  task: 'Generate a complete portfolio draft (hero, bio, skills, experience, case studies, proof, contact) from parsed resume facts, role-specific and evidence-only.',
  routes: ['/api/ai/generate-portfolio'],
  modelTier: 'main',
  temperature: 0.4,
  maxOutputTokens: 12000,
  maxInputCharacters: MAX_INPUT_CHARACTERS,
  outputSchema: PortfolioContentSchema,
  schemaName: 'portfolio_content',
  invariants: [
    'No fake-authority persona — task and rubric carry the instruction, not invented credentials',
    'Never attributes a general skill to a specific project without that project stating it',
    'Never invents a work-location/remote preference not explicit in resume',
    'Case study generated from experience when no Projects section exists, never fabricated',
    'Every quantified claim traces to a literal number in parsedResume',
  ],
  reviewPolicy: 'shadow',
  buildMessages: (input) => [
    { role: 'user', content: userMessage(input) },
  ],
})
