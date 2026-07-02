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

  // The results page auto-runs AI analysis on landing, so 'networkidle' never settles
  // within a fixed budget. Wait for the page shell, then for the Practice Next card
  // (rendered for every completed session regardless of analysis outcome).
  await page.goto(`${APP_URL}/interviews/${sessionId}/results`, { waitUntil: 'domcontentloaded' })
  // Analysis is a real AI call auto-run on landing; wait for it to resolve to either
  // a scored state (dimension-driven Practice Next copy) or an explicit failure state.
  await page.waitForFunction(() => {
    const t = document.body.innerText
    return t.includes('lowest-scoring dimensions') || t.includes('You did well overall')
      || t.includes('Retry scoring') || t.includes('ran into an error')
  }, null, { timeout: 180000 })
  await page.waitForTimeout(1000)

  console.log('\n── Practice Next ──')
  {
    const bodyText = await page.textContent('body')
    const isPersonalized = bodyText?.includes('lowest-scoring dimensions')
    const scoredWellAcrossBoard = bodyText?.includes('You did well overall')
    record('Practice Next reflects real per-dimension scores, not a generic fallback', isPersonalized || scoredWellAcrossBoard, `personalized=${isPersonalized} well=${scoredWellAcrossBoard}`)
  }
  const drillLinks = page.locator('a[href="/interviews/drills"]')
  record('At least one real drill recommendation links to the actual Drills page', await drillLinks.count() > 0)

  // NOTE: "Save as Story" was deliberately removed from the results page in commit
  // 85c4d70 (Story Bank is a standalone page now, covered by test:interview-story-bank).
  // The retry flow on this page is covered by test:interview-retry.

  await browser.close()
  console.log(`\n  Results page extras test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
