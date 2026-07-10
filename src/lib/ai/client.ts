import 'server-only'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import type { z } from 'zod'
import { openai, MODELS, modelSupportsTemperature, isReasoningModel, type ModelTier } from './openai'
import type { PromptSpec } from './prompts/types'
import {
  GeneralAiBudgetUnavailableError,
  releaseGeneralAiBudget,
  reserveGeneralAiBudget,
  settleGeneralAiBudget,
  type GeneralAiBudgetReservation,
} from '@/lib/growth/ai-budget'

const IS_MOCK_MODE = !process.env.OPENAI_API_KEY && process.env.NODE_ENV === 'development'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ── Mock mode (dev only, no API key) ─────────────────────────────────────────

function getMockResponse(messages: AIMessage[]): string {
  const userMsg = messages.find(m => m.role === 'user')?.content ?? ''

  if (userMsg.includes('ProofScore') || userMsg.includes('audit') || userMsg.includes('Score each category')) {
    return JSON.stringify({
      overall_score: 62,
      summary: '[MOCK MODE] This is a simulated audit response. Set OPENAI_API_KEY in .env.local for real analysis.',
      categories: [
        { name: 'First Impression Clarity', score: 70, maxScore: 100, explanation: 'Mock score', issues: ['Mock issue 1'], severity: 'major', fix: 'Mock fix', example: '', priority: 1 },
        { name: 'Target Role Alignment', score: 65, maxScore: 100, explanation: 'Mock score', issues: [], severity: 'major', fix: 'Mock fix', example: '', priority: 2 },
        { name: 'Proof Strength', score: 45, maxScore: 100, explanation: 'Mock score', issues: ['No metrics'], severity: 'critical', fix: 'Add metrics', example: '', priority: 3 },
        { name: 'Project Depth', score: 55, maxScore: 100, explanation: 'Mock score', issues: [], severity: 'major', fix: 'Mock fix', example: '', priority: 4 },
        { name: 'Resume Quality', score: 68, maxScore: 100, explanation: 'Mock score', issues: [], severity: 'minor', fix: 'Mock fix', example: '', priority: 5 },
        { name: 'Case Study Quality', score: 50, maxScore: 100, explanation: 'Mock score', issues: [], severity: 'major', fix: 'Mock fix', example: '', priority: 6 },
        { name: 'Credibility Signals', score: 60, maxScore: 100, explanation: 'Mock score', issues: [], severity: 'minor', fix: 'Mock fix', example: '', priority: 7 },
        { name: 'Visual Polish', score: 75, maxScore: 100, explanation: 'Mock score', issues: [], severity: 'minor', fix: 'Mock fix', example: '', priority: 8 },
        { name: 'Contact Readiness', score: 80, maxScore: 100, explanation: 'Mock score', issues: [], severity: 'minor', fix: 'Mock fix', example: '', priority: 9 },
        { name: 'Keyword Relevance', score: 58, maxScore: 100, explanation: 'Mock score', issues: [], severity: 'major', fix: 'Mock fix', example: '', priority: 10 },
        { name: 'Hiring Risk Gaps', score: 72, maxScore: 100, explanation: 'Mock score', issues: [], severity: 'minor', fix: 'Mock fix', example: '', priority: 11 },
      ],
      missing_evidence: ['[MOCK] Add quantified outcomes to all bullets', '[MOCK] Include project links'],
      top_priorities: ['[MOCK] Add metrics to bullets', '[MOCK] Expand project descriptions', '[MOCK] Improve headline clarity'],
    })
  }

  if (userMsg.includes('Parse this resume') || userMsg.includes('structured JSON')) {
    return JSON.stringify({
      name: 'Mock User', email: 'mock@example.com', phone: '', location: '',
      summary: '[MOCK MODE] Set OPENAI_API_KEY for real parsing.',
      skills: ['JavaScript', 'React', 'Node.js'],
      experience: [{ company: 'Mock Company', role: 'Software Engineer', period: '2022-2024', bullets: ['Built features'], metrics: [], has_metrics: false }],
      education: [], projects: [], certifications: [],
      links: { linkedin: null, github: null, website: null, portfolio: null },
      weak_bullets: ['Built features'],
      missing_proof: ['No metrics in any bullet'],
      possible_case_studies: ['Mock project could become a case study'],
      overall_resume_quality: 'average', years_of_experience: 2, seniority_level: 'junior',
    })
  }

  if (userMsg.includes('portfolio writer') || userMsg.includes('Generate a complete portfolio')) {
    return JSON.stringify({
      hero: { headline: '[MOCK] Portfolio headline goes here', subheadline: 'Set OPENAI_API_KEY to generate real content', tagline: 'Mock Mode' },
      about: { bio: '[MOCK MODE] Real bio will be generated when OPENAI_API_KEY is set.', values: ['Quality', 'Impact'] },
      skills: [{ name: 'JavaScript', level: 'Expert', category: 'Frontend' }],
      experience: [{ company: 'Mock Corp', role: 'Engineer', period: '2022-now', bullets: ['Built things'], metrics: [] }],
      projects: [{ title: 'Mock Project', role: 'Lead', summary: 'A mock project', problem: '', process: '', outcome: '', metrics: [], links: [], tags: ['Mock'] }],
      proof: [{ label: 'Projects', value: '5+' }],
      contact: { email: '', linkedin: '', github: '', website: '' },
      cta: { headline: 'Get in touch', buttonLabel: 'Contact me' },
    })
  }

  return JSON.stringify({ result: '[MOCK MODE] AI response. Set OPENAI_API_KEY in .env.local for real AI.' })
}

