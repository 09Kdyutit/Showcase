import 'server-only'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import type { ReviewMode, ReviewRequest, ReviewerOutput } from './review-types.ts'
import { ReviewerOutputSchema } from './review-types.ts'
import { buildReviewerPrompt } from './prompts/reviewer.ts'
import { toGeminiJsonSchema } from './gemini-schema-utils.ts'

// ── Configuration — every knob the mission's Phase 8/10/11 requires, all defaulting closed ──

export function getReviewMode(): ReviewMode {
  const mode = process.env.AI_REVIEW_MODE
  if (mode === 'shadow' || mode === 'review' || mode === 'fallback') return mode
  return 'off'
}

export function getReviewSampleRate(): number {
  const rate = Number(process.env.AI_REVIEW_SAMPLE_RATE ?? '0')
  return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0
}

export function getReviewEligibleTasks(): Set<string> {
  return new Set((process.env.AI_REVIEW_TASKS ?? '').split(',').map((s) => s.trim()).filter(Boolean))
}

export function getMaxRevisionPasses(): number {
  const n = Number(process.env.AI_MAX_REVISION_PASSES ?? '1')
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1 // hard ceiling of 1 — never an infinite loop
}

/** Phase 10's privacy/legal gate. Real (non-synthetic) data may never reach Gemini unless an
 *  operator has explicitly flipped this AND a real key is configured. Both default false/unset. */
export function isGeminiPrivateDataAllowed(): boolean {
  return process.env.GEMINI_PRIVATE_DATA_ENABLED === 'true' && !!process.env.GEMINI_API_KEY
}

/** True only when there is something to do — mode isn't off, a key is configured, and (for
 *  any path that would touch real user data) the privacy gate is open. Every call site must
 *  check this before attempting a review; nothing in this codebase calls Gemini unconditionally.
 *  Even when this returns true, callGeminiReviewer()'s own synthetic-only guard is a second,
 *  independent check — this function alone is not what keeps real data out. */
export function isGeminiReviewEnabled(forTask: string): boolean {
  const mode = getReviewMode()
  if (mode === 'off') return false
  if (!process.env.GEMINI_API_KEY) return false
  if (!getReviewEligibleTasks().has(forTask)) return false
  return isGeminiPrivateDataAllowed()
}

// ── Safe, typed errors — never let a raw provider error (which can embed request details)
// reach a route's error response. ──

export class GeminiNotConfiguredError extends Error {
  constructor(reason: string) {
    super(`Gemini review unavailable: ${reason}`)
  }
}

export class GeminiSafetyRejectionError extends Error {
  constructor(reason: string) {
    super(`Gemini review refused: ${reason}`)
  }
}

export class GeminiTimeoutError extends Error {
  constructor() {
    super('Gemini review timed out')
  }
}

export class GeminiSchemaError extends Error {
  constructor(detail: string) {
    super(`Gemini review response failed schema validation: ${detail}`)
  }
}

export class GeminiProviderError extends Error {
  constructor() {
    super('Gemini review provider error')
  }
}

export class GeminiRateLimitError extends Error {
  constructor() {
    super('Gemini review rate-limited (429) after retries')
  }
}

/** Distinct from GeminiRateLimitError: a per-minute throttle is worth retrying with backoff,
 *  but Google's free tier also enforces GenerateRequestsPerDayPerProjectPerModel-FreeTier — a
 *  fixed daily cap (20/day for gemini-2.5-flash as observed in this project) that no amount of
 *  in-process backoff can wait out. Retrying against this wastes the configured retry budget
 *  on every single call for the rest of the day; failing fast here is the correct response. */
export class GeminiDailyQuotaExceededError extends Error {
  constructor() {
    super('Gemini daily free-tier quota exceeded — will not reset until tomorrow; retrying will not help')
  }
}

/** A third distinct 429 cause, observed in this project: this API key's Google Cloud project
 *  is on prepaid billing and its credit balance hit zero. Unlike a daily quota, this does NOT
 *  reset on its own — it requires a human to add funds at ai.studio. Conflating this with
 *  GeminiRateLimitError or GeminiDailyQuotaExceededError would tell an operator to "wait" when
 *  waiting will never fix it. */
export class GeminiCreditsDepletedError extends Error {
  constructor() {
    super('Gemini API prepayment credits depleted — requires billing action, will not resolve by waiting or retrying')
  }
}

const REVIEW_TIMEOUT_MS = 20_000
// gemini-2.5-flash's "thinking" tokens are drawn from the same maxOutputTokens budget as the
// visible JSON response — a run that thinks for ~1500 tokens before answering can blow past a
// tight cap and get cut off mid-JSON (finishReason: MAX_TOKENS), which surfaces here as a
// GeminiSchemaError even though the model would have produced valid JSON given more room.
// 4096 leaves real headroom for thinking + the (small) ReviewerOutputSchema payload.
const MAX_OUTPUT_TOKENS = 4096
// Caps how much of the request we'll build at all — buildReviewerPrompt() also caps each
// section individually; this is a hard backstop on the whole serialized request.
const MAX_REQUEST_CHARACTERS = 12_000

let cachedClient: GoogleGenAI | null = null

function getClient(apiKey: string): GoogleGenAI {
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey })
  }
  return cachedClient
}

// Raw z.toJSONSchema() output is rejected outright by Gemini's responseJsonSchema —
// see gemini-schema-utils.ts, found and fixed while wiring up Interview Lab's
// analysis call against a real billed project for the first time.
const REVIEWER_JSON_SCHEMA = toGeminiJsonSchema(z.toJSONSchema(ReviewerOutputSchema))

