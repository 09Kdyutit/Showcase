import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  GeneralAiBudgetExceededError,
  calculateProviderCostNanoUsd,
  estimateStructuredPromptMaximum,
  parseBudgetUsdToNanoUsd,
  parseOpenAiBudgetRates,
  settleGeneralAiBudget,
} from '../src/lib/growth/ai-budget.ts'

let checks = 0
const check = (condition, message) => {
  assert.ok(condition, message)
  checks += 1
}

assert.equal(parseBudgetUsdToNanoUsd('4'), 4_000_000_000)
checks += 1
assert.equal(parseBudgetUsdToNanoUsd('80.000000001'), 80_000_000_001)
checks += 1
for (const invalid of [undefined, '', '0', '-1', '4.0000000001', '1e2', ' 4 dollars ']) {
  assert.equal(parseBudgetUsdToNanoUsd(invalid), null, `invalid USD budget must fail closed: ${invalid}`)
  checks += 1
}

const rateJson = JSON.stringify({
  exact: {
    inputPerMillion: 2.5,
    cachedInputPerMillion: 1.25,
    outputPerMillion: 10,
    pricingVersion: 'test-v1',
  },
  '*': {
    inputPerMillion: 0.25,
    cachedInputPerMillion: 0.025,
    outputPerMillion: 2,
    pricingVersion: 'fallback-v1',
  },
})
const exactRates = parseOpenAiBudgetRates(rateJson, 'exact')
assert.deepEqual(exactRates, {
  inputPerMillion: 2.5,
  cachedInputPerMillion: 1.25,
  outputPerMillion: 10,
  pricingVersion: 'test-v1',
})
checks += 1
assert.equal(parseOpenAiBudgetRates(rateJson, 'other')?.pricingVersion, 'fallback-v1')
checks += 1
for (const invalidRates of [
  undefined,
  '{}',
  JSON.stringify({ exact: { inputPerMillion: 1, outputPerMillion: 2, pricingVersion: 'v' } }),
  JSON.stringify({ exact: { inputPerMillion: 1, cachedInputPerMillion: 2, outputPerMillion: 2, pricingVersion: 'v' } }),
  JSON.stringify({ exact: { inputPerMillion: 0, cachedInputPerMillion: 0, outputPerMillion: 0, pricingVersion: 'v' } }),
]) {
  assert.equal(parseOpenAiBudgetRates(invalidRates, 'exact'), null, 'invalid/missing rates must fail closed')
  checks += 1
}

const messages = [
  { role: 'system', content: 'Be precise.' },
  { role: 'user', content: 'Résumé evidence: 🚀' },
]
const structuredFormat = {
  type: 'json_schema',
  name: 'result',
  strict: true,
  schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
}
const estimate = estimateStructuredPromptMaximum({
  messages,
  structuredFormat,
  maxOutputTokens: 400,
  rates: exactRates,
})
const serializedBytes = Buffer.byteLength(JSON.stringify({
  input: messages,
  text: { format: structuredFormat },
}), 'utf8')
assert.equal(estimate.estimatedInputTokens, serializedBytes + 1_024)
checks += 1
assert.equal(
  estimate.estimatedCostNanoUsd,
  Math.ceil(((serializedBytes + 1_024) * 2.5 + 400 * 10) * 1_000)
)
checks += 1

assert.equal(calculateProviderCostNanoUsd({
  inputTokens: 1_000,
  cachedInputTokens: 400,
  outputTokens: 200,
}, exactRates), 4_000_000)
checks += 1
assert.throws(
  () => calculateProviderCostNanoUsd({ inputTokens: 10, cachedInputTokens: 11, outputTokens: 0 }, exactRates),
  /usage protection/
)
checks += 1
await assert.rejects(
  () => settleGeneralAiBudget({
    id: '00000000-0000-4000-8000-000000000001',
    feature: 'test-prompt',
    model: 'exact',
    estimatedInputTokens: 1_000,
    maxOutputTokens: 400,
    estimatedCostNanoUsd: 1_000_000,
    rates: exactRates,
  }, { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }),
  /usage protection/,
  'missing/zero provider usage must keep the maximum reservation'
)
checks += 1
assert.match(new GeneralAiBudgetExceededError('daily').message, /tomorrow/i)
checks += 1
assert.match(new GeneralAiBudgetExceededError('monthly').message, /next month/i)
checks += 1

