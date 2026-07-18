#!/usr/bin/env node --experimental-strip-types

import { existsSync, readFileSync } from 'node:fs'
import { hasRealContent, isEditedSinceGeneration } from '../src/lib/portfolio/guard.ts'

let pass = 0
let fail = 0

function check(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    pass += 1
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
    fail += 1
  }
}

// Portfolio overwrite protection remains independent of entitlement accounting.
const t0 = new Date('2026-01-01T00:00:00Z').toISOString()
const t0plus500ms = new Date('2026-01-01T00:00:00.5Z').toISOString()
const t0plus5s = new Date('2026-01-01T00:00:05Z').toISOString()
check(!hasRealContent({}), 'Empty object has no real content')
check(!hasRealContent({ hero: {} }), 'Nested empty object has no real content')
check(hasRealContent({ hero: { headline: 'Senior Engineer' } }), 'Populated nested field has real content')
check(!isEditedSinceGeneration({}, t0, null), 'First generation of an empty draft needs no confirmation')
check(isEditedSinceGeneration({ hero: { headline: 'X' } }, t0, null), 'Hand-written draft requires confirmation')
check(!isEditedSinceGeneration({ hero: { headline: 'X' } }, t0plus500ms, t0), 'Sub-second write skew is tolerated')
check(isEditedSinceGeneration({ hero: { headline: 'Y' } }, t0plus5s, t0), 'Later edit requires confirmation')

const migration = readFileSync('supabase/migrations/20260718010000_ai_feature_usage_leases.sql', 'utf8')
const client = readFileSync('src/lib/ai/client.ts', 'utf8')
const rateLimit = readFileSync('src/lib/ai/rate-limit.ts', 'utf8')
const helper = readFileSync('src/lib/ai/feature-usage-leases.ts', 'utf8')
const portfolioRoute = readFileSync('src/app/api/ai/generate-portfolio/route.ts', 'utf8')
const auditRoute = readFileSync('src/app/api/ai/audit-portfolio/route.ts', 'utf8')

