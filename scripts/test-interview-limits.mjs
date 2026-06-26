#!/usr/bin/env node
// Real adversarial concurrency test against the live dev server and the real atomic
// reservation RPC — proves the entitlement ledger is race-proof under genuine
// parallel HTTP requests, not just "looks atomic when read." This is the test the
// deterministic test:interview-entitlements cannot cover: a SELECT-then-INSERT race
// only shows up in code under real concurrent load, which is exactly the class of bug
// already found and fixed once elsewhere in this codebase (the AI-quota limiter).
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

// Canonical Free/Pro limits mirrored from src/lib/interviews/entitlements/plans.ts.
// This script runs under plain `node` (no --experimental-strip-types), so it cannot
// import the .ts source directly; these MUST be kept in lockstep with plans.ts. The
// deterministic test:interview-entitlements asserts the source numbers themselves.
const FREE_PLAN_LIMITS = { sessionsPerPeriod: 3, audioSessionsPerPeriod: 0 }
const PRO_PLAN_LIMITS = { sessionsPerPeriod: 30, audioSessionsPerPeriod: 15, retriesPerPeriod: 30 }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function signUp(browser, email) {
  const page = await browser.newPage()
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Limits Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(3500)
  return page
}

async function createSession(page, overrides = {}) {
  return page.evaluate(async (body) => {
    const res = await fetch('/api/interviews/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    let json = null
    try { json = await res.json() } catch {}
    return { status: res.status, body: json }
  }, { sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided', difficulty: 'standard', sessionLength: 'quick', targetRole: 'Concurrency Test Role', ...overrides })
}

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // ── 10 parallel Free session creations: never more than 2 succeed, and every ──
  // denial is one of the two REAL, intentional gates (period quota or the separate
  // max-1-concurrent-session rule) — never a 500 or a silent extra success. Concurrency
  // and period quota are two independent, both-legitimate gates that can each fire
  // first depending on request interleaving; a real burst of 10 simultaneous creates
  // necessarily collides with "only 1 concurrent session," so asserting a single
  // specific denial code for all 8 would be wrong — both codes are correct outcomes.
  {
    const page = await signUp(browser, `limits-free-${suffix}@example.com`)
    const results = await Promise.all(Array.from({ length: 10 }, () => createSession(page)))
    const succeeded = results.filter((r) => r.status === 201)
    const validCodes = new Set(['SESSION_LIMIT_REACHED', 'CONCURRENT_SESSION_LIMIT'])
    const cleanlyRejected = results.filter((r) => r.status === 403 && validCodes.has(r.body?.code))
    record('10 parallel Free session creations: never more than the canonical Free session limit succeed', succeeded.length <= FREE_PLAN_LIMITS.sessionsPerPeriod && succeeded.length >= 1, `got ${succeeded.length}, limit ${FREE_PLAN_LIMITS.sessionsPerPeriod}`)
    record('Every other request is cleanly rejected (period quota or concurrency), never a 500 or extra success', cleanlyRejected.length === results.length - succeeded.length, `statuses: ${results.map((r) => r.status).join(',')}, codes: ${results.map((r) => r.body?.code).join(',')}`)
  }

  // ── Pro audio sub-quota, tested at the real boundary — NOT as N blind parallel
  // creates, which would just collide with the separate, equally-real "1 concurrent
  // session" rule (you cannot have the whole audio pool concurrently open, by design).
  // Sessions are completed sequentially up to (limit - 1), freeing the concurrency slot
  // each time exactly like real usage, then a final parallel burst of 3 requests races
  // for the single remaining last slot — that race is the genuine, adversarial thing
  // worth proving atomic. Limit is the CANONICAL plans.ts audioSessionsPerPeriod.
  {
    const audioLimit = PRO_PLAN_LIMITS.audioSessionsPerPeriod
    const fillTo = audioLimit - 1
    const email = `limits-pro-audio-${suffix}@example.com`
    const page = await signUp(browser, email)
    const { data: { users } } = await service.auth.admin.listUsers()
    const userId = users.find((u) => u.email === email)?.id
    await service.from('subscriptions').insert({
      user_id: userId, status: 'active', stripe_customer_id: `cus_limits_${suffix}`,
      stripe_subscription_id: `sub_limits_${suffix}`, price_id: 'price_1Tk7KRRrWPEIfq2MgalU2tno',
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    })

    for (let i = 0; i < fillTo; i++) {
      const create = await createSession(page, { deliveryMode: 'voice', sessionType: 'behavioral' })
      const sessionId = create.body?.data?.id
      const startRes = await page.evaluate(async (id) => (await (await fetch(`/api/interviews/sessions/${id}/start`, { method: 'POST' })).json()), sessionId)
      const q = startRes.data?.firstQuestion
      await page.evaluate(async ({ id, q }) => fetch(`/api/interviews/sessions/${id}/transcript`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: q.id, answerText: 'A real sequential audio-quota-test answer.' }),
      }), { id: sessionId, q })
      await page.evaluate(async (id) => fetch(`/api/interviews/sessions/${id}/complete`, { method: 'POST' }), sessionId)
    }
    const usageAfterFill = await page.evaluate(async () => (await (await fetch('/api/interviews/usage')).json()))
    record(`After ${fillTo} sequential completed voice sessions, usage correctly shows ${fillTo} of ${audioLimit}`, usageAfterFill.data?.audioSessions?.used === fillTo, `got ${usageAfterFill.data?.audioSessions?.used}`)

    const burst = await Promise.all(Array.from({ length: 3 }, () => createSession(page, { deliveryMode: 'voice', sessionType: 'behavioral' })))
    const succeeded = burst.filter((r) => r.status === 201)
    const rejected = burst.filter((r) => r.status === 403 && r.body?.code === 'AUDIO_LIMIT_REACHED')
    record(`3 parallel requests racing for the last (${audioLimit}th) audio slot: exactly 1 succeeds`, succeeded.length === 1, `got ${succeeded.length}, statuses: ${burst.map((r) => r.status).join(',')}`)
    record('The other 2 are cleanly rejected with AUDIO_LIMIT_REACHED', rejected.length === 2, `got ${rejected.length}`)

    const { count: sessionReservations } = await service.from('interview_usage_reservations').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('kind', 'session').in('status', ['reserved', 'committed'])
    record(`Each successful voice session also consumed exactly one regular session slot (${audioLimit} total)`, sessionReservations === audioLimit, `got ${sessionReservations}`)
  }

  // ── Concurrent session creation never leaves an orphaned reservation behind ──
  {
    const email = `limits-orphan-${suffix}@example.com`
    const page = await signUp(browser, email)
    const { data: { users } } = await service.auth.admin.listUsers()
    const userId = users.find((u) => u.email === email)?.id
    const before = await service.from('interview_usage_reservations').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    await Promise.all(Array.from({ length: 10 }, () => createSession(page)))
    const { data: reservations } = await service.from('interview_usage_reservations').select('id, session_id, status').eq('user_id', userId)
    const orphaned = (reservations ?? []).filter((r) => r.session_id === null && r.status !== 'released')
    record('No reservation is left attached to a nonexistent session (orphaned, never released)', orphaned.length === 0, `${orphaned.length} orphaned of ${reservations?.length}`)
    void before
  }

  // ── Simultaneous retry requests on a Free session: exactly 1 may succeed ────
  {
    const email = `limits-retry-${suffix}@example.com`
    const page = await signUp(browser, email)
    const create = await createSession(page, { sessionType: 'behavioral' })
    const sessionId = create.body?.data?.id
    const startRes = await page.evaluate(async (id) => (await (await fetch(`/api/interviews/sessions/${id}/start`, { method: 'POST' })).json()), sessionId)
    let nextQ = startRes.data?.firstQuestion
    const firstQuestionId = nextQ?.id
    const allQuestionIds = []
    while (nextQ) {
      allQuestionIds.push(nextQ.id)
      const ansRes = await page.evaluate(async ({ id, q }) => (await (await fetch(`/api/interviews/sessions/${id}/transcript`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: q, answerText: 'A real, specific concurrency-test answer with a clear personal action and outcome.' }),
      })).json()), { id: sessionId, q: nextQ.id })
      nextQ = ansRes.data?.nextQuestion
    }
    await page.evaluate(async (id) => fetch(`/api/interviews/sessions/${id}/complete`, { method: 'POST' }), sessionId)

    const retryResults = await Promise.all(Array.from({ length: 5 }, () => page.evaluate(async ({ id, q }) => {
      const res = await fetch(`/api/interviews/sessions/${id}/answers/${q}/retry`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answerText: 'A concurrent retry attempt.' }),
      })
      let json = null
      try { json = await res.json() } catch {}
      return { status: res.status, body: json }
    }, { id: sessionId, q: firstQuestionId })))
    const retrySucceeded = retryResults.filter((r) => r.status === 201)
    // Two independent races can deny a losing request here: the entitlements quota
    // check (RETRY_LIMIT_REACHED, 403) or the database's own unique-attempt constraint
    // when multiple requests raced past that check simultaneously (RETRY_RACE_LOST,
    // 409 — see the retry route's explicit handling of Postgres error 23505). Both are
    // honest, clean rejections; neither is a raw 500.
    const validRetryDenialCodes = new Set(['RETRY_LIMIT_REACHED', 'RETRY_RACE_LOST'])
    const retryCleanlyRejected = retryResults.filter((r) => (r.status === 403 || r.status === 409) && validRetryDenialCodes.has(r.body?.code))
    record('5 simultaneous retries on a Free session: exactly 1 succeeds', retrySucceeded.length === 1, `got ${retrySucceeded.length}, statuses: ${retryResults.map((r) => r.status).join(',')}`)
    record('The other 4 are cleanly rejected (quota or race-lost), never a raw 500', retryCleanlyRejected.length === 4, `got ${retryCleanlyRejected.length}, codes: ${retryResults.map((r) => r.body?.code).join(',')}`)

    // ── IL-17 gap (b): the real bypass was NOT same-answer retries (the unique
    // attempt_number constraint already caught those) — it was simultaneous retries on
    // DIFFERENT questions of the same completed session, each reading priorRetryCount=0
    // via a non-atomic SELECT and each slipping past the "1 retry per Free session"
    // gate. A fresh Free session (the one above already spent its single retry) proves
    // the per-session ceiling now holds atomically ACROSS questions, via migration 027's
    // interview_reserve_retry RPC. Needs >= 2 distinct questions to be meaningful.
    if (allQuestionIds.length >= 2) {
      const email2 = `limits-retry-xq-${suffix}@example.com`
      const page2 = await signUp(browser, email2)
      const create2 = await createSession(page2, { sessionType: 'behavioral' })
      const sessionId2 = create2.body?.data?.id
      const startRes2 = await page2.evaluate(async (id) => (await (await fetch(`/api/interviews/sessions/${id}/start`, { method: 'POST' })).json()), sessionId2)
      let nq = startRes2.data?.firstQuestion
      const qIds2 = []
      while (nq) {
        qIds2.push(nq.id)
        const ar = await page2.evaluate(async ({ id, q }) => (await (await fetch(`/api/interviews/sessions/${id}/transcript`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: q, answerText: 'A real, specific concurrency-test answer with a clear personal action and outcome.' }),
        })).json()), { id: sessionId2, q: nq.id })
        nq = ar.data?.nextQuestion
      }
      await page2.evaluate(async (id) => fetch(`/api/interviews/sessions/${id}/complete`, { method: 'POST' }), sessionId2)

      // One parallel retry per DISTINCT question, fired simultaneously. Pre-fix, two of
      // these on different questions could both succeed (the bypass). Post-fix, exactly
      // one may succeed; the rest are cleanly rejected as RETRY_LIMIT_REACHED.
      const xqResults = await Promise.all(qIds2.map((qid) => page2.evaluate(async ({ id, q }) => {
        const res = await fetch(`/api/interviews/sessions/${id}/answers/${q}/retry`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answerText: 'A cross-question concurrent retry attempt.' }),
        })
        let json = null
        try { json = await res.json() } catch {}
        return { status: res.status, body: json }
      }, { id: sessionId2, q: qid })))
      const xqSucceeded = xqResults.filter((r) => r.status === 201)
      const xqValidCodes = new Set(['RETRY_LIMIT_REACHED', 'RETRY_RACE_LOST'])
      const xqRejected = xqResults.filter((r) => (r.status === 403 || r.status === 409) && xqValidCodes.has(r.body?.code))
      record('IL-17: parallel retries across DIFFERENT questions of one Free session — exactly 1 succeeds (no cross-question bypass)', xqSucceeded.length === 1, `got ${xqSucceeded.length} over ${qIds2.length} questions, statuses: ${xqResults.map((r) => r.status).join(',')}`)
      record('IL-17: every other cross-question retry cleanly rejected, never a raw 500', xqRejected.length === xqResults.length - xqSucceeded.length, `got ${xqRejected.length}, codes: ${xqResults.map((r) => r.body?.code).join(',')}`)

      // No orphaned / negative-counter fallout: the per-session retry ledger must hold
      // exactly ONE reserved retry row (the single winner), never more, never negative.
      const { data: { users: users2 } } = await service.auth.admin.listUsers()
      const userId2 = users2.find((u) => u.email === email2)?.id
      const { count: retryRows } = await service.from('interview_usage_reservations').select('id', { count: 'exact', head: true })
        .eq('user_id', userId2).eq('session_id', sessionId2).eq('kind', 'retry').in('status', ['reserved', 'committed'])
      record('IL-17: exactly one retry reservation persists for the session (no orphaned or double-counted reservations)', retryRows === 1, `got ${retryRows}`)
      await page2.close()
    }
  }

  // ── Abandoning a session before any answer refunds the slot ────────────────
  {
    const email = `limits-abandon-${suffix}@example.com`
    const page = await signUp(browser, email)
    const create = await createSession(page)
    const sessionId = create.body?.data?.id
    record(`Session created (1 of ${FREE_PLAN_LIMITS.sessionsPerPeriod} Free slots used)`, create.status === 201)

    await page.evaluate(async (id) => fetch(`/api/interviews/sessions/${id}`, { method: 'DELETE' }), sessionId)
    const usageRes = await page.evaluate(async () => (await (await fetch('/api/interviews/usage')).json()))
    record('Deleting an unanswered session refunds the slot — usage shows 0 used, not 1', usageRes.data?.sessions?.used === 0, `got ${usageRes.data?.sessions?.used}`)

    const secondCreate = await createSession(page)
    record('The refunded slot is immediately usable again', secondCreate.status === 201)
  }

  // ── Deleting a COMPLETED (answered) session does NOT refund the slot ───────
  {
    const email = `limits-no-refund-${suffix}@example.com`
    const page = await signUp(browser, email)
    const create = await createSession(page)
    const sessionId = create.body?.data?.id
    const startRes = await page.evaluate(async (id) => (await (await fetch(`/api/interviews/sessions/${id}/start`, { method: 'POST' })).json()), sessionId)
    const q = startRes.data?.firstQuestion
    await page.evaluate(async ({ id, q }) => fetch(`/api/interviews/sessions/${id}/transcript`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: q.id, answerText: 'A real committed answer.' }),
    }), { id: sessionId, q })

    await page.evaluate(async (id) => fetch(`/api/interviews/sessions/${id}`, { method: 'DELETE' }), sessionId)
    const usageRes = await page.evaluate(async () => (await (await fetch('/api/interviews/usage')).json()))
    record('Deleting an ANSWERED session does NOT refund the slot — usage still shows 1 used', usageRes.data?.sessions?.used === 1, `got ${usageRes.data?.sessions?.used}`)
  }

  await browser.close()
  console.log(`\n  Interview entitlement concurrency test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
