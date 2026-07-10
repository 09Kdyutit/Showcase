#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PRODUCTION_SUPABASE_REF = 'yogwhfrjhcbnvoxitcay'
const failures = []
const fail = (message) => failures.push(message)
const env = process.env

const stagingRef = env.STAGING_SUPABASE_PROJECT_REF?.trim() ?? ''
if (!/^[a-z0-9]{20}$/.test(stagingRef)) fail('STAGING_SUPABASE_PROJECT_REF is missing or malformed')
if (stagingRef === PRODUCTION_SUPABASE_REF) fail('the declared staging project is production')

if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${stagingRef}.supabase.co`) {
  fail('NEXT_PUBLIC_SUPABASE_URL does not exactly match the declared staging project')
}
if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) fail('staging Supabase publishable key is missing')
if (!env.SUPABASE_SERVICE_ROLE_KEY) fail('staging Supabase service-role key is missing')

const linkedRefPath = resolve('supabase/.temp/project-ref')
if (!existsSync(linkedRefPath)) {
  fail('this worktree is not linked to Supabase; link the isolated staging worktree first')
} else {
  const linkedRef = readFileSync(linkedRefPath, 'utf8').trim()
  if (linkedRef === PRODUCTION_SUPABASE_REF) fail('this worktree is linked to production')
  if (linkedRef !== stagingRef) fail('the linked Supabase ref does not match STAGING_SUPABASE_PROJECT_REF')
}

if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) fail('STRIPE_SECRET_KEY must be test mode')
if (!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')) {
  fail('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be test mode')
}
if (!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) fail('STRIPE_WEBHOOK_SECRET is malformed')
for (const name of [
  'STRIPE_PRICE_ID_PRO_MONTHLY',
  'STRIPE_PRICE_ID_PRO_ANNUAL',
  'STRIPE_PRICE_ID_FOUNDING_ANNUAL',
]) {
  if (!env[name]?.startsWith('price_')) fail(`${name} is missing or malformed`)
}

for (const name of ['EMAILS_ENABLED', 'LIFECYCLE_EMAILS_ENABLED', 'LAUNCH_OPEN']) {
  if (env[name] !== 'false') fail(`${name} must be the literal string false in initial staging`)
}
for (const name of [
  'KILL_SWITCH_AI',
  'KILL_SWITCH_GEMINI',
  'KILL_SWITCH_CHECKOUT',
  'KILL_SWITCH_JOBS_PROVIDER',
  'KILL_SWITCH_PUBLISHING',
  'INTERVIEW_KILL_SWITCH',
]) {
  if (env[name] !== 'true') fail(`${name} must be the literal string true in initial staging`)
}

if (failures.length > 0) {
  console.error('Staging preflight refused to continue:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Staging preflight passed: isolated Supabase, Stripe test mode, and all launch/spend switches paused.')
