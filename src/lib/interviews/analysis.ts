import { runPrompt } from '@/lib/ai/client'
import { interviewAnalysisPrompt, type InterviewAnalysisInput } from '@/lib/ai/prompts/interview-analysis'
import { isInterviewAnalysisEnabled } from './config'
import type { InterviewAnalysis } from './schemas'

export type { InterviewAnalysisInput as AnalysisPromptInput }

export interface InterviewAnalysisResult {
  data: InterviewAnalysis
  meta: {
    provider: 'openai'
    model: string
    promptId: string
    promptVersion: string
    latencyMs: number
    inputTokens: number
    outputTokens: number
  }
}

export class InterviewAnalysisDisabledError extends Error {}

/**
 * Post-session interview analysis. Runs on OpenAI (gpt-5-mini by default, see
 * src/lib/ai/openai.ts MODELS.interviewAnalysis) rather than Gemini -- moved off Gemini
 * because gpt-5-mini is priced at or below what this text-only task cost on Gemini 2.5
 * Flash, while live voice interviews (src/lib/interviews/gemini/live.ts) stay on Gemini
 * since its native-audio pricing is far cheaper than OpenAI's Realtime API equivalent
 * for that feature specifically.
 *
 * NOTE: isInterviewAnalysisEnabled() still gates on GEMINI_PAID_PROJECT_CONFIRMED /
 * GEMINI_TERMS_COMPATIBILITY_CONFIRMED (see config.ts) even though this path no longer
 * calls Gemini. Kept deliberately -- that gate is preserved as-is rather than silently
 * loosened by this migration; the flags are Gemini-named but represent a human having
 * attested this Interview Lab feature is cost/compliance-reviewed in general. Whether
 * to rename or split that attestation now that analysis runs on a different provider
 * is a separate decision for a human to make, not something to resolve implicitly here.
 */
export async function runInterviewAnalysis(input: InterviewAnalysisInput): Promise<InterviewAnalysisResult> {
  if (!isInterviewAnalysisEnabled()) {
    throw new InterviewAnalysisDisabledError(
      'Interview analysis is not enabled (see src/lib/interviews/config.ts gate flags).'
    )
  }

  const startedAt = Date.now()
  const result = await runPrompt(interviewAnalysisPrompt, input)
  return {
    data: result.data,
    meta: {
      provider: 'openai',
      model: result.meta.model,
      promptId: result.meta.promptId,
      promptVersion: result.meta.promptVersion,
      latencyMs: Date.now() - startedAt,
      inputTokens: result.meta.usage.inputTokens,
      outputTokens: result.meta.usage.outputTokens,
    },
  }
}
