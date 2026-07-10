#!/usr/bin/env node

// Local-only concurrency proof for the Free first-portfolio in-flight gate. This calls the
// real migration-046 quota RPC with ten simultaneous requests and cleans up every row it
// owns. It never contacts an AI provider.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EXPECTED_PORT = process.env.LOCAL_SUPABASE_PORT ?? '54321'

if (process.env.RUN_LIVE_TESTS !== '1') {
  throw new Error('Refusing credentialed test without RUN_LIVE_TESTS=1')
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const target = new URL(SUPABASE_URL)
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
if (!loopbackHosts.has(target.hostname) || target.port !== EXPECTED_PORT) {
  throw new Error(
    `LOCAL-ONLY guard refused ${target.origin}; expected loopback port ${EXPECTED_PORT}`
  )
}

const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const globalKey = 'ai:global:daily'
let userId = null
let userQuotaKey = null
let originalGlobal = null
let globalSnapshotCaptured = false
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

async function waitForProfile(id) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await service.from('profiles').select('id').eq('id', id).maybeSingle()
    if (error) throw error
    if (data) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('profile trigger did not create the test profile')
}

async function snapshotGlobalCounter() {
  const { data, error } = await service
    .from('rate_limit_counters')
    .select('key, count, window_start')
    .eq('key', globalKey)
    .maybeSingle()
  if (error) throw error
  return data
}

async function restoreGlobalCounter() {
  if (originalGlobal) {
    const { error } = await service.from('rate_limit_counters').upsert(originalGlobal)
    if (error) throw error
  } else {
    const { error } = await service.from('rate_limit_counters').delete().eq('key', globalKey)
    if (error) throw error
  }
}

async function cleanup() {
  if (userQuotaKey) {
    const { error } = await service.from('rate_limit_counters').delete().eq('key', userQuotaKey)
    if (error) throw error
  }
  if (globalSnapshotCaptured) await restoreGlobalCounter()
  if (userId) {
    const { error } = await service.auth.admin.deleteUser(userId)
    if (error) throw error
  }
}

try {
  console.log(`Free portfolio entitlement concurrency test: ${target.origin} (local only)`)
  originalGlobal = await snapshotGlobalCounter()
  globalSnapshotCaptured = true
  const email = `portfolio-entitlement-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@example.com`
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password: `Local-${crypto.randomUUID()}-Aa1!`,
    email_confirm: true,
  })
  if (createError || !created.user) throw createError ?? new Error('test user creation failed')
  userId = created.user.id
  userQuotaKey = `ai:portfolio_generated:${userId}`
  await waitForProfile(userId)

  const { error: creditError } = await service
    .from('profiles')
    .update({ bonus_credits: 5 })
    .eq('id', userId)
  if (creditError) throw creditError

  const startedAt = Date.now()
  const calls = await Promise.all(Array.from({ length: 10 }, () => service
    .rpc('consume_ai_request_quota', {
      p_user_id: userId,
      p_event_name: 'portfolio_generated',
      p_window_seconds: 86_400,
      p_base_max: 1,
      p_global_max: 1_000_000,
      p_allow_bonus: false,
    })
    .single()))

  const rpcErrors = calls.filter((call) => call.error)
  const allowed = calls.filter((call) => call.data?.allowed === true)
  const denied = calls.filter((call) => call.data?.allowed === false)
  check('ten simultaneous Free claims produce exactly one winner',
    allowed.length === 1, `allowed=${allowed.length}`)
  check('the other nine are clean user-limit denials',
    denied.length === 9 && denied.every((call) => call.data?.denial_reason === 'user_limit'),
    `denied=${denied.length}`)
  check('parallel claims produce no RPC errors', rpcErrors.length === 0, `errors=${rpcErrors.length}`)

  const [{ data: profile, error: profileError }, { data: userCounter, error: userCounterError }, globalAfter] = await Promise.all([
    service.from('profiles').select('bonus_credits').eq('id', userId).single(),
    service.from('rate_limit_counters').select('count, window_start').eq('key', userQuotaKey).single(),
    snapshotGlobalCounter(),
  ])
  if (profileError) throw profileError
  if (userCounterError) throw userCounterError

  check('five referral credits remain untouched', profile.bonus_credits === 5,
    `bonus=${profile.bonus_credits}`)
  check('all ten attempts serialized through one user counter', userCounter.count === 10,
    `count=${userCounter.count}`)

  const priorWindowActive = originalGlobal
    && Date.parse(originalGlobal.window_start) >= startedAt - 86_400_000
  const expectedGlobalCount = priorWindowActive ? originalGlobal.count + 1 : 1
  check('only the winner advances global request capacity',
    globalAfter?.count === expectedGlobalCount,
    `before=${originalGlobal?.count ?? 0}, after=${globalAfter?.count ?? 0}, expected=${expectedGlobalCount}`)

  const slug = `entitlement-${crypto.randomUUID()}`
  const { data: portfolio, error: portfolioError } = await service
    .from('portfolios')
    .insert({ user_id: userId, slug, title: 'Disposable entitlement proof' })
    .select('id')
    .single()
  if (portfolioError) throw portfolioError
  const { data: generation, error: generationError } = await service
    .from('generations')
    .insert({
      user_id: userId,
      type: 'portfolio_generation',
      status: 'completed',
      output: {},
    })
    .select('id')
    .single()
  if (generationError) throw generationError
  const { error: portfolioDeleteError } = await service
    .from('portfolios')
    .delete()
    .eq('id', portfolio.id)
  if (portfolioDeleteError) throw portfolioDeleteError
  const { data: durableGeneration, error: durableError } = await service
    .from('generations')
    .select('id')
    .eq('id', generation.id)
    .maybeSingle()
  if (durableError) throw durableError
  check('deleting a portfolio does not erase its durable generation marker',
    durableGeneration?.id === generation.id)
} catch (error) {
  console.error(`  ❌ unexpected failure — ${error instanceof Error ? error.message : error}`)
  failed += 1
} finally {
  try {
    await cleanup()
    const [remainingUserCounter, restoredGlobal, deletedUser] = await Promise.all([
      userQuotaKey
        ? service.from('rate_limit_counters').select('key', { count: 'exact', head: true }).eq('key', userQuotaKey)
        : Promise.resolve({ count: 0, error: null }),
      globalSnapshotCaptured ? snapshotGlobalCounter() : Promise.resolve(null),
      userId ? service.auth.admin.getUserById(userId) : Promise.resolve({ data: { user: null } }),
    ])
    check('owned user quota row cleaned up',
      !remainingUserCounter.error && remainingUserCounter.count === 0)
    check('temporary auth user and profile removed', deletedUser.data.user === null)
    const globalRestored = originalGlobal
      ? restoredGlobal?.count === originalGlobal.count
        && Date.parse(restoredGlobal.window_start) === Date.parse(originalGlobal.window_start)
      : restoredGlobal === null
    check('shared local global counter restored exactly', globalRestored)
  } catch (error) {
    console.error(`  ❌ cleanup failed — ${error instanceof Error ? error.message : error}`)
    failed += 1
  }
}

console.log(`\nFree portfolio entitlement live test: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