// ── OpenAI error → user-friendly message ─────────────────────────────────────

function toUserError(err: unknown): Error {
  // Always keep the raw error reachable via .cause - the friendly message above is for the
  // user, but swallowing the real error (e.g. a schema validation failure) makes bugs like
  // that invisible in logs. Callers should log err.cause, not just err.message.
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) return new Error('AI service is temporarily overloaded. Please try again in a moment.', { cause: err })
    if (err.status === 401) return new Error('AI service authentication failed. Please contact support.', { cause: err })
    if (err.status === 400) return new Error('AI request was invalid. Please try again.', { cause: err })
    if (err.status >= 500) return new Error('AI service is temporarily unavailable. Please try again.', { cause: err })
    return new Error(`AI request failed. Please try again.`, { cause: err })
  }
  if (err instanceof Error) {
    if (err.name === 'APIConnectionTimeoutError' || err.message.includes('timeout')) {
      return new Error('AI request timed out. Please try again.', { cause: err })
    }
  }
  return new Error('AI service encountered an error. Please try again.', { cause: err instanceof Error ? err : undefined })
}

// Most provider 4xx responses are definitive rejections and can release their reservation.
// Network failures, retry-class 408/409/429 responses, 5xx responses, and local parse
// failures are treated as ambiguous: the provider may already have completed/billed the
// request, so those reservations stay at their maximum and become stale estimates.
function isDefinitiveProviderFailure(err: unknown): boolean {
  return err instanceof OpenAI.APIError
    && typeof err.status === 'number'
    && err.status >= 400
    && err.status < 500
    && ![408, 409, 429].includes(err.status)
}

function legacyBudgetFeature(raw: string): string {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return `legacy_${normalized || 'ai'}`.slice(0, 100)
}

// ── Core: Responses API with structured outputs ───────────────────────────────
//
// Uses openai.responses.parse() + zodTextFormat() for type-safe, validated JSON.
// store: false prevents creation of a retrievable provider Response object. Provider-side
// safety retention and training rules remain governed by the OpenAI account and current
// API policy; Showcase does not log prompt bodies in this client.

export interface StructuredCallUsage {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
}

