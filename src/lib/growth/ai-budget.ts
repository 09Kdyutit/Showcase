import 'server-only'

import type { AIMessage } from '@/lib/ai/client'

const NANO_USD_PER_USD = 1_000_000_000
const TOKEN_FRAMING_OVERHEAD = 1_024
const STALE_RESERVATION_SECONDS = 15 * 60

export interface OpenAiBudgetRates {
  inputPerMillion: number
  cachedInputPerMillion: number
  outputPerMillion: number
  pricingVersion: string
}

interface OpenAiRateConfigValue {
  inputPerMillion: number
  cachedInputPerMillion: number
  outputPerMillion: number
  pricingVersion: string
}

export interface GeneralAiBudgetReservation {
  id: string
  feature: string
  model: string
  estimatedInputTokens: number
  maxOutputTokens: number
  estimatedCostNanoUsd: number
  rates: OpenAiBudgetRates
}

export interface ProviderTokenUsage {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
}

export class GeneralAiBudgetExceededError extends Error {
  readonly code = 'AI_BUDGET_EXCEEDED'
  readonly period: 'daily' | 'monthly'

  constructor(period: 'daily' | 'monthly') {
    super(period === 'daily'
      ? 'AI has reached today\'s spending limit. Please try again tomorrow.'
      : 'AI has reached this month\'s spending limit. Please try again next month.')
    this.name = 'GeneralAiBudgetExceededError'
    this.period = period
  }
}

export class GeneralAiBudgetUnavailableError extends Error {
  readonly code = 'AI_BUDGET_UNAVAILABLE'

  constructor(cause?: unknown) {
    super('AI is temporarily unavailable while usage protection is being checked. Please try again shortly.', {
      cause: cause instanceof Error ? cause : undefined,
    })
    this.name = 'GeneralAiBudgetUnavailableError'
  }
}