check(
  !existsSync('src/lib/ai/free-portfolio-quota.ts')
    && !client.includes('onQuotaConsumed')
    && !client.includes('retryAfterSeconds?: number'),
  'Blanket shared-counter reset and obsolete quota callback plumbing are gone',
)
check(
  !/portfolio_generated:\s*\{/.test(rateLimit)
    && !/audit_completed:\s*\{/.test(rateLimit)
    && !rateLimit.includes("eventName !== 'portfolio_generated'")
    && !rateLimit.includes("eventName !== 'audit_completed'"),
  'Portfolio and Audit leave the legacy feature-counter/referral-credit path entirely',
)

check(
  /create table if not exists public\.ai_feature_usage_leases/.test(migration)
    && /status in \('reserved', 'committed', 'released', 'expired'\)/.test(migration)
    && /tier_at_reservation text not null/.test(migration)
    && /resume_state_hash_at_reservation text/.test(migration),
  'Generic durable lease table stores UUID ownership, source digests, state, and reservation tier',
)
check(
  /enable row level security/.test(migration)
    && /revoke all on table public\.ai_feature_usage_leases from public, anon, authenticated/.test(migration)
    && /grant all on table public\.ai_feature_usage_leases to service_role/.test(migration),
  'Lease rows are service-only under RLS',
)
check(
  /create unique index[^;]+where status = 'reserved'/s.test(migration),
  'Only one active lease can exist per exact user and feature',
)

const lockKeys = migration.match(/hashtextextended\('ai-feature-usage:' \|\|/g) ?? []
check(
  lockKeys.length === 4 && !migration.includes('free-ai-feature:'),
  'Reserve, release, and both commits use one identical per-user/feature advisory lock namespace',
  `locks=${lockKeys.length}`,
)
check(
  /v_now \+ interval '5 minutes'/.test(migration)
    && /expires_at <= v_now/.test(migration)
    && /failure_reason = coalesce\(failure_reason, 'lease_ttl_expired'\)/.test(migration),
  'Five-minute leases exceed route timeout and stale reservations self-expire',
)
check(
  /status in \('active', 'trialing'\)/.test(migration)
    && /current_period_end is null or s\.current_period_end > v_now/.test(migration)
    && /user_id, event_name, tier_at_reservation/.test(migration),
  'Reservation RPC derives live tier server-side and persists it',
)
check(
  /v_attempt_limit := case when v_tier = 'pro' then 30 else 3 end/.test(migration)
    && /v_success_limit := case when v_tier = 'pro' then 10 else 1 end/.test(migration)
    && /v_success_limit := 10/.test(migration),
  'Free/Pro attempt and success caps are encoded in the transaction authority',
)
check(
  !migration.includes('bonus_credits') && !migration.includes('p_allow_bonus'),
  'Feature leases never consume referral credits',
)

const reserveBody = migration.slice(
  migration.indexOf('create or replace function public.reserve_ai_feature_usage_lease'),
  migration.indexOf('create or replace function public.release_ai_feature_usage_lease'),
)
const releaseBody = migration.slice(
  migration.indexOf('create or replace function public.release_ai_feature_usage_lease'),
  migration.indexOf('create or replace function public.commit_portfolio_generation_lease'),
)
check(
  (reserveBody.match(/rate_limit_increment\('ai:global:daily'/g) ?? []).length === 1
    && !releaseBody.includes("'ai:global:daily'")
    && !migration.slice(migration.indexOf('create or replace function public.commit_portfolio_generation_lease')).includes("'ai:global:daily'"),
  'Exactly one global capacity unit is consumed per allowed lease and never refunded',
)
check(
  /release_ai_feature_usage_lease[\s\S]+where l\.id = p_lease_id[\s\S]+and l\.user_id = p_user_id[\s\S]+and l\.event_name = p_event_name/.test(migration),
  'Failure release is bound to the exact token, user, and feature',
)
check(
  (reserveBody.match(/for update;/g) ?? []).length >= 2
    && reserveBody.indexOf('v_current_portfolio_content is distinct from p_expected_portfolio_content')
      < reserveBody.indexOf("rate_limit_increment('ai:global:daily'"),
  'Expected source states are row-locked and rejected before attempt/global capacity is consumed',
)

check(
  /failure_reason = 'target_deleted_before_commit'/.test(migration)
    && /status = 'committed', finalized_at = v_now/.test(migration)
    && /l\.failure_reason in \('target_deleted_before_commit', 'target_modified_before_commit'\)[\s\S]+l\.finalized_at > v_now - interval '24 hours'/.test(migration),
  'Deleted or concurrently edited portfolio targets consume Free lifetime and Pro rolling success authority',
)
check(
  migration.includes('portfolio_state_hash_at_reservation')
    && migration.includes("failure_reason = 'target_modified_before_commit'")
    && reserveBody.includes('p_expected_portfolio_content')
    && reserveBody.includes('p_expected_portfolio_target_role')
    && reserveBody.includes('v_current_portfolio_content is distinct from p_expected_portfolio_content')
    && portfolioRoute.includes('expectedPortfolioContent: portfolio.content')
    && portfolioRoute.includes('expectedPortfolioTargetRole: portfolio.target_role')
    && portfolioRoute.includes("code: targetDeleted")
    && portfolioRoute.includes("'PORTFOLIO_TARGET_MODIFIED'"),
  'Generation binds confirmation to the exact portfolio state and preserves later edits',
)
check(
  /p\.ai_generated_at > v_lease\.reserved_at/.test(migration)
    && /g\.created_at > v_lease\.reserved_at/.test(migration)
    && !/historical_success_during_attempt[\s\S]{0,900}ai_generated_at is not null/.test(migration),
  'Pro regeneration ignores older success history while protecting against a newer concurrent write',
)
check(
  /l\.event_name = 'audit_completed'[\s\S]+l\.status = 'committed'[\s\S]+l\.finalized_at > v_now - interval '24 hours'/.test(migration)
    && /select l\.finalized_at from public\.ai_feature_usage_leases/.test(migration),
  'Committed-success rolling windows start at finalization, not reservation',
)
check(
  /insert into public\.portfolios/.test(migration) === false
    && /update public\.portfolios[\s\S]+insert into public\.generations[\s\S]+update public\.ai_feature_usage_leases/.test(migration),
  'Portfolio content, generation marker, and lease commit share one atomic RPC',
)
check(
  migration.includes('resume_state_hash_at_reservation')
    && reserveBody.includes('p_expected_resume_raw_text')
    && reserveBody.includes('p_expected_resume_parsed_json')
    && /failure_reason = 'source_changed_before_commit'/.test(migration)
    && /l\.failure_reason = 'source_changed_before_commit'[\s\S]+l\.finalized_at > v_now - interval '24 hours'/.test(migration)
    && /insert into public\.audits[\s\S]+insert into public\.generations[\s\S]+update public\.ai_feature_usage_leases/.test(migration)
    && auditRoute.includes('expectedPortfolioContent: portfolioContent')
    && auditRoute.includes('expectedResumeRawText: resumeText')
    && auditRoute.includes('expectedResumeParsedJson: parsedResume')
    && auditRoute.includes("code: 'AUDIT_SOURCE_CHANGED'"),
  'Audit binds both source states and atomically skips stale persistence after provider success',
)
check(
  /jsonb_array_length\(p_category_scores\) <> 11/.test(migration),
  'Complete audit commits enforce all 11 dimensions',
)
check(
  (migration.match(/a\.audit_type = 'full'/g) ?? []).length === 2,
  'Legacy preview audits do not consume the complete-Audit success allowance',
)

for (const [label, source, event, commit] of [
  ['Portfolio', portfolioRoute, 'portfolio_generated', 'commitPortfolioGenerationLease'],
  ['Audit', auditRoute, 'audit_completed', 'commitAuditLease'],
]) {
  check(
    source.includes('runPromptWithFeatureUsageLease(')
      && source.includes(`eventName: '${event}'`)
      && source.includes(commit)
      && source.includes('releaseAiFeatureUsageLease('),
    `${label} route reserves, commits, and exact-releases the server-owned lease`,
  )
  check(
    !source.includes('runPromptWithQuota(')
      && !source.includes(".from('rate_limit_counters')"),
    `${label} route cannot fall back to the legacy counter path`,
  )
}
check(
  !portfolioRoute.includes("service.from('generations').insert")
    && !auditRoute.includes("service.from('generations').insert")
    && !auditRoute.includes("service.from('audits').insert"),
  'Routes cannot split atomic result persistence across client-side writes',
)
const leaseRunner = client.slice(client.indexOf('export async function runPromptWithFeatureUsageLease'))
check(
  leaseRunner.indexOf('preparePromptCall(spec, input)')
    < leaseRunner.indexOf('reserveAiFeatureUsageLease(usage.service')
    && leaseRunner.indexOf('reserveAiFeatureUsageLease(usage.service')
      < leaseRunner.indexOf('...await prepared.run()'),
  'Dollar budget and feature lease are reserved before provider contact',
)
check(
  helper.includes("code: 'PRO_REQUIRED'")
    && helper.includes("? 'GENERATION_IN_PROGRESS'")
    && helper.includes(": 'AUDIT_IN_PROGRESS'")
    && helper.includes(": 'AUDIT_SOURCE_CHANGED'"),
  'Lease denials preserve actionable first-generation, in-flight, and source-change responses',
)

console.log(`\n  Generation/AI feature lease guard: ${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
