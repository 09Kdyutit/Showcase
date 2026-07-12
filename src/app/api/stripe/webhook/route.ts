import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import { recordTrustedEvent } from '@/lib/growth/trusted-events'
import {
  processClaimedStripeEvent,
  stripeProductConfigFromEnv,
  type SubscriptionSnapshot,
} from '@/lib/stripe/webhook-events'
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
    await processClaimedStripeEvent(event, {
      retrieveSubscription: (subscriptionId) => stripe.subscriptions.retrieve(subscriptionId),
      resolveCustomerUserId: (customerId) => getUserIdFromCustomer(supabase, customerId),
      applySubscriptionSnapshot: (input) => applySubscriptionSnapshot(supabase, input),
      applySubscriptionDeletion: (input) => applySubscriptionDeletion(supabase, input),
      activateFoundingSlot: async (input) => {
        const { data, error } = await supabase.rpc('activate_founding_member_slot', {
          p_reservation_id: input.reservationId,
          p_user_id: input.userId,
          p_checkout_session_id: input.checkoutSessionId,
          p_subscription_id: input.subscriptionId,
        })
        if (error) throw error
        return data === true
      },
      releaseFoundingSlot: async (input) => {
        const { data, error } = await supabase.rpc('release_founding_member_slot', {
          p_reservation_id: input.reservationId,
          p_user_id: input.userId,
          p_reason: input.reason,
        })
        if (error) throw error
        return data === true
      },
      recordCheckoutCompleted: (input) => recordTrustedEvent({
        idempotencyKey: `stripe-checkout-completed:${input.session.id}`,
        eventName: 'checkout_completed',
        userId: input.userId,
        entityType: 'stripe_checkout_session',
        entityId: input.session.id,
        source: 'stripe_webhook',
        metadata: {
          plan: input.plan,
          price_id: input.priceId,
          subscription_id: input.subscription.id,
          founding: input.plan === 'founding',
        },
        occurredAt: input.eventCreatedAt,
      }, supabase),
    }, stripeProductConfigFromEnv())

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

async function applySubscriptionSnapshot(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  input: SubscriptionSnapshot
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

async function applySubscriptionDeletion(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  input: SubscriptionSnapshot
): Promise<boolean> {
  const priceItem = input.subscription.items.data[0]
  const { data, error } = await supabase.rpc('apply_subscription_deletion', {
    p_user_id: input.userId,
    p_stripe_customer_id: input.customerId,
    p_stripe_subscription_id: input.subscription.id,
    p_subscription_created_at: new Date(input.subscription.created * 1000).toISOString(),
    p_price_id: priceItem?.price?.id ?? null,
    p_current_period_end: priceItem?.current_period_end
      ? new Date(priceItem.current_period_end * 1000).toISOString()
      : null,
    p_cancel_at_period_end: input.subscription.cancel_at_period_end,
    p_event_created_at: input.eventCreatedAt,
    p_event_id: input.eventId,
  })
  if (error) throw new Error(`Atomic subscription cancellation failed: ${error.message}`)
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
