#!/usr/bin/env node
// Real browser test of the Results page's "Save as Story" and "Practice Next"
// additions: saving a real answer creates a real Story Bank entry (verified by
// visiting the Story Bank page itself, not just trusting a toast), and the
// recommended drills genuinely link to real drills.
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

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Results Extras Test')
  await page.fill('input[type=email]', `interview-extras-${suffix}@example.com`)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  const createRes = await callApi(page, 'POST', '/api/interviews/sessions', {
    sessionType: 'behavioral', deliveryMode: 'text', coachingMode: 'guided',
    difficulty: 'standard', sessionLength: 'quick', targetRole: 'Results Extras Role',
  })
  const sessionId = createRes.body?.data?.id
  const startRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/start`)
  let nextQ = startRes.body?.data?.firstQuestion
  while (nextQ) {
    const ansRes = await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/transcript`, { questionId: nextQ.id, answerText: 'A specific real answer with my own action and a measurable outcome for this drill test.' })
    nextQ = ansRes.body?.data?.nextQuestion
  }
  await callApi(page, 'POST', `/api/interviews/sessions/${sessionId}/complete`)

  await page.goto(`${APP_URL}/interviews/${sessionId}/results`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  console.log('\n── Practice Next ──')
  record('Practice Next section is shown with the honest "not personalized yet" note', (await page.textContent('body'))?.includes("aren't personalized to this session yet"))
  const drillLinks = page.locator('a[href="/interviews/drills"]')
  record('At least one real drill recommendation links to the actual Drills page', await drillLinks.count() > 0)

  console.log('\n── Save as Story ──')
  await page.getByRole('button', { name: /save as story/i }).first().click()
  await page.waitForTimeout(1000)
  record('Button updates to "Saved to Story Bank" after saving', (await page.textContent('body'))?.includes('Saved to Story Bank'))

  await page.goto(`${APP_URL}/interviews/story-bank`, { waitUntil: 'networkidle' })
  const storyBankBody = await page.textContent('body')
  record('The saved story genuinely appears on the real Story Bank page', storyBankBody?.includes('A specific real answer with my own action'))
  record('The saved story is tagged with the real question competency, not invented', storyBankBody?.includes('conflict') || storyBankBody?.includes('failure') || storyBankBody?.includes('ownership'))

  await browser.close()
  console.log(`\n  Results page extras test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
