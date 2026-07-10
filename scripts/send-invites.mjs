// Controlled-release invite operator. DRY RUN BY DEFAULT — previews the oldest eligible
// people and changes nothing. --send calls the authenticated batch endpoint, which still
// obeys growth_controls.invites_paused and daily_invite_limit.
//
//   Preview:  node --env-file=.env.local --experimental-strip-types scripts/send-invites.mjs --limit=15
//   Send:     node --env-file=.env.local --experimental-strip-types scripts/send-invites.mjs --limit=15 --send
//
// Picks the oldest 'waitlisted' signups first (fair — first in line). Marks each 'invited'
// (with invited_at) only after its email actually sends.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { betaInviteEmail } from '../src/lib/email/invite-email.ts'

const SEND = process.argv.includes('--send')
const limArg = process.argv.find((a) => a.startsWith('--limit='))
const LIMIT = Math.max(1, Math.min(100, limArg ? parseInt(limArg.split('=')[1], 10) : 10))
const APP_URL = process.env.INVITE_APP_URL || 'https://app.tryshowcase.ink'
const FROM = 'Showcase <hello@tryshowcase.ink>'
const POSTAL_ADDRESS = process.env.EMAIL_POSTAL_ADDRESS || '[EMAIL_POSTAL_ADDRESS required before sending]'
// Keep the same exclusion list configured on the deployment running the cron worker.
const EXCLUDE = new Set((process.env.INVITE_EXCLUDE || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Pull extra so exclusions still leave a full cohort of LIMIT.
const { data: pool, error } = await admin
  .from('waitlist_signups')
  .select('id, email, full_name, status, created_at, invite_token')
  .eq('status', 'waitlisted')
  .order('created_at', { ascending: true })
  .limit(LIMIT + EXCLUDE.size + 10)
if (error) { console.error('query failed:', error.message); process.exit(1) }
const people = pool.filter((p) => !EXCLUDE.has((p.email || '').toLowerCase())).slice(0, LIMIT)

console.log(`\n${SEND ? '🚀 SEND MODE — real emails will go out' : '🧪 DRY RUN — nothing is sent or changed'}`)
console.log(`App URL: ${APP_URL}   |   From: ${FROM}   |   Cohort size: ${people.length}\n`)

if (people.length === 0) { console.log('No one is waitlisted. Nothing to do.'); process.exit(0) }

// Render the first email to a file so you can open it and eyeball it.
if (!/^[a-f0-9]{48}$/.test(people[0].invite_token || '')) {
  console.error('The paced-admission migration is not applied: the next invite has no secure token.')
  process.exit(1)
}
const sample = betaInviteEmail(people[0].full_name, APP_URL, people[0].invite_token, POSTAL_ADDRESS)
const previewPath = '/tmp/invite-preview.html'
writeFileSync(previewPath, sample.html)
console.log(`Subject: "${sample.subject}"`)
console.log(`HTML preview written to: ${previewPath}  (open it in a browser)\n`)

console.log('Cohort (oldest signups first):')
people.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.email}${p.full_name ? `  (${p.full_name})` : ''}`))

if (!SEND) {
  console.log('\n— dry run only. Re-run with --send to actually invite these people. —')
  process.exit(0)
}

if (!process.env.CRON_SECRET) {
  console.error('CRON_SECRET is required in --send mode.')
  process.exit(1)
}
if (!process.env.EMAIL_POSTAL_ADDRESS?.trim()) {
  console.error('EMAIL_POSTAL_ADDRESS is required in --send mode.')
  process.exit(1)
}

const endpoint = new URL('/api/cron/invite-batch', APP_URL)
endpoint.searchParams.set('limit', String(LIMIT))
const response = await fetch(endpoint, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
const result = await response.json().catch(() => ({}))
if (!response.ok) {
  console.error(`Invite batch failed (${response.status}):`, result.error || 'unknown error')
  process.exit(1)
}
console.log(`\nDone: ${result.sent ?? 0} invited, ${result.failed ?? 0} failed, ${result.claimed ?? 0} claimed.`)
