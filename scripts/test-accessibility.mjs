#!/usr/bin/env node
// Real axe-core accessibility scan against live pages in a real browser. Uses the
// axe-core package already present transitively (via eslint-plugin-jsx-a11y) — no new
// dependency added. Only fails on 'critical' and 'serious' violations; 'moderate' and
// 'minor' are reported but don't fail the run, since this is a first pass, not a
// zero-tolerance accessibility certification.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const PAGES = ['/waitlist', '/login', '/signup', '/pricing', '/privacy', '/terms']

let PASS = 0, FAIL = 0
const FAILING_IMPACTS = new Set(['critical', 'serious'])

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  for (const path of PAGES) {
    await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle' }).catch(() => null)
    await page.addScriptTag({ content: axeSource })
    const results = await page.evaluate(() => window.axe.run())

    const blocking = results.violations.filter((v) => FAILING_IMPACTS.has(v.impact))
    const nonBlocking = results.violations.filter((v) => !FAILING_IMPACTS.has(v.impact))

    const ok = blocking.length === 0
    console.log(`  ${ok ? '✅' : '❌'} ${path} — ${blocking.length} critical/serious, ${nonBlocking.length} moderate/minor`)
    if (ok) PASS++; else FAIL++

    for (const v of blocking) {
      console.log(`      [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`)
    }
    if (nonBlocking.length > 0) {
      for (const v of nonBlocking) {
        console.log(`      (non-blocking) [${v.impact}] ${v.id}: ${v.help}`)
      }
    }
  }

  await browser.close()
  console.log(`\n  Accessibility test: ${PASS} pages clean of critical/serious issues, ${FAIL} pages with issues\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message, e.stack); process.exit(1) })
