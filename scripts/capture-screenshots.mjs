#!/usr/bin/env node
// Captures real screenshots at desktop and mobile viewports for visual QA review.
// Saves to screenshots/ (gitignored — these are review artifacts, not committed assets).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const OUT_DIR = 'screenshots'
const PAGES = ['/waitlist', '/login', '/signup', '/pricing', '/privacy', '/terms']
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()

  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage({ viewport })
    for (const path of PAGES) {
      const name = path === '/' ? 'home' : path.replace(/\//g, '')
      await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle' }).catch((e) => console.log(`  skip ${path}: ${e.message}`))
      await page.waitForTimeout(300)
      const filePath = `${OUT_DIR}/${device}-${name}.png`
      await page.screenshot({ path: filePath, fullPage: true })
      console.log(`  saved ${filePath}`)
    }
    await page.close()
  }

  await browser.close()
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
