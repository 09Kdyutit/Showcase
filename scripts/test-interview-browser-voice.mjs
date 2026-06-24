#!/usr/bin/env node
// Real test of Browser Voice (Beta) -- the Web Speech API-based read-aloud/dictation
// feature, deliberately separate from the still-disabled Gemini Live voice path.
// Headless Chromium has no real microphone input, so genuine human speech can't be
// fed through SpeechRecognition in CI. Instead this injects a standards-shaped fake
// SpeechRecognition/SpeechSynthesis implementation via an init script -- the same
// contract (start/stop/onresult/onend) any real browser implementation uses -- and
// verifies the app's OWN wiring reacts correctly: it calls speak() with the right
// text, starts/stops recognition on click, and correctly appends a final transcript
// result into the answer textarea. This proves the integration code is correct;
// real speech recognition accuracy is the browser's own, already-shipped behavior.
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

const FAKE_SPEECH_API_INIT_SCRIPT = `
  // window.speechSynthesis is a read-only getter on real Chromium -- a plain
  // assignment silently no-ops, leaving the native implementation in place (which
  // then rejects our fake SpeechSynthesisUtterance, since it isn't a real instance).
  // Object.defineProperty forces the override.
  window.__speakCalls = [];
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      cancel: () => {},
      speak: (utterance) => { window.__speakCalls.push(utterance.text); },
    },
  });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.rate = 1; };

  window.__recognitionInstances = [];
  function FakeSpeechRecognition() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = '';
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.started = false;
    window.__recognitionInstances.push(this);
  }
  FakeSpeechRecognition.prototype.start = function () { this.started = true; };
  FakeSpeechRecognition.prototype.stop = function () {
    this.started = false;
    if (this.onend) this.onend();
  };
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;
`

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.addInitScript(FAKE_SPEECH_API_INIT_SCRIPT)

  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Browser Voice Test')
  await page.fill('input[type=email]', `interview-browser-voice-${suffix}@example.com`)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  const createRes = await callApi(page, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Browser Voice Test Role',
  })
  const sessionId = createRes.body?.data?.id
  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/start`)

  await page.goto(`${APP_URL}/interviews/${sessionId}/live`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  console.log('\n── Honest labeling ──')
  const body = await page.textContent('body')
  record('Page clearly labels this as "Browser Voice (Beta)", not the AI voice interviewer', body?.includes('Browser Voice (Beta)'))
  record('Page explicitly discloses nothing is sent to Gemini/AI', body?.toLowerCase().includes('nothing is sent to gemini'))

  console.log('\n── Read aloud (TTS) ──')
  const questionText = await page.locator('p.text-lg').textContent()
  await page.getByRole('button', { name: /read aloud/i }).click()
  await page.waitForTimeout(300)
  const speakCalls = await page.evaluate(() => window.__speakCalls)
  record('Clicking "Read aloud" calls speechSynthesis.speak with the real question text', speakCalls.length === 1 && speakCalls[0] === questionText?.trim())

  console.log('\n── Dictation (STT) ──')
  await page.getByRole('button', { name: /^dictate$/i }).click()
  await page.waitForTimeout(300)
  const recognitionStarted = await page.evaluate(() => window.__recognitionInstances[0]?.started === true)
  record('Clicking "Dictate" actually starts a SpeechRecognition instance', recognitionStarted)
  record('Button flips to "Stop dictating" while listening', (await page.textContent('body'))?.includes('Stop dictating'))

  // Simulate the browser delivering a final transcript result, exactly as a real
  // browser would call the app's own onresult handler.
  await page.evaluate(() => {
    const rec = window.__recognitionInstances[0]
    rec.onresult({
      results: [Object.assign([{ transcript: 'I personally led the migration and cut latency by 40 percent.' }], { isFinal: true })],
    })
  })
  await page.waitForTimeout(300)
  const textareaValue = await page.locator('textarea').inputValue()
  record('A final dictation result is appended into the real answer textarea', textareaValue.includes('I personally led the migration and cut latency by 40 percent.'))

  await page.getByRole('button', { name: /stop dictating/i }).click()
  await page.waitForTimeout(300)
  record('Clicking again stops recognition and button reverts to "Dictate"', (await page.textContent('body'))?.includes('Dictate') && !(await page.textContent('body'))?.includes('Stop dictating'))

  console.log('\n── Submits as a normal text answer, no new data model ──')
  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, { questionId: (await callApi(page, 'GET', `/api/interviews/sessions/${sessionId}`)).body.data.questions[0].id, answerText: textareaValue })
  const detail = await callApi(page, 'GET', `/api/interviews/sessions/${sessionId}`)
  const stored = detail.body?.data?.transcript?.find((t) => t.content?.includes('cut latency by 40 percent'))
  record('The dictated answer is stored as a completely normal text answer via the existing transcript endpoint', !!stored)

  console.log('\n── Graceful degradation when the browser does not support these APIs ──')
  const page2 = await browser.newPage()
  await page2.addInitScript(`delete window.SpeechRecognition; delete window.webkitSpeechRecognition; delete window.speechSynthesis;`)
  await page2.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' })
  await page2.fill('input[type=email]', `interview-browser-voice-${suffix}@example.com`)
  await page2.fill('input[type=password]', 'TestPassword123!')
  await page2.click('button[type=submit]')
  await page2.waitForTimeout(3000)
  await page2.goto(`${APP_URL}/interviews/${sessionId}/live`, { waitUntil: 'networkidle' })
  const body2 = await page2.textContent('body')
  record('When the browser lacks both APIs, no voice buttons are shown and a plain-text fallback note appears', !body2?.includes('Read aloud') && !body2?.includes('Dictate') && body2?.includes("isn't supported in this browser"))

  await browser.close()
  console.log(`\n  Browser voice test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
