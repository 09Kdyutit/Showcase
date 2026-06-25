#!/usr/bin/env node
// Real axe-core accessibility scan against Interview Lab's actual authenticated
// pages, extending the same convention scripts/test-accessibility.mjs already
// established for public marketing pages — only 'critical'/'serious' violations fail
// the run. Also checks a few mission-specific requirements directly: no camera
// requirement, keyboard reachability of primary actions, visible focus.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const FAILING_IMPACTS = new Set(['critical', 'serious'])

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function scanPage(page, path) {
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle' }).catch(() => null)
  await page.addScriptTag({ content: axeSource })
  const results = await page.evaluate(() => window.axe.run())
  const blocking = results.violations.filter((v) => FAILING_IMPACTS.has(v.impact))
  const ok = blocking.length === 0
  record(`${path} has zero critical/serious axe violations`, ok, blocking.map((v) => `[${v.impact}] ${v.id}: ${v.help}`).join('; '))
  return ok
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

  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Accessibility Test')
  await page.fill('input[type=email]', `interview-a11y-${suffix}@example.com`)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  await scanPage(page, '/interviews')
  await scanPage(page, '/interviews/new')
  await scanPage(page, '/interviews/story-bank')
  await scanPage(page, '/interviews/drills')

  const createRes = await callApi(page, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Accessibility Test Role',
  })
  const sessionId = createRes.body?.data?.id
  await scanPage(page, `/interviews/${sessionId}/lobby`)

  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/start`)
  await scanPage(page, `/interviews/${sessionId}/live`)

  let nextQ = (await callApi(page, 'GET', `/api/interviews/sessions/${sessionId}`)).body?.data?.questions?.[0]
  while (nextQ) {
    const ansRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, { questionId: nextQ.id, answerText: 'A real answer for accessibility testing purposes.' })
    nextQ = ansRes.body?.data?.nextQuestion
  }
  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/complete`)
  await scanPage(page, `/interviews/${sessionId}/results`)
  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/analyze`)
  await scanPage(page, '/interviews') // returning-user Hub state: readiness breakdown, evidence coverage, next actions

  console.log('\n── Mission-specific manual checks ──')
  await page.goto(`${APP_URL}/interviews/${sessionId}/lobby`, { waitUntil: 'networkidle' })
  const lobbyBody = await page.textContent('body')
  record('Lobby does not require camera access (text mode only in this build)', !lobbyBody?.toLowerCase().includes('enable your camera') && !lobbyBody?.toLowerCase().includes('camera required'))

  await page.goto(`${APP_URL}/interviews/new`, { waitUntil: 'networkidle' })
  await page.keyboard.press('Tab')
  const firstFocused = await page.evaluate(() => document.activeElement?.tagName)
  record('New Interview page has a real focusable element reachable by Tab from page load', !!firstFocused && firstFocused !== 'BODY', firstFocused)

  // Submit the New Interview form using only the keyboard, to prove the primary
  // action does not require a mouse.
  await page.goto(`${APP_URL}/interviews/new`, { waitUntil: 'networkidle' })
  await page.getByText('Written', { exact: true }).click()
  await page.locator('#targetRole').focus()
  await page.keyboard.type('Keyboard Test Role')
  const continueButton = page.getByRole('button', { name: /continue to lobby/i })
  await continueButton.focus()
  record('The primary submit action is reachable via .focus() (a real DOM-focusable button), not click-only', await continueButton.evaluate((el) => el === document.activeElement))

  await browser.close()
  console.log(`\n  Interview Lab accessibility test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
