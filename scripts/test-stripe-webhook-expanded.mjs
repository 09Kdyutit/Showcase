#!/usr/bin/env node
// Deterministic Stripe money-state suite. It deliberately makes no Stripe API calls: HMAC
// verification uses a synthetic local signing secret, provider objects are fixtures, and all
// durable-state tests are restricted to the disposable loopback Supabase stack.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  processClaimedStripeEvent,
  validatePaidCheckoutEntitlement,
} from '../src/lib/stripe/webhook-events.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const CONFIG = {
  monthlyPriceId: 'price_monthly_local_fixture',
  annualPriceId: 'price_annual_local_fixture',
  foundingPriceId: 'price_founding_local_fixture',
}

let PASS = 0
let FAIL = 0

async function test(label, fn) {
  try {
    await fn()
    console.log(`  ✅ ${label}`)
    PASS++
  } catch (error) {
    console.log(`  ❌ ${label} — ${error instanceof Error ? error.message : String(error)}`)
    FAIL++
  }
}

function subscription(overrides = {}) {
  const id = overrides.id ?? 'sub_good'
  const customer = overrides.customer ?? 'cus_good'
  const userId = overrides.userId === undefined ? 'user_good' : overrides.userId
  const plan = overrides.plan === undefined ? 'monthly' : overrides.plan
  const priceId = overrides.priceId ?? CONFIG.monthlyPriceId
  const metadata = { ...(overrides.metadata ?? {}) }
  if (userId !== null) metadata.user_id = userId
  if (plan !== null) metadata.plan = plan
  return {
    id,
    object: 'subscription',
    customer,
    created: overrides.created ?? 1_750_000_000,
    status: overrides.status ?? 'active',
    cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
    metadata,
    items: {
      object: 'list',
      data: overrides.items ?? [{
        id: `si_${id}`,
        object: 'subscription_item',
        current_period_end: 1_800_000_000,
        price: { id: priceId, object: 'price' },
      }],
      has_more: false,
      url: `/v1/subscription_items?subscription=${id}`,
    },
  }
}

function checkoutSession(sub, overrides = {}) {
  const metadata = { ...(overrides.metadata ?? {}) }
  if (!('user_id' in metadata)) metadata.user_id = overrides.userId ?? 'user_good'
  if (!('plan' in metadata)) metadata.plan = overrides.plan ?? 'monthly'
  if (overrides.reservationId) metadata.founding_reservation_id = overrides.reservationId
  return {
    id: overrides.id ?? 'cs_good',
    object: 'checkout.session',
    mode: overrides.mode ?? 'subscription',
    payment_status: overrides.paymentStatus ?? 'paid',
    customer: overrides.customer ?? 'cus_good',
    subscription: overrides.subscription === undefined ? sub.id : overrides.subscription,
    metadata,
  }
}

function event(type, object, id = `evt_${type.replaceAll('.', '_')}`) {
  return {
    id,
    object: 'event',
    type,
    created: 1_760_000_000,
    data: { object },
  }
}

function fakeActions(options = {}) {
  const state = {
    applied: [],
    deleted: [],
    activated: [],
    released: [],
    recorded: [],
    order: [],
  }
  const subscriptions = options.subscriptions ?? new Map()
  return {
    state,
    actions: {
      retrieveSubscription: async (subscriptionId) => {
        const value = subscriptions.get(subscriptionId)
        if (!value) throw new Error(`fixture subscription not found: ${subscriptionId}`)
        return value
      },
      resolveCustomerUserId: async (customerId) => {
        if (options.customerUsers?.has(customerId)) return options.customerUsers.get(customerId)
        return customerId === 'cus_good' ? 'user_good' : null
      },
      applySubscriptionSnapshot: async (input) => {
        state.order.push('apply')
        state.applied.push(input)
        return options.applyResult ?? true
      },
      applySubscriptionDeletion: async (input) => {
        state.order.push('delete')
        state.deleted.push(input)
        return options.applyResult ?? true
      },
      activateFoundingSlot: async (input) => {
        state.order.push('activate')
        state.activated.push(input)
        return options.activateResult ?? true
      },
      releaseFoundingSlot: async (input) => {
        state.order.push('release')
        state.released.push(input)
        return options.releaseResult ?? true
      },
      recordCheckoutCompleted: async (input) => {
        state.order.push('record')
        state.recorded.push(input)
      },
    },
  }
}

