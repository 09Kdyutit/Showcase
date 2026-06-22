import { z } from 'zod'

export type ReviewMode = 'off' | 'shadow' | 'review' | 'fallback'

// Structured reviewer output. The reviewer critiques and flags — it never silently rewrites,
// never invents its own facts, and never touches a deterministic score (there is no field
// here that could hold one). See PHASE9 in the prompt-quality mission for the full rationale.
export const ReviewerOutputSchema = z.object({
  verdict: z.enum(['pass', 'revise', 'block']),
  scores: z.object({
    factual_grounding: z.number().min(0).max(100),
    source_fidelity: z.number().min(0).max(100),
    role_relevance: z.number().min(0).max(100),
    specificity: z.number().min(0).max(100),
    actionability: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    natural_tone: z.number().min(0).max(100),
    schema_compliance: z.number().min(0).max(100),
  }),
  unsupported_claims: z.array(z.object({
    claim: z.string(),
    reason: z.string(),
    source_found: z.boolean(),
  })),
  missing_evidence: z.array(z.string()),
  critical_issues: z.array(z.string()),
  // Phase 6: the reviewer must distinguish issue kinds rather than lump everything into one
  // bucket — a style preference and a factual error must never carry the same weight.
  classified_issues: z.array(z.object({
    description: z.string(),
    category: z.enum(['factual_error', 'unsupported_claim', 'missing_evidence', 'style_preference', 'optional_improvement']),
  })),
  revision_instructions: z.array(z.string()),
  confidence: z.number().min(0).max(100),
})

export type ReviewerOutput = z.infer<typeof ReviewerOutputSchema>

/** Hard synthetic-only safety lock (Phase 3). Every ReviewRequest must declare what kind of
 *  data it carries; callGeminiReviewer() rejects anything other than 'synthetic' regardless
 *  of any other config, so a caller cannot accidentally route real user data to Gemini by
 *  omitting this field — there is no default that means "real data is fine". */
export type DataClassification = 'synthetic' | 'private' | 'user'

export interface ReviewRequest {
  /** Which PromptSpec id produced the output being reviewed. */
  promptId: string
  /** The generated output to review — already schema-validated and passed deterministic
   *  truth/safety checks before reaching here, per Phase 8's flow. */
  output: unknown
  /** Minimized, normalized evidence the reviewer needs to check claims against — never the
   *  full raw resume/portfolio. Phase 10: minimize data even in paid review mode. */
  normalizedEvidence: Record<string, unknown>
  targetRole: string
  /** Required, no default. Must be exactly 'synthetic' for callGeminiReviewer() to proceed. */
  dataClassification: DataClassification
}
