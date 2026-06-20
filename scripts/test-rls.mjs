#!/usr/bin/env node
// Real, adversarial two-user RLS test. Signs up two genuine users via real auth (not
// service-role), has User A create real rows, then attempts every realistic cross-user
// access from User B's authenticated session: SELECT by known ID, UPDATE, DELETE, and
// INSERT-with-someone-else's-user_id (impersonation/mass-assignment). "RLS enabled" in
// the dashboard proves nothing — only a real second session attempting real access does.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let PASS = 0
let FAIL = 0
const results = []

function record(label, ok, detail) {
  results.push({ label, ok, detail })
  if (ok) PASS++; else FAIL++
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
}

async function signUp(email) {
  const client = createClient(URL, ANON_KEY)
  const { data, error } = await client.auth.signUp({ email, password: 'TestPassword123!' })
  if (error) throw new Error(`signup failed: ${error.message}`)
  return { client, userId: data.user.id }
}

async function main() {
  const suffix = Date.now()
  const a = await signUp(`rls-test-a-${suffix}@example.com`)
  const b = await signUp(`rls-test-b-${suffix}@example.com`)
  console.log('User A:', a.userId)
  console.log('User B:', b.userId)

  // ── User A creates real data ─────────────────────────────────────────────
  const { data: resumeA, error: resumeErr } = await a.client
    .from('resumes')
    .insert({ user_id: a.userId, title: 'Secret Resume A', raw_text: 'CONFIDENTIAL: SSN 123-45-6789' })
    .select()
    .single()
  if (resumeErr) throw new Error('setup: could not create resume as User A: ' + resumeErr.message)

  const { data: savedJobA } = await a.client
    .from('saved_jobs')
    .insert({ user_id: a.userId, imported_title: 'Secret Job A', imported_company: 'SecretCo', status: 'saved' })
    .select()
    .single()

  const { data: portfolioA } = await a.client
    .from('portfolios')
    .insert({ user_id: a.userId, slug: `secret-a-${suffix}`, title: 'Secret Portfolio A', status: 'draft', content: {} })
    .select()
    .single()

  const { data: auditA } = await a.client
    .from('audits')
    .insert({ user_id: a.userId, resume_id: resumeA.id, audit_type: 'proofscore', overall_score: 42, category_scores: {}, findings: [], recommendations: [] })
    .select()
    .single()

  const { data: tailoredA } = await a.client
    .from('tailored_assets')
    .insert({ user_id: a.userId, saved_job_id: savedJobA?.id ?? null, asset_type: 'application_kit', content: { secret: 'do not leak' }, truth_map: [] })
    .select()
    .single()

  console.log('\n── Cross-user SELECT ──')
  {
    const { data, error } = await b.client.from('resumes').select('*').eq('id', resumeA.id)
    record('User B cannot SELECT User A\'s resume by known ID', (data?.length ?? 0) === 0 && !error, JSON.stringify({ rows: data?.length, error: error?.message }))
  }
  {
    const { data } = await b.client.from('resumes').select('*')
    const leaked = (data ?? []).some(r => r.id === resumeA.id)
    record('User B\'s unfiltered resume list does not include User A\'s resume', !leaked)
  }
  {
    const { data } = await b.client.from('saved_jobs').select('*').eq('id', savedJobA.id)
    record('User B cannot SELECT User A\'s saved job by known ID', (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('portfolios').select('*').eq('id', portfolioA.id).eq('status', 'draft')
    record('User B cannot SELECT User A\'s unpublished draft portfolio', (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('audits').select('*').eq('id', auditA?.id ?? '')
    record('User B cannot SELECT User A\'s ProofScore audit', (data?.length ?? 0) === 0)
  }
  {
    const { data } = await b.client.from('tailored_assets').select('*').eq('id', tailoredA?.id ?? '')
    record('User B cannot SELECT User A\'s tailored application kit', (data?.length ?? 0) === 0)
  }

  console.log('\n── Cross-user UPDATE ──')
  {
    const { data, error } = await b.client.from('resumes').update({ title: 'HACKED' }).eq('id', resumeA.id).select()
    record('User B cannot UPDATE User A\'s resume', (data?.length ?? 0) === 0, error?.message)
  }
  {
    const { data: check } = await a.client.from('resumes').select('title').eq('id', resumeA.id).single()
    record('User A\'s resume title is unchanged after attempted hijack', check?.title === 'Secret Resume A')
  }

  console.log('\n── Cross-user DELETE ──')
  {
    const { data, error } = await b.client.from('saved_jobs').delete().eq('id', savedJobA.id).select()
    record('User B cannot DELETE User A\'s saved job', (data?.length ?? 0) === 0, error?.message)
  }
  {
    const { data: check } = await a.client.from('saved_jobs').select('id').eq('id', savedJobA.id).single()
    record('User A\'s saved job still exists after attempted deletion', !!check)
  }

  console.log('\n── Impersonation / mass-assignment (INSERT as someone else) ──')
  {
    const { data, error } = await b.client.from('resumes').insert({ user_id: a.userId, title: 'Planted by B', raw_text: 'x' }).select()
    record('User B cannot INSERT a row with User A\'s user_id', (data?.length ?? 0) === 0, error?.message)
  }

  console.log('\n── Published portfolio (intended public surface) ──')
  await a.client.from('portfolios').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', portfolioA.id)
  {
    const anon = createClient(URL, ANON_KEY)
    const { data } = await anon.from('portfolios').select('*').eq('id', portfolioA.id).eq('status', 'published')
    record('Anonymous client CAN read a portfolio explicitly marked published (intended)', (data?.length ?? 0) === 1)
  }
  {
    // Re-draft and confirm anon access is revoked
    await a.client.from('portfolios').update({ status: 'draft' }).eq('id', portfolioA.id)
    const anon = createClient(URL, ANON_KEY)
    const { data } = await anon.from('portfolios').select('*').eq('id', portfolioA.id)
    record('Anonymous client loses access once portfolio is reverted to draft', (data?.length ?? 0) === 0)
  }

  console.log(`\n  RLS adversarial test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
