#!/usr/bin/env node
// Real test of Recorded Mode against the live Gemini API: a genuine spoken-word
// audio file (generated via macOS `say` + ffmpeg, not synthetic noise) gets
// uploaded through the real route, transcribed by the real model, and the
// resulting transcript is checked for actual semantic accuracy against the known
// source sentence -- not just "did it return any string."
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const KNOWN_SENTENCE = 'I personally led the database migration and we reduced query latency by sixty percent.'
const AIFF_PATH = '/tmp/interview-recording-test.aiff'
const WEBM_PATH = '/tmp/interview-recording-test.webm'

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
  execSync(`say -o "${AIFF_PATH}" "${KNOWN_SENTENCE}"`)
  execSync(`ffmpeg -y -i "${AIFF_PATH}" -c:a libopus "${WEBM_PATH}"`, { stdio: 'ignore' })
  record('Setup: generated a real spoken-word webm audio file', existsSync(WEBM_PATH))

  const suffix = Date.now()
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Recording Test')
  await page.fill('input[type=email]', `interview-real-recording-${suffix}@example.com`)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  const createRes = await callApi(page, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Recording Test Role',
  })
  const sessionId = createRes.body?.data?.id
  const startRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/start`)
  const firstQuestionId = startRes.body?.data?.firstQuestion?.id
  record('Setup: real session created and started', !!firstQuestionId)

  console.log('\n── Real upload + real Gemini transcription ──')
  const audioBuffer = readFileSync(WEBM_PATH)
  const uploadResult = await page.evaluate(async ({ path, base64, mime }) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: mime })
    const form = new FormData()
    form.append('file', blob, 'recording.webm')
    const res = await fetch(path, { method: 'POST', body: form })
    let json = null
    try { json = await res.json() } catch {}
    return { status: res.status, body: json }
  }, { path: `/api/interviews/sessions/${sessionId}/answers/${firstQuestionId}/recording`, base64: audioBuffer.toString('base64'), mime: 'audio/webm' })

  record('Upload + transcription succeeds (201)', uploadResult.status === 201, `got ${uploadResult.status}: ${JSON.stringify(uploadResult.body)?.slice(0, 300)}`)
  const transcribedText = uploadResult.body?.data?.answer?.answer_text ?? ''
  console.log(`  transcribed: "${transcribedText}"`)
  record('Real audio_storage_path was set (recording genuinely persisted)', !!uploadResult.body?.data?.answer?.audio_storage_path)
  record('Transcription is real and semantically accurate (mentions migration/latency, not gibberish)', /migration/i.test(transcribedText) && /(latency|sixty|60)/i.test(transcribedText))
  record('Response includes the next question (progression works exactly like text mode)', uploadResult.body?.data?.nextQuestion !== undefined)

  console.log('\n── The transcribed answer feeds into the same analysis pipeline as text ──')
  let nextQ = uploadResult.body?.data?.nextQuestion
  while (nextQ) {
    const ansRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, { questionId: nextQ.id, answerText: 'A typed follow-up answer to finish the session.' })
    nextQ = ansRes.body?.data?.nextQuestion
  }
  const completeRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/complete`)
  record('Session completes normally with a mixed voice+text transcript', completeRes.status === 200)

  const detail = await callApi(page, 'GET', `/api/interviews/sessions/${sessionId}`)
  const voiceSegment = (detail.body?.data?.transcript ?? []).find((t) => t.source_mode === 'voice_recorded')
  record('A real voice_recorded transcript segment exists with the real transcribed content', voiceSegment?.content === transcribedText)

  await browser.close()
  console.log(`\n  Real recording + transcription test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
