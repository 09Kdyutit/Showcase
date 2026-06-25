import 'server-only'
import { z } from 'zod'
import { InterviewAnalysisSchema, type InterviewAnalysis } from '../schemas.ts'
import { isInterviewAnalysisEnabled } from '../config.ts'
import { getInterviewGeminiClient } from './client.ts'
import { getAnalysisModel } from './models.ts'
import { buildInterviewAnalysisPrompt, type AnalysisPromptInput } from './prompts.ts'
import { toGeminiJsonSchema } from '../../ai/gemini-schema-utils.ts'
import {
  InterviewGeminiDisabledError,
  InterviewGeminiSchemaError,
  InterviewGeminiProviderError,
  InterviewGeminiTimeoutError,
} from './errors.ts'

const ANALYSIS_TIMEOUT_MS = 30_000
const MAX_OUTPUT_TOKENS = 8192
// z.toJSONSchema()'s raw output is rejected outright by Gemini's responseJsonSchema
// (400 INVALID_ARGUMENT, no detail) -- it doesn't support $schema,
// additionalProperties, min/maxItems, or min/maxLength, and needs `nullable: true`
// instead of `anyOf` with a null branch. Confirmed by direct testing against a real
// billed project before this fix existed. See schema-utils.ts.
const ANALYSIS_JSON_SCHEMA = toGeminiJsonSchema(z.toJSONSchema(InterviewAnalysisSchema))

export interface InterviewAnalysisResult {
  data: InterviewAnalysis
  meta: { model: string; latencyMs: number; promptTokenCount: number | null; candidatesTokenCount: number | null }
}

/**
 * The only function in this codebase that calls Gemini for interview analysis. The
 * legal/cost gate (isInterviewAnalysisEnabled — see config.ts) is checked FIRST and
 * unconditionally: as built, GEMINI_PAID_PROJECT_CONFIRMED and GEMINI_INTERVIEW_ENABLED
 * are unset everywhere, so this throws InterviewGeminiDisabledError before any network
 * call in every current environment. That is intentional, not a bug to fix — the
 * mission's own gate requires a human to confirm paid billing and ToS review before
 * this path may run for real, and no human confirmation happened in this session.
 */
export async function runInterviewAnalysis(input: AnalysisPromptInput): Promise<InterviewAnalysisResult> {
  if (!isInterviewAnalysisEnabled()) {
    throw new InterviewGeminiDisabledError(
      'GEMINI_PAID_PROJECT_CONFIRMED and/or GEMINI_INTERVIEW_ENABLED and/or INTERVIEW_ANALYSIS_ENABLED is not true. ' +
      'This requires a human decision (paid Gemini billing confirmed, ToS reviewed, age gate live) — see security/INTERVIEW_LAB_GATE.md.'
    )
  }

  const client = getInterviewGeminiClient()
  const model = getAnalysisModel()
  const prompt = buildInterviewAnalysisPrompt(input)

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS)
  const startedAt = Date.now()

  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: ANALYSIS_JSON_SCHEMA,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.1,
        abortSignal: controller.signal,
        httpOptions: { timeout: ANALYSIS_TIMEOUT_MS },
      },
    })
    const latencyMs = Date.now() - startedAt

    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw new InterviewGeminiSchemaError('response was truncated by maxOutputTokens before completing')
    }

    const text = response.text
    if (!text) throw new InterviewGeminiProviderError()

    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      throw new InterviewGeminiSchemaError('response was not valid JSON')
    }

    const parsed = InterviewAnalysisSchema.safeParse(raw)
    if (!parsed.success) {
      throw new InterviewGeminiSchemaError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
    }

    return {
      data: parsed.data,
      meta: {
        model,
        latencyMs,
        promptTokenCount: response.usageMetadata?.promptTokenCount ?? null,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount ?? null,
      },
    }
  } catch (err) {
    if (err instanceof InterviewGeminiSchemaError || err instanceof InterviewGeminiProviderError) throw err
    if (controller.signal.aborted) throw new InterviewGeminiTimeoutError()
    console.error('[interviews/gemini/analysis] provider call failed', { model })
    throw new InterviewGeminiProviderError()
  } finally {
    clearTimeout(timeoutHandle)
  }
}
