#!/usr/bin/env node
/**
 * Showcase Visual QA Screenshot Script
 * Run: node scripts/screenshot-showcase.mjs
 * Requires: npm run dev running on port 3000
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://localhost:3000'
const OUT = '/tmp/showcase-screenshots'
mkdirSync(OUT, { recursive: true })

const PAGES = [
  { id: '01-landing-desktop',   url: '/',                  w: 1440, h: 900,  slowScroll: true },
  { id: '02-landing-mobile',    url: '/',                  w: 390,  h: 844,  slowScroll: true },
  { id: '03-pricing',           url: '/pricing',           w: 1440, h: 900,  slowScroll: true },
  { id: '04-login',             url: '/login',             w: 1440, h: 900  },
  { id: '05-signup',            url: '/signup',            w: 1440, h: 900  },
  { id: '06-onboarding',        url: '/demo/onboarding',   w: 1440, h: 900 },
  { id: '07-dashboard-rich',    url: '/demo/dashboard',    w: 1440, h: 900,  slowScroll: true },
  { id: '08-resume-rich',       url: '/demo/resume',       w: 1440, h: 900,  slowScroll: true },
  { id: '09-audit-rich',        url: '/demo/audit',        w: 1440, h: 900,  slowScroll: true },
  { id: '10-builder-rich',      url: '/demo/builder',      w: 1440, h: 900,  slowScroll: true },
  { id: '11-billing-rich',      url: '/demo/billing',      w: 1440, h: 900,  slowScroll: true },
  { id: '12-public-portfolio',  url: '/demo/portfolio',    w: 1440, h: 900,  slowScroll: true },
]

async function scrollAndCapture(page, slowScroll) {
  await page.waitForTimeout(1500)
  if (slowScroll) {
    const totalH = await page.evaluate(() => document.body.scrollHeight)
    const step = 700
    for (let y = 0; y < totalH; y += step) {
      await page.evaluate(y => window.scrollTo(0, y), y)
      await page.waitForTimeout(900) // wait for 650ms animations + buffer
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(800)
  }
}

async function checkRejected(page, url) {
  const title = await page.title().catch(() => '')
  const body = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? '').catch(() => '')
  const finalUrl = page.url()

  if (finalUrl.includes('/login') && !url.includes('/login')) return 'REDIRECT_TO_LOGIN'
  if (body.includes('404') && body.includes('could not be found')) return '404'
  if (title === '404') return '404'
  if (body.trim().length < 50) return 'BLANK'
  return null
}

async function main() {
  const browser = await chromium.launch()
  const results = []

  for (const { id, url, w, h, slowScroll, allowRedirect } of PAGES) {
    const page = await browser.newPage()
    await page.setViewportSize({ width: w, height: h })
    const path = `${OUT}/${id}.png`

    try {
      await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await scrollAndCapture(page, slowScroll)

      const rejection = await checkRejected(page, url)
      if (rejection && !allowRedirect) {
        console.log(`❌ REJECTED  ${id}.png — ${rejection} at ${page.url()}`)
        results.push({ id, status: 'REJECTED', reason: rejection })
      } else {
        await page.screenshot({ path, fullPage: true })
        const h_px = await page.evaluate(() => document.body.scrollHeight)
        console.log(`✅ CAPTURED  ${id}.png  (${w}×${h_px}px)`)
        results.push({ id, status: 'OK', path })
      }
    } catch (e) {
      console.log(`💥 ERROR     ${id}.png — ${e.message}`)
      results.push({ id, status: 'ERROR', reason: e.message })
    }
    await page.close()
  }

  await browser.close()

  console.log('\n── Summary ─────────────────────────────')
  const ok = results.filter(r => r.status === 'OK')
  const fail = results.filter(r => r.status !== 'OK')
  console.log(`Captured: ${ok.length}/${results.length}`)
  if (fail.length) {
    console.log('Failed:')
    fail.forEach(r => console.log(`  ${r.id}: ${r.reason}`))
  }
  console.log(`Output dir: ${OUT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