const migration = readFileSync(resolve('supabase/migrations/20260710033046_referral_abuse_and_credit_hardening.sql'), 'utf8')
check(migration.includes('add column if not exists cached_input_tokens'),
  'secondary cost telemetry must persist cached input usage')
check(migration.includes('add column if not exists cached_input_rate_per_million'),
  'secondary cost telemetry must persist cached input rates')
const budgetSql = migration.slice(migration.indexOf('-- General OpenAI spend'))
for (const required of [
  'create table if not exists public.general_ai_budget_reservations',
  "pg_advisory_xact_lock(hashtextextended('showcase-general-openai-budget', 0))",
  'v_now := clock_timestamp()',
  "coalesce(auth.role(), '') <> 'service_role'",
  "status = 'settled'",
  "actual_cost_nano_usd = r.estimated_cost_nano_usd",
  "resolution = 'stale_estimate'",
  'v_daily_committed + v_estimated_cost_nano_usd > p_daily_budget_nano_usd',
  'v_monthly_committed + v_estimated_cost_nano_usd > p_monthly_budget_nano_usd',
  "return query select false, null::uuid, 'duplicate'::text",
  'p_daily_budget_nano_usd > 4000000000',
  'p_monthly_budget_nano_usd > 80000000000',
  'v_actual_cost_nano_usd := ceil',
  'create or replace function public.settle_general_ai_budget',
  "resolution = 'provider_usage'",
  'create or replace function public.release_general_ai_budget',
  "resolution = 'provider_failure'",
  'revoke all on function public.reserve_general_ai_budget',
  'grant execute on function public.reserve_general_ai_budget',
]) check(budgetSql.toLowerCase().includes(required.toLowerCase()), `budget migration is missing: ${required}`)
check(
  budgetSql.indexOf('v_now := clock_timestamp()') > budgetSql.indexOf("pg_advisory_xact_lock(hashtextextended('showcase-general-openai-budget', 0))"),
  'UTC accounting time must be captured after waiting for the global lock'
)

const tableDefinition = budgetSql.match(/create table if not exists public\.general_ai_budget_reservations \([\s\S]*?\n\);/)?.[0] ?? ''
check(tableDefinition.length > 0, 'budget table definition must be discoverable')
check(!/(prompt|message|request_body|response_body|resume|portfolio)[_a-z]*\s/.test(tableDefinition),
  'budget table must never persist prompt or product-content bodies')

const client = readFileSync(resolve('src/lib/ai/client.ts'), 'utf8')
const preparePromptIndex = client.indexOf('export async function preparePromptCall')
const reserveIndex = client.indexOf('await reserveGeneralAiBudget', preparePromptIndex)
const quotaPromptIndex = client.indexOf('export async function runPromptWithQuota')
const attemptLimitIndex = client.indexOf('await checkAiReservationAttemptLimit', quotaPromptIndex)
const quotaPrepareIndex = client.indexOf('await preparePromptCall', quotaPromptIndex)
const quotaConsumeIndex = client.indexOf('await checkRateLimit', quotaPromptIndex)
const quotaProviderIndex = client.indexOf('await prepared.run()', quotaPromptIndex)
const providerIndex = client.indexOf('openai.responses.parse')
check(reserveIndex > preparePromptIndex, 'prepared prompt must atomically reserve its maximum dollar cost')
check(attemptLimitIndex > quotaPromptIndex && attemptLimitIndex < quotaPrepareIndex,
  'a separate non-credit attempt throttle must bound authenticated reservation churn')
check(quotaPrepareIndex > quotaPromptIndex && quotaPrepareIndex < quotaConsumeIndex,
  'authenticated prompt flow must reserve dollars before consuming user quota/referral credit')
check(quotaConsumeIndex < quotaProviderIndex,
  'authenticated prompt flow must consume quota before contacting the provider')
