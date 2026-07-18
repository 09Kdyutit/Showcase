#!/usr/bin/env node

// Guarded local integration proof for server-owned Portfolio/Audit feature leases. This
// never contacts an AI provider and refuses every non-loopback Supabase target.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const EXPECTED_PORT = process.env.LOCAL_SUPABASE_PORT ?? '54321'

if (process.env.RUN_LIVE_TESTS !== '1') throw new Error('Refusing credentialed test without RUN_LIVE_TESTS=1')
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) throw new Error('Local Supabase URL, anon key, and service key are required')
const target = new URL(SUPABASE_URL)
if (!new Set(['127.0.0.1', 'localhost', '::1', '[::1]']).has(target.hostname) || target.port !== EXPECTED_PORT) {
  throw new Error(`LOCAL-ONLY guard refused ${target.origin}; expected loopback port ${EXPECTED_PORT}`)
}

const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const globalKey = 'ai:global:daily'
const users = []
let globalBefore = null
let globalCaptured = false
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

async function createUser(label) {
  const password = `Local-${crypto.randomUUID()}-Aa1!`
  const email = `lease-${label}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@example.com`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('local user creation failed')
  users.push(data.user.id)
  return { id: data.user.id, email, password }
}

async function createPortfolio(userId, label) {
  const { data, error } = await service.from('portfolios').insert({
    user_id: userId,
    slug: `lease-${label}-${crypto.randomUUID()}`,
    title: `Lease ${label}`,
    content: {},
  }).select('id').single()
  if (error || !data) throw error ?? new Error('portfolio creation failed')
  return data.id
}

async function createResume(userId, label) {
  const { data, error } = await service.from('resumes').insert({
    user_id: userId,
    title: `Lease ${label}`,
    raw_text: 'Local-only resume context',
    parsed_json: { name: 'Local User' },
  }).select('id').single()
  if (error || !data) throw error ?? new Error('resume creation failed')
  return data.id
}

async function readExpectedSourceState(portfolioId, resumeId) {
  let portfolioContent = null
  let portfolioTargetRole = null
  let resumeRawText = null
  let resumeParsedJson = null

  if (portfolioId) {
    const { data, error } = await service.from('portfolios')
      .select('content, target_role').eq('id', portfolioId).single()
    if (error || !data) throw error ?? new Error('portfolio state read failed')
    portfolioContent = data.content
    portfolioTargetRole = data.target_role
  }
  if (resumeId) {
    const { data, error } = await service.from('resumes')
      .select('raw_text, parsed_json').eq('id', resumeId).single()
    if (error || !data) throw error ?? new Error('resume state read failed')
    resumeRawText = data.raw_text
    resumeParsedJson = data.parsed_json
  }

  return { portfolioContent, portfolioTargetRole, resumeRawText, resumeParsedJson }
}

async function reserve(userId, eventName, portfolioId = null, resumeId = null, expectedState = null) {
  const expected = expectedState ?? await readExpectedSourceState(portfolioId, resumeId)
  return service.rpc('reserve_ai_feature_usage_lease', {
    p_user_id: userId,
    p_event_name: eventName,
    p_portfolio_id: portfolioId,
    p_resume_id: resumeId,
    p_expected_portfolio_content: expected.portfolioContent,
    p_expected_portfolio_target_role: eventName === 'portfolio_generated'
      ? expected.portfolioTargetRole
      : null,
    p_expected_resume_raw_text: expected.resumeRawText,
    p_expected_resume_parsed_json: expected.resumeParsedJson,
    p_global_max: 1_000_000,
  }).single()
}

async function release(leaseId, userId, eventName, reason = 'local_provider_failure') {
  return service.rpc('release_ai_feature_usage_lease', {
    p_lease_id: leaseId,
    p_user_id: userId,
    p_event_name: eventName,
    p_reason: reason,
  })
}