async function expectReject(promise, pattern) {
  await assert.rejects(promise, pattern)
}

async function runSignatureAndWiringTests() {
  console.log('\nStripe signature and route wiring')
  const signingSecret = ['whsec', 'local', 'deterministic', 'fixture'].join('_')
  const stripe = new Stripe('STRIPE_NETWORK_DISABLED_FOR_THIS_SUITE')
  const payload = JSON.stringify(event('showcase.fixture', { id: 'fixture' }, 'evt_signature_fixture'))
  const now = Math.floor(Date.now() / 1000)
  const validHeader = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: signingSecret,
    timestamp: now,
  })

  await test('valid HMAC signature is accepted', () => {
    const verified = stripe.webhooks.constructEvent(payload, validHeader, signingSecret)
    assert.equal(verified.id, 'evt_signature_fixture')
  })
  await test('tampered payload is rejected', () => {
    assert.throws(
      () => stripe.webhooks.constructEvent(`${payload} `, validHeader, signingSecret),
      /signature/i,
    )
  })
  await test('forged signature is rejected', () => {
    assert.throws(
      () => stripe.webhooks.constructEvent(payload, `t=${now},v1=forged`, signingSecret),
      /signature/i,
    )
  })
  await test('valid but stale signature is rejected by timestamp tolerance', () => {
    const staleHeader = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: signingSecret,
      timestamp: now - 301,
    })
    assert.throws(
      () => stripe.webhooks.constructEvent(payload, staleHeader, signingSecret),
      /timestamp/i,
    )
  })

  const route = readFileSync(join(ROOT, 'src/app/api/stripe/webhook/route.ts'), 'utf8')
  const reconcile = readFileSync(join(ROOT, 'src/app/api/stripe/reconcile-session/route.ts'), 'utf8')
  await test('route verifies the raw body before claiming or processing', () => {
    const signatureAt = route.indexOf('constructEvent(body, signature')
    const claimAt = route.indexOf("rpc('claim_webhook_event'")
    const processAt = route.indexOf('processClaimedStripeEvent(event')
    assert.ok(route.includes("request.headers.get('stripe-signature')"))
    assert.ok(signatureAt >= 0 && signatureAt < claimAt && claimAt < processAt)
  })
  await test('route leaves failed handlers reclaimable and marks success processed', () => {
    assert.ok(route.includes("status: 'failed'"))
    assert.ok(route.includes("status: 'processed'"))
    assert.ok(route.includes('p_stale_after_seconds: 300'))
  })
  await test('return-session reconciliation uses the same entitlement validator', () => {
    assert.ok(reconcile.includes('validatePaidCheckoutEntitlement(session, subscription'))
    assert.ok(reconcile.includes('expectedUserId: user.id'))
  })
}

