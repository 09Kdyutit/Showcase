// Controlled-release invite sender. DRY RUN BY DEFAULT — prints who would be invited and
// renders the email, and changes NOTHING. It only sends real email + marks people 'invited'
// when you pass --send explicitly.
//
//   Preview:  node --env-file=.env.local --experimental-strip-types scripts/send-invites.mjs --limit=15
//   Send:     node --env-file=.env.local --experimental-strip-types scripts/send-invites.mjs --limit=15 --send
//
// Picks the oldest 'waitlisted' signups first (fair — first in line). Marks each 'invited'
// (with invited_at) only after its email actually sends.
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { writeFileSync } from 'node:fs'
import { betaInviteEmail } from '../src/lib/email/invite-email.ts'

const SEND = process.argv.includes('--send')
const limArg = process.argv.find((a) => a.startsWith('--limit='))
const LIMIT = Math.max(1, Math.min(100, limArg ? parseInt(limArg.split('=')[1], 10) : 10))
const APP_URL = process.env.INVITE_APP_URL || 'https://showcase-app-three.vercel.app'
const FROM = 'Showcase <hello@tryshowcase.ink>'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: people, error } = await admin
  .from('waitlist_signups')
  .select('id, email, full_name, status, created_at')
  .eq('status', 'waitlisted')
  .order('created_at', { ascending: true })
  .limit(LIMIT)
if (error) { console.error('query failed:', error.message); process.exit(1) }

console.log(`\n${SEND ? '🚀 SEND MODE — real emails will go out' : '🧪 DRY RUN — nothing is sent or changed'}`)
console.log(`App URL: ${APP_URL}   |   From: ${FROM}   |   Cohort size: ${people.length}\n`)

if (people.length === 0) { console.log('No one is waitlisted. Nothing to do.'); process.exit(0) }

// Render the first email to a file so you can open it and eyeball it.
const sample = betaInviteEmail(people[0].full_name, APP_URL)
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

const resend = new Resend(process.env.RESEND_API_KEY)
let sent = 0, failed = 0
for (const p of people) {
  const { subject, html, text } = betaInviteEmail(p.full_name, APP_URL)
  try {
    const { error: sendErr } = await resend.emails.send({
      from: FROM, to: p.email, subject, html, text,
      tags: [{ name: 'type', value: 'beta_invite' }],
    })
    if (sendErr) throw new Error(sendErr.message || String(sendErr))
    await admin.from('waitlist_signups').update({ status: 'invited', invited_at: new Date().toISOString() }).eq('id', p.id)
    console.log(`  ✅ ${p.email}`)
    sent++
    await new Promise((r) => setTimeout(r, 600)) // gentle pacing for Resend
  } catch (e) {
    console.log(`  ❌ ${p.email} — ${e.message}`)
    failed++
  }
}
console.log(`\nDone: ${sent} invited, ${failed} failed.`)