async function commitPortfolio(leaseId, userId, portfolioId, headline = 'Generated locally') {
  return service.rpc('commit_portfolio_generation_lease', {
    p_lease_id: leaseId,
    p_user_id: userId,
    p_portfolio_id: portfolioId,
    p_content: { hero: { headline } },
    p_target_role: 'Software Engineer',
    p_model_used: 'local-no-provider',
    p_prompt_id: 'portfolio-generation',
    p_prompt_version: 'local-test',
    p_provider: 'openai',
  }).single()
}

function auditCategories() {
  return Array.from({ length: 11 }, (_, index) => ({
    name: `Dimension ${index + 1}`,
    score: 50,
    fix: `Fix ${index + 1}`,
  }))
}

async function commitAudit(leaseId, userId, portfolioId, resumeId) {
  return service.rpc('commit_audit_lease', {
    p_lease_id: leaseId,
    p_user_id: userId,
    p_portfolio_id: portfolioId,
    p_resume_id: resumeId,
    p_overall_score: 50,
    p_category_scores: auditCategories(),
    p_findings: ['Local missing evidence'],
    p_recommendations: ['Local recommendation'],
    p_explanation: { summary: 'Local explanation' },
    p_model_used: 'local-no-provider',
    p_prompt_id: 'proofscore-explanation',
    p_prompt_version: 'local-test',
    p_provider: 'openai',
  }).single()
}

async function snapshotGlobal() {
  const { data, error } = await service.from('rate_limit_counters')
    .select('key, count, window_start').eq('key', globalKey).maybeSingle()
  if (error) throw error
  return data
}

async function restoreGlobal() {
  if (globalBefore) {
    const { error } = await service.from('rate_limit_counters').upsert(globalBefore)
    if (error) throw error
  } else {
    const { error } = await service.from('rate_limit_counters').delete().eq('key', globalKey)
    if (error) throw error
  }
}

