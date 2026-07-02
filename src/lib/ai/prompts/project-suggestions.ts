import { z } from 'zod'
import { untrustedDataNotice } from './shared-rules'
import { definePrompt } from './types'

export const ProjectSuggestionSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  why: z.string(),
  techStack: z.array(z.string()).max(8),
  // Skill difficulty tier — how hard the project is to pull off well.
  difficulty: z.enum(['Beginner', 'Intermediate', 'Master']),
  // Rough time to build, e.g. "Weekend", "1-2 weeks", "1 month".
  timeEstimate: z.string(),
  impact: z.string(),
  steps: z.array(z.string()).max(6),
  // A realistic build timeline: what to do and roughly when, phase by phase.
  timeline: z.array(z.object({
    phase: z.string(),   // what this phase is, e.g. "Setup & scaffolding"
    when: z.string(),    // rough timing, e.g. "Day 1", "Days 2-4", "Week 2"
    detail: z.string(),  // one line on what "done" looks like for this phase
  })).min(3).max(5),
  repoIdea: z.string(),
})
export const ProjectSuggestionsSchema = z.object({
  suggestions: z.array(ProjectSuggestionSchema).min(3).max(9),
})
export type ProjectSuggestionsOutput = z.infer<typeof ProjectSuggestionsSchema>

export interface ProjectSuggestionsInput {
  resumeText: string
  /** Free tier: only the 3 Beginner projects are generated (Intermediate/Master are Pro),
   *  so we never spend tokens producing content a free user can't see. */
  beginnerOnly?: boolean
}

const MAX_RESUME = 8000

const SYSTEM = `You are a senior engineering career advisor who helps early-career candidates build portfolios that actually get them interviews. You read a candidate's resume and propose specific projects that would MEANINGFULLY strengthen it for the roles they're targeting.

How you work:
- Base every suggestion on THIS person's real background, gaps, and level — never generic tutorial projects everyone has (no "to-do app", "weather app", "clone X").
- Each project must close a real gap: a skill that's missing or underrepresented, a signal top employers look for at their level, or a way to make their GitHub/portfolio stand out for their target roles.
- Be concrete and buildable: a real scope, a real tech stack that fits them, clear steps, and a repo name.
- Mix difficulty: some quick wins (Weekend), some substantial (1 Month).`

function userMessage(input: ProjectSuggestionsInput): string {
  const countLine = input.beginnerOnly
    ? 'Suggest exactly 3 portfolio projects tailored to this candidate, ALL at the "Beginner" difficulty tier.'
    : 'Suggest exactly 9 portfolio projects tailored to this candidate — EXACTLY 3 at each difficulty tier: 3 "Beginner", 3 "Intermediate", 3 "Master".'
  return `${countLine}

${untrustedDataNotice('resume below')}

RESUME:
${input.resumeText.slice(0, MAX_RESUME)}

Difficulty tiers (this is about how HARD the project is to build well, given this candidate's level):
- "Beginner": approachable, a clear quick win they can finish and show off soon — still relevant, not a toy.
- "Intermediate": a real, substantial project that stretches them and clearly levels up their portfolio.
- "Master": ambitious and impressive — the kind of project that makes a strong candidate stand out (system design, scale, novel depth). Genuinely challenging.

For each project return: title (specific, not generic), tagline (one sentence), why (2-3 sentences on why THIS person needs it, referencing their actual resume gaps), techStack (3-5 technologies that fit them), difficulty ("Beginner" | "Intermediate" | "Master"), timeEstimate (rough build time, e.g. "Weekend", "1-2 weeks", "1 month"), impact (what it adds to their story for their target roles), steps (4-5 concrete build steps), timeline (3-5 phases, each with phase/when/detail — a realistic schedule of WHAT to build and roughly WHEN across the timeEstimate, e.g. { phase: "Setup & schema", when: "Day 1", detail: "Repo, DB schema, CI running" }), repoIdea (a repo name + one-line description).

Return JSON: { "suggestions": [ ...objects with the keys above ] } — ${input.beginnerOnly ? 'exactly 3, all "Beginner".' : 'exactly 9, exactly 3 per tier.'}`
}

export const projectSuggestionsPrompt = definePrompt<ProjectSuggestionsInput, ProjectSuggestionsOutput>({
  id: 'project-suggestions',
  version: '2.2.0',
  task: 'Suggest 9 portfolio projects (3 Beginner, 3 Intermediate, 3 Master) tailored to a candidate\'s resume gaps and target roles.',
  routes: ['/api/ai/suggest-projects'],
  modelTier: 'fast',
  temperature: 0.6,
  maxOutputTokens: 8000,
  maxInputCharacters: MAX_RESUME,
  outputSchema: ProjectSuggestionsSchema,
  schemaName: 'project_suggestions',
  invariants: [
    'Suggests exactly 6 projects grounded in the candidate\'s real background',
    'No generic tutorial projects (to-do/weather/clone apps)',
    'Each includes a concrete tech stack, steps, and repo idea',
  ],
  reviewPolicy: 'none',
  buildMessages: (input) => [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userMessage(input) },
  ],
})
