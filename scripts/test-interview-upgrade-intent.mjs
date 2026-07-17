import assert from 'node:assert/strict'
import {
  hasMatchingInterviewRetryCheckoutOrigin,
  interviewRetryCheckoutOriginValue,
  parseInterviewRetryUpgradeIntent,
  serializeInterviewRetryUpgradeIntent,
  shouldOfferInterviewUpgrade,
} from '../src/lib/interviews/upgrade-intent.ts'

const intent = {
  kind: 'retry',
  sessionId: '123e4567-e89b-42d3-a456-426614174000',
  questionId: '123e4567-e89b-42d3-a456-426614174001',
  answerText: 'A concrete retry answer.',
}

assert.deepEqual(
  parseInterviewRetryUpgradeIntent(serializeInterviewRetryUpgradeIntent(intent)),
  intent,
  'valid retry intent must round-trip without changing the draft'
)
assert.equal(parseInterviewRetryUpgradeIntent(null), null)
assert.equal(parseInterviewRetryUpgradeIntent('not-json'), null)
assert.equal(parseInterviewRetryUpgradeIntent(JSON.stringify({ ...intent, sessionId: '../billing' })), null)
assert.equal(parseInterviewRetryUpgradeIntent(JSON.stringify({ ...intent, answerText: '' })), null)
assert.equal(parseInterviewRetryUpgradeIntent(JSON.stringify({ ...intent, answerText: 'x'.repeat(10_001) })), null)
assert.equal(
  hasMatchingInterviewRetryCheckoutOrigin(interviewRetryCheckoutOriginValue(intent), intent),
  true,
  'a retry Checkout marker must be bound to the exact retained draft'
)
assert.equal(
  hasMatchingInterviewRetryCheckoutOrigin(
    interviewRetryCheckoutOriginValue({ ...intent, questionId: '123e4567-e89b-42d3-a456-426614174002' }),
    intent,
  ),
  false,
  'a marker for another retry must not take over this draft handoff'
)
assert.equal(hasMatchingInterviewRetryCheckoutOrigin(null, intent), false)
assert.equal(hasMatchingInterviewRetryCheckoutOrigin(interviewRetryCheckoutOriginValue(intent), null), false)

const allowedCodes = ['SESSION_LIMIT_REACHED', 'AUDIO_LIMIT_REACHED']
assert.equal(shouldOfferInterviewUpgrade({ status: 403, tier: 'free', code: 'SESSION_LIMIT_REACHED', allowedCodes }), true)
assert.equal(shouldOfferInterviewUpgrade({ status: 403, tier: 'free', code: 'AUDIO_LIMIT_REACHED', allowedCodes }), true)
assert.equal(shouldOfferInterviewUpgrade({ status: 403, tier: 'pro', code: 'SESSION_LIMIT_REACHED', allowedCodes }), false)
assert.equal(shouldOfferInterviewUpgrade({ status: 503, tier: 'free', code: 'SESSION_LIMIT_REACHED', allowedCodes }), false)
assert.equal(shouldOfferInterviewUpgrade({ status: 500, tier: 'free', code: 'SESSION_LIMIT_REACHED', allowedCodes }), false)
assert.equal(shouldOfferInterviewUpgrade({ status: 403, tier: undefined, code: 'SESSION_LIMIT_REACHED', allowedCodes }), false)
assert.equal(shouldOfferInterviewUpgrade({ status: 403, tier: 'free', code: 'RETRY_LIMIT_REACHED', allowedCodes }), false)

console.log('Interview upgrade-intent tests passed: 17/17')
