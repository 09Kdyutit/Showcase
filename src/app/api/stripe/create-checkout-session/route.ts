import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe/client'
import { absoluteUrl } from '@/lib/utils'
import { isCheckoutEnabled, KILL_SWITCH_MESSAGE } from '@/lib/feature-flags'
import { trackAsync } from '@/lib/analytics/track'
import Stripe from 'stripe'

type CheckoutPlan = 'monthly' | 'annual' | 'founding'

interface FoundingReservation {
  reservation_id: string
  reservation_token: string
  reservation_status: 'reserved' | 'checkout_created' | 'active'
  expires_at: string
  stripe_checkout_session_id: string | null
}

const FOUNDING_WEBHOOK_GRACE_MS = 60 * 60_000

function isAmbiguousStripeCreationError(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeConnectionError
    || error instanceof Stripe.errors.StripeAPIError
    || error instanceof Stripe.errors.StripeIdempotencyError
    || error instanceof Stripe.errors.StripeRateLimitError
}

export async function POST(req: NextRequest) {
  let foundingReservation: FoundingReservation | null = null
  let foundingService: Awaited<ReturnType<typeof createServiceClient>> | null = null
  let stripeSessionCreationStarted = false
  let stripeSessionCreated = false
  let checkoutUserId: string | null = null

  try {
    if (!isCheckoutEnabled()) {
      return NextResponse.json({ error: KILL_SWITCH_MESSAGE }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    checkoutUserId = user.id

    const body: unknown = await req.json().catch(() => ({}))
    const requestedPlan = body && typeof body === 'object' && 'plan' in body
      ? (body as { plan?: unknown }).plan
      : null
    const plan: CheckoutPlan = requestedPlan === 'annual' || requestedPlan === 'founding'
      ? requestedPlan
      : 'monthly'

    const priceId = plan === 'founding'
      ? process.env.STRIPE_PRICE_ID_FOUNDING_ANNUAL
      : plan === 'annual'
        ? process.env.STRIPE_PRICE_ID_PRO_ANNUAL
        : process.env.STRIPE_PRICE_ID_PRO_MONTHLY
    if (!priceId) {
      return NextResponse.json(
        { error: plan === 'founding' ? 'Founding Member checkout is not configured' : 'Stripe price not configured' },
        { status: plan === 'founding' ? 503 : 500 }
      )
    }

    const { data: existingSubscription, error: subscriptionReadError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (subscriptionReadError) throw subscriptionReadError
    if (existingSubscription && ['active', 'trialing', 'past_due', 'unpaid'].includes(existingSubscription.status)) {
      return NextResponse.json(
        { error: 'You already have a subscription. Manage it from Billing instead.', code: 'SUBSCRIPTION_EXISTS' },
        { status: 409 },
      )
    }

    if (plan === 'founding') {
      foundingService = await createServiceClient()
      const { data, error } = await foundingService.rpc('reserve_founding_member_slot', {
        p_user_id: user.id,
      })
      if (error) throw new Error(`Could not reserve a Founding Member slot: ${error.message}`)

      foundingReservation = ((data ?? []) as FoundingReservation[])[0] ?? null
      if (!foundingReservation) {
        return NextResponse.json(
          { error: 'Founding Member spots are currently unavailable', code: 'FOUNDING_UNAVAILABLE' },
          { status: 409 }
        )
      }
      if (foundingReservation.reservation_status === 'active') {
        return NextResponse.json(
          { error: 'You already have a Founding Member spot', code: 'FOUNDING_ALREADY_ACTIVE' },
          { status: 409 }
        )
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const customerId = await getOrCreateStripeCustomer(
      user.id,
      profile?.email ?? user.email ?? '',
      profile?.full_name ?? undefined
    )

    const checkoutMetadata: Record<string, string> = { user_id: user.id, plan }
    if (foundingReservation) checkoutMetadata.founding_reservation_id = foundingReservation.reservation_id
    const stripeExpiresAt = foundingReservation
      ? Math.floor((new Date(foundingReservation.expires_at).getTime() - FOUNDING_WEBHOOK_GRACE_MS) / 1000)
      : null
    if (stripeExpiresAt && stripeExpiresAt < Math.floor(Date.now() / 1000) + 30 * 60) {
      throw new Error('Founding Member reservation has too little time remaining')
    }

    stripeSessionCreationStarted = true
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: absoluteUrl('/billing?session_id={CHECKOUT_SESSION_ID}'),
      cancel_url: absoluteUrl('/billing?canceled=true'),
      metadata: checkoutMetadata,
      subscription_data: {
        metadata: checkoutMetadata,
      },
      allow_promotion_codes: plan !== 'founding',
      ...(stripeExpiresAt ? { expires_at: stripeExpiresAt } : {}),
    }, {
      // One reusable Checkout Session per user/plan/day prevents double subscriptions from
      // impatient double-clicks or an ambiguous provider response. Stripe sessions normally
      // remain usable for the same window; tomorrow naturally gets a fresh attempt.
      idempotencyKey: foundingReservation
        ? `founding-checkout-${foundingReservation.reservation_id}`
        : `pro-checkout-${user.id}-${plan}-${new Date().toISOString().slice(0, 10)}`,
    })
    stripeSessionCreated = true

    if (foundingReservation && foundingService) {
      const { data: attached, error } = await foundingService.rpc('attach_founding_checkout_session', {
        p_reservation_id: foundingReservation.reservation_id,
        p_user_id: user.id,
        p_checkout_session_id: session.id,
      })
      if (error || attached !== true) {
        // Do not release here: Stripe created a payable session. The reservation remains
        // capacity-bearing and a retry uses the same Stripe idempotency key to attach it.
        throw new Error(error?.message ?? 'Could not attach Founding Member checkout session')
      }
    }

    trackAsync(user.id, 'checkout_initiated', { price_id: priceId, plan })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const canSafelyRelease = !stripeSessionCreationStarted || !isAmbiguousStripeCreationError(err)
    if (foundingReservation && foundingService && checkoutUserId && !stripeSessionCreated && canSafelyRelease) {
      const { error: releaseError } = await foundingService.rpc('release_founding_member_slot', {
        p_reservation_id: foundingReservation.reservation_id,
        p_user_id: checkoutUserId,
        p_reason: err instanceof Error ? err.message.slice(0, 240) : 'checkout_creation_failed',
      })
      if (releaseError) console.error('[create-checkout-session] Founding slot release failed:', releaseError.message)
    }
    console.error('[create-checkout-session]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
