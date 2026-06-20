#!/usr/bin/env node
// Real adversarial tests against the live webhook route using properly-signed (but
// synthetic) Stripe events — generateTestHeaderString produces a real HMAC signature
// against the real STRIPE_WEBHOOK_SECRET, so this exercises actual signature
// verification, not a mock. Tests duplicate delivery, replay, out-of-order events,
// and invalid signatures.
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

function fakeSubscriptionEvent({ id, type, userId, customerId, subscriptionId, status, createdAt }) {
  const payload = JSON.stringify({
    id,
    object: 'event',
    type,
    created: Math.floor(createdAt / 1000),
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status,
        cancel_at_period_end: false,
        metadata: { user_id: userId },
        items: { data: [{ price: { id: 'price_fake_test' }, current_period_end: Math.floor((createdAt + 30 * 86400000) / 1000) }] },
      },
    },
  })
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
  return { payload, header }
}

async function post(payload, signatureHeader) {
  const res = await fetch(`${APP_URL}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signatureHeader },
    body: payload,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function main() {
  const anon = createClient(URL, ANON_KEY)
  const service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })
  const suffix = Date.now()
  const email = `webhook-test-${suffix}@example.com`
  const { data: signup, error } = await anon.auth.signUp({ email, password: 'TestPassword123!' })
  if (error) throw new Error('signup failed: ' + error.message)
  const userId = signup.user.id
  const customerId = `cus_fake_${suffix}`
  const subscriptionId = `sub_fake_${suffix}`

  console.log('Test user:', userId)

  // ── Invalid signature ──
  {
    const { payload } = fakeSubscriptionEvent({ id: `evt_${suffix}_bad`, type: 'customer.subscription.updated', userId, customerId, subscriptionId, status: 'active', createdAt: Date.now() })
    const res = await fetch(`${APP_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=forged_signature_not_real' },
      body: payload,
    })
    record('Invalid signature is rejected (400)', res.status === 400, `got ${res.status}`)
  }

  // ── Real signed event applies correctly ──
  const t0 = Date.now()
  const evt1 = fakeSubscriptionEvent({ id: `evt_${suffix}_1`, type: 'customer.subscription.updated', userId, customerId, subscriptionId, status: 'active', createdAt: t0 })
  {
    const { status, body } = await post(evt1.payload, evt1.header)
    record('First delivery of a real signed event is accepted', status === 200 && !body?.duplicate, `got ${status} ${JSON.stringify(body)}`)
  }
  {
    const { data } = await service.from('subscriptions').select('status, last_webhook_event_at').eq('user_id', userId).single()
    record('Subscription status applied correctly', data?.status === 'active', `got ${data?.status}`)
  }

  // ── Exact duplicate delivery (same event id) ──
  {
    const { status, body } = await post(evt1.payload, evt1.header)
    record('Duplicate delivery of the same event id is recognized and short-circuited', status === 200 && body?.duplicate === true, `got ${status} ${JSON.stringify(body)}`)
  }

  // ── Newer event applies, then an older (out-of-order) event must NOT regress state ──
  const t1 = t0 + 60_000 // 1 minute later
  const evt2 = fakeSubscriptionEvent({ id: `evt_${suffix}_2`, type: 'customer.subscription.updated', userId, customerId, subscriptionId, status: 'past_due', createdAt: t1 })
  await post(evt2.payload, evt2.header)
  {
    const { data } = await service.from('subscriptions').select('status').eq('user_id', userId).single()
    record('Newer event (t1, past_due) applied correctly', data?.status === 'past_due', `got ${data?.status}`)
  }

  // Now deliver an OLDER event (t0-equivalent but different event id, simulating a late/replayed-from-retry-queue delivery)
  const evt3Old = fakeSubscriptionEvent({ id: `evt_${suffix}_3_old`, type: 'customer.subscription.updated', userId, customerId, subscriptionId, status: 'active', createdAt: t0 - 10_000 })
  await post(evt3Old.payload, evt3Old.header)
  {
    const { data } = await service.from('subscriptions').select('status').eq('user_id', userId).single()
    record('Out-of-order older event does NOT regress newer status (still past_due)', data?.status === 'past_due', `got ${data?.status}`)
  }

  console.log(`\n  Stripe webhook test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message, e.stack); process.exit(1) })