function isRateLimitStatus(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'status' in err && (err as { status: unknown }).status === 429
}

/** Google's 429 body distinguishes the quota that was actually hit (see QuotaFailure.violations
 *  in the JSON body) — a per-day quota and a per-minute throttle both surface as HTTP 429, but
 *  only the latter is worth an in-process retry. Checked as a substring on the raw error message
 *  since the SDK doesn't parse this into a typed field. */
function isDailyQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('PerDay')
}

/** A second non-retryable 429 cause distinct from a daily quota: this project's prepaid
 *  billing balance is at zero. Checked the same way — substring match on the raw message,
 *  since the SDK surfaces this as plain text rather than a typed field. */
function isCreditsDepletedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('prepayment credits') || message.includes('credit balance')
}

/** Google's free-tier quota for gemini-2.5-flash is low enough that a batch of sequential
 *  review calls (e.g. the eval:multi-model harness running ~25 fixtures) routinely hits 429
 *  mid-run. Retries with exponential backoff before surfacing GeminiRateLimitError — this is
 *  the adapter being a well-behaved client of a real rate limit, not a workaround for a bug.
 *  A daily-quota 429 fails immediately instead — backoff cannot wait out a quota that resets
 *  tomorrow, and retrying it anyway would burn the configured delay budget on every call for
 *  the rest of the day for no benefit. */
async function generateWithRateLimitRetry(
  client: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
): ReturnType<GoogleGenAI['models']['generateContent']> {
  const delaysMs = [2000, 5000, 10000]
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await client.models.generateContent(params)
    } catch (err) {
      if (!isRateLimitStatus(err)) throw err
      if (isDailyQuotaError(err)) throw new GeminiDailyQuotaExceededError()
      if (isCreditsDepletedError(err)) throw new GeminiCreditsDepletedError()
      if (attempt === delaysMs.length) throw err
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]))
    }
  }
  throw new GeminiRateLimitError()
}

/**
 * The only function in this codebase that talks to Google's API. Two independent gates must
 * both pass before any network call happens: (1) request.dataClassification must be exactly
 * 'synthetic' — there is no value, including undefined, that defaults to "allowed"; (2)
 * GEMINI_API_KEY and GEMINI_MODEL_REVIEWER must be configured via process.env only (never
 * NEXT_PUBLIC_*, never hardcoded). Never logs the key, the full prompt, or raw resume/portfolio
 * content — only operational metadata (model, latency, token counts, verdict) belongs in logs.
 */
export interface GeminiReviewMeta {
  model: string
  latencyMs: number
  promptTokenCount: number | null
  candidatesTokenCount: number | null
  totalTokenCount: number | null
}

export interface GeminiReviewResult {
  data: ReviewerOutput
  meta: GeminiReviewMeta
}

export async function callGeminiReviewer(request: ReviewRequest): Promise<GeminiReviewResult> {
  if (request.dataClassification !== 'synthetic') {
    throw new GeminiSafetyRejectionError(
      `dataClassification must be "synthetic" — got ${JSON.stringify(request.dataClassification)}. Real user/private data may never reach Gemini through this function.`
    )
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiNotConfiguredError('GEMINI_API_KEY is not set')
  const model = process.env.GEMINI_MODEL_REVIEWER
  if (!model) throw new GeminiNotConfiguredError('GEMINI_MODEL_REVIEWER is not set')

  const prompt = buildReviewerPrompt(request).slice(0, MAX_REQUEST_CHARACTERS)
  const client = getClient(apiKey)

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS)
  const startedAt = Date.now()

  try {
    const response = await generateWithRateLimitRetry(client, {
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: REVIEWER_JSON_SCHEMA,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.1,
        abortSignal: controller.signal,
        httpOptions: { timeout: REVIEW_TIMEOUT_MS },
      },
    })
    const latencyMs = Date.now() - startedAt

    const finishReason = response.candidates?.[0]?.finishReason
    if (finishReason === 'MAX_TOKENS') {
      throw new GeminiSchemaError('response was truncated by maxOutputTokens before completing (finishReason: MAX_TOKENS)')
    }

    const text = response.text
    if (!text) throw new GeminiProviderError()

    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      throw new GeminiSchemaError('response was not valid JSON')
    }

    const parsed = ReviewerOutputSchema.safeParse(raw)
    if (!parsed.success) {
      throw new GeminiSchemaError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
    }

    return {
      data: parsed.data,
      meta: {
        model,
        latencyMs,
        promptTokenCount: response.usageMetadata?.promptTokenCount ?? null,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount ?? null,
        totalTokenCount: response.usageMetadata?.totalTokenCount ?? null,
      },
    }
  } catch (err) {
    if (err instanceof GeminiSchemaError || err instanceof GeminiProviderError || err instanceof GeminiRateLimitError || err instanceof GeminiDailyQuotaExceededError || err instanceof GeminiCreditsDepletedError) throw err
    if (controller.signal.aborted) throw new GeminiTimeoutError()
    if (isRateLimitStatus(err)) throw new GeminiRateLimitError()
    // Deliberately do not rethrow the raw provider error — it can carry request internals.
    // Operational detail (not the key, not the prompt) is safe to log server-side only.
    console.error('[gemini-reviewer] provider call failed', { model, promptId: request.promptId })
    throw new GeminiProviderError()
  } finally {
    clearTimeout(timeoutHandle)
  }
}

/** Validates a hypothetical reviewer response against the structured schema — used by tests
 *  and by the real call path alike, so a malformed reviewer response fails closed rather than
 *  silently passing through. */
export function parseReviewerOutput(raw: unknown): ReviewerOutput {
  return ReviewerOutputSchema.parse(raw)
}