check(client.includes('if (!rateLimit.allowed) {\n    await prepared.release()'),
  'a quota denial must idempotently release its unused dollar reservation')
check(client.includes("state: 'ready' | 'releasing' | 'started' | 'released'"),
  'prepared calls must serialize release and enforce one-shot provider use')
check(client.includes("if (state === 'released' || state === 'started') return"),
  'release must be idempotent and must not reopen spend after provider contact')
const rateLimit = readFileSync(resolve('src/lib/ai/rate-limit.ts'), 'utf8')
check(rateLimit.includes('ai:reservation-attempt:'),
  'reservation churn must use a separate key that cannot consume product quota/referral credit')
check(client.includes('await settleGeneralAiBudget(options.budgetReservation, usage)'), 'provider usage must settle the reservation')
check(client.includes('await releaseGeneralAiBudget(options.budgetReservation)'), 'provider failure must release the reservation')
check(client.includes('isDefinitiveProviderFailure(err)'), 'ambiguous network/parse failures must retain their maximum reservation')
check(client.includes('{ maxRetries: 0 }'), 'guarded calls must not hide extra billable retries')
check(client.includes('IS_MOCK_MODE ? undefined : await reserveGeneralAiBudget'), 'mock mode must not require budget RPCs')
check(client.includes('input_tokens_details?.cached_tokens'), 'settlement must use cached-input token details')
check(client.includes('feature: legacyBudgetFeature(schemaName)'), 'legacy structured calls must reserve budget')
check(client.includes('feature: legacyBudgetFeature(`chat_${options.responseFormat'), 'legacy chat calls must reserve budget')
check(client.includes('response.usage.prompt_tokens_details?.cached_tokens'), 'legacy chat settlement must include cached tokens')
check(client.includes('err.status < 500'), 'ambiguous provider 5xx failures must retain their reservation')
check(client.includes('![408, 409, 429].includes(err.status)'),
  'retry-class 408/409/429 responses must retain their reservation')
check(providerIndex >= 0, 'central provider path must remain present')

const quotaGuardedRoutes = [
  'src/app/api/ai/analyze-resume/route.ts',
  'src/app/api/ai/audit-portfolio/route.ts',
  'src/app/api/ai/cover-letter/route.ts',
  'src/app/api/ai/generate-portfolio/route.ts',
  'src/app/api/ai/improve-resume/route.ts',
  'src/app/api/ai/outreach/route.ts',
  'src/app/api/ai/role-match/route.ts',
  'src/app/api/ai/suggest-projects/route.ts',
  'src/app/api/ats/check/route.ts',
  'src/app/api/interviews/drills/[id]/attempt/route.ts',
  'src/app/api/interviews/questions/score/route.ts',
  'src/app/api/jobs/[id]/tailor/route.ts',
  'src/app/api/jobs/import/route.ts',
  'src/app/api/jobs/match/route.ts',
]
for (const routePath of quotaGuardedRoutes) {
  const route = readFileSync(resolve(routePath), 'utf8')
  check(route.includes('runPromptWithQuota('), `${routePath} must use reserve-before-quota flow`)
  check(!route.includes('await runPrompt('), `${routePath} must not bypass reserve-before-quota flow`)
}

const envExample = readFileSync(resolve('.env.example'), 'utf8')
check(envExample.includes('OPENAI_GENERAL_DAILY_BUDGET_USD=4'), 'general daily allocation must be $4')
check(envExample.includes('OPENAI_GENERAL_MONTHLY_BUDGET_USD=80'), 'general monthly allocation must be $80')
check(envExample.includes('INTERVIEW_GLOBAL_DAILY_BUDGET_USD=1'), 'Interview Lab daily allocation must be $1')
check(envExample.includes('INTERVIEW_GLOBAL_MONTHLY_BUDGET_USD=20'), 'Interview Lab monthly allocation must be $20')
check(envExample.includes('cachedInputPerMillion'), 'versioned rate config must include cached-input pricing')

console.log(`General AI budget guard: ${checks} deterministic checks passed`)
