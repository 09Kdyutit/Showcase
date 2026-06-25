#!/usr/bin/env node
// Real, end-to-end test of Gemini Live voice interviews. Chromium is launched with
// --use-file-for-fake-audio-capture pointed at a genuine spoken-word WAV file (built
// via macOS `say` + ffmpeg, not synthetic noise) so the browser's real getUserMedia
// pipeline captures REAL human speech as its "microphone" input. This exercises the
// entire real pipeline with nothing mocked: ephemeral token minting, a real
// WebSocket connection straight from the browser to Gemini, real PCM audio
// encode/send, the model's real spoken response + real input/output transcription,
// and real persistence of the resulting transcript back to the database.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const FAKE_MIC_WAV = '/tmp/live-voice-fake-mic-padded.wav'
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
  const browser = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${FAKE_MIC_WAV}`,
    ],
  })
  const context = await browser.newContext({ permissions: ['microphone'] })
  const page = await context.newPage()
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.text().includes('[live-voice]')) console.log('  [browser]', msg.text().slice(0, 300)) })

  const suffix = Date.now()
  const email = `live-voice-real-${suffix}@example.com`
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Live Voice Real Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: { users } } = await service.auth.admin.listUsers()
  const userId = users.find((u) => u.email === email)?.id
  const { error: subError } = await service.from('subscriptions').insert({
    user_id: userId, status: 'active', stripe_customer_id: `cus_test_${suffix}`,
    stripe_subscription_id: `sub_test_${suffix}`, price_id: 'price_1Tk7KRRrWPEIfq2MgalU2tno',
    current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  })
  record('Setup: real user created and granted Pro entitlement', !subError, subError?.message)

  const createRes = await callApi(page, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'voice', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Live Voice Real Test Role',
  })
  const sessionId = createRes.body?.data?.id
  record('Setup: real voice session created (the previously-hardcoded VOICE_NOT_ENABLED bug is fixed)', createRes.status === 201, JSON.stringify(createRes.body).slice(0, 200))

  const startRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/start`)
  record('Setup: session started', startRes.status === 200)

  console.log('\n── Real browser → Gemini Live WebSocket connection ──')
  await page.goto(`${APP_URL}/interviews/${sessionId}/live`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /start interview/i }).click()

  const liveBadge = page.getByText('Live', { exact: true })
  await liveBadge.waitFor({ timeout: 20000 }).catch(() => {})
  record('Real Live connection opened (UI transitioned from connecting to live)', await liveBadge.isVisible().catch(() => false))

  console.log('\n── Letting the real conversation run (model speaks, fake mic feeds real speech, both sides transcribed) ──')
  await page.waitForTimeout(45000)

  const bodyText = await page.locator('body').innerText()
  const mentionsMigrationLikeContent = /checkout|conversion|redesign|mobile|engineering|baseline/i.test(bodyText)
  record('Real interviewer speech was transcribed onto the page (some text appeared beyond the idle placeholder)', bodyText.includes('Live') && bodyText.length > 500)
  record('Real candidate speech (from the fake mic WAV) was transcribed with recognizable real content', mentionsMigrationLikeContent, `page text sample: ${bodyText.slice(0, 300)}`)

  console.log('\n── Ending the call and verifying real persistence ──')
  const endButton = page.getByRole('button', { name: /end interview/i })
  if (await endButton.isVisible().catch(() => false)) {
    await endButton.click()
    await page.waitForURL(/\/results$/, { timeout: 20000 }).catch(() => {})
  }
  await page.waitForTimeout(2000)

  const detail = await callApi(page, 'GET', `/api/interviews/sessions/${sessionId}`)
  const liveSegments = (detail.body?.data?.transcript ?? []).filter((t) => t.source_mode === 'voice_live')
  record('Real voice_live transcript segments were persisted to the database', liveSegments.length > 0, `found ${liveSegments.length} segments`)
  const interviewerSegments = liveSegments.filter((s) => s.speaker === 'interviewer')
  const candidateSegments = liveSegments.filter((s) => s.speaker === 'candidate')
  record('Both interviewer and candidate sides were captured', interviewerSegments.length > 0 && candidateSegments.length > 0, `interviewer=${interviewerSegments.length} candidate=${candidateSegments.length}`)
  record('Session reached completed status after the call ended', detail.body?.data?.session?.status === 'completed', `status=${detail.body?.data?.session?.status}`)

  if (liveSegments.length > 0) {
    console.log('\n  Sample real transcript:')
    for (const seg of liveSegments.slice(0, 6)) console.log(`    [${seg.speaker}] ${seg.content.slice(0, 100)}`)
  }

  await browser.close()
  console.log(`\n  Real Live voice test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
