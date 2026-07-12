#!/usr/bin/env node

// Credentialed integration test for
// 20260710033046_referral_abuse_and_credit_hardening.sql's general OpenAI budget ledger.
// This script is intentionally LOCAL-ONLY: it refuses every non-loopback URL before
// constructing a Supabase client or mutating anything.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.SUPABASE_ANON_KEY
const EXPECTED_PORT = process.env.LOCAL_SUPABASE_PORT ?? '54321'

if (process.env.RUN_LIVE_TESTS !== '1') {
  throw new Error('Refusing credentialed test without RUN_LIVE_TESTS=1')
}
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and '
    + 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) are required.'
  )
}

const parsedUrl = new URL(SUPABASE_URL)
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
if (!loopbackHosts.has(parsedUrl.hostname) || parsedUrl.port !== EXPECTED_PORT) {
  throw new Error(
    `LOCAL-ONLY guard refused Supabase target ${parsedUrl.origin}; `
    + `expected loopback port ${EXPECTED_PORT}.`
  )
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const service = createClient(SUPABASE_URL, SERVICE_KEY, clientOptions)
const anonymous = createClient(SUPABASE_URL, ANON_KEY, clientOptions)
const runTag = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`
const feature = `live-budget-${runTag}`.slice(0, 100)
const reservationIds = new Set()
let authUserId = null
let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed += 1
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
    failed += 1
  }
}

function row(data) {
  return Array.isArray(data) ? data[0] : data
}

function budgetArgs(id, overrides = {}) {
  reservationIds.add(id)
  return {
    p_reservation_id: id,
    p_feature: feature,
    p_model: 'local-test-model',
    p_pricing_version: 'local-live-v1',
    p_estimated_input_tokens: 0,
    p_max_output_tokens: 1,
    p_input_rate_per_million: 0,
    p_cached_input_rate_per_million: 0,
    p_output_rate_per_million: 1,
    p_daily_budget_nano_usd: 4_000_000_000,
    p_monthly_budget_nano_usd: 80_000_000_000,
    p_stale_after_seconds: 300,
    ...overrides,
  }
}

async function serviceRpc(name, args) {
  const { data, error } = await service.rpc(name, args)
  if (error) throw new Error(`${name} failed: ${error.message}`)
  return data
}

function committedTotals(rows, now = new Date()) {
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  let daily = 0
  let monthly = 0
  for (const entry of rows ?? []) {
    if (!['reserved', 'settled'].includes(entry.status)) continue
    const cost = Number(entry.status === 'reserved'
      ? entry.estimated_cost_nano_usd
      : entry.actual_cost_nano_usd)
    const reservedAt = Date.parse(entry.reserved_at)
    if (reservedAt >= monthStart) monthly += cost
    if (reservedAt >= dayStart) daily += cost
  }
  return { daily, monthly }
}

async function testParallelNearCap() {
  console.log('\n── Parallel near-cap reservation ──')
  const { data: existing, error } = await service
    .from('general_ai_budget_reservations')
    .select('status, estimated_cost_nano_usd, actual_cost_nano_usd, reserved_at')
  if (error) throw error
  const baseline = committedTotals(existing)
  const dailyCap = baseline.daily + 5_000
  const monthlyCap = baseline.monthly + 5_000
  assert.ok(dailyCap <= 4_000_000_000 && monthlyCap <= 80_000_000_000,
    'local ledger is too close to the hard cap for the near-cap test')

  const ids = Array.from({ length: 10 }, () => crypto.randomUUID())
  const results = await Promise.all(ids.map(async (id) => {
    const { data, error: reserveError } = await service.rpc('reserve_general_ai_budget', budgetArgs(id, {
      p_daily_budget_nano_usd: dailyCap,
      p_monthly_budget_nano_usd: monthlyCap,
    }))
    return { id, result: row(data), error: reserveError }
  }))

  const allowed = results.filter((result) => !result.error && result.result?.allowed === true)
  const denied = results.filter((result) => !result.error && result.result?.allowed === false)
  check('exactly five of ten parallel 1,000 nano-USD reservations are admitted',
    allowed.length === 5, `allowed=${allowed.length}`)
  check('the other five are clean budget denials, never RPC errors',
    denied.length === 5 && denied.every((result) => ['daily', 'monthly'].includes(result.result.denial_reason)),
    `denied=${denied.length}, rpcErrors=${results.filter((result) => result.error).length}`)

  const { data: stored, error: storedError } = await service
    .from('general_ai_budget_reservations')
    .select('id, status, estimated_cost_nano_usd')
    .in('id', ids)
  if (storedError) throw storedError
  check('only admitted IDs were persisted',
    stored?.length === 5
      && stored.every((entry) => entry.status === 'reserved')
      && stored.every((entry) => Number(entry.estimated_cost_nano_usd) === 1_000),
    `rows=${stored?.length ?? 0}`)
}

async function testDuplicateAndDenial() {
  console.log('\n── Duplicate and hard denial ──')
  const duplicateId = crypto.randomUUID()
  const args = budgetArgs(duplicateId)
  const first = row(await serviceRpc('reserve_general_ai_budget', args))
  const replay = row(await serviceRpc('reserve_general_ai_budget', args))
  check('first use of a reservation UUID succeeds', first?.allowed === true)
  check('duplicate reservation UUID is denied and cannot represent a second provider call',
    replay?.allowed === false && replay?.denial_reason === 'duplicate')

  const deniedId = crypto.randomUUID()
  const denied = row(await serviceRpc('reserve_general_ai_budget', budgetArgs(deniedId, {
    p_daily_budget_nano_usd: 1,
    p_monthly_budget_nano_usd: 1,
  })))
  const { count, error } = await service
    .from('general_ai_budget_reservations')
    .select('id', { count: 'exact', head: true })
    .eq('id', deniedId)
  if (error) throw error
  check('budget denial persists no reservation row',
    denied?.allowed === false && ['daily', 'monthly'].includes(denied?.denial_reason) && count === 0,
    `reason=${denied?.denial_reason}, rows=${count}`)
}

async function testSettlementAndRelease() {
  console.log('\n── Settlement and release idempotency ──')
  const settledId = crypto.randomUUID()
  const settlementRates = {
    p_estimated_input_tokens: 100,
    p_max_output_tokens: 100,
    p_input_rate_per_million: 1,
    p_cached_input_rate_per_million: 0.5,
    p_output_rate_per_million: 2,
  }
  const reserved = row(await serviceRpc(
    'reserve_general_ai_budget',
    budgetArgs(settledId, settlementRates),
  ))
  check('settlement fixture reserves successfully', reserved?.allowed === true)
  const settled = await serviceRpc('settle_general_ai_budget', {
    p_reservation_id: settledId,
    p_actual_input_tokens: 2,
    p_actual_cached_input_tokens: 1,
    p_actual_output_tokens: 3,
  })
  const settledReplay = await serviceRpc('settle_general_ai_budget', {
    p_reservation_id: settledId,
    p_actual_input_tokens: 9,
    p_actual_cached_input_tokens: 0,
    p_actual_output_tokens: 9,
  })
  const { data: settledRow, error: settledError } = await service
    .from('general_ai_budget_reservations')
    .select('status, resolution, actual_cost_nano_usd')
    .eq('id', settledId)
    .single()
  if (settledError) throw settledError
  check('provider usage settles to the database-computed cached-token cost',
    settled === true
      && settledRow.status === 'settled'
      && settledRow.resolution === 'provider_usage'
      && Number(settledRow.actual_cost_nano_usd) === 7_500,
    `cost=${settledRow.actual_cost_nano_usd}`)
  check('settlement replay is idempotent and cannot rewrite actual cost',
    settledReplay === true && Number(settledRow.actual_cost_nano_usd) === 7_500)
  const releaseSettled = await serviceRpc('release_general_ai_budget', {
    p_reservation_id: settledId,
  })
  check('provider-usage settlement is immutable and cannot be released', releaseSettled === false)

  const releasedId = crypto.randomUUID()
  const releaseFixture = row(await serviceRpc(
    'reserve_general_ai_budget',
    budgetArgs(releasedId),
  ))
  const release = await serviceRpc('release_general_ai_budget', { p_reservation_id: releasedId })
  const releaseReplay = await serviceRpc('release_general_ai_budget', { p_reservation_id: releasedId })
  const { data: releasedRow, error: releasedError } = await service
    .from('general_ai_budget_reservations')
    .select('status, resolution, actual_cost_nano_usd')
    .eq('id', releasedId)
    .single()
  if (releasedError) throw releasedError
  check('unused live reservation releases to zero cost',
    releaseFixture?.allowed === true
      && release === true
      && releasedRow.status === 'released'
      && releasedRow.resolution === 'provider_failure'
      && Number(releasedRow.actual_cost_nano_usd) === 0)
  check('release replay is idempotent', releaseReplay === true)
}

async function testStaleReservation() {
  console.log('\n── Stale reservation behavior ──')
  const staleId = crypto.randomUUID()
  const rates = {
    p_estimated_input_tokens: 100,
    p_max_output_tokens: 100,
    p_input_rate_per_million: 1,
    p_cached_input_rate_per_million: 0.5,
    p_output_rate_per_million: 2,
  }
  const staleFixture = row(await serviceRpc(
    'reserve_general_ai_budget',
    budgetArgs(staleId, rates),
  ))
  check('stale fixture reserves successfully', staleFixture?.allowed === true)
  const agedAt = new Date(Date.now() - 10 * 60 * 1_000).toISOString()
  const { error: ageError } = await service
    .from('general_ai_budget_reservations')
    .update({ reserved_at: agedAt, updated_at: agedAt })
    .eq('id', staleId)
  if (ageError) throw ageError

  const triggerId = crypto.randomUUID()
  const trigger = row(await serviceRpc(
    'reserve_general_ai_budget',
    budgetArgs(triggerId),
  ))
  check('a later reservation triggers stale reconciliation', trigger?.allowed === true)
  let { data: staleRow, error: staleError } = await service
    .from('general_ai_budget_reservations')
    .select('status, resolution, estimated_cost_nano_usd, actual_cost_nano_usd')
    .eq('id', staleId)
    .single()
  if (staleError) throw staleError
  check('stale live reservation settles permanently to its conservative estimate',
    staleRow.status === 'settled'
      && staleRow.resolution === 'stale_estimate'
      && Number(staleRow.actual_cost_nano_usd) === Number(staleRow.estimated_cost_nano_usd))

  const lateSettle = await serviceRpc('settle_general_ai_budget', {
    p_reservation_id: staleId,
    p_actual_input_tokens: 1,
    p_actual_cached_input_tokens: 0,
    p_actual_output_tokens: 0,
  })
  ;({ data: staleRow, error: staleError } = await service
    .from('general_ai_budget_reservations')
    .select('status, resolution, estimated_cost_nano_usd, actual_cost_nano_usd')
    .eq('id', staleId)
    .single())
  if (staleError) throw staleError
  check('late provider settlement cannot shrink an already-finalized stale estimate',
    lateSettle === true
      && staleRow.resolution === 'stale_estimate'
      && Number(staleRow.actual_cost_nano_usd) === Number(staleRow.estimated_cost_nano_usd))
  const staleRelease = await serviceRpc('release_general_ai_budget', { p_reservation_id: staleId })
  check('a definitive provider failure may still correct a stale estimate', staleRelease === true)
}

async function expectRpcDenied(client, roleLabel) {
  const reserveId = crypto.randomUUID()
  const calls = [
    ['reserve', 'reserve_general_ai_budget', budgetArgs(reserveId)],
    ['settle', 'settle_general_ai_budget', {
      p_reservation_id: reserveId,
      p_actual_input_tokens: 1,
      p_actual_cached_input_tokens: 0,
      p_actual_output_tokens: 0,
    }],
    ['release', 'release_general_ai_budget', { p_reservation_id: reserveId }],
  ]
  for (const [label, functionName, args] of calls) {
    const { error } = await client.rpc(functionName, args)
    check(`${roleLabel} cannot execute ${label} budget RPC`, error !== null)
  }
}

async function testPermissions() {
  console.log('\n── RPC permissions ──')
  await expectRpcDenied(anonymous, 'anon')

  const email = `budget-live-${runTag}@example.com`
  const password = `Local-${crypto.randomUUID()}-Aa1!`
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) throw createError ?? new Error('test user was not created')
  authUserId = created.user.id
  const authenticated = createClient(SUPABASE_URL, ANON_KEY, clientOptions)
  const { error: signInError } = await authenticated.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  await expectRpcDenied(authenticated, 'authenticated')
  await authenticated.auth.signOut()
}

function testPreparedCallOrderingSource() {
  console.log('\n── Prepared-call ordering contract ──')
  const client = readFileSync(new URL('../src/lib/ai/client.ts', import.meta.url), 'utf8')
  const helperStart = client.indexOf('export async function runPromptWithQuota')
  const attempt = client.indexOf('await checkAiReservationAttemptLimit', helperStart)
  const reserve = client.indexOf('await preparePromptCall', helperStart)
  const quota = client.indexOf('await checkRateLimit', helperStart)
  const provider = client.indexOf('await prepared.run()', helperStart)
  check('authenticated helper orders abuse throttle → dollars → product quota → provider',
    helperStart >= 0 && attempt < reserve && reserve < quota && quota < provider)
  check('authenticated quota denial releases the unused dollar reservation',
    client.indexOf('await prepared.release()', quota) > quota
      && client.indexOf('await prepared.release()', quota) < provider)

}

async function cleanup() {
  console.log('\n── Cleanup ──')
  if (authUserId) {
    const { error } = await service.auth.admin.deleteUser(authUserId)
    check('temporary authenticated test user removed', !error, error?.message)
  }
  const ids = [...reservationIds]
  if (ids.length > 0) {
    const { error: deleteError } = await service
      .from('general_ai_budget_reservations')
      .delete()
      .in('id', ids)
    check('service-role budget test rows deleted', !deleteError, deleteError?.message)
    const { count, error: countError } = await service
      .from('general_ai_budget_reservations')
      .select('id', { count: 'exact', head: true })
      .in('id', ids)
    check('no budget test rows remain', !countError && count === 0, `rows=${count}`)
  }
}

try {
  console.log(`General AI budget live test: ${parsedUrl.origin} (local only)`)
  testPreparedCallOrderingSource()
  await testParallelNearCap()
  await testDuplicateAndDenial()
  await testSettlementAndRelease()
  await testStaleReservation()
  await testPermissions()
} catch (error) {
  console.error(`\n  ❌ unexpected live-test failure — ${error instanceof Error ? error.message : error}`)
  failed += 1
} finally {
  try {
    await cleanup()
  } catch (error) {
    console.error(`  ❌ cleanup failed — ${error instanceof Error ? error.message : error}`)
    failed += 1
  }
}

console.log(`\nGeneral AI budget live test: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
