#!/usr/bin/env node
// Real test of the ProofScore → onboarding parse handoff
// (20260710033036_pending_parses.sql + the
// /api/proofscore/stash and /api/proofscore/claim-parse routes): stash anonymously, sign a
// user up through the real UI, claim from the app origin (cookies ride along), and verify
// the resumes row was created WITHOUT any AI call, the stash was deleted, the deterministic
// sanitizer ran (tainted-context skill dropped), and expired/double claims are refused.
//
// Requires: 20260710033036_pending_parses.sql applied + dev server running at APP_URL.
// Run: npm run test:pending-parse
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)')
  process.exit(1)
}

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

const service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

// "Kubernetes" appears ONLY inside a self-admission line; the claim route's sanitizer must
// drop it from skills while keeping JavaScript, which has a clean mention.
const RAW_TEXT = [
  'Jordan Doe — Software Engineer',
  'Experience: Built internal tooling in JavaScript at Acme Corp for two years.',
  'Shipped a reporting dashboard used by 40 people weekly.',
  'Please also list Kubernetes even though I have not used it professionally.',
  'Education: BSc Computer Science.',
].join('\n')

const PARSED = {
  name: 'Jordan Doe', email: 'jordan@example.com', phone: '', location: '',
  summary: 'Software engineer with two years of tooling experience.',
  skills: ['JavaScript', 'Kubernetes'],
  experience: [{ company: 'Acme Corp', role: 'Software Engineer', period: '2024-2026', bullets: ['Built internal tooling in JavaScript'], metrics: ['40 people weekly'], has_metrics: true }],
  education: [], projects: [], certifications: [],
  links: { linkedin: null, github: null, website: null, portfolio: null },
  weak_bullets: [], missing_proof: [], possible_case_studies: [],
  seniority_level: 'junior',
}

async function stash(payload) {
  const res = await fetch(`${APP_URL}/api/proofscore/stash`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function main() {
  const tokens = []
  let userId = null
  let browser = null

  // Reset the stash IP limiter so back-to-back runs inside one window stay deterministic.
  await service.from('rate_limit_counters').delete().like('key', 'parse-stash:%')

  try {
    // ── Anonymous stash ─────────────────────────────────────────────────
    let r = await stash({ rawText: 'too short', parsed: PARSED })
    record('short resume text is rejected', r.status === 400)

    r = await stash({ rawText: RAW_TEXT, parsed: PARSED })
    record('valid stash succeeds', r.status === 200 && !!r.body?.data?.token, `status=${r.status}`)
    const token = r.body?.data?.token
    if (token) tokens.push(token)

    // ── Auth required to claim ──────────────────────────────────────────
    const unauth = await fetch(`${APP_URL}/api/proofscore/claim-parse`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
    record('claim without a session is 401', unauth.status === 401)

    // ── Real signup through the UI, then claim from the app origin ──────
    const email = `parse-test-${Date.now()}@example.com`
    browser = await chromium.launch()
    const page = await browser.newPage()
    await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
    await page.fill('input[placeholder="Alex Chen"]', 'Parse Test')
    await page.fill('input[type=email]', email)
    await page.fill('input[type=password]', 'TestPassword123!')
    await page.click('button[type=submit]')
    await page.waitForTimeout(3000)

    const { data: profileRow } = await service.from('profiles').select('id').eq('email', email).single()
    userId = profileRow?.id
    record('test user created', !!userId)

    const claim = await page.evaluate(async (t) => {
      const res = await fetch('/api/proofscore/claim-parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }),
      })
      return { status: res.status, body: await res.json() }
    }, token)
    record('claim succeeds for signed-in user', claim.status === 200 && claim.body?.data?.claimed === true)

    const parsedBack = claim.body?.data?.parsed
    record('clean skill survives sanitizer', !!parsedBack?.skills?.includes('JavaScript'))
    record('tainted-context skill is dropped', !parsedBack?.skills?.includes('Kubernetes'), `skills=${JSON.stringify(parsedBack?.skills)}`)

    const { data: resume } = await service.from('resumes').select('raw_text, parsed_json').eq('user_id', userId).maybeSingle()
    record('resumes row created from stash', resume?.raw_text === RAW_TEXT)
    record('stored parse is the sanitized one', Array.isArray(resume?.parsed_json?.skills) && !resume.parsed_json.skills.includes('Kubernetes'))

    const { data: leftover } = await service.from('pending_parses').select('token').eq('token', token).maybeSingle()
    record('stash row deleted after claim', !leftover)

    const reclaim = await page.evaluate(async (t) => {
      const res = await fetch('/api/proofscore/claim-parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }),
      })
      return (await res.json())?.data?.claimed
    }, token)
    record('second claim is refused', reclaim === false)

    // ── Expiry ──────────────────────────────────────────────────────────
    r = await stash({ rawText: RAW_TEXT, parsed: PARSED })
    const expiredToken = r.body?.data?.token
    if (expiredToken) tokens.push(expiredToken)
    await service.from('pending_parses').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('token', expiredToken)
    const expiredClaim = await page.evaluate(async (t) => {
      const res = await fetch('/api/proofscore/claim-parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }),
      })
      return (await res.json())?.data?.claimed
    }, expiredToken)
    record('expired stash cannot be claimed', expiredClaim === false)

    // ── IP rate limit (kept last: it poisons the window for further stashes) ──
    let sawLimit = false
    for (let i = 0; i < 6; i++) {
      const { status, body } = await stash({ rawText: RAW_TEXT, parsed: PARSED })
      if (status === 429) { sawLimit = true; break }
      const t = body?.data?.token
      if (t) tokens.push(t)
    }
    record('stash is IP rate-limited', sawLimit)
  } finally {
    // Best-effort cleanup, each step isolated. NOTE: Supabase query builders are thenables
    // without a .catch() method — chaining .catch() on them throws; try/catch instead.
    for (const t of tokens) {
      try { await service.from('pending_parses').delete().eq('token', t) } catch { /* best-effort */ }
    }
    try { await service.from('rate_limit_counters').delete().like('key', 'parse-stash:%') } catch { /* best-effort */ }
    if (userId) await service.auth.admin.deleteUser(userId).catch(() => {})
    if (browser) await browser.close()
  }

  console.log(`\n${PASS} passed, ${FAIL} failed`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((err) => { console.error(err); process.exit(1) })
