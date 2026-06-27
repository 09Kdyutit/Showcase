import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { getGlobalDailyBudgetUsd, getUserMonthlyBudgetUsd, getGlobalMonthlyBudgetUsd } from './config'

export type CostFeature = 'question_gen' | 'transcription' | 'analysis' | 'live_voice'

export class BudgetExceededError extends Error {}

// Per-1M-token USD rates used to compute (or, for live voice, estimate) cost_usd.
// Kept here rather than scattered across each caller so the numbers can be audited
// and updated in one place as provider pricing changes.
export const RATES = {
  // Gemini 2.5 Flash, standard generateContent (question generation, transcription)
  geminiFlashTextInPerM: 0.30,
  geminiFlashTextOutPerM: 2.50,
  geminiFlashAudioInPerM: 1.00, // audio input costs more than text input on the same model
  // Gemini 2.5 Flash Native Audio, Live API
  geminiLiveAudioInPerM: 3.00,
  geminiLiveAudioOutPerM: 12.00,
  // OpenAI gpt-5-mini (interview analysis) - see src/lib/ai/openai.ts MODELS.interviewAnalysis
  gpt5MiniInPerM: 0.25,
  gpt5MiniOutPerM: 2.00,
} as const

export function costFromTokens(inputTokens: number, outputTokens: number, inRatePerM: number, outRatePerM: number): number {
  return (inputTokens / 1_000_000) * inRatePerM + (outputTokens / 1_000_000) * outRatePerM
}

// Gemini's documented audio tokenization rate is ~32 tokens/second. Live voice cost
// can't be measured exactly here (see migration 028's comment), so this estimates
// audio-in as continuous for the whole connected duration (the mic stream is always
// being sent) and audio-out as roughly half the duration (the AI isn't talking the
// entire time in a back-and-forth interview) -- deliberately biased toward
// overestimating, since this number only feeds a spend-protection gate, not a refund.
const AUDIO_TOKENS_PER_SECOND = 32
const ASSUMED_AI_SPEAKING_FRACTION = 0.5

export function estimateLiveVoiceCostUsd(durationSeconds: number): number {
  const audioInTokens = durationSeconds * AUDIO_TOKENS_PER_SECOND
  const audioOutTokens = durationSeconds * AUDIO_TOKENS_PER_SECOND * ASSUMED_AI_SPEAKING_FRACTION
  return costFromTokens(audioInTokens, audioOutTokens, RATES.geminiLiveAudioInPerM, RATES.geminiLiveAudioOutPerM)
}

export async function recordCostEvent(input: {
  userId: string
  sessionId?: string | null
  feature: CostFeature
  provider: string
  model: string
  costUsd: number
  estimated: boolean
}): Promise<void> {
  try {
    const service = await createServiceClient()
    const { error } = await service.from('interview_cost_events').insert({
      user_id: input.userId,
      session_id: input.sessionId ?? null,
      feature: input.feature,
      provider: input.provider,
      model: input.model,
      cost_usd: input.costUsd,
      estimated: input.estimated,
    })
    if (error) console.error('[interviews/budget] failed to record cost event', error.message)
  } catch (err) {
    // Never let cost-ledger bookkeeping break a request that otherwise succeeded.
    console.error('[interviews/budget] failed to record cost event', err instanceof Error ? err.message : err)
  }
}

async function sumCostUsdSince(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  sinceIso: string,
  userId?: string
): Promise<number> {
  let query = service.from('interview_cost_events').select('cost_usd').gte('created_at', sinceIso)
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd), 0)
}

/**
 * Pre-flight budget check - call BEFORE making a cost-incurring AI call, passing a
 * conservative (worst-case, not expected-case) estimate of what that call could cost.
 * Throws BudgetExceededError (fail closed) if allowing it would breach any configured
 * ceiling. All three budgets default to null (unconfigured), which config.ts documents
 * as "do not allow any cost-incurring call" rather than "unlimited" - so with nothing
 * set in .env, this throws for every call until INTERVIEW_GLOBAL_DAILY_BUDGET_USD,
 * INTERVIEW_USER_MONTHLY_BUDGET_USD, and INTERVIEW_GLOBAL_MONTHLY_BUDGET_USD are all set.
 *
 * isPro skips the per-user monthly check: a Pro subscriber's usage is already bounded
 * by the plan limits in entitlements/plans.ts (session counts, max minutes, etc.)  -
 * that's where their paid quota is supposed to live, not here. The two GLOBAL checks
 * (daily + monthly) still apply to every user regardless of plan, because those protect
 * the actual provider account balance - once that hits zero, AI calls fail with an
 * ugly provider error for every user, paying or not, so everyone shares that ceiling.
 */
export async function assertWithinBudget(userId: string, estimatedCostUsd: number, isPro = false): Promise<void> {
  const dailyBudget = getGlobalDailyBudgetUsd()
  const userMonthlyBudget = getUserMonthlyBudgetUsd()
  const globalMonthlyBudget = getGlobalMonthlyBudgetUsd()

  if (dailyBudget === null || (!isPro && userMonthlyBudget === null) || globalMonthlyBudget === null) {
    throw new BudgetExceededError(
      'Interview Lab cost budgets are not configured. Set INTERVIEW_GLOBAL_DAILY_BUDGET_USD, ' +
      'INTERVIEW_USER_MONTHLY_BUDGET_USD, and INTERVIEW_GLOBAL_MONTHLY_BUDGET_USD to enable AI features.'
    )
  }

  const service = await createServiceClient()
  const now = new Date()
  const todayStartIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const monthStartIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const [todayGlobalSpend, monthUserSpend, monthGlobalSpend] = await Promise.all([
    sumCostUsdSince(service, todayStartIso),
    isPro ? Promise.resolve(0) : sumCostUsdSince(service, monthStartIso, userId),
    sumCostUsdSince(service, monthStartIso),
  ])

  if (todayGlobalSpend + estimatedCostUsd > dailyBudget) {
    throw new BudgetExceededError(`Interview Lab's daily AI budget ($${dailyBudget}) would be exceeded. Try again tomorrow.`)
  }
  if (!isPro && monthUserSpend + estimatedCostUsd > (userMonthlyBudget as number)) {
    throw new BudgetExceededError(`You've reached this month's Interview Lab AI usage limit ($${userMonthlyBudget}).`)
  }
  if (monthGlobalSpend + estimatedCostUsd > globalMonthlyBudget) {
    throw new BudgetExceededError(`Interview Lab's monthly AI budget ($${globalMonthlyBudget}) would be exceeded. Try again next month.`)
  }
}
