import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  buildInviteSignupUrl,
  generateAdmissionToken,
  generateWaitlistReferralCode,
  normalizeAdmissionToken,
} from '../src/lib/growth/admission.ts'
import { betaInviteEmail } from '../src/lib/email/invite-email.ts'
import { waitlistConfirmationEmail } from '../src/lib/email/waitlist-email.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(ROOT, path), 'utf8')

const tokens = new Set(Array.from({ length: 32 }, () => generateAdmissionToken()))
assert.equal(tokens.size, 32, 'admission tokens should be unique in a representative sample')
for (const token of tokens) assert.match(token, /^[a-f0-9]{48}$/)

const codes = new Set(Array.from({ length: 32 }, () => generateWaitlistReferralCode()))
assert.equal(codes.size, 32, 'waitlist referral codes should be unique in a representative sample')
for (const code of codes) assert.match(code, /^[A-F0-9]{12}$/)

const token = 'ab'.repeat(24)
assert.equal(normalizeAdmissionToken(token.toUpperCase()), token)
assert.equal(normalizeAdmissionToken('not-a-token'), null)
assert.equal(
  buildInviteSignupUrl('https://app.tryshowcase.ink', token),
  `https://app.tryshowcase.ink/signup?invite=${token}`
)

const email = betaInviteEmail('Taylor Example', 'https://app.tryshowcase.ink', token, '123 Example St, Test City, NY 10001')
assert.match(email.html, new RegExp(`signup\\?invite=${token}`))
assert.match(email.text, new RegExp(`signup\\?invite=${token}`))
assert.match(email.html, /123 Example St/)
assert.doesNotMatch(email.text, /Forward this/)

const hostileName = '<img\r\nBcc: victim@example.com>'
const hostileInvite = betaInviteEmail(hostileName, 'https://app.tryshowcase.ink', token, '123 Example St')
const hostileConfirmation = waitlistConfirmationEmail(hostileName)
assert.doesNotMatch(hostileInvite.subject, /[\r\n]/, 'invite subjects must reject header control characters')
assert.doesNotMatch(hostileInvite.html, /<img, your Showcase access/, 'invite names must be escaped in HTML')
assert.match(hostileInvite.html, /&lt;img/)
assert.doesNotMatch(hostileConfirmation.html, /<img, welcome/, 'confirmation names must be escaped in HTML')
assert.match(hostileConfirmation.html, /&lt;img/)

const migration = read('supabase/migrations/20260710033038_growth_admission.sql')
for (const invariant of [
  'invites_paused boolean not null default true',
  'pg_advisory_xact_lock',
  'for update skip locked',
  'order by w.created_at asc',
  "invite_token = null",
  "'showcase_admitted', true",
  'grant execute on function public.redeem_waitlist_admission',
]) assert.ok(migration.toLowerCase().includes(invariant.toLowerCase()), `missing migration invariant: ${invariant}`)

const joinRoute = read('src/app/api/waitlist/join/route.ts')
assert.ok(!joinRoute.includes('scheduledAt'), 'waitlist join must not schedule access directly')
assert.ok(!joinRoute.includes('waitlist_auto_invite'), 'legacy ten-minute auto invite must stay removed')
assert.ok(!joinRoute.includes('Math.random'), 'admission identifiers must be cryptographically generated')
assert.ok(joinRoute.includes('referred_by_signup_id'), 'incoming referral attribution must be separate')
assert.ok(joinRoute.includes('consent_granted_at'), 'waitlist consent must be persisted')
assert.match(joinRoute, /function publicSuccessResponse/)
assert.match(joinRoute, /EMAIL_POSTAL_ADDRESS/)
assert.doesNotMatch(joinRoute, /already_joined\s*:/, 'public response must not disclose membership')
assert.doesNotMatch(joinRoute, /referral_code:\s*(?:existing|racedExisting)/, 'public duplicate response must not disclose referral codes')
const existingBranch = joinRoute.slice(joinRoute.indexOf('if (existing)'), joinRoute.indexOf('const emailSuppressed'))
assert.doesNotMatch(existingBranch, /\.update\(/, 'an unverified duplicate submission must not mutate existing answers or consent')

const proxy = read('src/proxy.ts')
for (const path of [
  "'/'",
  "'/pricing'",
  "'/for-career-services'",
  '/api/cron/',
  '/api/email/unsubscribe',
  '/api/email/inbound',
  '/api/beta/feedback',
  '/api/interviews/reports/',
  '/p/',
  '/proof/',
  '/shared/',
]) assert.ok(proxy.includes(path), `lockdown allowance missing: ${path}`)
assert.ok(proxy.includes("'/resume-to-portfolio'"), 'public resume-to-portfolio page must bypass closed-beta lockdown')
assert.match(proxy, /WAITLIST_ALLOWED_PATH_PREFIXES\.some/,
  'closed beta must use prefix matching for published and token-authorized public routes')
assert.ok(proxy.includes('showcase_admitted'), 'lockdown must recognize admitted accounts')

const cron = read('src/app/api/cron/invite-batch/route.ts')
assert.ok(cron.includes('CRON_SECRET'), 'invite cron must require CRON_SECRET')
assert.ok(cron.includes('runInviteBatch'), 'invite cron must use the shared batch service')

console.log('✓ growth admission offline invariants passed')
