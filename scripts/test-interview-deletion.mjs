#!/usr/bin/env node
// Real test that account deletion actually wipes Interview Lab data, including a
// storage object in the nested interview-recordings bucket path -- the gap that
// would exist if account deletion only cleaned up the flat resumes bucket pattern.
// Recorded Mode itself is gated off, so a recording file is seeded directly via the
// service role to simulate "what if this user had one," rather than via the real
// (currently-disabled) upload route.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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
  const email = `interview-deletion-${suffix}@example.com`

  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Deletion Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: { users } } = await service.auth.admin.listUsers()
  const userId = users.find((u) => u.email === email)?.id

  // ── Seed real interview data through the real API ──────────────────────────
  const createRes = await callApi(page, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Deletion Test Role',
  })
  const sessionId = createRes.body?.data?.id
  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/start`)
  await callApi(page, 'POST', '/api/interviews/story-bank', { title: 'Deletion test story', competencies: ['ownership'] })
  await callApi(page, 'POST', `/api/interviews/drills/star_structure/attempt`, { answerText: 'A reasonably long answer for the drill so it records an attempt for this user before deletion runs.' })
  record('Setup: session/story/drill attempt created', !!sessionId)

  // Complete + share, to also seed interview_shared_reports
  for (let i = 0; i < 3; i++) {
    const detail = await callApi(page, 'GET', `/api/interviews/sessions/${sessionId}`)
    const nextQ = detail.body?.data?.questions?.find((q) => !detail.body.data.transcript.some((t) => t.question_id === q.id))
    if (!nextQ) break
    await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, { questionId: nextQ.id, answerText: 'A real answer for deletion testing.' })
  }
  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/complete`)
  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/share`, { scope: 'completion_only', expiresInDays: 30 })

  // Seed a recording file directly (simulating Recorded Mode having been enabled)
  const recordingPath = `${userId}/${sessionId}/fake-recording.webm`
  const fakeWebm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...Array(300).fill(0x41)])
  await service.storage.from('interview-recordings').upload(recordingPath, fakeWebm, { contentType: 'audio/webm' })
  const { data: beforeFiles } = await service.storage.from('interview-recordings').list(`${userId}/${sessionId}`)
  record('Setup: a recording file genuinely exists in storage before deletion', (beforeFiles?.length ?? 0) > 0)

  const { count: sessionsBefore } = await service.from('interview_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const { count: storiesBefore } = await service.from('interview_story_bank').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const { count: sharesBefore } = await service.from('interview_shared_reports').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  record('Setup: real rows exist in interview_sessions/story_bank/shared_reports', sessionsBefore > 0 && storiesBefore > 0 && sharesBefore > 0, `${sessionsBefore}/${storiesBefore}/${sharesBefore}`)

  // ── Delete the account through the real route ───────────────────────────────
  const deleteRes = await callApi(page, 'POST', '/api/account/delete', { confirm: 'DELETE' })
  record('Account deletion succeeds', deleteRes.status === 200, JSON.stringify(deleteRes.body))

  // ── Verify everything is actually gone ──────────────────────────────────────
  const { count: sessionsAfter } = await service.from('interview_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const { count: questionsAfter } = await service.from('interview_questions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const { count: storiesAfter } = await service.from('interview_story_bank').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const { count: drillsAfter } = await service.from('interview_drills').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const { count: sharesAfter } = await service.from('interview_shared_reports').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  record('interview_sessions is empty for the deleted user (FK cascade)', sessionsAfter === 0, `count: ${sessionsAfter}`)
  record('interview_questions is empty (cascaded via session)', questionsAfter === 0, `count: ${questionsAfter}`)
  record('interview_story_bank is empty', storiesAfter === 0, `count: ${storiesAfter}`)
  record('interview_drills is empty', drillsAfter === 0, `count: ${drillsAfter}`)
  record('interview_shared_reports is empty', sharesAfter === 0, `count: ${sharesAfter}`)

  const { data: afterFiles } = await service.storage.from('interview-recordings').list(`${userId}/${sessionId}`)
  record('The nested recording file is genuinely gone from storage after deletion', (afterFiles?.length ?? 0) === 0, `remaining: ${afterFiles?.length ?? 0}`)

  await browser.close()
  console.log(`\n  Interview Lab account-deletion test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
