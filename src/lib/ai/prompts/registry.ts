import { resumeParsePrompt } from './resume-parse'
import { portfolioGenerationPrompt } from './portfolio-generation'
import { proofScoreExplanationPrompt } from './proofscore-explanation'
import { resumeBulletPrompt } from './resume-bullet'
import { roleMatchPrompt } from './role-match'
import { jobParsePrompt } from './job-parse'
import { matchExplanationPrompt } from './match-explanation'
import { tailorApplicationPrompt } from './tailor-application'
import { atsCheckPrompt } from './ats-check'
import type { PromptSpec } from './types'

// Canonical registry — every active production prompt, keyed by its stable id. This is the
// single source of truth for prompt text, model tier, temperature, token limits, output
// schema, and review eligibility. Route files must not hardcode any of those values; they
// call runPrompt(REGISTRY.x, input) (see ../client.ts) instead.
//
// Two prompts that existed in the old flat prompts.ts file were NOT migrated here because
// they have zero call sites anywhere in the app (confirmed via grep across src/):
//   - buildRecruiterSummaryPrompt / RecruiterSummarySchema — no route ever called it
//   - buildVoiceProfilePrompt — no route ever called it; only the unrelated VoiceProfile
//     *type* in src/types/database.ts shares the name
// If a future feature needs either, write a fresh PromptSpec against this standard rather
// than resurrecting the old unstructured text — both predate the no-fake-authority pass.
export const REGISTRY = {
  'resume-parse': resumeParsePrompt,
  'portfolio-generation': portfolioGenerationPrompt,
  'proofscore-explanation': proofScoreExplanationPrompt,
  'resume-bullet': resumeBulletPrompt,
  'role-match': roleMatchPrompt,
  'job-parse': jobParsePrompt,
  'match-explanation': matchExplanationPrompt,
  'tailor-application': tailorApplicationPrompt,
  'ats-check': atsCheckPrompt,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<string, PromptSpec<any, any>>

export type PromptId = keyof typeof REGISTRY

export const PROMPT_INVENTORY = Object.values(REGISTRY).map((spec) => ({
  id: spec.id,
  version: spec.version,
  task: spec.task,
  routes: spec.routes,
  modelTier: spec.modelTier,
  temperature: spec.temperature,
  maxOutputTokens: spec.maxOutputTokens,
  reviewPolicy: spec.reviewPolicy,
  invariants: spec.invariants,
}))

export {
  resumeParsePrompt,
  portfolioGenerationPrompt,
  proofScoreExplanationPrompt,
  resumeBulletPrompt,
  roleMatchPrompt,
  jobParsePrompt,
  matchExplanationPrompt,
  tailorApplicationPrompt,
  atsCheckPrompt,
}
export type { PromptSpec, ReviewPolicy } from './types'
