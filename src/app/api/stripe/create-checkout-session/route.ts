import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe/client'
import { absoluteUrl } from '@/lib/utils'
import { isCheckoutEnabled, KILL_SWITCH_MESSAGE } from '@/lib/feature-flags'

export async function POST(req: NextRequest) {
  try {
    if (!isCheckoutEnabled()) {
      return NextResponse.json({ error: KILL_SWITCH_MESSAGE }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const plan = body.plan === 'annual' ? 'annual' : 'monthly'

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    const customerId = await getOrCreateStripeCustomer(
      user.id,
      profile?.email ?? user.email ?? '',
      profile?.full_name ?? undefined
    )

    const priceId = plan === 'annual'
      ? process.env.STRIPE_PRICE_ID_PRO_ANNUAL
      : process.env.STRIPE_PRICE_ID_PRO_MONTHLY
    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: absoluteUrl('/billing?session_id={CHECKOUT_SESSION_ID}'),
      cancel_url: absoluteUrl('/billing?canceled=true'),
      metadata: { user_id: user.id },
      subscription_data: {
        metadata: { user_id: user.id },
      },
      allow_promotion_codes: true,
    })

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'checkout_initiated',
      metadata: { price_id: priceId, plan },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout-session]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
