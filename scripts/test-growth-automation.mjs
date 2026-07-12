import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resend } from 'resend'
import {
  deriveLifecycleCandidates,
  lifecycleDeliveryKey,
} from '../src/lib/growth/lifecycle.ts'
import { lifecycleEmail } from '../src/lib/email/lifecycle-email.ts'
import { isFreshWebhookTimestamp, normalizeEmailAddress } from '../src/lib/email/webhook.ts'
import {
  buildGrowthScorecard,
  completedUtcWeek,
  isOrganicFirstTouch,
} from '../src/lib/growth/scorecard.ts'

const now = new Date('2026-07-09T12:00:00.000Z')
const hoursAgo = (hours) => new Date(now.getTime() - hours * 3600_000).toISOString()
const profiles = [
  { id: 'signup-user', email: 'signup@example.com', fullName: 'Sam Signup', createdAt: hoursAgo(25) },
  { id: 'two-hour-user', email: 'two@example.com', fullName: 'Taylor Two', createdAt: hoursAgo(200) },
  { id: 'sixty-eight-user', email: 'later@example.com', fullName: null, createdAt: hoursAgo(200) },
  { id: 'previewed-user', email: 'previewed@example.com', fullName: 'Pat Preview', createdAt: hoursAgo(200) },
  { id: 'completed-user', email: 'completed@example.com', fullName: 'Casey Complete', createdAt: hoursAgo(200) },
]
const portfolios = [
  { id: 'portfolio-two', userId: 'two-hour-user', generatedAt: hoursAgo(3) },
  { id: 'portfolio-later', userId: 'sixty-eight-user', generatedAt: hoursAgo(70) },
  { id: 'portfolio-previewed', userId: 'previewed-user', generatedAt: hoursAgo(3) },
  { id: 'portfolio-completed', userId: 'completed-user', generatedAt: hoursAgo(3) },
]
const facts = [
  { eventName: 'portfolio_preview_viewed', userId: 'previewed-user', entityId: 'portfolio-previewed', occurredAt: hoursAgo(1) },
  { eventName: 'portfolio_completed', userId: 'completed-user', entityId: 'portfolio-completed', occurredAt: hoursAgo(1) },
]

const candidates = deriveLifecycleCandidates({ now, profiles, portfolios, facts })
assert.deepEqual(
  candidates.map((candidate) => candidate.template).sort(),
  ['generated_not_previewed_2h', 'generated_not_previewed_68h', 'portfolio_completion', 'signup_not_generated_24h'].sort(),
  'each lifecycle moment should produce exactly one eligible delivery'
)
assert.equal(new Set(candidates.map((candidate) => candidate.idempotencyKey)).size, candidates.length)
assert.equal(
  lifecycleDeliveryKey('generated_not_previewed_2h', 'user', 'portfolio'),
  lifecycleDeliveryKey('generated_not_previewed_2h', 'user', 'portfolio'),
  'delivery keys must be deterministic across retries'
)
assert.ok(!candidates.some((candidate) => candidate.userId === 'previewed-user'), 'previewed drafts must not receive a nudge')

for (const template of ['signup_not_generated_24h', 'generated_not_previewed_2h', 'generated_not_previewed_68h', 'portfolio_completion']) {
  const rendered = lifecycleEmail({
    template,
    firstName: 'A&B',
    appUrl: 'https://example.com/',
    unsubscribeUrl: 'https://example.com/api/email/unsubscribe?kind=lifecycle&token=abc',
    portfolioId: '00000000-0000-0000-0000-000000000001',
    postalAddress: '123 Example St, Test City, NY 10001',
  })
  assert.ok(rendered.subject.length > 5)
  assert.match(rendered.html, /Unsubscribe from lifecycle emails/)
  assert.match(rendered.text, /Unsubscribe:/)
  assert.match(rendered.text, /123 Example St/)
  assert.ok(!rendered.html.includes('Hey A&B,'), 'names must be escaped in HTML')
}

