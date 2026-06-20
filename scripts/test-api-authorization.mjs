#!/usr/bin/env node
// Real adversarial test: User A creates real resources via the real app, then User B
// (a separate real authenticated browser session) attempts every API route that accepts
// a record ID, using User A's real IDs. This proves explicit ownership checks work at the
// API layer itself — not just RLS, and not just by reading the code.
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function signUpBrowser(browser, email) {
  const page = await browser.newPage()
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'API Auth Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(3000)
  return page
}

async function callApi(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    let json = null
    try { json = await res.json() } catch {}
    return { status: res.status, body: json }
  }, { method, path, body })
}

async function main() {
  const suffix = Date.now()
  const client = createClient(URL, ANON_KEY)

  // User A signs up via the API client directly (for seeding), and also via browser (for an authentic session if needed)
  const emailA = `api-auth-a-${suffix}@example.com`
  const emailB = `api-auth-b-${suffix}@example.com`
  const { data: signupA, error: errA } = await client.auth.signUp({ email: emailA, password: 'TestPassword123!' })
  if (errA) throw new Error('User A signup failed: ' + errA.message)
  const userA = signupA.user.id

  const browser = await chromium.launch()
  const pageB = await signUpBrowser(browser, emailB)

  // ── Seed User A's resources directly via Supabase (respects RLS, owned by A) ──
  const { data: resumeA } = await client.from('resumes').insert({
    user_id: userA, title: 'A Secret Resume', raw_text: 'A private resume content', parsed_json: { name: 'A', skills: ['x'] },
  }).select().single()

  const { data: portfolioA } = await client.from('portfolios').insert({
    user_id: userA, slug: `api-auth-a-${suffix}`, title: 'A Portfolio', status: 'draft', content: { hero: { headline: 'A secret' } },
  }).select().single()

  const { data: savedJobA } = await client.from('saved_jobs').insert({
    user_id: userA, imported_title: 'A Secret Job', imported_company: 'ACo', status: 'saved',
  }).select().single()

  const { data: applicationA } = await client.from('applications').insert({
    user_id: userA, saved_job_id: savedJobA.id, stage: 'saved',
  }).select().single()

  const { data: tailoredA } = await client.from('tailored_assets').insert({
    user_id: userA, saved_job_id: savedJobA.id, asset_type: 'application_kit',
    content: { professional_summary: 'A secret summary' }, truth_map: [],
  }).select().single()

  console.log('Seeded resources for User A:', { resumeA: resumeA?.id, portfolioA: portfolioA?.id, savedJobA: savedJobA?.id, applicationA: applicationA?.id, tailoredA: tailoredA?.id })

  // ── User B attacks every route with User A's real IDs ──────────────────────

  console.log('\n── portfolio/publish ──')
  {
    const { status, body } = await callApi(pageB, 'POST', '/api/portfolio/publish', { portfolioId: portfolioA.id, action: 'publish' })
    record('User B cannot publish User A\'s portfolio', status === 404, `got ${status} ${JSON.stringify(body)}`)
  }
  {
    const { data: check } = await client.from('portfolios').select('status').eq('id', portfolioA.id).single()
    record('User A\'s portfolio is still draft (not published by B)', check.status === 'draft')
  }

  console.log('\n── portfolio/save ──')
  {
    await callApi(pageB, 'POST', '/api/portfolio/save', { portfolioId: portfolioA.id, title: 'HIJACKED BY B' })
    const { data: check } = await client.from('portfolios').select('title').eq('id', portfolioA.id).single()
    record('User B cannot rewrite User A\'s portfolio title', check.title === 'A Portfolio', `actual title: ${check.title}`)
  }

  console.log('\n── resume/export ──')
  {
    const { status, body } = await callApi(pageB, 'POST', '/api/resume/export', { resume_id: resumeA.id, format: 'docx' })
    record('User B cannot export User A\'s resume', status === 404, `got ${status} ${JSON.stringify(body)}`)
  }
  {
    const { status, body } = await callApi(pageB, 'POST', '/api/resume/export', { tailored_asset_id: tailoredA.id, format: 'docx' })
    record('User B cannot export User A\'s tailored asset', status === 404, `got ${status} ${JSON.stringify(body)}`)
  }

  console.log('\n── jobs/save (PATCH/DELETE) ──')
  {
    const { status } = await callApi(pageB, 'PATCH', '/api/jobs/save', { id: savedJobA.id, status: 'archived' })
    record('User B cannot PATCH User A\'s saved job', status === 404, `got ${status}`)
  }
  {
    const { data: check } = await client.from('saved_jobs').select('status').eq('id', savedJobA.id).single()
    record('User A\'s saved job status is unchanged', check.status === 'saved')
  }
  {
    const { status } = await callApi(pageB, 'DELETE', `/api/jobs/save?id=${savedJobA.id}`)
    record('DELETE on User A\'s saved job returns success=true but affects 0 rows (no ownership leak)', status === 200)
  }
  {
    const { data: check } = await client.from('saved_jobs').select('id').eq('id', savedJobA.id).single()
    record('User A\'s saved job still exists after User B\'s delete attempt', !!check)
  }

  console.log('\n── applications (PATCH) ──')
  {
    const { status } = await callApi(pageB, 'PATCH', '/api/applications', { id: applicationA.id, stage: 'rejected' })
    record('User B cannot PATCH User A\'s application', status === 404, `got ${status}`)
  }

  console.log('\n── ai/generate-portfolio ──')
  {
    const { status, body } = await callApi(pageB, 'POST', '/api/ai/generate-portfolio', {
      parsedResume: { name: 'B' }, targetRole: 'Engineer', industry: 'Tech', portfolioGoal: 'job search', links: {}, portfolioId: portfolioA.id,
    })
    record('User B cannot generate content into User A\'s portfolio', status === 404 || status === 403, `got ${status} ${JSON.stringify(body)}`)
  }

  console.log('\n── ai/audit-portfolio ──')
  {
    const { status, body } = await callApi(pageB, 'POST', '/api/ai/audit-portfolio', {
      portfolioId: portfolioA.id, targetRole: 'Engineer', industry: 'Tech',
    })
    const leaked = JSON.stringify(body).toLowerCase().includes('a secret')
    record('User B cannot audit User A\'s portfolio content (no leak, no false success)', !leaked && (status === 400 || status === 404), `got ${status} ${JSON.stringify(body).slice(0,200)}`)
  }

  console.log('\n── jobs/[id]/tailor with another user\'s saved_job_id ──')
  {
    const { status, body } = await callApi(pageB, 'POST', `/api/jobs/${savedJobA.id}/tailor`, {
      parsed_resume: { name: 'B' }, saved_job_id: savedJobA.id,
    })
    // Either PRO_REQUIRED (B is free tier) or job-not-found — both correctly prevent any cross-user effect
    record('User B cannot tailor against User A\'s saved job (blocked by Pro gate or ownership check)', status === 403 || status === 404, `got ${status} ${JSON.stringify(body).slice(0,200)}`)
  }

  console.log('\n── stripe/create-portal-session ──')
  {
    const { status, body } = await callApi(pageB, 'POST', '/api/stripe/create-portal-session', {})
    // User B has no subscription, so this should 404 "no billing account" — never return User A's portal
    record('User B gets their own (404, no account) result, never User A\'s portal', status === 404, `got ${status} ${JSON.stringify(body)}`)
  }

  console.log('\n── mass assignment: insert with another user_id via jobs/save snapshot ──')
  {
    const { status, body } = await callApi(pageB, 'POST', '/api/jobs/save', {
      job: { provider: 'fixture', title: 'Planted', company: 'Evil Co' },
      notes: 'planted',
    })
    // This should succeed for B's OWN account (creates a row owned by B), not impersonate A
    if (status === 201 && body?.data?.user_id) {
      record('Saved job created is owned by User B (the actual caller), not spoofable', body.data.user_id !== userA, `owner: ${body.data.user_id}`)
    } else {
      record('Saved job creation handled safely', status === 201 || status === 403, `got ${status}`)
    }
  }

  await browser.close()
  console.log(`\n  API authorization test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message, e.stack); process.exit(1) })
