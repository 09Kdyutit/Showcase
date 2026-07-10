#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(ROOT, path), 'utf8')

// Executable models of the two money invariants: exactly three claims and five consumable
// calls total (not five extra calls for every feature after every reset).
const allocation = { limit: 3, used: 0 }
const claim = () => {
  if (allocation.used >= allocation.limit) return false
  allocation.used += 1
  return true
}
assert.deepEqual(Array.from({ length: 7 }, claim), [true, true, true, false, false, false, false])
assert.equal(allocation.used, 3)

let credits = 5
const spendCredit = () => credits > 0 ? (--credits, true) : false
assert.deepEqual(
  ['audit', 'resume', 'bullet', 'audit', 'jobs', 'resume'].map(spendCredit),
  [true, true, true, true, true, false],
)
assert.equal(credits, 0)

const migration = read('supabase/migrations/20260710033045_referral_invite_pacing.sql').toLowerCase()
for (const invariant of [
  'referral_invite_limit integer not null default 0',
  'referral_invites_used integer not null default 0',
  'referral_invites_used between 0 and referral_invite_limit',
  'for update',
  'referral_invites_used >= v_referrer.referral_invite_limit',
  'referral_invites_used = referral_invites_used + 1',
  "'showcase_admitted', true",
  "'showcase_admission_source', 'completion_referral'",
  'grant_referral_invites_after_completion',
  'credit_referrer_on_completion(new.user_id)',
  'to service_role',
]) {
  assert.ok(migration.includes(invariant), `missing referral pacing invariant: ${invariant}`)
}
assert.match(migration, /revoke all on function public\.claim_referral\(uuid, text\)[\s\S]*authenticated/)
assert.match(migration, /revoke all on function public\.grant_completion_referral_invites\(uuid, integer\)[\s\S]*authenticated/)

const hardening = read('supabase/migrations/20260710033046_referral_abuse_and_credit_hardening.sql').toLowerCase()
for (const invariant of [
  "referral_code ~ '^[a-f0-9]{32}$'",
  'referral_claimed_at timestamptz',
  "showcase-referral-claims",
  "v_auth_created_at < now() - interval '7 days'",
  "showcase_admitted",
  'return v_new_user.referred_by = v_referrer.id',
  'for update',
  'consume_ai_request_quota',
  'bonus_credits = bonus_credits - 1',
  'bonus_credits = least(bonus_credits + 1, 60)',
  "'user_limit'::text",
  "'global_limit'::text",
  "'showcase_admission_source', 'waitlist_invite'",
]) assert.ok(hardening.includes(invariant), `missing referral hardening invariant: ${invariant}`)

const claimRoute = read('src/app/api/referral/claim/route.ts')
assert.match(claimRoute, /PROFILE_PENDING/)
assert.match(claimRoute, /alreadyClaimed: true/)
assert.match(claimRoute, /REFERRAL_UNAVAILABLE/)
assert.match(claimRoute, /claimError/)
assert.match(claimRoute, /referral-claim-user:/)
assert.match(claimRoute, /referral-claim-ip:/)
assert.match(claimRoute, /\[A-Fa-f0-9\]\{32\}/)

const validateRoute = read('src/app/api/referral/validate/route.ts')
assert.match(validateRoute, /enforceAtomicLimit/)
assert.match(validateRoute, /30,/)

const signup = read('src/app/(auth)/signup/page.tsx')
assert.match(signup, /params\.has\('invite'\)/)
assert.match(signup, /localStorage\.setItem\('showcase_ref'/)

const proxy = read('src/proxy.ts')
assert.match(proxy, /'\/api\/referral'/)
assert.match(proxy, /isReferralEntry/)
assert.match(proxy, /\[A-F0-9\]\{32\}/)

const aiLimit = read('src/lib/ai/rate-limit.ts')
assert.match(aiLimit, /consume_ai_request_quota/)
assert.doesNotMatch(aiLimit, /effectiveMax\s*=\s*limit\.max\s*\+\s*bonus/)
assert.match(aiLimit, /status: 503/)

console.log('✓ referral invite pacing offline invariants passed')