const scorecard = buildGrowthScorecard({
  periodStart: '2026-06-29T00:00:00.000Z',
  periodEnd: '2026-07-06T00:00:00.000Z',
  anonymousSessions: 100,
  organicSessions: 80,
  signups: 20,
  attributedSignups: 15,
  proofscoreViews: 12,
  generatedPortfolios: 10,
  completedPortfolios: 8,
  completedPortfolioUsers: 7,
  activationCohort: 10,
  activatedWithin72h: 4,
  d7Cohort: 10,
  d7MeaningfulReturns: 2,
  proConversions: 1,
  publishPaywallUsers: 4,
  publishPaywallConversions: 1,
  referralShares: 4,
  referralSharers: 2,
  activatedReferrals: 2,
  aiCostEvents: 25,
  aiCostUsd: 4,
  emailSent: 19,
  emailFailed: 1,
})
assert.equal(scorecard.visitorToSignupRate, 0.2)
assert.equal(scorecard.attributionCoverageRate, 0.75)
assert.equal(scorecard.activation72hRate, 0.4)
assert.equal(scorecard.d7ReturnRate, 0.2)
assert.equal(scorecard.costPerCompletionUsd, 0.5)
assert.equal(scorecard.publishPaywallConversionRate, 0.25)
assert.equal(scorecard.referralShareRate, Number((2 / 7).toFixed(4)))
assert.equal(scorecard.emailFailureRate, 0.05)
assert.equal(isOrganicFirstTouch(null), true)
assert.equal(isOrganicFirstTouch('organic'), true)
assert.equal(isOrganicFirstTouch('cpc'), false)
assert.deepEqual(completedUtcWeek(now), {
  start: new Date('2026-06-29T00:00:00.000Z'),
  end: new Date('2026-07-06T00:00:00.000Z'),
  key: '2026-06-29',
})
assert.equal(isFreshWebhookTimestamp(String(now.getTime() / 1000), now.getTime()), true)
assert.equal(isFreshWebhookTimestamp(String(now.getTime() / 1000 - 301), now.getTime()), false)
assert.equal(normalizeEmailAddress('Showcase User <USER@Example.com>'), 'user@example.com')
assert.equal(normalizeEmailAddress('A_B@Example.com'), 'a_b@example.com')
assert.equal(normalizeEmailAddress('not-an-email'), null)

// Resend delegates to Standard Webhooks: the secret is whsec_<base64>, and the
// signed bytes are the untouched `${id}.${timestamp}.${rawBody}` string.
const webhookKey = Buffer.from('showcase-standard-webhooks-test-key')
const webhookSecret = `whsec_${webhookKey.toString('base64')}`
const webhookPayload = JSON.stringify({ type: 'auth.matrix.ignored', data: {} })
const webhookHeaders = {
  id: 'msg_growth_automation_fixture',
  timestamp: String(Math.floor(Date.now() / 1000)),
  signature: '',
}
webhookHeaders.signature = `v1,${createHmac('sha256', webhookKey)
  .update(`${webhookHeaders.id}.${webhookHeaders.timestamp}.${webhookPayload}`)
  .digest('base64')}`
const webhookVerifier = new Resend('local-verification-only')
assert.deepEqual(
  webhookVerifier.webhooks.verify({
    payload: webhookPayload,
    headers: webhookHeaders,
    webhookSecret,
  }),
  JSON.parse(webhookPayload),
  'Resend SDK must accept a correctly signed Standard Webhooks fixture',
)
assert.throws(
  () => webhookVerifier.webhooks.verify({
    payload: `${webhookPayload} `,
    headers: webhookHeaders,
    webhookSecret,
  }),
  'verification must bind the signature to the exact raw request body',
)


