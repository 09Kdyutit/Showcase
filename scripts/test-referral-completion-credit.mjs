#!/usr/bin/env node
// Real test against the DB through 20260710033046_referral_abuse_and_credit_hardening.sql:
// three-slot admission, high-entropy codes,
// new-account-only claims, concurrent replay idempotency, durable completion payout, and
// true one-use bonus-credit consumption.
//
// Requires: canonical versions 20260710033035 through 20260710033046 applied.
// Run: npm run test:referral-credit
import { createClient } from '@supabase/supabase-js'

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

async function createUser(tag) {
  const email = `ref-test-${tag}-${Date.now()}@example.com`
  const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true, password: 'TestPassword123!' })
  if (error) throw error
  const id = data.user.id
  // handle_new_user trigger creates the profile; poll briefly for it.
  for (let i = 0; i < 20; i++) {
    const { data: prof } = await service.from('profiles').select('id').eq('id', id).maybeSingle()
    if (prof) return id
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`profile for ${tag} never appeared`)
}

const profile = async (id) =>
  (await service.from('profiles').select('referral_code, referred_by, referral_count, bonus_credits, referral_credited_at, referral_claimed_at, referral_invite_limit, referral_invites_used').eq('id', id).single()).data

async function main() {
  const cleanup = []
  try {
    const referrer = await createUser('referrer')
    const friend = await createUser('friend')
    const stranger = await createUser('stranger')
    cleanup.push(referrer, friend, stranger)

    // Completion is what earns the real three-slot allocation.
    await service.from('portfolios').insert({
      user_id: referrer, slug: `ref-test-owner-${Date.now()}`, title: 'Owner', status: 'draft',
      ai_generated_at: new Date().toISOString(), content: {},
    })
    const referrerBefore = await profile(referrer)
    const refCode = referrerBefore.referral_code
    const strangerCode = (await profile(stranger)).referral_code
    record('completion grants exactly three invitations', referrerBefore.referral_invite_limit === 3 && referrerBefore.referral_invites_used === 0)
    record('member bearer code has 128 bits of entropy', /^[A-F0-9]{32}$/.test(refCode), refCode)

    // ── Attribution guards ──────────────────────────────────────────────
    let { data: claimed } = await service.rpc('claim_referral', { p_new_user: friend, p_code: '0'.repeat(32) })
    record('unknown code is rejected', claimed === false)

    ;({ data: claimed } = await service.rpc('claim_referral', { p_new_user: referrer, p_code: refCode }))
    record('self-referral is rejected', claimed === false)

    ;({ data: claimed } = await service.rpc('claim_referral', { p_new_user: friend, p_code: refCode }))
    record('valid claim succeeds', claimed === true)

    let friendProf = await profile(friend)
    let refProf = await profile(referrer)
    record('invited user gets +5 at signup', friendProf.bonus_credits === 5, `bonus=${friendProf.bonus_credits}`)
    record('attribution recorded', friendProf.referred_by === referrer)
    record('immutable claim marker recorded', friendProf.referral_claimed_at !== null)
    record('payout NOT made at signup', refProf.bonus_credits === 0, `referrer bonus=${refProf.bonus_credits}`)
    record('referral_count advances at signup', refProf.referral_count === 1)
    record('one real invite slot is consumed', refProf.referral_invites_used === 1)
    record('credited_at still null before completion', friendProf.referral_credited_at === null)

    const [replayA, replayB] = await Promise.all([
      service.rpc('claim_referral', { p_new_user: friend, p_code: refCode }),
      service.rpc('claim_referral', { p_new_user: friend, p_code: refCode }),
    ])
    refProf = await profile(referrer)
    record('concurrent same-code replays are idempotent success', replayA.data === true && replayB.data === true)
    record('concurrent replay does not consume more capacity', refProf.referral_invites_used === 1 && refProf.referral_count === 1)

    ;({ data: claimed } = await service.rpc('claim_referral', { p_new_user: friend, p_code: strangerCode }))
    record('re-attribution is rejected', claimed === false)

    await service.auth.admin.updateUserById(stranger, { app_metadata: { showcase_admitted: true } })
    ;({ data: claimed } = await service.rpc('claim_referral', { p_new_user: stranger, p_code: refCode }))
    refProf = await profile(referrer)
    record('already-admitted account cannot claim', claimed === false && refProf.referral_invites_used === 1)

    // ── Completion-time payout ──────────────────────────────────────────
    let { data: paid } = await service.rpc('credit_referrer_on_completion', { p_completed_user: friend })
    record('no payout without a generated portfolio', paid === false)

    // A draft with no AI generation is not a completion.
    await service.from('portfolios').insert({
      user_id: friend, slug: `ref-test-draft-${Date.now()}`, title: 'Draft', status: 'draft', content: {},
    })
    ;({ data: paid } = await service.rpc('credit_referrer_on_completion', { p_completed_user: friend }))
    record('ungenerated draft does not pay', paid === false)

    await service.from('portfolios').insert({
      user_id: friend, slug: `ref-test-${Date.now()}`, title: 'P', status: 'draft',
      ai_generated_at: new Date().toISOString(), content: {},
    })

    refProf = await profile(referrer)
    friendProf = await profile(friend)
    record('completion trigger durably pays referrer +5', refProf.bonus_credits === 5, `bonus=${refProf.bonus_credits}`)
    record('completion trigger stamps credited_at', friendProf.referral_credited_at !== null)
    record('friend completion also grants their three invites', friendProf.referral_invite_limit === 3)

    ;({ data: paid } = await service.rpc('credit_referrer_on_completion', { p_completed_user: friend }))
    refProf = await profile(referrer)
    record('second call is a no-op (idempotent)', paid === false && refProf.bonus_credits === 5)

    // ── Lifetime cap ────────────────────────────────────────────────────
    await service.from('profiles').update({ bonus_credits: 58 }).eq('id', referrer)
    await service.from('profiles').update({ referral_credited_at: null }).eq('id', friend)
    ;({ data: paid } = await service.rpc('credit_referrer_on_completion', { p_completed_user: friend }))
    refProf = await profile(referrer)
    record('lifetime bonus caps at 60', paid === true && refProf.bonus_credits === 60, `bonus=${refProf.bonus_credits}`)

    // ── Non-referred completer ──────────────────────────────────────────
    await service.from('portfolios').insert({
      user_id: stranger, slug: `ref-test-s-${Date.now()}`, title: 'P', status: 'draft',
      ai_generated_at: new Date().toISOString(), content: {},
    })
    ;({ data: paid } = await service.rpc('credit_referrer_on_completion', { p_completed_user: stranger }))
    record('non-referred completer pays nobody', paid === false)

    // One base request plus five stored credits allows exactly six total calls in this
    // isolated window. Credits are shared across event types in the real balance; this
    // single event proves each over-base request decrements it once and only once.
    const quotaResults = []
    for (let i = 0; i < 7; i++) {
      quotaResults.push(await service.rpc('consume_ai_request_quota', {
        p_user_id: friend,
        p_event_name: 'referral_test',
        p_window_seconds: 3600,
        p_base_max: 1,
        p_global_max: 1000000,
        p_allow_bonus: true,
      }))
    }
    friendProf = await profile(friend)
    record('five credits buy exactly five over-base calls', quotaResults.slice(0, 6).every((r) => r.data?.[0]?.allowed === true) && quotaResults[6].data?.[0]?.allowed === false)
    record('bonus balance is consumed to zero', friendProf.bonus_credits === 0, `bonus=${friendProf.bonus_credits}`)

    // ── Old publish-time function is gone ───────────────────────────────
    const { error: droppedErr } = await service.rpc('credit_referrer_on_publish', { p_published_user: friend })
    record('publish-time payout function is dropped', droppedErr !== null)
  } finally {
    for (const id of cleanup) {
      await service.auth.admin.deleteUser(id).catch(() => {})
    }
  }

  console.log(`\n${PASS} passed, ${FAIL} failed`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((err) => { console.error(err); process.exit(1) })
