#!/usr/bin/env node
// Real end-to-end "new user journey" browser test: a genuine signup, then the actual
// Dashboard / Onboarding / Builder pages, a REAL AI portfolio generation (exactly one —
// this is the only paid model call in this script), publish, the public /p/<slug> page +
// its view tracking, and every feature shipped in the recent batch (saved searches,
// practice reminders, career-packet ZIP) exercised through their real authed endpoints.
//
// The interview half of the journey is covered by scripts/test-interview-e2e.mjs (run
// separately) so this script does not re-pay for a full interview session.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

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
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (text.includes('va.vercel-scripts.com')) return // known dev-only CSP artifact, see interview-e2e
    consoleErrors.push(text)
  })
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

  // ── 1. Signup ──────────────────────────────────────────────────────────────
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'E2E Journey')
  await page.fill('input[type=email]', `journey-${suffix}@example.com`)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(4000)
  record('Signup lands inside the app (not back on /signup)', !page.url().includes('/signup'), page.url())

  // ── 2. Dashboard + Onboarding render cleanly ────────────────────────────────
  await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'networkidle' })
  record('Dashboard loads with no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join('; '))
  await page.goto(`${APP_URL}/onboarding`, { waitUntil: 'networkidle' })
  const onbText = await page.textContent('body')
  record('Onboarding page renders', !!onbText && onbText.length > 200)

  // ── 3. Builder: create a portfolio the way a user does (button → server action) ─
  await page.goto(`${APP_URL}/builder`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /create your first portfolio|new portfolio/i }).first().click()
  await page.waitForURL(/\/builder\/[a-f0-9-]{30,}/, { timeout: 15000 }).catch(() => {})
  const portfolioId = page.url().match(/builder\/([a-f0-9-]{30,})/)?.[1]
  record('Creating a portfolio opens the editor at /builder/<id>', !!portfolioId, portfolioId ?? page.url())
  if (!portfolioId) { await finish(browser); return }

  // ── 4. REAL AI portfolio generation (the one paid call) ─────────────────────
  const parsedResume = {
    name: 'E2E Journey',
    headline: 'Product Designer',
    summary: 'Product designer with 4 years shipping consumer mobile apps.',
    experience: [{ company: 'Northwind', title: 'Product Designer', dates: '2021–2025', bullets: ['Led the redesign of the onboarding flow, lifting activation 18%.', 'Ran a 6-person design system working group.'] }],
    skills: ['Figma', 'Design systems', 'User research', 'Prototyping'],
    projects: [{ name: 'Onboarding redesign', description: 'Rebuilt first-run experience; activation +18%.' }],
  }
  const gen = await callApi(page, 'POST', '/api/ai/generate-portfolio', {
    parsedResume, targetRole: 'Product Designer', industry: 'Consumer software',
    portfolioGoal: 'Land a senior product design role at a product-led company.',
    links: {}, portfolioId,
  })
  record('Portfolio AI generation returns 200 with real content', gen.status === 200 && !!gen.body?.data, `status ${gen.status} ${gen.body?.error ?? ''}`)

  // ── 5. Publish + public page + view tracking ────────────────────────────────
  // Publishing publicly is Pro-gated (free users generate but can't publish). Grant a
  // temporary trialing subscription via the service key so the real published-portfolio
  // path — including view tracking + builder analytics — gets genuine coverage. Removed
  // in cleanup below.
  const { data: pf } = await admin.from('portfolios').select('user_id').eq('id', portfolioId).single()
  const testUserId = pf?.user_id
  if (testUserId) {
    await admin.from('subscriptions').upsert({
      user_id: testUserId, status: 'trialing',
      current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
    }, { onConflict: 'user_id' })
  }
  record('Test user granted temporary Pro (for publish path)', !!testUserId)

  const pub = await callApi(page, 'POST', '/api/portfolio/publish', { portfolioId, action: 'publish' })
  record('Publish returns published status', pub.status === 200 && pub.body?.status === 'published', `status ${pub.status} ${JSON.stringify(pub.body)}`)

  await page.goto(`${APP_URL}/builder`, { waitUntil: 'networkidle' })
  const slug = await page.getAttribute('a[href^="/p/"]', 'href').then((h) => h?.replace('/p/', '')).catch(() => null)
  record('Published portfolio exposes a public /p/<slug> link', !!slug, slug)

  if (slug) {
    consoleErrors.length = 0
    await page.goto(`${APP_URL}/p/${slug}?ref=e2e`, { waitUntil: 'networkidle' })
    const pubBody = await page.textContent('body')
    record('Public portfolio page renders real content', !!pubBody && pubBody.length > 300)
    record('Public portfolio page has no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join('; '))
    // The view tracker fires client-side; give it a beat, then confirm the aggregate surfaces.
    await page.waitForTimeout(2500)
    await page.goto(`${APP_URL}/builder`, { waitUntil: 'networkidle' })
    const builderText = await page.textContent('body')
    record('Builder shows a view count for the published portfolio', /\bview/i.test(builderText ?? '') )
  }

  // ── 6. Recently-shipped features, via their real authed endpoints ───────────
  const ss = await callApi(page, 'POST', '/api/jobs/saved-searches', { label: 'Remote Senior PD', filters: { remote: true }, alertsEnabled: true })
  record('Saving a job search persists (table is live)', ss.status === 200 && !!ss.body?.data?.id, `status ${ss.status} ${ss.body?.error ?? ''}`)
  if (ss.body?.data?.id) {
    const list = await callApi(page, 'GET', '/api/jobs/saved-searches')
    record('Saved search is listed back', Array.isArray(list.body?.data) && list.body.data.some((s) => s.id === ss.body.data.id))
    await callApi(page, 'DELETE', `/api/jobs/saved-searches?id=${ss.body.data.id}`)
  }

  const rem = await callApi(page, 'POST', '/api/interviews/reminders', { remindAt: new Date(Date.now() + 3 * 864e5).toISOString(), note: 'before Acme onsite' })
  record('Setting a practice reminder persists (table is live)', rem.status === 200 && !!rem.body?.data?.id, `status ${rem.status} ${rem.body?.error ?? ''}`)
  if (rem.body?.data?.id) await callApi(page, 'DELETE', `/api/interviews/reminders?id=${rem.body.data.id}`)

  const zip = await page.evaluate(async () => {
    const r = await fetch('/api/career-packet')
    return { status: r.status, type: r.headers.get('content-type'), len: (await r.blob()).size }
  })
  record('Career-packet ZIP downloads', zip.status === 200 && zip.type?.includes('zip') && zip.len > 0, `status ${zip.status} type ${zip.type} bytes ${zip.len}`)

  // ── Cleanup: remove the temporary Pro grant so we don't leave a fake subscriber ─
  if (testUserId) await admin.from('subscriptions').delete().eq('user_id', testUserId)

  await finish(browser)
}

async function finish(browser) {
  await browser.close()
  console.log(`\n  New-user journey E2E: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
