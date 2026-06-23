#!/usr/bin/env node
// Real browser test of the Story Bank UI: create, see it listed with correct coverage,
// edit, and delete — against the live app, not the API directly (the API itself
// already has CRUD; this proves the page that calls it actually works).
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
  await page.fill('input[placeholder="Alex Chen"]', 'Story Bank Test')
  await page.fill('input[type=email]', `interview-storybank-${suffix}@example.com`)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)

  await page.goto(`${APP_URL}/interviews/story-bank`, { waitUntil: 'networkidle' })
  record('Story Bank page loads with no console errors', consoleErrors.length === 0, consoleErrors.join('; '))
  record('Empty state is shown for a new user', (await page.textContent('body'))?.includes('No stories saved yet'))
  record('Coverage strip shows the canonical competencies', (await page.textContent('body'))?.toLowerCase().includes('ownership'))

  // ── Create ──────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /new story/i }).click()
  await page.fill('#story-title', 'Migrating the legacy billing API')
  await page.fill('#story-competencies', 'ownership, conflict')
  await page.fill('#story-situation', 'Our billing API was on a deprecated provider sunsetting in 60 days.')
  await page.fill('#story-task', 'Migrate all billing traffic with zero downtime.')
  await page.fill('#story-actions', 'Wrote the migration plan\nBuilt a dual-write shim\nCoordinated rollout with support')
  await page.fill('#story-outcome', 'Migrated 100% of traffic two weeks early with zero customer-facing incidents.')
  await page.getByRole('button', { name: /^save story$/i }).click()
  await page.waitForTimeout(1500)

  const bodyAfterCreate = await page.textContent('body')
  record('Created story appears in the list', bodyAfterCreate?.includes('Migrating the legacy billing API'))
  record('Created story shows its competency tags', bodyAfterCreate?.toLowerCase().includes('ownership') && bodyAfterCreate?.toLowerCase().includes('conflict'))
  record('Coverage strip now marks "ownership" as covered', await page.locator('span.capitalize:has-text("ownership")').first().evaluate((el) => el.className.includes('emerald')).catch(() => false))
  record('Created story shows "Unverified" evidence badge (no resume/project linked)', bodyAfterCreate?.includes('Unverified'))

  // ── Edit ────────────────────────────────────────────────────────────────
  const editButtons = page.locator('button:has(svg.lucide-pencil)')
  await editButtons.first().click()
  await page.waitForTimeout(300)
  const titleInput = page.locator('#story-title')
  record('Edit dialog pre-fills the existing title', (await titleInput.inputValue()) === 'Migrating the legacy billing API')
  await titleInput.fill('Migrating the legacy billing API (updated)')
  await page.getByRole('button', { name: /^save story$/i }).click()
  await page.waitForTimeout(1500)
  record('Edited title is reflected in the list', (await page.textContent('body'))?.includes('Migrating the legacy billing API (updated)'))

  // ── Delete ──────────────────────────────────────────────────────────────
  page.once('dialog', (dialog) => dialog.accept())
  const deleteButtons = page.locator('button:has(svg.lucide-trash2)')
  await deleteButtons.first().click()
  await page.waitForTimeout(1500)
  record('Deleted story no longer appears in the list', !(await page.textContent('body'))?.includes('Migrating the legacy billing API'))
  record('No console errors occurred during the whole flow', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; '))

  await browser.close()
  console.log(`\n  Story Bank UI test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