async function callStructuredWithUsage<T>(
  messages: AIMessage[],
  schema: z.ZodType<T>,
  schemaName: string,
  options: {
    tier?: ModelTier
    maxOutputTokens?: number
    temperature?: number
    textFormat?: ReturnType<typeof zodTextFormat>
    budgetReservation?: GeneralAiBudgetReservation
  } = {}
): Promise<{ data: T; usage: StructuredCallUsage }> {
  if (IS_MOCK_MODE) {
    console.warn('[AI] Mock mode - set OPENAI_API_KEY in .env.local for real responses')
    const raw = getMockResponse(messages)
    return {
      data: schema.parse(JSON.parse(raw)) as T,
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    }
  }

  const model = MODELS[options.tier ?? 'main']
  const input = messages.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }))
  const textFormat = options.textFormat ?? zodTextFormat(schema, schemaName)

  let response: Awaited<ReturnType<typeof openai.responses.parse>>
  try {
    response = await openai.responses.parse({
      model,
      input,
      text: { format: textFormat },
      max_output_tokens: options.maxOutputTokens ?? 4096,
      ...(modelSupportsTemperature(model) ? { temperature: options.temperature ?? 0.3 } : {}),
      // Reasoning models stay smart but answer fast at 'low' effort — avoids the multi-second
      // "thinking" delay that made post-session grading feel sluggish.
      ...(isReasoningModel(model) ? { reasoning: { effort: 'low' as const } } : {}),
      store: false,
    }, options.budgetReservation ? { maxRetries: 0 } : undefined)
  } catch (err) {
    if (options.budgetReservation && isDefinitiveProviderFailure(err)) {
      try {
        await releaseGeneralAiBudget(options.budgetReservation)
      } catch (releaseError) {
        console.error('[AI budget] provider call and reservation release both failed', {
          reservationId: options.budgetReservation.id,
          providerError: err instanceof Error ? err.name : 'unknown',
        })
        throw releaseError
      }
    }
    throw toUserError(err)
  }

  if (options.budgetReservation && !response.usage) {
    // The provider may have charged for this response, so keep the maximum reservation.
    // A later reservation pass converts it to a permanent stale-estimate settlement.
    throw new GeneralAiBudgetUnavailableError(new Error('Provider usage was missing'))
  }

  const usage: StructuredCallUsage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  }

  if (options.budgetReservation) {
    await settleGeneralAiBudget(options.budgetReservation, usage)
  }

  if (response.output_parsed === null) {
    throw new Error('AI declined to respond. Please rephrase and try again.')
  }

  return {
    data: response.output_parsed as T,
    usage,
  }
}

export async function callStructured<T>(
  messages: AIMessage[],
  schema: z.ZodType<T>,
  schemaName: string,
  options: {
    tier?: ModelTier
    maxOutputTokens?: number
    temperature?: number
  } = {}
): Promise<T> {
  const tier = options.tier ?? 'main'
  const model = MODELS[tier]
  const maxOutputTokens = options.maxOutputTokens ?? 4096
  const textFormat = zodTextFormat(schema, schemaName)
  const budgetReservation = IS_MOCK_MODE ? undefined : await reserveGeneralAiBudget({
    feature: legacyBudgetFeature(schemaName),
    model,
    messages,
    structuredFormat: textFormat,
    maxOutputTokens,
  })
  const { data } = await callStructuredWithUsage(messages, schema, schemaName, {
    ...options,
    tier,
    maxOutputTokens,
    textFormat,
    budgetReservation,
  })
  return data
}

// ── Registry-driven calls ─────────────────────────────────────────────────────
//
// The only call path route files should use going forward. Takes a PromptSpec from
// src/lib/ai/prompts/registry.ts so model tier, temperature, token budget, schema, and
// version all come from one place instead of being re-typed at every call site. Returns
// operational metadata alongside the parsed output so callers can persist prompt_id/
// prompt_version/provider/model on the generations row (Phase 13 versioning) without
// hand-typing those strings either.

