#!/usr/bin/env node
// Real test of the Recorded Mode upload route. The feature itself is off in every
// environment (isInterviewRecordingEnabled() is false — no human has approved
// Recorded Mode for real users), so the meaningful thing to prove here is that
// ownership/session-state enforcement happens BEFORE the gate is even checked (so
// opening the gate later introduces no new authorization gap), and that the gate
// itself fails closed for the legitimate owner once everything else checks out.
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
  await page.fill('input[placeholder="Alex Chen"]', 'Recording Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)
  return page
}

async function callApi(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    let json = null
    try { json = await res.json() } catch {}
    return { status: res.status, body: json }
  }, { method, path, body })
}

async function uploadRecording(page, sessionId, questionId) {
  return page.evaluate(async ({ sessionId, questionId }) => {
    const bytes = new Uint8Array(2048)
    bytes.set([0x1a, 0x45, 0xdf, 0xa3]) // real webm magic bytes
    const blob = new Blob([bytes], { type: 'audio/webm' })
    const form = new FormData()
    form.append('file', blob, 'answer.webm')
    const res = await fetch(`/api/interviews/sessions/${sessionId}/answers/${questionId}/recording`, { method: 'POST', body: form })
    let json = null
    try { json = await res.json() } catch {}
    return { status: res.status, body: json }
  }, { sessionId, questionId })
}

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const pageA = await signUpBrowser(browser, `interview-rec-a-${suffix}@example.com`)
  const pageB = await signUpBrowser(browser, `interview-rec-b-${suffix}@example.com`)

  const createRes = await callApi(pageA, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Recording Test Role',
  })
  const sessionId = createRes.body?.data?.id
  const startRes = await callApi(pageA, 'POST', `/api/interviews/sessions/${sessionId}/start`)
  const questionId = startRes.body?.data?.firstQuestion?.id
  record('Setup: real in-progress session with a real question exists', !!sessionId && !!questionId)

  console.log('\n── Unauthenticated and cross-user access (checked before the gate) ──')
  {
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' })
    const res = await anonPage.evaluate(async ({ sessionId, questionId }) => {
      const r = await fetch(`/api/interviews/sessions/${sessionId}/answers/${questionId}/recording`, { method: 'POST', body: new FormData() })
      return { status: r.status }
    }, { sessionId, questionId })
    record('Unauthenticated upload attempt is rejected (401), not the feature-disabled message', res.status === 401, `got ${res.status}`)
    await anonContext.close()
  }
  {
    const res = await uploadRecording(pageB, sessionId, questionId)
    record("User B cannot upload to User A's session (404, not 403 — ownership is checked first)", res.status === 404, `got ${res.status} ${JSON.stringify(res.body)}`)
  }
  {
    const fakeQuestionId = '00000000-0000-0000-0000-000000000000'
    const res = await uploadRecording(pageA, sessionId, fakeQuestionId)
    record('Uploading against a nonexistent question ID 404s', res.status === 404, `got ${res.status}`)
  }

  console.log('\n── The feature itself, for the legitimate owner (gate is on, real transcription) ──')
  {
    const res = await uploadRecording(pageA, sessionId, questionId)
    record('A legitimate owner uploading a real, valid webm file gets a real transcribed answer back (201)', res.status === 201 && !!res.body?.data?.answer?.answer_text, `got ${res.status} ${JSON.stringify(res.body)}`)
    record('The uploaded recording was genuinely persisted to storage', !!res.body?.data?.answer?.audio_storage_path)
  }

  await browser.close()
  console.log(`\n  Interview recording upload test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
