import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import { recordTrustedEvent } from '@/lib/growth/trusted-events'
import type Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  if (!process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const eventCreatedAt = new Date(event.created * 1000).toISOString()

  // Claim, don't merely record. A handler can fail after the claim; the database keeps
  // that event retryable and atomically lets a later Stripe delivery reclaim it. This
  // avoids the dangerous "insert first, then every retry looks processed" failure mode.
  const { data: claimData, error: claimError } = await supabase.rpc('claim_webhook_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_stale_after_seconds: 300,
  })
  if (claimError) {
    console.error('[webhook] Failed to claim event:', claimError.message)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
  const claim = claimData as 'claimed' | 'processed' | 'busy' | null
  if (claim === 'processed') {
    return NextResponse.json({ received: true, duplicate: true })
  }
  if (claim !== 'claimed') {
    // Another delivery is still working. A non-2xx response keeps Stripe's retry queue
    // alive in case that worker crashes; once it succeeds the retry becomes a duplicate.
    return NextResponse.json({ error: 'Webhook event is already processing' }, { status: 409 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const eventSub = event.data.object as Stripe.Subscription
        // Delivery can be delayed. Re-read Stripe so an old event carries the current
        // provider snapshot, then let the database serialize it with any concurrent event.
        const sub = await stripe.subscriptions.retrieve(eventSub.id)
        const customerId = stripeObjectId(sub.customer)
        const resolvedUserId = sub.metadata?.user_id
          ?? eventSub.metadata?.user_id
          ?? await getUserIdFromCustomer(supabase, customerId)
        if (!resolvedUserId) throw new Error('Subscription event could not be mapped to a Showcase user')

        await applySubscriptionSnapshot(supabase, {
          userId: resolvedUserId,
          subscription: sub,
          customerId,
          eventCreatedAt,
          eventId: event.id,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = stripeObjectId(sub.customer)
        const userId = sub.metadata?.user_id ?? await getUserIdFromCustomer(supabase, customerId)
        if (!userId) throw new Error('Deleted subscription could not be mapped to a Showcase user')
        const applied = await applySubscriptionSnapshot(supabase, {
          userId,
          subscription: sub,
          customerId,
          eventCreatedAt,
          eventId: event.id,
          statusOverride: 'canceled',
        })

        // A deletion for an older replaced subscription returns false atomically, so it
        // cannot take a newly-paid user's work offline.
        if (!applied) break

        const { error: unpublishError } = await supabase
          .from('portfolios')
          .update({
            status: 'draft',
            published_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('status', 'published')
        if (unpublishError) throw unpublishError
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionRef = invoice.parent?.subscription_details?.subscription
        if (subscriptionRef) {
          const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef.id
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const customerId = stripeObjectId(sub.customer)
          const userId = sub.metadata?.user_id ?? await getUserIdFromCustomer(supabase, customerId)
          if (!userId) throw new Error('Failed invoice could not be mapped to a Showcase user')
          await applySubscriptionSnapshot(supabase, {
            userId,
            subscription: sub,
            customerId,
            eventCreatedAt,
            eventId: event.id,
          })
        }
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // A completed Checkout Session is not necessarily paid when asynchronous payment
        // methods are enabled. Capacity and conversion facts only become durable on payment.
        if (session.mode === 'subscription' && session.subscription && session.payment_status === 'paid') {
          const sub = await stripe.subscriptions.retrieve(stripeObjectId(session.subscription))
          const userId = session.metadata?.user_id ?? sub.metadata?.user_id
          if (!userId) throw new Error('Paid checkout could not be mapped to a Showcase user')
          if (sub) {
            const priceItem = sub.items.data[0]
            const plan = session.metadata?.plan ?? sub.metadata?.plan ?? 'unknown'

            if (plan === 'founding') {
              const reservationId = session.metadata?.founding_reservation_id
                ?? sub.metadata?.founding_reservation_id
              if (!reservationId) throw new Error('Paid Founding checkout is missing its reservation id')

              const { data: activated, error: activationError } = await supabase.rpc(
                'activate_founding_member_slot',
                {
                  p_reservation_id: reservationId,
                  p_user_id: userId,
                  p_checkout_session_id: session.id,
                  p_subscription_id: sub.id,
                }
              )
              if (activationError || activated !== true) {
                throw new Error(activationError?.message ?? 'Could not activate paid Founding Member slot')
              }
            }

            // Capacity activation and the paid-checkout fact are monotonic. Mutable
            // subscription state is serialized inside Postgres.
            await applySubscriptionSnapshot(supabase, {
              userId,
              subscription: sub,
              customerId: stripeObjectId(sub.customer),
              eventCreatedAt,
              eventId: event.id,
            })

            await recordTrustedEvent({
              idempotencyKey: `stripe-checkout-completed:${session.id}`,
              eventName: 'checkout_completed',
              userId,
              entityType: 'stripe_checkout_session',
              entityId: session.id,
              source: 'stripe_webhook',
              metadata: {
                plan,
                price_id: priceItem?.price?.id ?? null,
                subscription_id: sub.id,
                founding: plan === 'founding',
              },
              occurredAt: eventCreatedAt,
            }, supabase)
          }
        }
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.plan !== 'founding') break

        const userId = session.metadata?.user_id
        const reservationId = session.metadata?.founding_reservation_id
        if (!userId || !reservationId) {
          throw new Error('Expired Founding checkout is missing reservation metadata')
        }

        const { error: releaseError } = await supabase.rpc('release_founding_member_slot', {
          p_reservation_id: reservationId,
          p_user_id: userId,
          p_reason: 'checkout_session_expired',
        })
        if (releaseError) throw releaseError
        // A false result is intentionally benign: an out-of-order expiry must never
        // regress a slot that the paid-completion path already made active.
        break
      }
    }

    const { error: processedError } = await supabase
      .from('processed_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('event_id', event.id)
    if (processedError) throw processedError
  } catch (err) {
    console.error('[webhook] Handler error:', err)
    const message = err instanceof Error ? err.message : 'unknown handler error'
    await supabase
      .from('processed_webhook_events')
      .update({
        status: 'failed',
        last_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', event.id)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

interface SubscriptionSnapshotInput {
  userId: string
  subscription: Stripe.Subscription
  customerId: string
  eventCreatedAt: string
  eventId: string
  statusOverride?: string
}

async function applySubscriptionSnapshot(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  input: SubscriptionSnapshotInput
): Promise<boolean> {
  const priceItem = input.subscription.items.data[0]
  const { data, error } = await supabase.rpc('apply_subscription_snapshot', {
    p_user_id: input.userId,
    p_stripe_customer_id: input.customerId,
    p_stripe_subscription_id: input.subscription.id,
    p_subscription_created_at: new Date(input.subscription.created * 1000).toISOString(),
    p_status: input.statusOverride ?? input.subscription.status,
    p_price_id: priceItem?.price?.id ?? null,
    p_current_period_end: priceItem?.current_period_end
      ? new Date(priceItem.current_period_end * 1000).toISOString()
      : null,
    p_cancel_at_period_end: input.subscription.cancel_at_period_end,
    p_event_created_at: input.eventCreatedAt,
    p_event_id: input.eventId,
  })
  if (error) throw new Error(`Atomic subscription update failed: ${error.message}`)
  return data === true
}

async function getUserIdFromCustomer(supabase: Awaited<ReturnType<typeof createServiceClient>>, customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (error) throw new Error(`Could not resolve Stripe customer: ${error.message}`)
  return data?.user_id ?? null
}

function stripeObjectId(value: string | { id: string } | null): string {
  if (typeof value === 'string') return value
  if (value?.id) return value.id
  throw new Error('Stripe object is missing an id')
}