export interface RunPromptResult<T> {
  data: T
  meta: {
    promptId: string
    promptVersion: string
    provider: 'openai'
    model: string
    schemaName: string
    usage: StructuredCallUsage
  }
}

export async function runPrompt<TInput, TOutput>(
  spec: PromptSpec<TInput, TOutput>,
  input: TInput
): Promise<RunPromptResult<TOutput>> {
  const messages = spec.buildMessages(input)
  const model = MODELS[spec.modelTier]
  const textFormat = zodTextFormat(spec.outputSchema, spec.schemaName)
  const budgetReservation = IS_MOCK_MODE ? undefined : await reserveGeneralAiBudget({
    feature: spec.id,
    model,
    messages,
    structuredFormat: textFormat,
    maxOutputTokens: spec.maxOutputTokens,
  })
  const { data, usage } = await callStructuredWithUsage(
    messages,
    spec.outputSchema,
    spec.schemaName,
    {
      tier: spec.modelTier,
      maxOutputTokens: spec.maxOutputTokens,
      temperature: spec.temperature,
      textFormat,
      budgetReservation,
    }
  )
  return {
    data,
    meta: {
      promptId: spec.id,
      promptVersion: spec.version,
      provider: 'openai',
      model,
      schemaName: spec.schemaName,
      usage,
    },
  }
}

// ── Backward-compat helpers ──────────────────────────────────────────────────
//
// Falls back to JSON-object mode + manual parse. These remain budget-guarded even though
// current route files use runPrompt, so a future legacy call cannot bypass the USD cap.

export async function callAI(
  messages: AIMessage[],
  options: {
    model?: string
    maxTokens?: number
    temperature?: number
    responseFormat?: 'json' | 'text'
  } = {}
): Promise<string> {
  if (IS_MOCK_MODE) {
    console.warn('[AI] Mock mode - set OPENAI_API_KEY in .env.local')
    return getMockResponse(messages)
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('AI service is not configured. Please contact support.')
  }

  const { maxTokens = 4096, temperature = 0.3 } = options
  const tier: ModelTier = (options.model ?? '').includes('mini') ? 'fast' : 'main'
  const model = MODELS[tier]

  const chatMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }))

  const budgetReservation = await reserveGeneralAiBudget({
    feature: legacyBudgetFeature(`chat_${options.responseFormat ?? 'text'}`),
    model,
    messages,
    structuredFormat: options.responseFormat === 'json'
      ? { type: 'json_object' }
      : { type: 'text' },
    maxOutputTokens: maxTokens,
  })

  let response
  try {
    response = await openai.chat.completions.create({
      model,
      messages: chatMessages,
      ...(options.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      max_tokens: maxTokens,
      temperature,
      store: false,
    }, { maxRetries: 0 })
  } catch (err) {
    if (isDefinitiveProviderFailure(err)) {
      try {
        await releaseGeneralAiBudget(budgetReservation)
      } catch (releaseError) {
        console.error('[AI budget] legacy provider call and reservation release both failed', {
          reservationId: budgetReservation.id,
          providerError: err instanceof Error ? err.name : 'unknown',
        })
        throw releaseError
      }
    }
    throw toUserError(err)
  }

  if (!response.usage) {
    throw new GeneralAiBudgetUnavailableError(new Error('Provider usage was missing'))
  }
  await settleGeneralAiBudget(budgetReservation, {
    inputTokens: response.usage.prompt_tokens,
    cachedInputTokens: response.usage.prompt_tokens_details?.cached_tokens ?? 0,
    outputTokens: response.usage.completion_tokens,
  })

  return response.choices?.[0]?.message?.content ?? ''
}

export async function callAIJSON<T>(
  messages: AIMessage[],
  options: Parameters<typeof callAI>[1] = {}
): Promise<T> {
  const text = await callAI(messages, { ...options, responseFormat: 'json' })
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error('AI returned an unexpected response format. Please try again.')
  }
}
