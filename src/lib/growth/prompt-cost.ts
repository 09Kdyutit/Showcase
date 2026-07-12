import { recordAiCostEvent, type AiTokenRates } from '@/lib/growth/ai-cost'

interface PromptCostMeta {
  promptId: string
  promptVersion: string
  provider: string
  model: string
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number }
}

interface RateConfigValue {
  inputPerMillion: number
  cachedInputPerMillion: number
  outputPerMillion: number
  pricingVersion: string
}

export function parseAiCostRates(raw: string | undefined, model: string): AiTokenRates | null {
  if (!raw?.trim()) return null
  try {
    const config = JSON.parse(raw) as Record<string, Partial<RateConfigValue>>
    const selected = config[model] ?? config['*']
    if (!selected
      || typeof selected.inputPerMillion !== 'number'
      || typeof selected.cachedInputPerMillion !== 'number'
      || typeof selected.outputPerMillion !== 'number'
      || typeof selected.pricingVersion !== 'string'
      || !selected.pricingVersion.trim()
      || selected.inputPerMillion < 0
      || selected.cachedInputPerMillion < 0
      || selected.cachedInputPerMillion > selected.inputPerMillion
      || selected.outputPerMillion < 0) return null
    return {
      inputPerMillion: selected.inputPerMillion,
      cachedInputPerMillion: selected.cachedInputPerMillion,
      outputPerMillion: selected.outputPerMillion,
      pricingVersion: selected.pricingVersion,
    }
  } catch {
    return null
  }
}

/**
 * Records actual provider token counts only when an explicit, versioned rate is configured.
 * Missing/stale rates produce no guessed cost row; the scorecard exposes ledger coverage.
 */
export async function recordPromptCost(input: {
  userId: string | null
  meta: PromptCostMeta
  operationId?: string
}): Promise<boolean> {
  const rates = parseAiCostRates(process.env.OPENAI_COST_RATES_JSON, input.meta.model)
  if (!rates) return false
  try {
    await recordAiCostEvent({
      idempotencyKey: `ai-cost:${input.operationId ?? crypto.randomUUID()}`,
      userId: input.userId,
      feature: input.meta.promptId,
      provider: input.meta.provider,
      model: input.meta.model,
      inputTokens: input.meta.usage.inputTokens,
      cachedInputTokens: input.meta.usage.cachedInputTokens,
      outputTokens: input.meta.usage.outputTokens,
      rates,
      metadata: { prompt_version: input.meta.promptVersion },
    })
    return true
  } catch {
    // Cost telemetry must not turn a successful user-facing AI call into an error.
    return false
  }
}
