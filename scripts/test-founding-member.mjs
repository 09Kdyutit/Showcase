import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(ROOT, path), 'utf8')

const migration = read('supabase/migrations/042_founding_member_slots.sql')
for (const invariant of [
  'reservations_paused boolean not null default true',
  'slot_limit integer not null default 10',
  'slot_limit between 1 and 10',
  'pg_advisory_xact_lock',
  "status in ('reserved', 'checkout_created', 'active')",
  'expire_founding_member_slots',
  'reserve_founding_member_slot',
  'attach_founding_checkout_session',
  'release_founding_member_slot',
  'activate_founding_member_slot',
  'get_founding_member_availability',
  'grant execute on function public.activate_founding_member_slot',
]) assert.ok(migration.toLowerCase().includes(invariant.toLowerCase()), `missing migration invariant: ${invariant}`)

const checkout = read('src/app/api/stripe/create-checkout-session/route.ts')
const reserveAt = checkout.indexOf("rpc('reserve_founding_member_slot'")
const createAt = checkout.indexOf('stripe.checkout.sessions.create')
const attachAt = checkout.indexOf("rpc('attach_founding_checkout_session'")
assert.ok(reserveAt >= 0 && reserveAt < createAt, 'slot must be reserved before Stripe session creation')
assert.ok(attachAt > createAt, 'Stripe session must be attached after creation')
assert.ok(checkout.includes("requestedPlan === 'founding'"), 'checkout must accept the founding plan')
assert.ok(checkout.includes('STRIPE_PRICE_ID_FOUNDING_ANNUAL'), 'founding checkout must require its dedicated price')
assert.ok(checkout.includes('founding_reservation_id'), 'reservation id must be attached to Stripe metadata')
assert.ok(checkout.includes('founding-checkout-${foundingReservation.reservation_id}'), 'Stripe creation must be idempotent per reservation')
assert.ok(checkout.includes('pro-checkout-${user.id}-${plan}-'), 'standard checkout must also be idempotent')
assert.ok(checkout.includes('SUBSCRIPTION_EXISTS'), 'existing subscriptions must not create duplicate checkout sessions')
assert.ok(checkout.includes("rpc('release_founding_member_slot'"), 'pre-creation failures must release the slot')
assert.ok(checkout.includes('!stripeSessionCreated'), 'a payable Stripe session must keep capacity reserved')
assert.ok(checkout.includes('isAmbiguousStripeCreationError'), 'ambiguous Stripe failures must hold capacity until expiry')
assert.ok(checkout.includes('trackAsync('), 'checkout analytics must use the service-backed tracker')
assert.ok(!checkout.includes("from('usage_events')"), 'checkout must not write revoked usage_events directly')

const stripeClient = read('src/lib/stripe/client.ts')
assert.ok(stripeClient.includes("onConflict: 'user_id'"), 'customer persistence must upsert on the real unique user key')
assert.ok(stripeClient.includes('showcase-customer:${userId}:'), 'customer creation must use a retry-safe idempotency key')
assert.ok(stripeClient.includes("error.code !== 'resource_missing'"), 'provider outages must not create replacement customers')

const availability = read('src/app/api/stripe/founding-availability/route.ts')
assert.ok(availability.indexOf('auth.getUser()') < availability.indexOf('STRIPE_PRICE_ID_FOUNDING_ANNUAL'), 'availability must authenticate before configuration checks')
assert.ok(availability.includes("rpc('get_founding_member_availability')"), 'availability must read the atomic capacity function')
assert.ok(availability.includes("'Cache-Control': 'private, no-store'"), 'availability must never be cached')
assert.ok(availability.includes('remaining: null'), 'unconfigured availability must not expose a stale count')

