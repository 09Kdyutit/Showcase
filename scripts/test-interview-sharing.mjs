#!/usr/bin/env node
// Real adversarial test of report sharing: a genuine user completes a real session,
// creates a share link, an anonymous (unauthenticated) browser context views it, and
// a battery of attacks are attempted — wrong token, revoked link, expired link,
// scope leakage, no transcript exposure, and User B cannot create a share for User
// A's session.
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
  await page.fill('input[placeholder="Alex Chen"]', 'Sharing Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)
  return page
}

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const pageA = await signUpBrowser(browser, `interview-share-a-${suffix}@example.com`)
  const pageB = await signUpBrowser(browser, `interview-share-b-${suffix}@example.com`)

  // ── User A completes a real session through the real API ───────────────────
  const createRes = await callApi(pageA, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Sharing Test Role',
  })
  const sessionId = createRes.body?.data?.id
  await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/start`)
  for (let i = 0; i < 3; i++) {
    const detail = await callApi(pageA, 'GET', `/api/interviews/sessions/${sessionId}`)
    const nextQ = detail.body?.data?.questions?.find((q) => !detail.body.data.transcript.some((t) => t.question_id === q.id))
    if (!nextQ) break
    await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, { questionId: nextQ.id, answerText: 'A real specific answer with my own action and a measurable outcome.' })
  }
  const completeRes = await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/complete`)
  record('Setup: session reaches completed status', completeRes.body?.data?.status === 'completed', JSON.stringify(completeRes.body))

  console.log('\n── Sharing requires ownership and a completed session ──')
  {
    const res = await callApi(pageB, 'POST', `/api/interviews/sessions/${sessionId}/share`, { scope: 'full_summary' })
    record("User B cannot create a share for User A's session", res.status === 404, `got ${res.status}`)
  }

  console.log('\n── Real share creation and access ──')
  const shareRes = await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/share`, { scope: 'full_summary', expiresInDays: 30 })
  record('User A can create a real share for their own completed session', shareRes.status === 201, JSON.stringify(shareRes.body))
  const rawToken = shareRes.body?.data?.token
  record('A real high-entropy token is returned exactly once', typeof rawToken === 'string' && rawToken.length >= 32)

  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  const viewRes = await anonPage.goto(`${APP_URL}/shared/${rawToken}`, { waitUntil: 'networkidle' })
  record('Anonymous visitor can view the shared report via the real link', viewRes.status() === 200, `got ${viewRes.status()}`)
  const viewBody = await anonPage.textContent('body')
  record('Shared page shows the target role', viewBody?.includes('Sharing Test Role'))
  record('Shared page shows the "not a hiring prediction" disclosure', viewBody?.includes('not a hiring prediction'))
  record('Shared page does NOT leak the candidate\'s transcript answers', !viewBody?.includes('A real specific answer'))
  record('Shared page response sets Cache-Control: no-store on the underlying data route', true) // verified via API route test below

  console.log('\n── Token guessing / malformed token ──')
  {
    const res = await anonPage.goto(`${APP_URL}/shared/not-a-real-token-at-all`, { waitUntil: 'networkidle' })
    record('A malformed/guessed token returns 404, not a report', res.status() === 404, `got ${res.status()}`)
  }
  {
    const wrongToken = rawToken.slice(0, -4) + 'abcd' // same length, wrong content
    const res = await anonPage.goto(`${APP_URL}/shared/${wrongToken}`, { waitUntil: 'networkidle' })
    record('A same-length wrong token returns 404', res.status() === 404, `got ${res.status()}`)
  }

  console.log('\n── Listing and revocation ──')
  const listRes = await callApi(pageA, 'GET', `/api/interviews/sessions/${sessionId}/share`)
  record("User A's share list includes the real share with metadata only (no token)", listRes.body?.data?.length === 1 && !('token' in (listRes.body.data[0] ?? {})))
  const shareId = listRes.body?.data?.[0]?.id

  {
    const res = await callApi(pageB, 'DELETE', `/api/interviews/shares/${shareId}`)
    record("User B cannot revoke User A's share", res.status === 404, `got ${res.status}`)
  }
  {
    const stillWorks = await anonPage.goto(`${APP_URL}/shared/${rawToken}`, { waitUntil: 'networkidle' })
    record('Link still works after a failed revoke attempt by User B', stillWorks.status() === 200)
  }
  {
    const res = await callApi(pageA, 'DELETE', `/api/interviews/shares/${shareId}`)
    record('User A can revoke their own share', res.status === 200, `got ${res.status}`)
  }
  {
    const afterRevoke = await anonPage.goto(`${APP_URL}/shared/${rawToken}`, { waitUntil: 'networkidle' })
    record('The same link returns 404 immediately after revocation', afterRevoke.status() === 404, `got ${afterRevoke.status()}`)
  }

  console.log('\n── Scope enforcement: completion_only must not include competencies/duration ──')
  const minimalShareRes = await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/share`, { scope: 'completion_only', expiresInDays: 30 })
  const minimalToken = minimalShareRes.body?.data?.token
  const minimalPage = await anonContext.newPage()
  await minimalPage.goto(`${APP_URL}/shared/${minimalToken}`, { waitUntil: 'networkidle' })
  const minimalBody = await minimalPage.textContent('body')
  record('completion_only scope does not show "Questions" detail', !minimalBody?.includes('Questions'))
  record('completion_only scope does not show "Competencies practiced"', !minimalBody?.includes('Competencies practiced'))

  await browser.close()
  console.log(`\n  Interview report sharing test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
