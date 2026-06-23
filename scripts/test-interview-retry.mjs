#!/usr/bin/env node
// Real test of the answer retry feature: a genuine completed session, a real retry
// through the actual Results page UI, the original answer preserved (never
// overwritten), a real deterministic comparison shown, and cross-user/state
// adversarial checks via the API directly.
import { chromium } from 'playwright'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

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

async function signUpBrowser(browser, email) {
  const page = await browser.newPage()
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Retry Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)
  return page
}

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const pageA = await signUpBrowser(browser, `interview-retry-a-${suffix}@example.com`)
  const pageB = await signUpBrowser(browser, `interview-retry-b-${suffix}@example.com`)

  const createRes = await callApi(pageA, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Retry Test Role',
  })
  const sessionId = createRes.body?.data?.id
  const startRes = await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/start`)
  let nextQ = startRes.body?.data?.firstQuestion
  const firstQuestionId = nextQ?.id
  const originalText = 'I worked on a team project and it went okay overall.'
  while (nextQ) {
    const ansRes = await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, { questionId: nextQ.id, answerText: nextQ.id === firstQuestionId ? originalText : 'A filler answer to finish the session.' })
    nextQ = ansRes.body?.data?.nextQuestion
  }

  console.log('\n── Retry requires a completed session ──')
  {
    const res = await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/answers/${firstQuestionId}/retry`, { answerText: 'trying again' })
    record('Retry on an in_progress (not yet completed) session is rejected', res.status === 409, `got ${res.status}`)
  }

  await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/complete`)

  console.log('\n── Cross-user and validation ──')
  {
    const res = await callApi(pageB, 'POST', `/api/interviews/sessions/${sessionId}/answers/${firstQuestionId}/retry`, { answerText: 'hijacked retry' })
    record("User B cannot retry an answer in User A's session", res.status === 404, `got ${res.status}`)
  }
  {
    const res = await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/answers/00000000-0000-0000-0000-000000000000/retry`, { answerText: 'retry' })
    record('Retrying a nonexistent question 404s', res.status === 404, `got ${res.status}`)
  }

  console.log('\n── Real retry through the actual Results page UI ──')
  await pageA.goto(`${APP_URL}/interviews/${sessionId}/results`, { waitUntil: 'networkidle' })
  await pageA.waitForTimeout(2000) // allow the page's own analyze-on-load call to settle
  await pageA.getByRole('button', { name: /retry this answer/i }).first().click()
  await pageA.waitForTimeout(300)
  const retryAnswerText = 'I personally led a team project that cut our release cycle by 30 percent, so we shipped two sprints ahead of schedule.'
  await pageA.locator('textarea').first().fill(retryAnswerText)
  await pageA.getByRole('button', { name: /submit retry/i }).click()
  await pageA.waitForTimeout(1500)

  const bodyAfterRetry = await pageA.textContent('body')
  record('Original answer text is still visible after retry (never overwritten)', bodyAfterRetry?.includes(originalText))
  record('Retry answer text is shown alongside it', bodyAfterRetry?.includes('cut our release cycle by 30 percent'))
  record('A real deterministic observation (added a number) is shown', bodyAfterRetry?.includes('Added a specific number'))
  record('Honest disclosure that this is not an AI quality judgment is shown', bodyAfterRetry?.includes('not an AI quality judgment'))

  // ── Verify via direct DB-equivalent API call that BOTH attempts persist ──
  const detailRes = await callApi(pageA, 'GET', `/api/interviews/sessions/${sessionId}`)
  const answersForQuestion = (detailRes.body?.data?.answers ?? []).filter((a) => a.question_id === firstQuestionId)
  record('Both the original and retry are stored as separate attempts (attempt_number 1 and 2)', answersForQuestion.length === 2 && answersForQuestion.some((a) => a.attempt_number === 1) && answersForQuestion.some((a) => a.attempt_number === 2))

  await browser.close()
  console.log(`\n  Interview retry test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
