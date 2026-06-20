#!/usr/bin/env node
// Real test: sign up a user, create real data across multiple tables + a real storage
// file, delete the account through the real route, then verify via service-role queries
// that every row is gone, the storage file is gone, and the auth user can no longer log in.
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function main() {
  const service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })
  const anon = createClient(URL, ANON_KEY)
  const email = `delete-test-${Date.now()}@example.com`
  const password = 'TestPassword123!'

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Delete Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', password)
  await page.click('button[type=submit]')
  await page.waitForTimeout(3000)

  const { data: profileRow } = await service.from('profiles').select('id').eq('email', email).single()
  const userId = profileRow.id
  console.log('Created user:', userId)

  // Seed real data across multiple tables
  await service.from('resumes').insert({ user_id: userId, title: 'Delete Me', raw_text: 'content' })
  await service.from('portfolios').insert({ user_id: userId, slug: `delete-test-${Date.now()}`, title: 'P', status: 'draft', content: {} })
  await service.from('saved_jobs').insert({ user_id: userId, imported_title: 'Job', imported_company: 'Co', status: 'saved' })
  await service.from('usage_events').insert({ user_id: userId, event_name: 'test_event', metadata: {} })

  // Real storage file
  const fileBuffer = Buffer.from('%PDF-1.4 fake resume content')
  await service.storage.from('resumes').upload(`${userId}/test-resume.pdf`, fileBuffer, { contentType: 'application/pdf' })

  const tablesBeforeCounts = {}
  for (const t of ['resumes', 'portfolios', 'saved_jobs', 'usage_events', 'profiles', 'subscriptions']) {
    const { count } = await service.from(t).select('id', { count: 'exact', head: true }).eq(t === 'profiles' ? 'id' : 'user_id', userId)
    tablesBeforeCounts[t] = count
  }
  console.log('Row counts before deletion:', tablesBeforeCounts)
  record('Seed data actually exists before deletion (sanity check)', Object.values(tablesBeforeCounts).some(c => c > 0))

  // ── Call the real deletion route through the real authenticated browser session ──
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    })
    return { status: res.status, body: await res.json().catch(() => null) }
  })
  console.log('Deletion API result:', result.status, JSON.stringify(result.body))
  record('Deletion API returns success', result.status === 200 && result.body?.success === true)

  await page.waitForTimeout(1500)

  // ── Verify everything is actually gone ──
  for (const t of ['resumes', 'portfolios', 'saved_jobs', 'usage_events', 'subscriptions']) {
    const { count } = await service.from(t).select('id', { count: 'exact', head: true }).eq('user_id', userId)
    record(`${t} has zero rows for deleted user (cascade worked)`, count === 0, `count: ${count}`)
  }
  {
    const { data } = await service.from('profiles').select('id').eq('id', userId).maybeSingle()
    record('profile row is gone', !data)
  }
  {
    const { data: files } = await service.storage.from('resumes').list(userId)
    record('storage files are gone', !files || files.length === 0, `remaining: ${files?.length ?? 0}`)
  }

  // ── Confirm the auth user genuinely can't log in anymore ──
  {
    const { data, error } = await anon.auth.signInWithPassword({ email, password })
    record('Deleted user cannot log in anymore', !!error && !data?.session, error?.message)
  }

  // ── Confirm the deletion route requires the exact confirmation text ──
  const page2 = await browser.newPage()
  const email2 = `delete-test-noconf-${Date.now()}@example.com`
  await page2.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page2.fill('input[placeholder="Alex Chen"]', 'No Confirm Test')
  await page2.fill('input[type=email]', email2)
  await page2.fill('input[type=password]', password)
  await page2.click('button[type=submit]')
  await page2.waitForTimeout(3000)
  {
    const result2 = await page2.evaluate(async () => {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'delete' }), // wrong case
      })
      return { status: res.status }
    })
    record('Wrong confirmation text is rejected (400, account NOT deleted)', result2.status === 400)
  }
  {
    const { data } = await service.from('profiles').select('id').eq('email', email2).maybeSingle()
    record('Account with wrong confirmation text still exists', !!data)
  }

  // ── Unauthenticated deletion attempt ──
  {
    const res = await fetch(`${APP_URL}/api/account/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    })
    record('Unauthenticated deletion request is rejected (401)', res.status === 401, `got ${res.status}`)
  }

  await browser.close()
  console.log(`\n  Account deletion test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message, e.stack); process.exit(1) })
