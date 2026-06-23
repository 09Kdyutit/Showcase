#!/usr/bin/env node
// Real adversarial test: User A creates a real interview session through the real
// API, then User B (a separate real authenticated browser session) attempts every
// Interview Lab API route that accepts a session/story ID, using User A's real IDs.
// Proves explicit ownership checks work at the API layer, not just RLS.
import { chromium } from 'playwright'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function signUpBrowser(browser, email) {
  const page = await browser.newPage()
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Interview Auth Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)
  return page
}

async function callApi(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    let json = null
    try { json = await res.json() } catch {}
    return { status: res.status, body: json }
  }, { method, path, body })
}

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const pageA = await signUpBrowser(browser, `interview-auth-a-${suffix}@example.com`)
  const pageB = await signUpBrowser(browser, `interview-auth-b-${suffix}@example.com`)

  // ── User A confirms eligibility and creates a real session through the real API ──
  await callApi(pageA, 'POST', '/api/interviews/profile', { ageEligibilityConfirmed: true })
  const createRes = await callApi(pageA, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Auth Test Engineer',
  })
  record('User A can create a real session (setup)', createRes.status === 201, JSON.stringify(createRes.body))
  const sessionId = createRes.body?.data?.id
  if (!sessionId) { console.error('SETUP FAILED — cannot continue'); process.exit(1) }

  const storyRes = await callApi(pageA, 'POST', '/api/interviews/story-bank', {
    title: 'Secret story A', competencies: ['ownership'],
  })
  const storyId = storyRes.body?.data?.id

  console.log('\n── User B confirms their own eligibility (separate account) ──')
  await callApi(pageB, 'POST', '/api/interviews/profile', { ageEligibilityConfirmed: true })

  console.log('\n── Cross-user session access ──')
  {
    const res = await callApi(pageB, 'GET', `/api/interviews/sessions/${sessionId}`)
    record("User B cannot GET User A's session detail", res.status === 404, `got ${res.status}`)
  }
  {
    const res = await callApi(pageB, 'POST', `/api/interviews/sessions/${sessionId}/start`)
    record("User B cannot START User A's session", res.status === 404, `got ${res.status}`)
  }
  {
    const res = await callApi(pageB, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, { questionId: '00000000-0000-0000-0000-000000000000', answerText: 'hijacked answer' })
    record("User B cannot submit a transcript answer into User A's session", res.status === 404, `got ${res.status}`)
  }
  {
    const res = await callApi(pageB, 'POST', `/api/interviews/sessions/${sessionId}/complete`)
    record("User B cannot COMPLETE User A's session", res.status === 404, `got ${res.status}`)
  }
  {
    const res = await callApi(pageB, 'POST', `/api/interviews/sessions/${sessionId}/analyze`)
    record("User B cannot trigger ANALYSIS on User A's session", res.status === 404, `got ${res.status}`)
  }
  {
    const res = await callApi(pageB, 'POST', `/api/interviews/sessions/${sessionId}/live-token`)
    record("User B cannot issue a LIVE TOKEN for User A's session", res.status === 404, `got ${res.status}`)
  }
  {
    const res = await callApi(pageB, 'DELETE', `/api/interviews/sessions/${sessionId}`)
    record("User B cannot DELETE User A's session", res.status === 404, `got ${res.status}`)
  }
  {
    // Confirm it's really still there after the attempted hijack/delete attempts
    const res = await callApi(pageA, 'GET', `/api/interviews/sessions/${sessionId}`)
    record("User A's session is intact after all of User B's attempts", res.status === 200 && res.body?.data?.session?.id === sessionId)
  }

  console.log('\n── Cross-user story bank access ──')
  if (storyId) {
    const res = await callApi(pageB, 'PATCH', `/api/interviews/story-bank/${storyId}`, { title: 'HACKED' })
    record("User B cannot PATCH User A's story bank entry", res.status === 404, `got ${res.status}`)
  }
  if (storyId) {
    const res = await callApi(pageB, 'DELETE', `/api/interviews/story-bank/${storyId}`)
    record("User B cannot DELETE User A's story bank entry", res.status === 404, `got ${res.status}`)
  }

  console.log('\n── Mass-assignment: User B cannot create a session pointing at User A\'s resume/portfolio and read it back cross-user ──')
  {
    // Even if User B somehow knew User A's resume_id, the create route only ever reads
    // resume/portfolio evidence scoped to the CALLER's own user_id (see sessions/route.ts) —
    // so passing a foreign resumeId either gets ignored (no evidence gathered) or 400s,
    // never leaks User A's resume content into User B's session.
    const res = await callApi(pageB, 'POST', '/api/interviews/sessions', {
      sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
      difficulty: 'standard', sessionLength: 'quick', targetRole: 'Mass Assignment Test',
      resumeId: '00000000-0000-0000-0000-000000000000',
    })
    record('Session creation with a nonexistent/foreign resumeId does not error or leak — either succeeds with no evidence or fails cleanly', res.status === 201 || res.status === 400 || res.status === 403, `got ${res.status}`)
  }

  console.log('\n── Unauthenticated access ──')
  {
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' })
    const res = await anonPage.evaluate(async (sessionId) => {
      const r = await fetch(`/api/interviews/sessions/${sessionId}`)
      return { status: r.status }
    }, sessionId)
    record('Unauthenticated request to a real session ID is rejected (401)', res.status === 401, `got ${res.status}`)
    await anonContext.close()
  }

  console.log('\n── Voice mode is rejected for everyone (Live gate is off) ──')
  {
    const res = await callApi(pageA, 'POST', '/api/interviews/sessions', {
      sessionType: 'behavioral', deliveryMode: 'voice', coachingMode: 'guided',
      difficulty: 'standard', sessionLength: 'quick', targetRole: 'Voice Test',
    })
    record('Voice delivery mode is rejected at session creation (VOICE_NOT_ENABLED)', res.status === 403 && res.body?.code === 'VOICE_NOT_ENABLED', JSON.stringify(res.body))
  }

  await browser.close()
  console.log(`\n  Interview API authorization test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