async function runHandlerFixtureTests() {
  console.log('\nDeterministic webhook event fixtures')

  await test('subscription update re-reads provider state and applies it', async () => {
    const current = subscription()
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await processClaimedStripeEvent(event('customer.subscription.updated', current), actions, CONFIG)
    assert.equal(state.applied.length, 1)
    assert.equal(state.applied[0].userId, 'user_good')
  })

  await test('conflicting event/current user metadata fails closed', async () => {
    const current = subscription()
    const stale = subscription({ userId: 'user_wrong' })
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await expectReject(
      processClaimedStripeEvent(event('customer.subscription.updated', stale), actions, CONFIG),
      /Showcase user metadata conflicts/,
    )
    assert.equal(state.applied.length, 0)
  })

  await test('entitlement-bearing subscription on an unknown price fails closed', async () => {
    const current = subscription({ priceId: 'price_not_configured' })
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await expectReject(
      processClaimedStripeEvent(event('customer.subscription.updated', current), actions, CONFIG),
      /configured Showcase price/,
    )
    assert.equal(state.applied.length, 0)
  })

  await test('subscription deletion delegates state and unpublish to one atomic action', async () => {
    const deleted = subscription({ status: 'canceled' })
    const { actions, state } = fakeActions()
    await processClaimedStripeEvent(event('customer.subscription.deleted', deleted), actions, CONFIG)
    assert.deepEqual(state.order, ['delete'])
    assert.equal(state.deleted[0].statusOverride, 'canceled')
  })

  await test('stale deletion is a benign atomic no-op', async () => {
    const deleted = subscription({ status: 'canceled' })
    const { actions, state } = fakeActions({ applyResult: false })
    await processClaimedStripeEvent(event('customer.subscription.deleted', deleted), actions, CONFIG)
    assert.equal(state.deleted.length, 1)
    assert.deepEqual(state.order, ['delete'])
  })

  for (const invoiceType of ['invoice.payment_failed', 'invoice.paid', 'invoice.payment_succeeded']) {
    await test(`${invoiceType} re-reads and applies the current subscription`, async () => {
      const current = subscription({ status: invoiceType === 'invoice.payment_failed' ? 'past_due' : 'active' })
      const invoice = {
        id: `in_${invoiceType}`,
        object: 'invoice',
        customer: 'cus_good',
        parent: { subscription_details: { subscription: current.id } },
      }
      const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
      await processClaimedStripeEvent(event(invoiceType, invoice), actions, CONFIG)
      assert.equal(state.applied.length, 1)
      assert.equal(state.applied[0].subscription.status, current.status)
    })
  }

  await test('one-time invoice event without a subscription is ignored', async () => {
    const invoice = { id: 'in_one_time', object: 'invoice', customer: 'cus_good', parent: null }
    const { actions, state } = fakeActions()
    await processClaimedStripeEvent(event('invoice.paid', invoice), actions, CONFIG)
    assert.equal(state.applied.length, 0)
  })

  await test('invoice customer conflicting with subscription customer fails closed', async () => {
    const current = subscription()
    const invoice = {
      id: 'in_wrong_customer',
      object: 'invoice',
      customer: 'cus_wrong',
      parent: { subscription_details: { subscription: current.id } },
    }
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await expectReject(
      processClaimedStripeEvent(event('invoice.payment_failed', invoice), actions, CONFIG),
      /Stripe customer metadata conflicts/,
    )
    assert.equal(state.applied.length, 0)
  })

  await test('unpaid Checkout completion grants nothing', async () => {
    const current = subscription()
    const session = checkoutSession(current, { paymentStatus: 'unpaid' })
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG)
    assert.equal(state.applied.length, 0)
    assert.equal(state.recorded.length, 0)
  })

  await test('paid monthly Checkout applies entitlement then records conversion', async () => {
    const current = subscription()
    const session = checkoutSession(current)
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG)
    assert.deepEqual(state.order, ['apply', 'record'])
    assert.equal(state.recorded[0].plan, 'monthly')
    assert.equal(state.recorded[0].priceId, CONFIG.monthlyPriceId)
  })

  await test('Checkout user metadata conflicting with subscription/customer fails closed', async () => {
    const current = subscription()
    const session = checkoutSession(current, { userId: 'user_wrong' })
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await expectReject(
      processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG),
      /Showcase user metadata conflicts/,
    )
    assert.equal(state.applied.length, 0)
  })

  await test('Checkout customer conflicting with subscription fails closed', async () => {
    const current = subscription()
    const session = checkoutSession(current, { customer: 'cus_wrong' })
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await expectReject(
      processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG),
      /Stripe customer metadata conflicts/,
    )
    assert.equal(state.applied.length, 0)
  })

  await test('Checkout on a wrong price fails closed', async () => {
    const current = subscription({ priceId: 'price_not_configured' })
    const session = checkoutSession(current)
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await expectReject(
      processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG),
      /not a configured Showcase price/,
    )
    assert.equal(state.applied.length, 0)
  })

  await test('Checkout plan metadata conflicting with actual price fails closed', async () => {
    const current = subscription({ plan: 'annual' })
    const session = checkoutSession(current, { plan: 'annual' })
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await expectReject(
      processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG),
      /plan metadata conflicts/,
    )
    assert.equal(state.applied.length, 0)
  })

  await test('Checkout and retrieved subscription id mismatch fails closed', async () => {
    const sessionReference = subscription({ id: 'sub_reference' })
    const returned = subscription({ id: 'sub_different' })
    const session = checkoutSession(sessionReference)
    const { actions } = fakeActions({ subscriptions: new Map([[sessionReference.id, returned]]) })
    await expectReject(
      processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG),
      /subscription ids conflict/,
    )
  })

  await test('paid Founding Checkout activates capacity before access and conversion', async () => {
    const reservationId = '00000000-0000-4000-8000-000000000001'
    const current = subscription({
      id: 'sub_founding',
      plan: 'founding',
      priceId: CONFIG.foundingPriceId,
      metadata: { founding_reservation_id: reservationId },
    })
    const session = checkoutSession(current, {
      id: 'cs_founding',
      plan: 'founding',
      reservationId,
    })
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG)
    assert.deepEqual(state.order, ['activate', 'apply', 'record'])
    assert.equal(state.activated[0].reservationId, reservationId)
    assert.equal(state.recorded[0].plan, 'founding')
  })

  await test('Founding Checkout missing reservation metadata fails closed', async () => {
    const current = subscription({
      id: 'sub_founding_missing',
      plan: 'founding',
      priceId: CONFIG.foundingPriceId,
    })
    const session = checkoutSession(current, { plan: 'founding' })
    const { actions, state } = fakeActions({ subscriptions: new Map([[current.id, current]]) })
    await expectReject(
      processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG),
      /missing its reservation id/,
    )
    assert.equal(state.applied.length, 0)
  })

  await test('Founding activation failure grants no subscription access', async () => {
    const reservationId = '00000000-0000-4000-8000-000000000002'
    const current = subscription({
      id: 'sub_founding_rejected',
      plan: 'founding',
      priceId: CONFIG.foundingPriceId,
      metadata: { founding_reservation_id: reservationId },
    })
    const session = checkoutSession(current, { plan: 'founding', reservationId })
    const { actions, state } = fakeActions({
      subscriptions: new Map([[current.id, current]]),
      activateResult: false,
    })
    await expectReject(
      processClaimedStripeEvent(event('checkout.session.completed', session), actions, CONFIG),
      /Could not activate/,
    )
    assert.deepEqual(state.order, ['activate'])
  })

  await test('expired Founding Checkout releases its hold with an auditable reason', async () => {
    const session = checkoutSession(subscription(), {
      plan: 'founding',
      reservationId: '00000000-0000-4000-8000-000000000003',
    })
    const { actions, state } = fakeActions({ releaseResult: true })
    await processClaimedStripeEvent(event('checkout.session.expired', session), actions, CONFIG)
    assert.equal(state.released[0].reason, 'checkout_session_expired')
  })

  await test('out-of-order expiry after activation is benign', async () => {
    const session = checkoutSession(subscription(), {
      plan: 'founding',
      reservationId: '00000000-0000-4000-8000-000000000004',
    })
    const { actions, state } = fakeActions({ releaseResult: false })
    await processClaimedStripeEvent(event('checkout.session.expired', session), actions, CONFIG)
    assert.equal(state.released.length, 1)
  })

  await test('reconciliation validator rejects an unexpected signed-in user', async () => {
    const current = subscription()
    const session = checkoutSession(current)
    await expectReject(
      validatePaidCheckoutEntitlement(session, current, {
        expectedUserId: 'user_other',
        config: CONFIG,
        resolveCustomerUserId: async () => 'user_good',
      }),
      /Showcase user metadata conflicts/,
    )
  })
}