try {
  console.log(`AI feature usage lease integration: ${target.origin} (local only)`)
  globalBefore = await snapshotGlobal()
  globalCaptured = true

  // RLS/grant boundary: neither anonymous nor authenticated clients can inspect or invoke.
  const { error: anonTableError } = await anon.from('ai_feature_usage_leases').select('id').limit(1)
  check(Boolean(anonTableError), 'Anonymous clients cannot read lease rows')
  const { error: anonRpcError } = await anon.rpc('reserve_ai_feature_usage_lease', {
    p_user_id: crypto.randomUUID(), p_event_name: 'portfolio_generated',
    p_portfolio_id: crypto.randomUUID(), p_resume_id: null, p_global_max: 100,
    p_expected_portfolio_content: {}, p_expected_portfolio_target_role: null,
    p_expected_resume_raw_text: null, p_expected_resume_parsed_json: null,
  }).single()
  check(Boolean(anonRpcError), 'Anonymous clients cannot reserve feature leases')

  const authUser = await createUser('auth-boundary')
  const authenticated = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error: signInError } = await authenticated.auth.signInWithPassword({
    email: authUser.email, password: authUser.password,
  })
  if (signInError) throw signInError
  const { error: authTableError } = await authenticated.from('ai_feature_usage_leases').select('id').limit(1)
  check(Boolean(authTableError), 'Authenticated clients cannot read lease rows')

  // One active winner, exact release, attempt ceiling, and non-refundable global capacity.
  const free = await createUser('free-concurrency')
  const freePortfolio = await createPortfolio(free.id, 'free-concurrency')
  const beforeConcurrency = await snapshotGlobal()
  const concurrent = await Promise.all(
    Array.from({ length: 10 }, () => reserve(free.id, 'portfolio_generated', freePortfolio)),
  )
  const winners = concurrent.filter((call) => call.data?.allowed === true)
  const inFlight = concurrent.filter((call) => call.data?.denial_reason === 'in_flight')
  check(winners.length === 1, 'Ten concurrent Free requests create exactly one active lease', `winners=${winners.length}`)
  check(inFlight.length === 9, 'The other concurrent requests are in-flight denials', `denied=${inFlight.length}`)
  check(concurrent.every((call) => !call.error), 'Concurrent reservations return no RPC errors')
  const activeLease = winners[0]?.data?.lease_id
  const wrongRelease = await release(activeLease, authUser.id, 'portfolio_generated')
  check(!wrongRelease.error && wrongRelease.data === false, 'A different user cannot release the winner lease')
  const firstRelease = await release(activeLease, free.id, 'portfolio_generated')
  check(!firstRelease.error && firstRelease.data === true, 'Provider failure releases the exact winner lease')
  const afterFirstRelease = await snapshotGlobal()
  const priorWindowActive = beforeConcurrency
    && Date.parse(beforeConcurrency.window_start) > Date.now() - 86_400_000
  const expectedAfterFirst = priorWindowActive ? beforeConcurrency.count + 1 : 1
  check(afterFirstRelease?.count === expectedAfterFirst,
    'Release does not refund the one global capacity unit',
    `actual=${afterFirstRelease?.count}, expected=${expectedAfterFirst}`)

  const second = await reserve(free.id, 'portfolio_generated', freePortfolio)
  if (second.error || !second.data?.allowed) throw second.error ?? new Error('second Free lease denied')
  await release(second.data.lease_id, free.id, 'portfolio_generated')
  const third = await reserve(free.id, 'portfolio_generated', freePortfolio)
  if (third.error || !third.data?.allowed) throw third.error ?? new Error('third Free lease denied')
  await release(third.data.lease_id, free.id, 'portfolio_generated')
  const fourth = await reserve(free.id, 'portfolio_generated', freePortfolio)
  check(!fourth.error && fourth.data?.denial_reason === 'attempt_limit',
    'Three Free attempts per 24h cap provider-failure retry churn')
  const afterAttempts = await snapshotGlobal()
  check(afterAttempts?.count === expectedAfterFirst + 2,
    'Each of three allowed attempts advances global capacity exactly once')

  // A crashed process becomes retryable after TTL without treating expiry as success.
  const staleUser = await createUser('stale')
  const staleResume = await createResume(staleUser.id, 'stale')
  const stale = await reserve(staleUser.id, 'audit_completed', null, staleResume)
  if (stale.error || !stale.data?.allowed) throw stale.error ?? new Error('stale lease setup denied')
  const { error: ageError } = await service.from('ai_feature_usage_leases').update({
    reserved_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    expires_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  }).eq('id', stale.data.lease_id)
  if (ageError) throw ageError
  const staleRetry = await reserve(staleUser.id, 'audit_completed', null, staleResume)
  check(!staleRetry.error && staleRetry.data?.allowed === true,
    'Expired crash lease is automatically replaced by a retry')
  const { data: expiredRow, error: expiredError } = await service.from('ai_feature_usage_leases')
    .select('status, failure_reason').eq('id', stale.data.lease_id).single()
  if (expiredError) throw expiredError
  check(expiredRow.status === 'expired' && expiredRow.failure_reason === 'lease_ttl_expired',
    'Stale lease is durably finalized as expired')
  await release(staleRetry.data.lease_id, staleUser.id, 'audit_completed')

  // The lease must bind to the state that actually passed the route's overwrite check,
  // including an edit that lands while dollar capacity is being prepared.
  const preReserveEditUser = await createUser('pre-reserve-edit')
  const preReserveEditPortfolio = await createPortfolio(preReserveEditUser.id, 'pre-reserve-edit')
  const checkedPortfolioState = await readExpectedSourceState(preReserveEditPortfolio, null)
  const { error: preReserveOwnerEditError } = await service.from('portfolios').update({
    content: { hero: { headline: 'Edit after overwrite check' } },
    updated_at: new Date().toISOString(),
  }).eq('id', preReserveEditPortfolio)
  if (preReserveOwnerEditError) throw preReserveOwnerEditError
  const beforeStalePortfolioReservation = await snapshotGlobal()
  const stalePortfolioReservation = await reserve(
    preReserveEditUser.id,
    'portfolio_generated',
    preReserveEditPortfolio,
    null,
    checkedPortfolioState,
  )
  const afterStalePortfolioReservation = await snapshotGlobal()
  check(!stalePortfolioReservation.error
    && stalePortfolioReservation.data?.allowed === false
    && stalePortfolioReservation.data?.denial_reason === 'source_changed',
  'A portfolio edit between overwrite check and reservation is rejected before provider contact')
  check((afterStalePortfolioReservation?.count ?? 0) === (beforeStalePortfolioReservation?.count ?? 0),
    'A stale expected portfolio state consumes no global capacity')
  const currentPortfolioReservation = await reserve(
    preReserveEditUser.id,
    'portfolio_generated',
    preReserveEditPortfolio,
  )
  check(!currentPortfolioReservation.error && currentPortfolioReservation.data?.allowed === true
    && currentPortfolioReservation.data?.attempt_count === 1,
  'The current portfolio state starts with the first durable attempt')
  if (currentPortfolioReservation.error || !currentPortfolioReservation.data?.allowed) {
    throw currentPortfolioReservation.error ?? new Error('current portfolio state lease denied')
  }
  await release(currentPortfolioReservation.data.lease_id, preReserveEditUser.id, 'portfolio_generated')

  const preReserveAuditUser = await createUser('pre-reserve-audit-edit')
  const preReserveAuditResume = await createResume(preReserveAuditUser.id, 'pre-reserve-audit-edit')
  const checkedResumeState = await readExpectedSourceState(null, preReserveAuditResume)
  const { error: preReserveResumeEditError } = await service.from('resumes').update({
    raw_text: 'Resume changed after the audit route read it',
    parsed_json: { name: 'Updated Local User' },
    updated_at: new Date().toISOString(),
  }).eq('id', preReserveAuditResume)
  if (preReserveResumeEditError) throw preReserveResumeEditError
  const beforeStaleAuditReservation = await snapshotGlobal()
  const staleAuditReservation = await reserve(
    preReserveAuditUser.id,
    'audit_completed',
    null,
    preReserveAuditResume,
    checkedResumeState,
  )
  const afterStaleAuditReservation = await snapshotGlobal()
  check(!staleAuditReservation.error
    && staleAuditReservation.data?.allowed === false
    && staleAuditReservation.data?.denial_reason === 'source_changed',
  'A resume edit between Audit input read and reservation is rejected before provider contact')
  check((afterStaleAuditReservation?.count ?? 0) === (beforeStaleAuditReservation?.count ?? 0),
    'A stale expected Audit source consumes no global capacity')
  const currentAuditReservation = await reserve(
    preReserveAuditUser.id,
    'audit_completed',
    null,
    preReserveAuditResume,
  )
  if (currentAuditReservation.error || !currentAuditReservation.data?.allowed) {
    throw currentAuditReservation.error ?? new Error('current Audit source lease denied')
  }
  const currentAuditCommit = await commitAudit(
    currentAuditReservation.data.lease_id,
    preReserveAuditUser.id,
    null,
    preReserveAuditResume,
  )
  if (currentAuditCommit.error || !currentAuditCommit.data?.audit_id) {
    throw currentAuditCommit.error ?? new Error('current Audit source did not persist')
  }
  const [{ data: currentAuditRow }, { data: currentAuditGeneration }] = await Promise.all([
    service.from('audits').select('audit_type, resume_id, category_scores')
      .eq('id', currentAuditCommit.data?.audit_id).single(),
    service.from('generations').select('id')
      .eq('input_hash', `audit:${currentAuditCommit.data?.audit_id}`).single(),
  ])
  check(!currentAuditCommit.error
    && currentAuditCommit.data?.audit_persisted === true
    && currentAuditRow?.audit_type === 'full'
    && currentAuditRow?.resume_id === preReserveAuditResume
    && currentAuditRow?.category_scores?.length === 11
    && Boolean(currentAuditGeneration?.id),
  'The exact current Audit source, 11 dimensions, explanation, and lease commit atomically')

  // Free target deletion consumes the lifetime entitlement without fabricating a result.
  const deletedFree = await createUser('free-target-deleted')
  const deletedPortfolio = await createPortfolio(deletedFree.id, 'free-target-deleted')
  const deletedLease = await reserve(deletedFree.id, 'portfolio_generated', deletedPortfolio)
  if (deletedLease.error || !deletedLease.data?.allowed) throw deletedLease.error ?? new Error('deleted target lease denied')
  const { error: deletePortfolioError } = await service.from('portfolios').delete().eq('id', deletedPortfolio)
  if (deletePortfolioError) throw deletePortfolioError
  const deletedCommit = await commitPortfolio(deletedLease.data.lease_id, deletedFree.id, deletedPortfolio)
  check(!deletedCommit.error && deletedCommit.data?.lease_committed === true
    && deletedCommit.data?.portfolio_persisted === false
    && deletedCommit.data?.outcome === 'target_deleted_before_commit',
  'Deleted portfolio target commits the successful lease and safely skips persistence')
  const replacementPortfolio = await createPortfolio(deletedFree.id, 'free-replacement')
  const deletedRetry = await reserve(deletedFree.id, 'portfolio_generated', replacementPortfolio)
  check(!deletedRetry.error && deletedRetry.data?.denial_reason === 'historical_success',
    'Committed target-deleted lease blocks a second Free lifetime generation')

  // An edit made after reservation must win over a stale provider response.
  const modifiedFree = await createUser('free-target-modified')
  const modifiedPortfolio = await createPortfolio(modifiedFree.id, 'free-target-modified')
  const modifiedLease = await reserve(modifiedFree.id, 'portfolio_generated', modifiedPortfolio)
  if (modifiedLease.error || !modifiedLease.data?.allowed) throw modifiedLease.error ?? new Error('modified target lease denied')
  const ownerEdit = { hero: { headline: 'Owner edit must survive' } }
  const { error: ownerEditError } = await service.from('portfolios')
    .update({ content: ownerEdit, updated_at: new Date().toISOString() })
    .eq('id', modifiedPortfolio)
  if (ownerEditError) throw ownerEditError
  const modifiedCommit = await commitPortfolio(
    modifiedLease.data.lease_id,
    modifiedFree.id,
    modifiedPortfolio,
    'Stale provider result',
  )
  const { data: modifiedPortfolioRow } = await service.from('portfolios')
    .select('content').eq('id', modifiedPortfolio).single()
  check(!modifiedCommit.error
    && modifiedCommit.data?.outcome === 'target_modified_before_commit'
    && modifiedCommit.data?.portfolio_persisted === false
    && modifiedPortfolioRow?.content?.hero?.headline === 'Owner edit must survive',
  'A concurrent owner edit is preserved and the stale provider result is not written')
  const modifiedReplacement = await createPortfolio(modifiedFree.id, 'free-target-modified-retry')
  const modifiedRetry = await reserve(modifiedFree.id, 'portfolio_generated', modifiedReplacement)
  check(!modifiedRetry.error && modifiedRetry.data?.denial_reason === 'historical_success',
    'Edit-during-generation cannot recycle a successful Free provider call')

  // Older Pro success history allows regeneration, while committed output remains atomic.
  const pro = await createUser('pro-regeneration')
  const { error: proSubscriptionError } = await service.from('subscriptions').insert({
    user_id: pro.id, status: 'active',
    current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
  })
  if (proSubscriptionError) throw proSubscriptionError
  const proPortfolio = await createPortfolio(pro.id, 'pro-regeneration')
  const oldAt = new Date(Date.now() - 60_000).toISOString()
  const { error: oldMarkerError } = await service.from('portfolios')
    .update({ ai_generated_at: oldAt, updated_at: oldAt }).eq('id', proPortfolio)
  if (oldMarkerError) throw oldMarkerError
  const { error: oldGenerationError } = await service.from('generations').insert({
    user_id: pro.id, type: 'portfolio_generation', status: 'completed', output: { old: true },
    model_used: 'local-no-provider', prompt_id: 'old', prompt_version: 'old', provider: 'openai',
    created_at: oldAt,
  })
  if (oldGenerationError) throw oldGenerationError
  const proLease = await reserve(pro.id, 'portfolio_generated', proPortfolio)
  check(!proLease.error && proLease.data?.allowed === true && proLease.data?.tier_at_reservation === 'pro',
    'Reservation tier is derived from the live active subscription')
  const proCommit = await commitPortfolio(proLease.data.lease_id, pro.id, proPortfolio, 'Pro regeneration')
  check(!proCommit.error && proCommit.data?.portfolio_persisted === true
    && proCommit.data?.outcome === 'committed',
  'Pro regeneration persists despite older generated history')
  const [{ data: proPortfolioRow }, { data: proGenerationRow }, { data: proLeaseRow }] = await Promise.all([
    service.from('portfolios').select('content, ai_generated_at').eq('id', proPortfolio).single(),
    service.from('generations').select('id').eq('id', proCommit.data.generation_id).single(),
    service.from('ai_feature_usage_leases').select('status, result_id').eq('id', proLease.data.lease_id).single(),
  ])
  check(proPortfolioRow?.content?.hero?.headline === 'Pro regeneration'
    && proGenerationRow?.id === proCommit.data.generation_id
    && proLeaseRow?.status === 'committed'
    && proLeaseRow?.result_id === proCommit.data.generation_id,
  'Portfolio, generation, and committed lease agree on one atomic result')

  // A target-deleted Pro success is the tenth success and cannot be recycled.
  const proDeleted = await createUser('pro-target-deleted')
  const { error: proDeletedSubscriptionError } = await service.from('subscriptions').insert({
    user_id: proDeleted.id, status: 'trialing',
    current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
  })
  if (proDeletedSubscriptionError) throw proDeletedSubscriptionError
  const proDeletedPortfolio = await createPortfolio(proDeleted.id, 'pro-target-deleted')
  const seedRows = Array.from({ length: 9 }, (_, index) => ({
    user_id: proDeleted.id, type: 'portfolio_generation', status: 'completed',
    output: { index }, model_used: 'local-no-provider', prompt_id: 'seed',
    prompt_version: 'local-test', provider: 'openai',
  }))
  const { error: seedError } = await service.from('generations').insert(seedRows)
  if (seedError) throw seedError
  const tenthLease = await reserve(proDeleted.id, 'portfolio_generated', proDeletedPortfolio)
  if (tenthLease.error || !tenthLease.data?.allowed) throw tenthLease.error ?? new Error('tenth Pro success denied')
  await service.from('portfolios').delete().eq('id', proDeletedPortfolio)
  const tenthCommit = await commitPortfolio(tenthLease.data.lease_id, proDeleted.id, proDeletedPortfolio)
  check(tenthCommit.data?.outcome === 'target_deleted_before_commit',
    'Pro target deletion commits the provider success without a generation row')
  const proDeletedReplacement = await createPortfolio(proDeleted.id, 'pro-target-replacement')
  const eleventh = await reserve(proDeleted.id, 'portfolio_generated', proDeletedReplacement)
  check(!eleventh.error && eleventh.data?.denial_reason === 'success_limit'
    && eleventh.data?.success_count === 10,
  'Target-deleted Pro success counts exactly once toward the ten-success window',
  `success_count=${eleventh.data?.success_count}`)

  // Audit source edits after reservation consume the provider success but never persist a
  // stale audit or overwrite the score attached to the owner's newer portfolio state.
  const auditUser = await createUser('audit-context-changed')
  const auditPortfolio = await createPortfolio(auditUser.id, 'audit-context-changed')
  const auditResume = await createResume(auditUser.id, 'audit-context-changed')
  const { error: previewSeedError } = await service.from('audits').insert({
    user_id: auditUser.id,
    resume_id: auditResume,
    audit_type: 'preview',
    overall_score: 40,
  })
  if (previewSeedError) throw previewSeedError
  const auditLease = await reserve(auditUser.id, 'audit_completed', auditPortfolio, auditResume)
  check(!auditLease.error && auditLease.data?.allowed === true,
    'A recent legacy preview does not block the first complete Free Audit')
  if (auditLease.error || !auditLease.data?.allowed) throw auditLease.error ?? new Error('audit lease denied')
  const [{ error: editAuditPortfolioError }, { error: editAuditResumeError }] = await Promise.all([
    service.from('portfolios').update({
      content: { hero: { headline: 'Newer portfolio state' } },
      updated_at: new Date().toISOString(),
    }).eq('id', auditPortfolio),
    service.from('resumes').update({
      raw_text: 'Newer resume state',
      parsed_json: { name: 'Newer Local User' },
      updated_at: new Date().toISOString(),
    }).eq('id', auditResume),
  ])
  if (editAuditPortfolioError || editAuditResumeError) throw editAuditPortfolioError ?? editAuditResumeError
  const auditCommit = await commitAudit(auditLease.data.lease_id, auditUser.id, auditPortfolio, auditResume)
  check(!auditCommit.error && auditCommit.data?.lease_committed === true
    && auditCommit.data?.audit_persisted === false
    && auditCommit.data?.audit_id === null
    && auditCommit.data?.outcome === 'source_changed_before_commit',
  'Changed Audit sources commit the spent lease while skipping stale persistence')
  const [fullAuditCount, auditGenerationCount, portfolioAfterAudit, committedAuditLease] = await Promise.all([
    service.from('audits').select('id', { count: 'exact', head: true })
      .eq('user_id', auditUser.id).eq('audit_type', 'full'),
    service.from('generations').select('id', { count: 'exact', head: true })
      .eq('user_id', auditUser.id).eq('type', 'audit_explanation'),
    service.from('portfolios').select('content, proof_score').eq('id', auditPortfolio).single(),
    service.from('ai_feature_usage_leases').select('status, result_id, failure_reason')
      .eq('id', auditLease.data.lease_id).single(),
  ])
  check(fullAuditCount.count === 0
    && auditGenerationCount.count === 0
    && portfolioAfterAudit.data?.content?.hero?.headline === 'Newer portfolio state'
    && portfolioAfterAudit.data?.proof_score === null
    && committedAuditLease.data?.status === 'committed'
    && committedAuditLease.data?.result_id === null
    && committedAuditLease.data?.failure_reason === 'source_changed_before_commit',
  'A stale Audit writes no audit, explanation, or proof score and preserves newer source data')
  const replacementResume = await createResume(auditUser.id, 'audit-replacement')
  const secondAudit = await reserve(auditUser.id, 'audit_completed', null, replacementResume)
  check(!secondAudit.error && secondAudit.data?.denial_reason === 'success_limit',
    'A changed-source provider success cannot recycle the Free complete-Audit allowance')
} catch (error) {
  console.error(`  ❌ unexpected failure — ${error instanceof Error ? error.message : error}`)
  fail += 1
} finally {
  try {
    for (const userId of users.reverse()) {
      const { error } = await service.auth.admin.deleteUser(userId)
      if (error) throw error
    }
    if (globalCaptured) await restoreGlobal()
    const { count: leftoverLeaseCount, error: leftoverError } = await service
      .from('ai_feature_usage_leases').select('id', { count: 'exact', head: true }).in('user_id', users)
    check(!leftoverError && (leftoverLeaseCount ?? 0) === 0, 'Owned lease rows are removed with test users')
    const restored = await snapshotGlobal()
    const globalRestored = globalBefore
      ? restored?.count === globalBefore.count
        && Date.parse(restored.window_start) === Date.parse(globalBefore.window_start)
      : restored === null
    check(globalRestored, 'Shared local global counter is restored exactly')
  } catch (error) {
    console.error(`  ❌ cleanup failed — ${error instanceof Error ? error.message : error}`)
    fail += 1
  }
}

console.log(`\nAI feature usage lease live test: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
