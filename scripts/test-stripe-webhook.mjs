#!/usr/bin/env node
// Adversarial production-route + database test. Synthetic unknown events exercise real
// Stripe HMAC verification and retry claims without asking Stripe for fake objects. Mutable
// subscription ordering is exercised directly through the same atomic RPC used by the
// webhook, including concurrent/reversed snapshots and replacement subscriptions.
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!WEBHOOK_SECRET || !URL || !ANON_KEY || !SERVICE_KEY || !process.env.STRIPE_SECRET_KEY) {
  console.error('Stripe, Supabase, and webhook environment variables are required.')
  process.exit(1)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
let PASS = 0
let FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) PASS++
  else FAIL++
}

function fakeUnknownEvent(id, createdAt = Date.now()) {
  const payload = JSON.stringify({
    id,
    object: 'event',
    type: 'showcase.test_unknown',
    created: Math.floor(createdAt / 1000),
    data: { object: { id: `obj_${id}`, object: 'showcase_test' } },
  })
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
  return { payload, header }
}

async function post(payload, signatureHeader) {
  const response = await fetch(`${APP_URL}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signatureHeader },
    body: payload,
  })
  return { status: response.status, body: await response.json().catch(() => null) }
}

async function main() {
  const anon = createClient(URL, ANON_KEY)
  const service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })
  const suffix = Date.now()
  const email = `webhook-test-${suffix}@example.com`
  const { data: signup, error } = await anon.auth.signUp({ email, password: 'TestPassword123!' })
  if (error || !signup.user) throw new Error(`signup failed: ${error?.message ?? 'missing user'}`)
  const userId = signup.user.id
  const customerId = `cus_fake_${suffix}`
  const subscriptionId = `sub_fake_${suffix}`
  const t0 = Date.now()

  try {
    console.log('Test user:', userId)

    // Invalid signature and exact-event replay still run through the public route.
    const bad = fakeUnknownEvent(`evt_${suffix}_bad`)
    const badResponse = await fetch(`${APP_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=forged_signature_not_real' },
      body: bad.payload,
    })
    record('Invalid signature is rejected', badResponse.status === 400, `got ${badResponse.status}`)

    const first = fakeUnknownEvent(`evt_${suffix}_first`)
    const firstResponse = await post(first.payload, first.header)
    record('First signed event is processed', firstResponse.status === 200 && !firstResponse.body?.duplicate, JSON.stringify(firstResponse.body))
    const duplicateResponse = await post(first.payload, first.header)
    record('Exact duplicate is short-circuited', duplicateResponse.status === 200 && duplicateResponse.body?.duplicate === true, JSON.stringify(duplicateResponse.body))

    const retryEventId = `evt_${suffix}_retry`
    await service.from('processed_webhook_events').upsert({
      event_id: retryEventId,
      event_type: 'showcase.test_unknown',
      status: 'failed',
      attempt_count: 1,
      processed_at: null,
      last_error: 'synthetic previous failure',
      updated_at: new Date(t0 - 60_000).toISOString(),
    })
    const retry = fakeUnknownEvent(retryEventId)
    const retryResponse = await post(retry.payload, retry.header)
    const { data: retryRow } = await service
      .from('processed_webhook_events')
      .select('status, attempt_count')
      .eq('event_id', retryEventId)
      .single()
    record('Failed event is reclaimable', retryResponse.status === 200 && retryRow?.status === 'processed' && retryRow?.attempt_count === 2, JSON.stringify(retryRow))

    const apply = (input) => service.rpc('apply_subscription_snapshot', {
      p_user_id: userId,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: input.subscriptionId ?? subscriptionId,
      p_subscription_created_at: new Date(input.subscriptionCreatedAt ?? t0 - 5_000).toISOString(),
      p_status: input.status,
      p_price_id: 'price_fake_test',
      p_current_period_end: new Date(t0 + 30 * 86400_000).toISOString(),
      p_cancel_at_period_end: false,
      p_event_created_at: new Date(input.eventCreatedAt).toISOString(),
      p_event_id: input.eventId,
    })

    const firstSnapshot = await apply({ status: 'active', eventCreatedAt: t0, eventId: `evt_${suffix}_state_1` })
    record('Initial subscription snapshot applies', !firstSnapshot.error && firstSnapshot.data === true, firstSnapshot.error?.message)

    // Race two snapshots deliberately. The newer timestamp must win independent of commit order.
    const [newer, older] = await Promise.all([
      apply({ status: 'past_due', eventCreatedAt: t0 + 60_000, eventId: `evt_${suffix}_state_2` }),
      apply({ status: 'active', eventCreatedAt: t0 - 10_000, eventId: `evt_${suffix}_state_old` }),
    ])
    record('Concurrent snapshots complete without RPC errors', !newer.error && !older.error, newer.error?.message || older.error?.message)
    let { data: row } = await service
      .from('subscriptions')
      .select('status, stripe_subscription_id')
      .eq('user_id', userId)
      .single()
    record('Newer snapshot wins the race', row?.status === 'past_due', `got ${row?.status}`)

    // Same-second active must not outrank a terminal snapshot of the same subscription.
    await apply({ status: 'canceled', eventCreatedAt: t0 + 120_000, eventId: `evt_${suffix}_terminal` })
    await apply({ status: 'active', eventCreatedAt: t0 + 120_000, eventId: `evt_${suffix}_late_active_zz` })
    ;({ data: row } = await service.from('subscriptions').select('status, stripe_subscription_id').eq('user_id', userId).single())
    record('Same-second terminal state cannot regress to active', row?.status === 'canceled', `got ${row?.status}`)

    // A newer replacement subscription must survive a delayed deletion of the old one.
    const replacementId = `sub_replacement_${suffix}`
    await apply({
      subscriptionId: replacementId,
      subscriptionCreatedAt: t0 + 180_000,
      status: 'active',
      eventCreatedAt: t0 + 180_000,
      eventId: `evt_${suffix}_replacement`,
    })
    await apply({
      subscriptionId,
      subscriptionCreatedAt: t0 - 5_000,
      status: 'canceled',
      eventCreatedAt: t0 + 240_000,
      eventId: `evt_${suffix}_old_deleted_late`,
    })
    ;({ data: row } = await service.from('subscriptions').select('status, stripe_subscription_id').eq('user_id', userId).single())
    record('Late deletion of old subscription cannot replace the newer one', row?.status === 'active' && row?.stripe_subscription_id === replacementId, JSON.stringify(row))
  } finally {
    await service.auth.admin.deleteUser(userId).catch(() => {})
  }

  console.log(`\n  Stripe webhook test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('SCRIPT ERROR:', error.message, error.stack)
  process.exit(1)
})
