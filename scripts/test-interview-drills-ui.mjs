#!/usr/bin/env node
// Real browser test of the Drills feature: list, open, submit a deliberately weak
// answer (expect a failed check), submit a strong answer (expect it to pass), and
// confirm the best score persists across attempts.
import { chromium } from 'playwright'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function main() {
  const suffix = Date.now()
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('va.vercel-scripts.com')) consoleErrors.push(msg.text()) })
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Drills Test')
  await page.fill('input[type=email]', `interview-drills-${suffix}@example.com`)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  await page.goto(`${APP_URL}/interviews/drills`, { waitUntil: 'networkidle' })
  record('Drills page loads with no console errors', consoleErrors.length === 0, consoleErrors.join('; '))
  record('All 15 drills are listed', await page.locator('button:has(p.text-sm.font-medium)').count() === 15)

  await page.getByText('Time-Boxed Answer', { exact: true }).click()
  await page.waitForTimeout(300)
  record('Drill dialog opens with the prompt visible', (await page.textContent('body'))?.includes('100 words or fewer'))

  // ── Weak attempt: way too short, should fail the length check ───────────
  await page.fill('textarea', 'I am good.')
  await page.getByRole('button', { name: /^submit$/i }).click()
  await page.waitForTimeout(1000)
  const weakResult = await page.textContent('body')
  record('A too-short answer shows a failed check, not a pass', weakResult?.includes('Result:') && !weakResult?.includes('Result: 100/100'))

  await page.getByRole('button', { name: /try again/i }).click()
  await page.waitForTimeout(300)

  // ── Strong attempt: within the word range, should pass ──────────────────
  await page.fill('textarea', 'I have shipped production systems end to end, I take ownership of problems beyond my immediate scope, and I communicate clearly under pressure. You should hire me because those three things are exactly what this role demands: I led the last migration my team shipped, reduced our deploy time by half, and kept stakeholders informed the whole way through. That is why I am confident I can contribute from the first week rather than the first quarter.')
  await page.getByRole('button', { name: /^submit$/i }).click()
  await page.waitForTimeout(1000)
  const strongResult = await page.textContent('body')
  record('A well-formed answer within range shows Result: 100/100', strongResult?.includes('Result: 100/100'))

  await page.getByRole('button', { name: /^done$/i }).click()
  await page.waitForTimeout(500)
  record('Best score (100) now shows on the drill card', (await page.textContent('body'))?.includes('100'))
  record('No console errors occurred during the whole flow', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; '))

  await browser.close()
  console.log(`\n  Drills UI test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