/** Parse a positive USD decimal exactly to integer nano-USD; no float rounding. */
export function parseBudgetUsdToNanoUsd(raw: string | undefined): number | null {
  if (!raw) return null
  const match = raw.trim().match(/^(0|[1-9]\d*)(?:\.(\d{1,9}))?$/)
  if (!match) return null
  const fraction = (match[2] ?? '').padEnd(9, '0')
  const nanoUsd = BigInt(match[1]) * BigInt(NANO_USD_PER_USD) + BigInt(fraction || '0')
  if (nanoUsd <= BigInt(0) || nanoUsd > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(nanoUsd)
}

/** A rate entry must match the exact configured model. Wildcards are explicit, never guessed. */
export function parseOpenAiBudgetRates(
  raw: string | undefined,
  model: string
): OpenAiBudgetRates | null {
  if (!raw?.trim() || !model) return null
  try {
    const config = JSON.parse(raw) as Record<string, Partial<OpenAiRateConfigValue>>
    const selected = config[model] ?? config['*']
    if (!selected
      || typeof selected.inputPerMillion !== 'number'
      || typeof selected.cachedInputPerMillion !== 'number'
      || typeof selected.outputPerMillion !== 'number'
      || typeof selected.pricingVersion !== 'string'
      || !selected.pricingVersion.trim()
      || !Number.isFinite(selected.inputPerMillion)
      || !Number.isFinite(selected.cachedInputPerMillion)
      || !Number.isFinite(selected.outputPerMillion)
      || selected.inputPerMillion < 0
      || selected.cachedInputPerMillion < 0
      || selected.cachedInputPerMillion > selected.inputPerMillion
      || selected.outputPerMillion < 0
      || (selected.inputPerMillion === 0 && selected.outputPerMillion === 0)) return null
    return {
      inputPerMillion: selected.inputPerMillion,
      cachedInputPerMillion: selected.cachedInputPerMillion,
      outputPerMillion: selected.outputPerMillion,
      pricingVersion: selected.pricingVersion.trim(),
    }
  } catch {
    return null
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new GeneralAiBudgetUnavailableError(new Error(`${label} must be a non-negative safe integer`))
  }
}

/**
 * UTF-8 bytes conservatively upper-bound tokenizer tokens for the serialized request.
 * The extra framing allowance covers provider message/schema wrappers not represented in
 * the JSON payload. Prompt bodies are used only in memory for this calculation.
 */
export function estimateStructuredPromptMaximum(input: {
  messages: AIMessage[]
  structuredFormat: unknown
  maxOutputTokens: number
  rates: OpenAiBudgetRates
}): { estimatedInputTokens: number; estimatedCostNanoUsd: number } {
  assertNonNegativeInteger(input.maxOutputTokens, 'maxOutputTokens')
  if (input.maxOutputTokens === 0) throw new GeneralAiBudgetUnavailableError()

  let serialized: string
  try {
    serialized = JSON.stringify({
      input: input.messages.map((message) => ({ role: message.role, content: message.content })),
      text: { format: input.structuredFormat },
    })
  } catch (err) {
    throw new GeneralAiBudgetUnavailableError(err)
  }
  if (!serialized) throw new GeneralAiBudgetUnavailableError()

  const estimatedInputTokens = Buffer.byteLength(serialized, 'utf8') + TOKEN_FRAMING_OVERHEAD
  const estimatedCostNanoUsd = Math.ceil(
    (estimatedInputTokens * input.rates.inputPerMillion
      + input.maxOutputTokens * input.rates.outputPerMillion) * 1_000
  )
  if (!Number.isSafeInteger(estimatedCostNanoUsd) || estimatedCostNanoUsd <= 0) {
    throw new GeneralAiBudgetUnavailableError()
  }
  return { estimatedInputTokens, estimatedCostNanoUsd }
}

/** Provider-reported usage settled at the versioned full/cached/output rates. */
export function calculateProviderCostNanoUsd(
  usage: ProviderTokenUsage,
  rates: OpenAiBudgetRates
): number {
  assertNonNegativeInteger(usage.inputTokens, 'inputTokens')
  assertNonNegativeInteger(usage.cachedInputTokens, 'cachedInputTokens')
  assertNonNegativeInteger(usage.outputTokens, 'outputTokens')
  if (usage.cachedInputTokens > usage.inputTokens) throw new GeneralAiBudgetUnavailableError()
  const uncachedInputTokens = usage.inputTokens - usage.cachedInputTokens
  const cost = Math.ceil((
    uncachedInputTokens * rates.inputPerMillion
    + usage.cachedInputTokens * rates.cachedInputPerMillion
    + usage.outputTokens * rates.outputPerMillion
  ) * 1_000)
  if (!Number.isSafeInteger(cost) || cost < 0) throw new GeneralAiBudgetUnavailableError()
  return cost
}

async function serviceClient() {
  // Kept dynamic so deterministic pure-function tests never initialize framework request
  // state. This is still bundled server-side only because this module imports server-only.
  const { createServiceClient } = await import('@/lib/supabase/server')
  return createServiceClient()
}

function budgetConfig(model: string): {
  dailyBudgetNanoUsd: number
  monthlyBudgetNanoUsd: number
  rates: OpenAiBudgetRates
} {
  const dailyBudgetNanoUsd = parseBudgetUsdToNanoUsd(process.env.OPENAI_GENERAL_DAILY_BUDGET_USD)
  const monthlyBudgetNanoUsd = parseBudgetUsdToNanoUsd(process.env.OPENAI_GENERAL_MONTHLY_BUDGET_USD)
  const rates = parseOpenAiBudgetRates(process.env.OPENAI_COST_RATES_JSON, model)
  if (!dailyBudgetNanoUsd || !monthlyBudgetNanoUsd
    || monthlyBudgetNanoUsd < dailyBudgetNanoUsd || !rates) {
    throw new GeneralAiBudgetUnavailableError()
  }
  return { dailyBudgetNanoUsd, monthlyBudgetNanoUsd, rates }
}

/** Atomically reserve the maximum possible cost before the provider is contacted. */
export async function reserveGeneralAiBudget(input: {
  feature: string
  model: string
  messages: AIMessage[]
  structuredFormat: unknown
  maxOutputTokens: number
}): Promise<GeneralAiBudgetReservation> {
  const { dailyBudgetNanoUsd, monthlyBudgetNanoUsd, rates } = budgetConfig(input.model)
  const estimate = estimateStructuredPromptMaximum({
    messages: input.messages,
    structuredFormat: input.structuredFormat,
    maxOutputTokens: input.maxOutputTokens,
    rates,
  })
  const id = crypto.randomUUID()

  try {
    const service = await serviceClient()
    const { data, error } = await service.rpc('reserve_general_ai_budget', {
      p_reservation_id: id,
      p_feature: input.feature,
      p_model: input.model,
      p_pricing_version: rates.pricingVersion,
      p_estimated_input_tokens: estimate.estimatedInputTokens,
      p_max_output_tokens: input.maxOutputTokens,
      p_input_rate_per_million: rates.inputPerMillion,
      p_cached_input_rate_per_million: rates.cachedInputPerMillion,
      p_output_rate_per_million: rates.outputPerMillion,
      p_daily_budget_nano_usd: dailyBudgetNanoUsd,
      p_monthly_budget_nano_usd: monthlyBudgetNanoUsd,
      p_stale_after_seconds: STALE_RESERVATION_SECONDS,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row.allowed !== 'boolean') throw new Error('Malformed budget reservation response')
    if (!row.allowed) {
      if (row.denial_reason === 'daily' || row.denial_reason === 'monthly') {
        throw new GeneralAiBudgetExceededError(row.denial_reason)
      }
      throw new Error('Budget reservation was denied without a valid reason')
    }
  } catch (err) {
    if (err instanceof GeneralAiBudgetExceededError) throw err
    throw new GeneralAiBudgetUnavailableError(err)
  }

  return {
    id,
    feature: input.feature,
    model: input.model,
    estimatedInputTokens: estimate.estimatedInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    estimatedCostNanoUsd: estimate.estimatedCostNanoUsd,
    rates,
  }
}

/** Replace the reservation with actual provider usage. Missing/malformed usage fails closed. */
export async function settleGeneralAiBudget(
  reservation: GeneralAiBudgetReservation,
  usage: ProviderTokenUsage
): Promise<void> {
  if (usage.inputTokens <= 0) {
    // Every real structured request has input. Never let a malformed zero-usage payload
    // clear a conservative reservation after the provider has been contacted.
    throw new GeneralAiBudgetUnavailableError(new Error('Provider usage was not billable'))
  }
  // Validate provider usage locally; the database independently recomputes authoritative
  // nano-USD from the row's frozen rates instead of trusting a caller-supplied cost.
  calculateProviderCostNanoUsd(usage, reservation.rates)
  try {
    const service = await serviceClient()
    const { data, error } = await service.rpc('settle_general_ai_budget', {
      p_reservation_id: reservation.id,
      p_actual_input_tokens: usage.inputTokens,
      p_actual_cached_input_tokens: usage.cachedInputTokens,
      p_actual_output_tokens: usage.outputTokens,
    })
    if (error) throw error
    if (data !== true) throw new Error('Budget reservation could not be settled')
  } catch (err) {
    throw new GeneralAiBudgetUnavailableError(err)
  }
}

/** Release only when no usable provider response was returned. */
export async function releaseGeneralAiBudget(
  reservation: GeneralAiBudgetReservation
): Promise<void> {
  try {
    const service = await serviceClient()
    const { data, error } = await service.rpc('release_general_ai_budget', {
      p_reservation_id: reservation.id,
    })
    if (error) throw error
    if (data !== true) throw new Error('Budget reservation could not be released')
  } catch (err) {
    throw new GeneralAiBudgetUnavailableError(err)
  }
}
