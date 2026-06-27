import type { z } from 'zod'
import type { AIMessage } from '../client'
import type { ModelTier } from '../openai'

// Who is allowed to consume this task's output as a real (not synthetic-fixture-only)
// AI call. Keeps Gemini review opt-in per task rather than a single global switch  - 
// matches Phase 11's "per-task review eligibility" requirement.
export type ReviewPolicy = 'none' | 'shadow' | 'review'

export interface PromptSpec<TInput, TOutput> {
  /** Stable identifier. Never reused for a different task once shipped. */
  id: string
  /** Bump on any change to task text, rubric, or output contract. Never edit a shipped
   *  version's wording in place - ship a new version so old generations stay attributable. */
  version: string
  /** One-line description of what this prompt produces, for the registry inventory. */
  task: string
  /** Route(s) that call this prompt, for the inventory - informational only. */
  routes: string[]
  modelTier: ModelTier
  temperature: number
  maxOutputTokens: number
  /** Characters of untrusted free-text input this task will accept before truncating. */
  maxInputCharacters: number
  outputSchema: z.ZodType<TOutput>
  /** Schema name passed to the provider's structured-output mode. */
  schemaName: string
  buildMessages(input: TInput): AIMessage[]
  /** Human-readable non-negotiable rules this prompt's text encodes - used both as
   *  documentation and as a checklist for deterministic graders in the eval harness. */
  invariants: string[]
  reviewPolicy: ReviewPolicy
}

export function definePrompt<TInput, TOutput>(spec: PromptSpec<TInput, TOutput>): PromptSpec<TInput, TOutput> {
  return spec
}
