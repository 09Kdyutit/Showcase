#!/usr/bin/env node
// Visual QA captures for the brand/positioning pass — full-page screenshots at
// desktop and mobile widths for every public page touched in this mission.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const OUT_DIR = '/tmp/showcase-video-framework-screenshots'
const PAGES = ['/', '/pricing', '/waitlist', '/proofscore', '/for-career-services']
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()

  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
    for (const path of PAGES) {
      const name = path === '/' ? 'home' : path.replace(/\//g, '')
      try {
        await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle', timeout: 20000 })
        await page.waitForTimeout(400)
        const filePath = `${OUT_DIR}/${device}-${name}.png`
        await page.screenshot({ path: filePath, fullPage: true })
        console.log(`  saved ${filePath}`)
      } catch (e) {
        console.log(`  ❌ ${path}: ${e.message}`)
      }
    }
    await page.close()
  }

  await browser.close()
  console.log(`\nDone. Screenshots in ${OUT_DIR}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
