#!/usr/bin/env node
// Real test against the live proxy.ts Origin check. Drives a real authenticated
// Playwright browser session, then forges requests with spoofed Origin headers
// (something only a non-browser HTTP client can do — proving the protection works
// against the actual cross-site-request-forgery threat model: a real browser would
// never let JS override Origin, so a forged Origin here simulates what a malicious
// site's CSRF attempt would look like from the server's point of view... except a
// real browser attack can't forge Origin, so this also proves legitimate same-origin
// browser requests are unaffected).
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function main() {
  const anon = createClient(URL, ANON_KEY)
  const suffix = Date.now()
  const email = `csrf-test-${suffix}@example.com`
  const password = 'TestPassword123!'

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'CSRF Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', password)
  await page.click('button[type=submit]')
  await page.waitForTimeout(3000)

  // ── Same-origin POST (real browser fetch from our own page) succeeds ──
  {
    const result = await page.evaluate(async (appUrl) => {
      const res = await fetch(`${appUrl}/api/jobs/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imported_title: 'Engineer', imported_company: 'Acme' }),
      })
      return { status: res.status }
    }, APP_URL)
    record('Same-origin POST from a real authenticated browser session succeeds', result.status === 200 || result.status === 201, `got ${result.status}`)
  }

  // ── Forged cross-origin Origin header on a cookie-bearing request is rejected ──
  {
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await fetch(`${APP_URL}/api/jobs/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        Origin: 'https://evil-attacker-site.com',
      },
      body: JSON.stringify({ imported_title: 'Forged', imported_company: 'Evil' }),
    })
    record('Forged cross-origin Origin header on a state-changing request is rejected (403)', res.status === 403, `got ${res.status}`)
  }

  // ── GET requests are never blocked by the Origin check, even cross-origin ──
  {
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await fetch(`${APP_URL}/api/jobs/save`, {
      method: 'GET',
      headers: { Cookie: cookieHeader, Origin: 'https://evil-attacker-site.com' },
    })
    record('GET requests are not blocked by the Origin/CSRF check (no side effects to forge)', res.status !== 403, `got ${res.status}`)
  }

  // ── Stripe webhook route is exempt from the Origin check (legitimately cross-origin) ──
  {
    const res = await fetch(`${APP_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://api.stripe.com' },
      body: JSON.stringify({ fake: true }),
    })
    // Should fail on signature verification (400), NOT on the Origin check (403) —
    // proves the exemption is wired correctly without weakening actual auth.
    record('Stripe webhook route is exempt from Origin check (fails on signature, not Origin)', res.status === 400, `got ${res.status}`)
  }

  // ── Open-redirect fix: auth callback rejects external redirect targets ──
  {
    const payloads = ['//evil.com/phish', 'https://evil.com', '/\\evil.com', 'http://evil.com']
    let allSafe = true
    for (const payload of payloads) {
      const res = await fetch(`${APP_URL}/callback?next=${encodeURIComponent(payload)}`, { redirect: 'manual' })
      const location = res.headers.get('location') ?? ''
      const isSafe = !location.includes('evil.com')
      if (!isSafe) {
        allSafe = false
        console.log(`    unsafe redirect for payload "${payload}": ${location}`)
      }
    }
    record('Auth callback never redirects to an attacker-controlled external host', allSafe)
  }

  // ── Logout actually invalidates the session server-side ──
  {
    const { data: signIn } = await anon.auth.signInWithPassword({ email, password })
    const accessToken = signIn?.session?.access_token
    await anon.auth.signOut()
    const { data: afterSignout, error } = await anon.auth.getUser(accessToken)
    record('Signed-out session token is no longer valid for getUser()', !!error || !afterSignout?.user, error?.message)
  }

  await browser.close()
  console.log(`\n  CSRF/session test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message, e.stack); process.exit(1) })
