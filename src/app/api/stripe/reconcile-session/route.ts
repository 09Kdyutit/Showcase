import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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
    const { error } = await svc.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: (subscription.customer as string) ?? (session.customer as string) ?? null,
      stripe_subscription_id: subscription.id,
      status,
      price_id: priceItem?.price?.id ?? null,
      // current_period_end lives on the subscription item as of Stripe API 2025-03-31+.
      current_period_end: priceItem?.current_period_end
        ? new Date(priceItem.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw error

    const pro = status === 'active' || status === 'trialing'
    // If we had to heal, the webhook was late/lost — log it so silent failures are visible.
    if (pro) console.warn('[reconcile-session] self-healed Pro for user', user.id, 'session', session.id)
    return NextResponse.json({ status, pro, healed: true })
  } catch (err) {
    console.error('[reconcile-session]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 })
  }
}