function requireLocalSupabase() {
  let parsed
  try {
    parsed = new URL(LOCAL_URL)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must point to the disposable local Supabase stack')
  }
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || parsed.port !== '54321') {
    throw new Error(`refusing non-local Supabase target: ${parsed.origin}`)
  }
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for the local suite')
  return createClient(LOCAL_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

async function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function runDatabaseTests() {
  console.log('\nDisposable local Supabase claims, ordering, and Founding capacity')
  const service = requireLocalSupabase()
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`
  const eventPrefix = `evt_expanded_${suffix}`
  const userIds = []
  const slotIds = []
  let originalConfig = null

  const createUser = async (label) => {
    const data = await must(await service.auth.admin.createUser({
      email: `stripe-expanded-${label}-${suffix}@example.com`,
      password: 'LocalOnlyPassword123!',
      email_confirm: true,
    }), `create ${label} user`)
    userIds.push(data.user.id)
    return data.user.id
  }
  const claim = async (id, type = 'showcase.expanded_fixture') => must(
    await service.rpc('claim_webhook_event', {
      p_event_id: id,
      p_event_type: type,
      p_stale_after_seconds: 300,
    }),
    `claim ${id}`,
  )
  const apply = async (userId, customerId, subscriptionId, input) => must(
    await service.rpc('apply_subscription_snapshot', {
      p_user_id: userId,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscriptionId,
      p_subscription_created_at: new Date(input.subscriptionCreatedAt).toISOString(),
      p_status: input.status,
      p_price_id: CONFIG.monthlyPriceId,
      p_current_period_end: new Date(input.eventCreatedAt + 30 * 86_400_000).toISOString(),
      p_cancel_at_period_end: false,
      p_event_created_at: new Date(input.eventCreatedAt).toISOString(),
      p_event_id: input.eventId,
    }),
    `apply ${input.eventId}`,
  )
  const applyDeletion = async (userId, customerId, subscriptionId, input) => must(
    await service.rpc('apply_subscription_deletion', {
      p_user_id: userId,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscriptionId,
      p_subscription_created_at: new Date(input.subscriptionCreatedAt).toISOString(),
      p_price_id: CONFIG.monthlyPriceId,
      p_current_period_end: new Date(input.eventCreatedAt + 30 * 86_400_000).toISOString(),
      p_cancel_at_period_end: false,
      p_event_created_at: new Date(input.eventCreatedAt).toISOString(),
      p_event_id: input.eventId,
    }),
    `delete ${input.eventId}`,
  )

  try {
    const newId = `${eventPrefix}_new`
    await test('new webhook event is exclusively claimed', async () => {
      assert.equal(await claim(newId), 'claimed')
    })
    await must(await service.from('processed_webhook_events').update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('event_id', newId), 'mark claimed event processed')
    await test('processed duplicate is short-circuited', async () => {
      assert.equal(await claim(newId), 'processed')
    })

    const busyId = `${eventPrefix}_busy`
    await must(await service.from('processed_webhook_events').insert({
      event_id: busyId,
      event_type: 'showcase.expanded_fixture',
      status: 'processing',
      attempt_count: 1,
      processed_at: null,
      updated_at: new Date().toISOString(),
    }), 'seed busy claim')
    await test('concurrent in-flight duplicate returns busy', async () => {
      assert.equal(await claim(busyId), 'busy')
    })

    const failedId = `${eventPrefix}_failed`
    await must(await service.from('processed_webhook_events').insert({
      event_id: failedId,
      event_type: 'showcase.expanded_fixture',
      status: 'failed',
      attempt_count: 1,
      processed_at: null,
      last_error: 'synthetic failure',
      updated_at: new Date().toISOString(),
    }), 'seed failed claim')
    await test('failed delivery is immediately reclaimable as a retry', async () => {
      assert.equal(await claim(failedId), 'claimed')
      const row = await must(await service.from('processed_webhook_events')
        .select('status, attempt_count, last_error')
        .eq('event_id', failedId)
        .single(), 'read reclaimed failure')
      assert.deepEqual(row, { status: 'processing', attempt_count: 2, last_error: null })
    })

    const staleId = `${eventPrefix}_stale`
    await must(await service.from('processed_webhook_events').insert({
      event_id: staleId,
      event_type: 'showcase.expanded_fixture',
      status: 'processing',
      attempt_count: 1,
      processed_at: null,
      updated_at: new Date(Date.now() - 301_000).toISOString(),
    }), 'seed stale claim')
    await test('abandoned processing claim is reclaimable after timeout', async () => {
      assert.equal(await claim(staleId), 'claimed')
      const row = await must(await service.from('processed_webhook_events')
        .select('attempt_count')
        .eq('event_id', staleId)
        .single(), 'read stale retry')
      assert.equal(row.attempt_count, 2)
    })

    const orderingUserId = await createUser('ordering')
    const customerId = `cus_local_${suffix}`
    const firstSubscriptionId = `sub_local_${suffix}`
    const t0 = Date.now()
    await test('initial active subscription snapshot applies', async () => {
      assert.equal(await apply(orderingUserId, customerId, firstSubscriptionId, {
        status: 'active',
        subscriptionCreatedAt: t0 - 10_000,
        eventCreatedAt: t0,
        eventId: `${eventPrefix}_state_initial`,
      }), true)
    })
    await test('older out-of-order snapshot is rejected', async () => {
      assert.equal(await apply(orderingUserId, customerId, firstSubscriptionId, {
        status: 'past_due',
        subscriptionCreatedAt: t0 - 10_000,
        eventCreatedAt: t0 - 1_000,
        eventId: `${eventPrefix}_state_older`,
      }), false)
      const row = await must(await service.from('subscriptions').select('status')
        .eq('user_id', orderingUserId).single(), 'read state after stale event')
      assert.equal(row.status, 'active')
    })
    await test('newer invoice-style state transition wins', async () => {
      assert.equal(await apply(orderingUserId, customerId, firstSubscriptionId, {
        status: 'past_due',
        subscriptionCreatedAt: t0 - 10_000,
        eventCreatedAt: t0 + 1_000,
        eventId: `${eventPrefix}_invoice_failed`,
      }), true)
    })
    const portfolioId = await must(await service.from('portfolios').insert({
      user_id: orderingUserId,
      slug: `stripe-expanded-${suffix}`,
      title: 'Stripe expanded fixture',
      status: 'published',
      published_at: new Date().toISOString(),
    }).select('id').single(), 'create published portfolio')
    await test('subscription deletion and portfolio unpublish commit atomically', async () => {
      const timestamp = t0 + 2_000
      assert.equal(await applyDeletion(orderingUserId, customerId, firstSubscriptionId, {
        subscriptionCreatedAt: t0 - 10_000,
        eventCreatedAt: timestamp,
        eventId: `${eventPrefix}_terminal`,
      }), true)
      const [subscriptionRow, portfolioRow] = await Promise.all([
        must(await service.from('subscriptions').select('status')
          .eq('user_id', orderingUserId).single(), 'read canceled subscription'),
        must(await service.from('portfolios').select('status, published_at')
          .eq('id', portfolioId.id).single(), 'read unpublished portfolio'),
      ])
      assert.equal(subscriptionRow.status, 'canceled')
      assert.deepEqual(portfolioRow, { status: 'draft', published_at: null })
    })
    await test('lost-response deletion retry repeats the idempotent unpublish', async () => {
      await must(await service.from('portfolios').update({
        status: 'published',
        published_at: new Date().toISOString(),
      }).eq('id', portfolioId.id), 're-publish retry fixture')
      assert.equal(await applyDeletion(orderingUserId, customerId, firstSubscriptionId, {
        subscriptionCreatedAt: t0 - 10_000,
        eventCreatedAt: t0 + 2_000,
        eventId: `${eventPrefix}_terminal`,
      }), true)
      const row = await must(await service.from('portfolios').select('status, published_at')
        .eq('id', portfolioId.id).single(), 'read retry-unpublished portfolio')
      assert.deepEqual(row, { status: 'draft', published_at: null })
    })
    await test('same-second terminal state cannot regress to active', async () => {
      const timestamp = t0 + 2_000
      assert.equal(await apply(orderingUserId, customerId, firstSubscriptionId, {
        status: 'active',
        subscriptionCreatedAt: t0 - 10_000,
        eventCreatedAt: timestamp,
        eventId: `${eventPrefix}_zz_active`,
      }), false)
    })
    await test('late deletion of old subscription cannot replace a newer subscription', async () => {
      const replacementId = `sub_replacement_${suffix}`
      assert.equal(await apply(orderingUserId, customerId, replacementId, {
        status: 'active',
        subscriptionCreatedAt: t0 + 5_000,
        eventCreatedAt: t0 + 5_000,
        eventId: `${eventPrefix}_replacement`,
      }), true)
      await must(await service.from('portfolios').update({
        status: 'published',
        published_at: new Date().toISOString(),
      }).eq('id', portfolioId.id), 'publish replacement fixture')
      assert.equal(await applyDeletion(orderingUserId, customerId, firstSubscriptionId, {
        subscriptionCreatedAt: t0 - 10_000,
        eventCreatedAt: t0 + 10_000,
        eventId: `${eventPrefix}_old_delete_late`,
      }), false)
      const [subscriptionRow, portfolioRow] = await Promise.all([
        must(await service.from('subscriptions').select('status, stripe_subscription_id')
          .eq('user_id', orderingUserId).single(), 'read replacement state'),
        must(await service.from('portfolios').select('status')
          .eq('id', portfolioId.id).single(), 'read replacement portfolio'),
      ])
      assert.deepEqual(subscriptionRow, { status: 'active', stripe_subscription_id: replacementId })
      assert.equal(portfolioRow.status, 'published')
    })

    originalConfig = await must(await service.from('founding_member_config')
      .select('reservations_paused, slot_limit, reservation_ttl_minutes')
      .eq('id', 1)
      .single(), 'read Founding config')
    const existingLive = await must(await service.from('founding_member_slots')
      .select('id')
      .in('status', ['reserved', 'checkout_created', 'active']), 'check existing Founding slots')
    assert.equal(existingLive.length, 0, 'local stack must not contain unrelated live Founding slots')
    await must(await service.from('founding_member_config').update({
      reservations_paused: true,
      slot_limit: 2,
      reservation_ttl_minutes: 120,
    }).eq('id', 1), 'prepare Founding config')

    const foundingUsers = await Promise.all([
      createUser('founding-a'),
      createUser('founding-b'),
      createUser('founding-c'),
    ])
    const reserve = async (userId) => must(await service.rpc('reserve_founding_member_slot', {
      p_user_id: userId,
    }), `reserve slot for ${userId}`)

    await test('paused Founding offer returns no reservation', async () => {
      assert.deepEqual(await reserve(foundingUsers[0]), [])
    })
    await must(await service.from('founding_member_config')
      .update({ reservations_paused: false }).eq('id', 1), 'unpause Founding test')

    const reservations = await Promise.all(foundingUsers.map((userId) => reserve(userId)))
    for (const rows of reservations) {
      if (rows[0]?.reservation_id) slotIds.push(rows[0].reservation_id)
    }
    await test('concurrent Founding holds never exceed configured capacity', () => {
      assert.equal(reservations.filter((rows) => rows.length === 1).length, 2)
      assert.equal(reservations.filter((rows) => rows.length === 0).length, 1)
    })
    const winnerIndexes = reservations
      .map((rows, index) => ({ rows, index }))
      .filter(({ rows }) => rows.length === 1)
    const firstWinner = winnerIndexes[0]
    const secondWinner = winnerIndexes[1]
    const loserIndex = reservations.findIndex((rows) => rows.length === 0)
    const firstReservation = firstWinner.rows[0]
    const secondReservation = secondWinner.rows[0]

    await test('repeated reservation by one user is idempotent', async () => {
      const repeated = await reserve(foundingUsers[firstWinner.index])
      assert.equal(repeated[0].reservation_id, firstReservation.reservation_id)
    })
    await test('wrong user cannot attach a Checkout Session to another hold', async () => {
      const attached = await must(await service.rpc('attach_founding_checkout_session', {
        p_reservation_id: firstReservation.reservation_id,
        p_user_id: foundingUsers[secondWinner.index],
        p_checkout_session_id: `cs_wrong_${suffix}`,
      }), 'wrong-user attach')
      assert.equal(attached, false)
    })
    const checkoutSessionId = `cs_local_${suffix}`
    const foundingSubscriptionId = `sub_founding_local_${suffix}`
    await test('correct user can attach one immutable Checkout Session', async () => {
      assert.equal(await must(await service.rpc('attach_founding_checkout_session', {
        p_reservation_id: firstReservation.reservation_id,
        p_user_id: foundingUsers[firstWinner.index],
        p_checkout_session_id: checkoutSessionId,
      }), 'correct attach'), true)
      assert.equal(await must(await service.rpc('attach_founding_checkout_session', {
        p_reservation_id: firstReservation.reservation_id,
        p_user_id: foundingUsers[firstWinner.index],
        p_checkout_session_id: `cs_conflict_${suffix}`,
      }), 'conflicting attach'), false)
    })
    await test('paid activation requires the exact reservation user and session', async () => {
      assert.equal(await must(await service.rpc('activate_founding_member_slot', {
        p_reservation_id: firstReservation.reservation_id,
        p_user_id: foundingUsers[firstWinner.index],
        p_checkout_session_id: `cs_wrong_${suffix}`,
        p_subscription_id: foundingSubscriptionId,
      }), 'wrong-session activation'), false)
      assert.equal(await must(await service.rpc('activate_founding_member_slot', {
        p_reservation_id: firstReservation.reservation_id,
        p_user_id: foundingUsers[firstWinner.index],
        p_checkout_session_id: checkoutSessionId,
        p_subscription_id: foundingSubscriptionId,
      }), 'correct activation'), true)
    })
    await test('duplicate paid activation is idempotent', async () => {
      assert.equal(await must(await service.rpc('activate_founding_member_slot', {
        p_reservation_id: firstReservation.reservation_id,
        p_user_id: foundingUsers[firstWinner.index],
        p_checkout_session_id: checkoutSessionId,
        p_subscription_id: foundingSubscriptionId,
      }), 'duplicate activation'), true)
    })
    await test('out-of-order expiry/release cannot regress an active Founding slot', async () => {
      assert.equal(await must(await service.rpc('release_founding_member_slot', {
        p_reservation_id: firstReservation.reservation_id,
        p_user_id: foundingUsers[firstWinner.index],
        p_reason: 'checkout_session_expired',
      }), 'release active slot'), false)
      const row = await must(await service.from('founding_member_slots').select('status')
        .eq('id', firstReservation.reservation_id).single(), 'read active slot')
      assert.equal(row.status, 'active')
    })
    await test('released unpaid hold immediately restores one capacity slot', async () => {
      assert.equal(await must(await service.rpc('release_founding_member_slot', {
        p_reservation_id: secondReservation.reservation_id,
        p_user_id: foundingUsers[secondWinner.index],
        p_reason: 'fixture_release',
      }), 'release unpaid hold'), true)
      const replacement = await reserve(foundingUsers[loserIndex])
      assert.equal(replacement.length, 1)
      slotIds.push(replacement[0].reservation_id)
    })

    const loserSlotId = slotIds.at(-1)
    await must(await service.from('founding_member_slots').update({
      expires_at: new Date(Date.now() - 1_000).toISOString(),
    }).eq('id', loserSlotId), 'age replacement hold')
    await test('expired unpaid hold is reclaimed and restores availability', async () => {
      const expiredCount = await must(await service.rpc('expire_founding_member_slots'), 'expire holds')
      assert.equal(expiredCount, 1)
      const availability = await must(await service.rpc('get_founding_member_availability'), 'read availability')
      assert.deepEqual(availability.map((row) => ({
        claimed: row.claimed_count,
        remaining: row.remaining_count,
      })), [{ claimed: 1, remaining: 1 }])
    })
  } finally {
    if (slotIds.length > 0) {
      await service.from('founding_member_slots').delete().in('id', [...new Set(slotIds)])
    }
    if (originalConfig) {
      await service.from('founding_member_config').update(originalConfig).eq('id', 1)
    }
    await service.from('processed_webhook_events').delete().like('event_id', `${eventPrefix}%`)
    for (const userId of userIds) await service.auth.admin.deleteUser(userId).catch(() => {})
  }
}

async function main() {
  const configuredStripeKey = process.env.STRIPE_SECRET_KEY ?? ''
  if (configuredStripeKey.startsWith('sk_live_')) {
    console.log('Safety: configured Stripe key is LIVE, so this suite will not use it or contact Stripe.')
  } else if (configuredStripeKey.startsWith('sk_test_')) {
    console.log('Safety: a test-mode Stripe key is present, but deterministic fixtures require no provider calls.')
  } else {
    console.log('Safety: no recognized Stripe key is used; deterministic fixtures require no provider calls.')
  }

  await runSignatureAndWiringTests()
  await runHandlerFixtureTests()
  await runDatabaseTests()

  console.log(`\n  Expanded Stripe webhook suite: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(`SCRIPT ERROR: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