const webhook = read('src/app/api/stripe/webhook/route.ts')
const webhookPaidAt = webhook.indexOf("session.payment_status === 'paid'")
const webhookActivationAt = webhook.indexOf("'activate_founding_member_slot'")
const webhookTrustedAt = webhook.indexOf("eventName: 'checkout_completed'")
assert.ok(webhookPaidAt >= 0 && webhookPaidAt < webhookActivationAt, 'webhook must verify payment before Founding activation')
assert.ok(webhookActivationAt < webhookTrustedAt, 'webhook must activate Founding capacity before recording conversion')
assert.ok(webhook.includes("case 'checkout.session.expired'"), 'webhook must handle expired Checkout Sessions')
assert.ok(webhook.indexOf("case 'checkout.session.expired'") < webhook.lastIndexOf("rpc('release_founding_member_slot'"), 'expired Founding checkout must release its held slot')
assert.ok(webhook.includes("p_reason: 'checkout_session_expired'"), 'expired checkout releases must carry an auditable reason')
assert.ok(webhook.includes('claim_webhook_event'), 'Founding handling must preserve retry-safe event claims')
assert.ok(webhook.includes('apply_subscription_snapshot'), 'mutable subscription state must use the atomic database guard')
assert.ok(webhook.includes('retrieve(stripeObjectId(session.subscription))'), 'Checkout subscription ids must handle expanded and string objects')
assert.ok(webhook.includes('recordTrustedEvent('), 'paid webhook completion must use the trusted growth ledger')
assert.ok(webhook.includes('stripe-checkout-completed:${session.id}'), 'trusted webhook conversion must be idempotent per Checkout Session')
assert.ok(!webhook.includes('trackAsync(') && !webhook.includes("from('usage_events')"), 'webhook checkout completion must not use operational/browser analytics')

const deletedStart = webhook.indexOf("case 'customer.subscription.deleted'")
const paymentFailedStart = webhook.indexOf("case 'invoice.payment_failed'")
const checkoutCompletedStart = webhook.indexOf("case 'checkout.session.completed'")
const deletedHandler = webhook.slice(deletedStart, paymentFailedStart)
const paymentFailedHandler = webhook.slice(paymentFailedStart, checkoutCompletedStart)
assert.ok(deletedHandler.includes(".from('portfolios')"), 'subscription deletion must unpublish the customer portfolios')
assert.ok(deletedHandler.includes("status: 'draft'") && deletedHandler.includes('published_at: null'), 'cancellation unpublish must preserve work as private drafts')
assert.ok(deletedHandler.indexOf('applySubscriptionSnapshot') < deletedHandler.indexOf(".from('portfolios')"), 'cancellation must win the atomic state guard before unpublishing')
assert.ok(!paymentFailedHandler.includes(".from('portfolios')"), 'payment failure must not immediately unpublish portfolios')

const reconcile = read('src/app/api/stripe/reconcile-session/route.ts')
const ownershipAt = reconcile.indexOf('session.metadata?.user_id !== user.id')
const reconcilePaidAt = reconcile.indexOf("session.payment_status !== 'paid'")
const reconcileActivationAt = reconcile.indexOf("'activate_founding_member_slot'")
const reconcileUpsertAt = reconcile.indexOf("rpc('apply_subscription_snapshot'")
const reconcileTrustedAt = reconcile.indexOf("eventName: 'checkout_completed'")
assert.ok(ownershipAt >= 0 && ownershipAt < reconcilePaidAt, 'reconciliation must prove session ownership before reading paid state')
assert.ok(reconcilePaidAt < reconcileActivationAt, 'reconciliation must verify payment before Founding activation')
assert.ok(reconcileActivationAt < reconcileUpsertAt, 'reconciliation must reserve paid Founding capacity before granting subscription access')
assert.ok(reconcileUpsertAt < reconcileTrustedAt, 'reconciliation must atomically apply access before recording conversion')
assert.ok(reconcile.includes('activated !== true'), 'reconciliation must fail closed when Founding activation fails')
assert.ok(reconcile.includes('recordTrustedEvent('), 'reconciliation must use the trusted growth ledger')
assert.ok(reconcile.includes('stripe-checkout-completed:${session.id}'), 'webhook and reconciliation must share an idempotency key')
assert.ok(!reconcile.includes('trackAsync(') && !reconcile.includes("from('usage_events')"), 'reconciliation must not use operational/browser analytics')

const orderingMigration = read('supabase/migrations/044_atomic_subscription_state.sql')
assert.ok(orderingMigration.includes('pg_advisory_xact_lock'), 'subscription snapshots must serialize per user')
assert.ok(orderingMigration.includes('stripe_subscription_created_at'), 'replacement subscriptions need an independent monotonic marker')
assert.ok(orderingMigration.includes('last_webhook_event_id'), 'same-second events need a deterministic tie-break')
assert.ok(orderingMigration.includes('grant execute on function public.apply_subscription_snapshot'), 'only the service integration should execute snapshot writes')

const envExample = read('.env.example')
assert.ok(envExample.includes('STRIPE_PRICE_ID_FOUNDING_ANNUAL=price_...'), 'founding price must be documented')

console.log('✓ Founding Member server invariants passed')
