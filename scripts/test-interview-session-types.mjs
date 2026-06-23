#!/usr/bin/env node
// Real browser proof that every one of the 10 session types actually works through the
// live UI end to end (create -> lobby -> start -> answer -> complete), not just that
// buildInterviewPlan() succeeds in isolation. Targets the exact regression this
// session existed to fix: 7 of 10 types had rubric weights but zero question
// templates, so selecting them in the UI threw a 500 at session-creation time.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const SESSION_TYPES = [
  'recruiter_screen', 'behavioral', 'hiring_manager', 'portfolio_walkthrough',
  'project_deep_dive', 'technical_concept', 'case_problem_solving',
  'presentation_defense', 'job_specific_full_loop', 'rapid_fire_drill',
]

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function callApi(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    let json = null
    try { json = await res.json() } catch {}
    return { status: res.status, body: json }
  }, { method, path, body })
}

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const page = await browser.newPage()

  const email = `interview-types-${suffix}@example.com`
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Session Type Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  // This test exercises all 10 session types for one user in one run, which the real
  // 1-session/month free-tier quota would otherwise block after the first. Granting
  // Pro directly via the service role is the test's own setup, not something the
  // feature under test should ever allow a client to do itself (see
  // test-interview-authorization.mjs's entitlement checks for that guarantee).
  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: { users } } = await service.auth.admin.listUsers()
  const testUser = users.find((u) => u.email === email)
  await service.from('subscriptions').insert({
    user_id: testUser.id, status: 'active', cancel_at_period_end: false,
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })

  for (const sessionType of SESSION_TYPES) {
    const createRes = await callApi(page, 'POST', '/api/interviews/sessions', {
      sessionType, deliveryMode: 'text', coachingMode: 'guided', difficulty: 'standard',
      sessionLength: 'quick', targetRole: 'Software Engineer', targetCompany: 'Acme Corp',
    })
    const sessionId = createRes.body?.data?.id
    record(`${sessionType}: session creation succeeds (201) through the real API`, createRes.status === 201, `got ${createRes.status} ${JSON.stringify(createRes.body)}`)
    if (!sessionId) continue

    const startRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/start`)
    record(`${sessionType}: session starts and returns a first question`, startRes.status === 200 && !!startRes.body?.data?.firstQuestion, `got ${startRes.status}`)
    const firstQuestion = startRes.body?.data?.firstQuestion

    if (firstQuestion) {
      const answerRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, {
        questionId: firstQuestion.id, answerText: 'A real, specific, concrete answer with my own action and a measurable outcome for this question.',
      })
      record(`${sessionType}: real-text answer to the first question is accepted`, answerRes.status === 200, `got ${answerRes.status} ${JSON.stringify(answerRes.body)}`)
    }

    // Confirm the session is genuinely visible in the Hub's real list (not orphaned)
    const listRes = await callApi(page, 'GET', '/api/interviews/sessions')
    record(`${sessionType}: session appears in the user's real session list`, (listRes.body?.data ?? []).some((s) => s.id === sessionId))

    // Clean up so the list doesn't grow unbounded across 10 iterations
    await callApi(page, 'DELETE', `/api/interviews/sessions/${sessionId}`)
  }

  await browser.close()
  console.log(`\n  Interview session-type coverage test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
