import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { recordTrustedEvent } from '@/lib/growth/trusted-events'
import {
  stripeProductConfigFromEnv,
  validatePaidCheckoutEntitlement,
} from '@/lib/stripe/webhook-events'
import { z } from 'zod'
import type Stripe from 'stripe'

export const maxDuration = 15

const schema = z.object({ sessionId: z.string().min(1).max(200) })

// Payment safety net. Normally the Stripe webhook flips a user to Pro after checkout. If
// that webhook is delayed or lost, the customer has PAID but never gets Pro — a silent
// failure. On return from checkout the billing page calls this route, which reads the paid
// session straight from Stripe and self-heals the subscription row (same fields the webhook
// writes). The webhook is no longer a single point of failure for the person who just paid.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Missing session id' }, { status: 400 })

    const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, {
      expand: ['subscription', 'subscription.items'],
    })

    // Ownership: the session's user_id metadata (set at creation) must be THIS user, so one
    // user can never reconcile — or read the status of — someone else's checkout session.
    if (session.metadata?.user_id !== user.id) {
      return NextResponse.json({ error: 'Not your session' }, { status: 403 })
    }
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ status: session.payment_status, pro: false })
    }

    const sub = session.subscription
    if (!sub || typeof sub === 'string') {
      return NextResponse.json({ status: 'no_subscription', pro: false })
    }
    const subscription = sub as Stripe.Subscription
    const priceItem = subscription.items?.data?.[0]
    const status = subscription.status

    // Service client bypasses RLS, exactly as the webhook does when it writes this row.
    const svc = await createServiceClient()
    const entitlement = await validatePaidCheckoutEntitlement(session, subscription, {
      expectedUserId: user.id,
      config: stripeProductConfigFromEnv(),
      resolveCustomerUserId: async (customerId) => {
        const { data, error } = await svc
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (error) throw new Error(`Could not resolve Stripe customer: ${error.message}`)
        return data?.user_id ?? null
      },
    })
    if (entitlement.plan === 'founding') {
      if (!entitlement.foundingReservationId) {
        throw new Error('Paid Founding checkout is missing its reservation id')
      }

      const { data: activated, error: activationError } = await svc.rpc(
        'activate_founding_member_slot',
        {
          p_reservation_id: entitlement.foundingReservationId,
          p_user_id: entitlement.userId,
          p_checkout_session_id: session.id,
          p_subscription_id: subscription.id,
        }
      )
      if (activationError || activated !== true) {
        throw new Error(activationError?.message ?? 'Could not activate paid Founding Member slot')
      }
    }

    const observedAt = new Date().toISOString()
    const { error: snapshotError } = await svc.rpc('apply_subscription_snapshot', {
      p_user_id: entitlement.userId,
      p_stripe_customer_id: entitlement.customerId,
      p_stripe_subscription_id: subscription.id,
      p_subscription_created_at: new Date(subscription.created * 1000).toISOString(),
      p_status: status,
      p_price_id: priceItem?.price?.id ?? null,
      p_current_period_end: priceItem?.current_period_end
        ? new Date(priceItem.current_period_end * 1000).toISOString()
        : null,
      p_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      p_event_created_at: observedAt,
      p_event_id: `reconcile:${session.id}:${subscription.id}:${status}`,
    })
    if (snapshotError) throw new Error(`Atomic subscription reconciliation failed: ${snapshotError.message}`)

    // Same idempotency key as the webhook: whichever paid, server-verified path wins the
    // race records the conversion once, and a retry safely repairs any later step.
    await recordTrustedEvent({
      idempotencyKey: `stripe-checkout-completed:${session.id}`,
      eventName: 'checkout_completed',
      userId: entitlement.userId,
      entityType: 'stripe_checkout_session',
      entityId: session.id,
      source: 'stripe_reconcile_session',
      metadata: {
        plan: entitlement.plan,
        price_id: entitlement.priceId,
        subscription_id: subscription.id,
        founding: entitlement.plan === 'founding',
      },
    }, svc)

    const { data: effective, error: readError } = await svc
      .from('subscriptions')
      .select('status')
      .eq('user_id', entitlement.userId)
      .maybeSingle()
    if (readError) throw readError
    const effectiveStatus = effective?.status ?? status
    const pro = effectiveStatus === 'active' || effectiveStatus === 'trialing'
    // If we had to heal, the webhook was late/lost — log it so silent failures are visible.
    if (pro) console.warn('[reconcile-session] self-healed Pro for user', user.id, 'session', session.id)
    return NextResponse.json({ status: effectiveStatus, pro, healed: true })
  } catch (err) {
    console.error('[reconcile-session]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 })
  }
}