const migration = readFileSync(resolve('supabase/migrations/20260710033039_growth_automation.sql'), 'utf8')
for (const required of [
  'create table if not exists public.growth_attributions',
  'create table if not exists public.trusted_events',
  'create table if not exists public.ai_cost_events',
  'create table if not exists public.email_deliveries',
  'create table if not exists public.email_suppressions',
  'create table if not exists public.email_provider_events',
  'create or replace function public.claim_growth_attribution',
  'create or replace function public.claim_email_deliveries',
  'create or replace function public.claim_email_provider_event',
  'for update skip locked',
  'drop policy if exists "Users can insert own usage events"',
  'revoke all on table public.usage_events from anon, authenticated',
]) assert.ok(migration.toLowerCase().includes(required.toLowerCase()), `migration is missing: ${required}`)

const outbox = readFileSync(resolve('src/lib/email/outbox.ts'), 'utf8')
assert.match(outbox, /idempotencyKey: delivery\.idempotency_key/)
assert.match(outbox, /result\.error/)
const deliveryWebhook = readFileSync(resolve('src/app/api/email/events/route.ts'), 'utf8')
assert.match(deliveryWebhook, /resend\.webhooks\.verify/)
assert.match(deliveryWebhook, /payload:\s*raw/)
assert.match(deliveryWebhook, /headers:\s*\{\s*id:\s*headers\.id,\s*timestamp:\s*headers\.timestamp,\s*signature:\s*headers\.signature\s*\}/)
assert.match(deliveryWebhook, /isFreshWebhookTimestamp/)
assert.match(deliveryWebhook, /claim_email_provider_event/)
assert.doesNotMatch(deliveryWebhook, /\.ilike\(/, 'provider suppression must use exact normalized equality')
assert.match(deliveryWebhook, /apply_email_recipient_suppression/)

const scorecardRoute = readFileSync(resolve('src/app/api/cron/growth-scorecard/route.ts'), 'utf8')
assert.match(scorecardRoute, /from\('general_ai_budget_reservations'\)/)
assert.doesNotMatch(scorecardRoute, /from\('ai_cost_events'\)/,
  'operating spend must come from the authoritative reservation ledger')
assert.match(scorecardRoute, /estimated_cost_nano_usd/)
assert.match(scorecardRoute, /actual_cost_nano_usd/)

const hardeningMigration = readFileSync(resolve('supabase/migrations/20260710033043_email_and_parse_hardening.sql'), 'utf8')
for (const required of [
  'create or replace function public.claim_pending_parse',
  'delete from public.pending_parses p',
  'insert into public.resumes',
  'revoke all on function public.claim_pending_parse',
  'grant execute on function public.claim_pending_parse',
  'create or replace function public.guard_email_provider_status_monotonic',
  'email_deliveries_monotonic_provider_status',
  'create or replace function public.apply_email_recipient_suppression',
  'lower(trim(p.email)) = v_email',
  'lower(trim(d.recipient_email)) = v_email',
]) assert.ok(hardeningMigration.toLowerCase().includes(required.toLowerCase()), `hardening migration is missing: ${required}`)

const claimRoute = readFileSync(resolve('src/app/api/proofscore/claim-parse/route.ts'), 'utf8')
assert.match(claimRoute, /rpc\('claim_pending_parse'/)
assert.match(claimRoute, /LEGACY_CLAIM_GRACE_END_MS/)
assert.doesNotMatch(claimRoute, /from\('resumes'\)[\s\S]{0,80}\.insert\(/, 'route must not split resume insert from token consumption')

const proxy = readFileSync(resolve('src/proxy.ts'), 'utf8')
assert.ok((proxy.match(/['"]\/api\/email\/events['"]/g) ?? []).length >= 2, 'delivery webhook needs both origin and lockdown exemptions')

const suppressionHelper = readFileSync(resolve('src/lib/email/suppressions.ts'), 'utf8')
assert.match(suppressionHelper, /\.in\('normalized_email', chunk\)/)
for (const [path, helper] of [
  ['src/lib/growth/invite-batch.ts', 'findSuppressedEmails'],
  ['src/app/api/waitlist/join/route.ts', 'isEmailSuppressed'],
]) {
  assert.ok(readFileSync(resolve(path), 'utf8').includes(helper), `${path} must check the suppression registry`)
}
const waitlistJoin = readFileSync(resolve('src/app/api/waitlist/join/route.ts'), 'utf8')
assert.match(waitlistJoin, /failOpen:\s*false/, 'public confirmation email limiter must fail closed')
assert.match(waitlistJoin, /clientFingerprint\(req\)/, 'waitlist limiter must not persist raw IP addresses')
assert.match(waitlistJoin, /EMAILS_ENABLED === 'true'/, 'global email kill switch must stop waitlist sends')
for (const path of ['src/lib/rate-limit/postgres.ts', 'src/lib/rate-limit/distributed.ts']) {
  const limiter = readFileSync(resolve(path), 'utf8')
  assert.match(limiter, /options\?\.failOpen === false/, `${path} must honor the strict caller mode`)
  assert.match(limiter, /allowed:\s*true/, `${path} must preserve the existing default fail-open behavior`)
}

const unsubscribeRoute = readFileSync(resolve('src/app/api/email/unsubscribe/route.ts'), 'utf8')
const unsubscribeGet = unsubscribeRoute.slice(
  unsubscribeRoute.indexOf('export async function GET'),
  unsubscribeRoute.indexOf('export async function POST'),
)
assert.doesNotMatch(unsubscribeGet, /\.update\(/, 'GET must never mutate email preferences')
assert.match(unsubscribeGet, /signRequest\(/, 'GET confirmation form must be signed')
assert.match(unsubscribeRoute, /hasValidSignature\(/, 'POST must verify the confirmation signature')
assert.match(unsubscribeRoute, /application\/x-www-form-urlencoded/)
assert.match(unsubscribeRoute, /export async function POST/)

for (const cronPath of [
  'src/app/api/cron/lifecycle-email/route.ts',
  'src/app/api/cron/weekly-digest/route.ts',
]) {
  const cron = readFileSync(resolve(cronPath), 'utf8')
  assert.match(cron, /EMAIL_POSTAL_ADDRESS/, `${cronPath} must fail closed without a postal address`)
  assert.match(cron, /Boolean\(postalAddress\)/, `${cronPath} must include the address in its send gate`)
}

const growthControl = readFileSync(resolve('scripts/growth-control.mjs'), 'utf8')
assert.match(growthControl, /from\('general_ai_budget_reservations'\)/,
  'operator cost total must query the authoritative reservation ledger')
assert.match(growthControl, /estimated_cost_nano_usd, actual_cost_nano_usd/)
assert.match(growthControl, /gte\('reserved_at', since\)/,
  'operator cost total must use the reservation accounting time')
assert.match(growthControl, /\.range\(/, 'operator cost total must page beyond the API default row cap')
assert.doesNotMatch(growthControl, /from\('ai_cost_events'\)/,
  'secondary telemetry must not drive operator spend totals')

const inviteBatch = readFileSync(resolve('src/lib/growth/invite-batch.ts'), 'utf8')
assert.match(inviteBatch, /EMAILS_ENABLED !== 'true'/, 'global email kill switch must stop invite batches before claims')
assert.match(inviteBatch, /EMAIL_POSTAL_ADDRESS/, 'invite batches must require a sender postal address')

const inviteBatchRoute = readFileSync(resolve('src/app/api/cron/invite-batch/route.ts'), 'utf8')
assert.match(inviteBatchRoute, /code:\s*'EMAILS_DISABLED'/)
assert.match(inviteBatchRoute, /code:\s*'EMAILS_NOT_CONFIGURED'/)
assert.ok(
  inviteBatchRoute.indexOf("process.env.EMAILS_ENABLED !== 'true'") < inviteBatchRoute.indexOf('runInviteBatch({ limit })'),
  'invite cron must report its disabled gate before claim or provider work',
)

console.log('growth automation tests passed')
