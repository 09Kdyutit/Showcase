import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import { trackAsync } from '@/lib/analytics/track'
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

  // Idempotency: Stripe does not guarantee exactly-once delivery — retries and replays
  // are expected. Recording the event id with a unique constraint, before doing any
  // work, makes "already handled this exact event" an atomic check rather than a hope.
  // If insertion conflicts, we've seen this event id before — short-circuit cleanly.
  const { error: dedupeError } = await supabase
    .from('processed_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })
  if (dedupeError) {
    if (dedupeError.code === '23505') {
      console.warn('[webhook] Duplicate/replayed event ignored:', event.id, event.type)
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[webhook] Failed to record event for idempotency:', dedupeError.message)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id

        if (!userId) {
          const { data } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', sub.customer as string)
            .single()
          if (!data) break
        }

        const resolvedUserId = userId || await getUserIdFromCustomer(supabase, sub.customer as string)
        if (!resolvedUserId) break

        // Out-of-order guard: skip if a newer event already updated this row.
        if (await isStaleEvent(supabase, resolvedUserId, eventCreatedAt)) break

        const priceItem = sub.items.data[0]
        const { error: upsertError } = await supabase.from('subscriptions').upsert({
          user_id: resolvedUserId,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          status: sub.status,
          price_id: priceItem?.price?.id ?? null,
          // current_period_end lives on the subscription item, not the subscription itself,
          // as of Stripe API 2025-03-31+ (subscriptions can have items with different cycles).
          current_period_end: priceItem?.current_period_end
            ? new Date(priceItem.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: sub.cancel_at_period_end,
          last_webhook_event_at: eventCreatedAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        if (upsertError) throw upsertError
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (existing?.user_id && await isStaleEvent(supabase, existing.user_id, eventCreatedAt)) break

        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'canceled', last_webhook_event_at: eventCreatedAt, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)
        if (error) throw error
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null }
        if (invoice.subscription) {
          const { error } = await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription as string)
          if (error) throw error
        }
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          const userId = session.metadata?.user_id
          if (userId && sub) {
            const priceItem = sub.items.data[0]
            const { error: upsertError } = await supabase.from('subscriptions').upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: sub.id,
              status: sub.status,
              price_id: priceItem?.price?.id ?? null,
              current_period_end: priceItem?.current_period_end
                ? new Date(priceItem.current_period_end * 1000).toISOString()
                : null,
              cancel_at_period_end: sub.cancel_at_period_end,
              last_webhook_event_at: eventCreatedAt,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })
            if (upsertError) throw upsertError
            trackAsync(userId, 'checkout_completed', { price_id: priceItem?.price?.id ?? null })
          }
        }
        break
      }
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function isStaleEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  eventCreatedAt: string
): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('last_webhook_event_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data?.last_webhook_event_at) return false
  return new Date(data.last_webhook_event_at) > new Date(eventCreatedAt)
}

async function getUserIdFromCustomer(supabase: Awaited<ReturnType<typeof createServiceClient>>, customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.user_id ?? null
}
