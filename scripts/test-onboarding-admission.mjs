#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  INVITE_STORAGE_KEY,
  REFERRAL_STORAGE_KEY,
  redeemPendingAdmission,
  selectPendingAdmission,
} from '../src/lib/onboarding/admission-gate.ts'

const INVITE = 'a'.repeat(48)
const REFERRAL = 'B'.repeat(32)

assert.deepEqual(selectPendingAdmission('', null, null), { kind: 'none' })
assert.deepEqual(selectPendingAdmission(`?invite=${INVITE}&ref=${REFERRAL}`, null, null), { kind: 'invite', token: INVITE })
assert.deepEqual(selectPendingAdmission(`?ref=${REFERRAL}`, INVITE, null), { kind: 'referral', code: REFERRAL })
assert.deepEqual(selectPendingAdmission('?invite=bad', null, REFERRAL), { kind: 'invalid', source: 'invite' })
assert.deepEqual(selectPendingAdmission(`?ref=${REFERRAL}`, null, null), { kind: 'referral', code: REFERRAL })
assert.deepEqual(selectPendingAdmission('', INVITE, REFERRAL), { kind: 'invite', token: INVITE })
assert.deepEqual(selectPendingAdmission('', null, REFERRAL), { kind: 'referral', code: REFERRAL })

let releaseInvite
const pendingInviteResponse = new Promise((resolve) => { releaseInvite = resolve })
let inviteSettled = false
const pendingInviteAttempt = redeemPendingAdmission(
  { kind: 'invite', token: INVITE },
  {
    redeemInvite: () => pendingInviteResponse,
    claimReferral: async () => { throw new Error('referral should not run') },
  },
).then((result) => { inviteSettled = true; return result })
await Promise.resolve()
assert.equal(inviteSettled, false, 'a callback stays pending until admission authority responds')
releaseInvite({ ok: true, status: 200 })
assert.deepEqual(await pendingInviteAttempt, { kind: 'granted', storageKey: INVITE_STORAGE_KEY })

assert.deepEqual(
  await redeemPendingAdmission(
    { kind: 'referral', code: REFERRAL },
    {
      redeemInvite: async () => { throw new Error('invite should not run') },
      claimReferral: async () => ({ ok: true, status: 200, claimed: true }),
    },
  ),
  { kind: 'granted', storageKey: REFERRAL_STORAGE_KEY },
)

assert.equal(
  (await redeemPendingAdmission(
    { kind: 'invite', token: INVITE },
    {
      redeemInvite: async () => ({ ok: false, status: 503 }),
      claimReferral: async () => { throw new Error('referral should not run') },
    },
  )).kind,
  'retry',
)

assert.equal(
  (await redeemPendingAdmission(
    { kind: 'referral', code: REFERRAL },
    {
      redeemInvite: async () => { throw new Error('invite should not run') },
      claimReferral: async () => ({ ok: false, status: 409, claimed: false }),
    },
  )).kind,
  'rejected',
)

assert.equal(
  (await redeemPendingAdmission(
    { kind: 'referral', code: REFERRAL },
    {
      redeemInvite: async () => { throw new Error('invite should not run') },
      claimReferral: async () => ({ ok: true, status: 200, claimed: false }),
    },
  )).kind,
  'retry',
  'an unproven 2xx keeps the referral retryable after a lost or truncated body',
)

console.log('Onboarding admission gate tests passed')
