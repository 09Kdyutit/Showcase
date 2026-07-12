import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

export interface AiTokenRates {
  inputPerMillion: number
  cachedInputPerMillion: number
  outputPerMillion: number
  pricingVersion: string
}

export interface AiCostEventInput {
  idempotencyKey: string
  feature: string
  provider: string
  model: string
  inputTokens: number
  cachedInputTokens?: number
  outputTokens: number
  rates: AiTokenRates
  userId?: string | null
  generationId?: string | null
  estimated?: boolean
  occurredAt?: string
  metadata?: Record<string, string | number | boolean | null>
}

export function calculateAiCostUsd(
  inputTokens: number,
  outputTokens: number,
  rates: Pick<AiTokenRates, 'inputPerMillion' | 'cachedInputPerMillion' | 'outputPerMillion'>,
  cachedInputTokens = 0,
): number {
  const values = [inputTokens, cachedInputTokens, outputTokens, rates.inputPerMillion,
    rates.cachedInputPerMillion, rates.outputPerMillion]
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('AI usage and rates must be finite, non-negative numbers')
  }
  if (cachedInputTokens > inputTokens || rates.cachedInputPerMillion > rates.inputPerMillion) {
    throw new Error('Cached usage/rates cannot exceed total input usage/rates')
  }
  const uncachedInputTokens = inputTokens - cachedInputTokens
  return Number((
    (uncachedInputTokens / 1_000_000) * rates.inputPerMillion
    + (cachedInputTokens / 1_000_000) * rates.cachedInputPerMillion
    + (outputTokens / 1_000_000) * rates.outputPerMillion
  ).toFixed(8))
}

/** Append a provider usage fact with the rates used at the time of the call. */
export async function recordAiCostEvent(
  input: AiCostEventInput,
  client?: SupabaseClient
): Promise<number> {
  const cachedInputTokens = input.cachedInputTokens ?? 0
  const costUsd = calculateAiCostUsd(input.inputTokens, input.outputTokens, input.rates, cachedInputTokens)
  const supabase = client ?? await createServiceClient()
  const { error } = await supabase.from('ai_cost_events').upsert({
    idempotency_key: input.idempotencyKey,
    user_id: input.userId ?? null,
    generation_id: input.generationId ?? null,
    feature: input.feature,
    provider: input.provider,
    model: input.model,
    input_tokens: input.inputTokens,
    cached_input_tokens: cachedInputTokens,
    output_tokens: input.outputTokens,
    input_rate_per_million: input.rates.inputPerMillion,
    cached_input_rate_per_million: input.rates.cachedInputPerMillion,
    output_rate_per_million: input.rates.outputPerMillion,
    cost_usd: costUsd,
    pricing_version: input.rates.pricingVersion,
    estimated: input.estimated ?? false,
    metadata: input.metadata ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true })

  if (error) throw new Error(`Could not record AI cost: ${error.message}`)
  return costUsd
}
