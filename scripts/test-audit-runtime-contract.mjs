#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('src/app/api/ai/audit-portfolio/route.ts', 'utf8')
const engine = readFileSync('src/lib/proofscore/engine.ts', 'utf8')
const rateLimit = readFileSync('src/lib/ai/rate-limit.ts', 'utf8')
const featureUsageLeases = readFileSync('src/lib/ai/feature-usage-leases.ts', 'utf8')
const leaseMigration = readFileSync('supabase/migrations/20260718010000_ai_feature_usage_leases.sql', 'utf8')
const auditPage = readFileSync('src/app/(app)/audit/page.tsx', 'utf8')
const demoAuditPage = readFileSync('src/app/demo/(app)/audit/page.tsx', 'utf8')
const explanationPrompt = readFileSync('src/lib/ai/prompts/proofscore-explanation.ts', 'utf8')

assert.match(
  leaseMigration,
  /v_success_limit := case when v_tier = 'pro' then 10 else 1 end/,
  'Free must receive one Evidence Audit per 24 hours',
)
assert.match(
  leaseMigration,
  /v_success_limit := case when v_tier = 'pro' then 10 else 1 end/,
  'Pro must receive ten Evidence Audits per 24 hours',
)
assert.match(
  route,
  /runPromptWithFeatureUsageLease\([\s\S]*?eventName:\s*'audit_completed',[\s\S]*?isProForAttemptThrottle:\s*isPro/,
  'The audit route must use the server-owned feature lease path',
)
assert.match(
  rateLimit,
  /p_allow_bonus:\s*!isPro/,
  'Referral credits must not overflow the exact one-per-24h Free audit boundary',
)
assert.doesNotMatch(rateLimit, /audit_completed:\s*\{/, 'Audit must leave the legacy feature counter')
assert.doesNotMatch(leaseMigration, /bonus_credits|p_allow_bonus/, 'Audit leases must not use referral credits')
assert.match(
  featureUsageLeases,
  /upgradeAvailable:\s*denial\.tierAtReservation === 'free' && denial\.denialReason === 'success_limit'/,
  'Only an authoritative Free success-limit denial may offer the frequency upgrade',
)

assert.match(
  route,
  /computeProofScore\(parsedResume, portfolioContent, targetRole, industry\)/,
  'Deterministic scoring must not receive plan state',
)
assert.doesNotMatch(
  engine,
  /freeTier|Available on Pro|upgrade to see this category/i,
  'The deterministic engine must not contain dimension-level plan gates',
)
assert.match(
  engine,
  /PROOF_SCORE_DIMENSION_COUNT\s*=\s*11/,
  'The engine must enforce the 11-dimension contract',
)

assert.match(
  leaseMigration,
  /insert into public\.audits[\s\S]*audit_type[\s\S]*'full'/,
  'Every newly persisted audit must be full',
)
assert.doesNotMatch(
  `${route}\n${leaseMigration}`,
  /audit_type:[^\n]*preview|isPro\s*\?\s*'full'/,
  'Audit persistence must not vary by plan',
)
assert.doesNotMatch(
  route,
  /from\('audits'\)\.(?:update|delete)|from\('audits'\)[\s\S]{0,80}\.(?:update|delete)\(/,
  'The runtime change must not rewrite or backfill historical preview audits',
)

assert.match(
  route,
  /\.eq\('id', portfolioId\)[\s\S]*?\.eq\('user_id', user\.id\)/,
  'A requested portfolio must be explicitly owned by the authenticated user',
)
assert.match(
  auditPage,
  /portfolioId:\s*selectedPortfolioId\s*\|\|\s*undefined/,
  'The authenticated user must explicitly choose optional portfolio context',
)
assert.match(
  auditPage,
  /from\('portfolios'\)[\s\S]*?\.eq\('user_id', data\.user\.id\)[\s\S]*?\.not\('content', 'is', null\)/,
  'The portfolio selector must explicitly exclude other users’ publicly readable portfolios',
)
assert.match(
  auditPage,
  /Private drafts work; publishing is not required/,
  'The portfolio selector must explain that an owned private draft is valid context',
)
assert.doesNotMatch(
  route,
  /ownedPortfolioBase|most recently updated owned draft/,
  'The server must not silently combine a resume with an unrelated latest portfolio',
)
assert.doesNotMatch(
  route,
  /\.eq\('status', 'published'\)/,
  'Portfolio context must never require publication',
)
assert.match(
  route,
  /portfolioId:\s*resolvedPortfolioId/,
  'The resolved private portfolio must be associated with the saved full audit',
)

assert.match(
  explanationPrompt,
  /version:\s*'2\.2\.0'/,
  'The complete-audit explanation contract must use its new prompt version',
)
assert.doesNotMatch(
  explanationPrompt,
  /ranked by impact on .* hiring/i,
  'Audit priorities must not imply a hiring-outcome effect',
)
assert.match(
  explanationPrompt,
  /ranked by impact on how clearly the supplied evidence supports/,
  'Audit priorities must stay scoped to evidence-presentation quality',
)

assert.match(
  route,
  /mergeAuditExplanation\(deterministic, explanation\)/,
  'The route must use the fixed-dimension merge with fallback fixes',
)
assert.doesNotMatch(
  auditPage,
  /if\s*\(cat\.gated\)/,
  'The authenticated Audit UI must not render plan-gated category cards',
)
assert.match(
  auditPage,
  /data\.code === 'RATE_LIMITED' && data\.upgradeAvailable === true[\s\S]*?setAuditLimitReached\(true\)/,
  'The Audit UI must expose the upgrade handoff only from the authoritative server flag',
)
assert.match(
  auditPage,
  /Free includes one complete 11-dimension Evidence Audit every 24 hours\.[\s\S]*?Pro raises that frequency to 10 complete Audits every 24 hours\./,
  'The upgrade handoff must describe a frequency-only Free/Pro boundary',
)
assert.match(
  auditPage,
  /href="\/billing\?plan=monthly&source=audit"/,
  'The frequency upgrade must preserve the contextual Billing handoff',
)
assert.match(
  auditPage,
  /\{cat\.fix\}/,
  'The authenticated Audit UI must render the concrete fix for a dimension with missing context',
)
assert.match(
  auditPage,
  /from\('audits'\)[\s\S]*?\.eq\('audit_type', 'full'\)[\s\S]*?categories\.length === 11[\s\S]*?setResult\(/,
  'The latest owned complete Audit must survive refresh or response loss',
)
assert.doesNotMatch(
  auditPage,
  /Strong match|hiring risk gaps|hiring-readiness/i,
  'Audit UI must describe evidence clarity rather than predict hiring or fit',
)

assert.match(
  demoAuditPage,
  /const SAMPLE_RESUME:\s*ParsedResumeOutput/,
  'The public Audit demo must expose a typed sample resume as its scoring source',
)
assert.match(
  demoAuditPage,
  /const sampleAudit = computeProofScore\(SAMPLE_RESUME, null, SAMPLE_TARGET_ROLE, 'Technology'\)/,
  'The public Audit demo must compute its score from the visible sample through the canonical engine',
)
assert.match(
  demoAuditPage,
  /sampleAudit\.categories\.map/,
  'The public Audit demo must render the canonical dimension names instead of a drifting local category list',
)
assert.match(
  demoAuditPage,
  /Illustrative sample[\s\S]*?clearly labeled sample resume[\s\S]*?does not predict hiring decisions or interview outcomes/,
  'The public Audit demo must clearly label its source and limitation before showing a score',
)
assert.match(
  demoAuditPage,
  /metrics:\s*\[\][\s\S]*?has_metrics:\s*false[\s\S]*?has_outcome:\s*false/,
  'The public Audit demo sample must not claim an outcome or metric absent from its source',
)
assert.match(
  demoAuditPage,
  /FALLBACK_FIXES\[category\.key\]/,
  'The public Audit demo must use the same source-safe fixes as the canonical engine',
)
assert.doesNotMatch(
  demoAuditPage,
  /Ready to apply|competitive for|Elite|costing you interviews|Role Fit|Confidence|Hiring Risk/i,
  'The public Audit demo must not contain a hiring verdict, candidate ranking, or outcome implication',
)
assert.doesNotMatch(
  demoAuditPage,
  /Stripe|Strong company names|24%|\$180k|rough estimates|even rough|abandoned orders/i,
  'The public Audit demo must not retain fictional company proof or fabricated outcome/metric evidence',
)

console.log('✓ Evidence Audit runtime contract: complete 11-dimension Free and Pro audits, frequency-only plan boundary, private portfolio context, full persistence')
