import type Stripe from 'stripe'

export type ShowcaseCheckoutPlan = 'monthly' | 'annual' | 'founding'

export interface StripeProductConfig {
  monthlyPriceId?: string
  annualPriceId?: string
  foundingPriceId?: string
}

export interface SubscriptionSnapshot {
  userId: string
  subscription: Stripe.Subscription
  customerId: string
  eventCreatedAt: string
  eventId: string
  statusOverride?: string
}

export interface CheckoutCompletedFact {
  session: Stripe.Checkout.Session
  subscription: Stripe.Subscription
  userId: string
  plan: ShowcaseCheckoutPlan
  priceId: string
  eventCreatedAt: string
}

export interface StripeWebhookActions {
  retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription>
  resolveCustomerUserId(customerId: string): Promise<string | null>
  applySubscriptionSnapshot(input: SubscriptionSnapshot): Promise<boolean>
  applySubscriptionDeletion(input: SubscriptionSnapshot): Promise<boolean>
  activateFoundingSlot(input: {
    reservationId: string
    userId: string
    checkoutSessionId: string
    subscriptionId: string
  }): Promise<boolean>
  releaseFoundingSlot(input: {
    reservationId: string
    userId: string
    reason: string
  }): Promise<boolean>
  recordCheckoutCompleted(input: CheckoutCompletedFact): Promise<void>
}

export interface CheckoutEntitlementContext {
  userId: string
  customerId: string
  plan: ShowcaseCheckoutPlan
  priceId: string
  foundingReservationId: string | null
}

export interface SubscriptionEntitlementContext {
  userId: string
  customerId: string
  priceId: string | null
}

export function stripeProductConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StripeProductConfig {
  return {
    monthlyPriceId: env.STRIPE_PRICE_ID_PRO_MONTHLY,
    annualPriceId: env.STRIPE_PRICE_ID_PRO_ANNUAL,
    foundingPriceId: env.STRIPE_PRICE_ID_FOUNDING_ANNUAL,
  }
}

/**
 * Process the mutation-bearing portion of a verified and exclusively claimed Stripe event.
 * Signature verification, retry claiming, and final processed/failed bookkeeping stay in
 * the route; keeping provider/DB actions behind this interface makes every money-state
 * branch deterministic and adversarially testable without contacting Stripe.
 */
export async function processClaimedStripeEvent(
  event: Stripe.Event,
  actions: StripeWebhookActions,
  config: StripeProductConfig,
): Promise<void> {
  const eventCreatedAt = new Date(event.created * 1000).toISOString()

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const eventSubscription = event.data.object as Stripe.Subscription
      const subscription = await actions.retrieveSubscription(eventSubscription.id)
      const context = await validateSubscriptionEntitlement(subscription, {
        resolveCustomerUserId: actions.resolveCustomerUserId,
        config,
        metadataUserIds: [eventSubscription.metadata?.user_id],
        metadataPlans: [eventSubscription.metadata?.plan],
        observedCustomerIds: [objectId(eventSubscription.customer, 'subscription event customer')],
      })

      await actions.applySubscriptionSnapshot({
        userId: context.userId,
        subscription,
        customerId: context.customerId,
        eventCreatedAt,
        eventId: event.id,
      })
      return
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const context = await validateSubscriptionEntitlement(subscription, {
        resolveCustomerUserId: actions.resolveCustomerUserId,
        config,
        requireConfiguredPrice: false,
      })
      await actions.applySubscriptionDeletion({
        userId: context.userId,
        subscription,
        customerId: context.customerId,
        eventCreatedAt,
        eventId: event.id,
        statusOverride: 'canceled',
      })
      return
    }

    case 'invoice.paid':
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionReference = invoice.parent?.subscription_details?.subscription
      if (!subscriptionReference) return

      const subscriptionId = objectId(subscriptionReference, 'invoice subscription')
      const subscription = await actions.retrieveSubscription(subscriptionId)
      const context = await validateSubscriptionEntitlement(subscription, {
        resolveCustomerUserId: actions.resolveCustomerUserId,
        config,
        observedCustomerIds: invoice.customer
          ? [objectId(invoice.customer, 'invoice customer')]
          : [],
      })
      await actions.applySubscriptionSnapshot({
        userId: context.userId,
        subscription,
        customerId: context.customerId,
        eventCreatedAt,
        eventId: event.id,
      })
      return
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // Checkout completion can precede settlement for asynchronous methods. Only a paid
      // subscription checkout is authoritative for an entitlement or Founding activation.
      if (session.mode !== 'subscription' || !session.subscription || session.payment_status !== 'paid') return

      const subscription = await actions.retrieveSubscription(
        objectId(session.subscription, 'checkout subscription'),
      )
      const context = await validatePaidCheckoutEntitlement(session, subscription, {
        resolveCustomerUserId: actions.resolveCustomerUserId,
        config,
      })

      if (context.plan === 'founding') {
        if (!context.foundingReservationId) {
          throw new Error('Paid Founding checkout is missing its reservation id')
        }
        const activated = await actions.activateFoundingSlot({
          reservationId: context.foundingReservationId,
          userId: context.userId,
          checkoutSessionId: session.id,
          subscriptionId: subscription.id,
        })
        if (!activated) throw new Error('Could not activate paid Founding Member slot')
      }

      await actions.applySubscriptionSnapshot({
        userId: context.userId,
        subscription,
        customerId: context.customerId,
        eventCreatedAt,
        eventId: event.id,
      })
      await actions.recordCheckoutCompleted({
        session,
        subscription,
        userId: context.userId,
        plan: context.plan,
        priceId: context.priceId,
        eventCreatedAt,
      })
      return
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.plan !== 'founding') return

      const userId = requiredConsistentValue('Showcase user', [session.metadata?.user_id])
      const reservationId = requiredConsistentValue(
        'Founding reservation',
        [session.metadata?.founding_reservation_id],
      )
      // False is deliberately benign: an expiry delivered after paid completion must not
      // regress an already-active slot.
      await actions.releaseFoundingSlot({
        reservationId,
        userId,
        reason: 'checkout_session_expired',
      })
      return
    }
  }
}

export async function validatePaidCheckoutEntitlement(
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription,
  options: {
    resolveCustomerUserId(customerId: string): Promise<string | null>
    config: StripeProductConfig
    expectedUserId?: string
  },
): Promise<CheckoutEntitlementContext> {
  if (session.mode !== 'subscription' || session.payment_status !== 'paid') {
    throw new Error('Checkout session is not a paid subscription')
  }
  const sessionSubscriptionId = objectId(session.subscription, 'checkout subscription')
  if (sessionSubscriptionId !== subscription.id) {
    throw new Error('Checkout session and subscription ids conflict')
  }

  const subscriptionCustomerId = objectId(subscription.customer, 'subscription customer')
  const sessionCustomerId = objectId(session.customer, 'checkout customer')
  const customerId = requiredConsistentValue(
    'Stripe customer',
    [subscriptionCustomerId, sessionCustomerId],
  )
  const mappedUserId = await options.resolveCustomerUserId(customerId)
  const userId = requiredConsistentValue('Showcase user', [
    session.metadata?.user_id,
    subscription.metadata?.user_id,
    mappedUserId,
    options.expectedUserId,
  ])

  const claimedPlan = requiredCheckoutPlan([
    session.metadata?.plan,
    subscription.metadata?.plan,
  ])
  const priceId = onlySubscriptionPriceId(subscription)
  const configuredPlan = configuredPlanForPrice(priceId, options.config)
  if (claimedPlan !== configuredPlan) {
    throw new Error(`Checkout plan metadata conflicts with configured price (${claimedPlan}/${configuredPlan})`)
  }

  const foundingReservationId = optionalConsistentValue('Founding reservation', [
    session.metadata?.founding_reservation_id,
    subscription.metadata?.founding_reservation_id,
  ])
  if (claimedPlan !== 'founding' && foundingReservationId) {
    throw new Error('Non-Founding checkout contains Founding reservation metadata')
  }

  return { userId, customerId, plan: claimedPlan, priceId, foundingReservationId }
}

export async function validateSubscriptionEntitlement(
  subscription: Stripe.Subscription,
  options: {
    resolveCustomerUserId(customerId: string): Promise<string | null>
    config: StripeProductConfig
    metadataUserIds?: Array<string | null | undefined>
    metadataPlans?: Array<string | null | undefined>
    observedCustomerIds?: string[]
    requireConfiguredPrice?: boolean
  },
): Promise<SubscriptionEntitlementContext> {
  const customerId = requiredConsistentValue('Stripe customer', [
    objectId(subscription.customer, 'subscription customer'),
    ...(options.observedCustomerIds ?? []),
  ])
  const mappedUserId = await options.resolveCustomerUserId(customerId)
  const userId = requiredConsistentValue('Showcase user', [
    subscription.metadata?.user_id,
    ...(options.metadataUserIds ?? []),
    mappedUserId,
  ])

  const priceId = subscription.items.data.length === 1
    ? subscription.items.data[0]?.price?.id ?? null
    : null
  const mustRecognizePrice = options.requireConfiguredPrice
    ?? (subscription.status === 'active' || subscription.status === 'trialing')

  const metadataPlan = optionalCheckoutPlan([
    subscription.metadata?.plan,
    ...(options.metadataPlans ?? []),
  ])
  let configuredPlan: ShowcaseCheckoutPlan | null = null
  if (priceId) configuredPlan = maybeConfiguredPlanForPrice(priceId, options.config)
  if (mustRecognizePrice && (!priceId || !configuredPlan || subscription.items.data.length !== 1)) {
    throw new Error('Entitlement-bearing subscription does not use exactly one configured Showcase price')
  }
  if (metadataPlan && configuredPlan && metadataPlan !== configuredPlan) {
    throw new Error(`Subscription plan metadata conflicts with configured price (${metadataPlan}/${configuredPlan})`)
  }

  return { userId, customerId, priceId }
}

function onlySubscriptionPriceId(subscription: Stripe.Subscription): string {
  if (subscription.items.data.length !== 1) {
    throw new Error('Paid checkout subscription must contain exactly one price')
  }
  const priceId = subscription.items.data[0]?.price?.id
  if (!priceId) throw new Error('Paid checkout subscription is missing its price')
  return priceId
}

function requiredCheckoutPlan(values: Array<string | null | undefined>): ShowcaseCheckoutPlan {
  const plan = requiredConsistentValue('Checkout plan', values)
  if (plan !== 'monthly' && plan !== 'annual' && plan !== 'founding') {
    throw new Error(`Unsupported Checkout plan metadata: ${plan}`)
  }
  return plan
}

function optionalCheckoutPlan(
  values: Array<string | null | undefined>,
): ShowcaseCheckoutPlan | null {
  const plan = optionalConsistentValue('Subscription plan', values)
  if (plan === null) return null
  if (plan !== 'monthly' && plan !== 'annual' && plan !== 'founding') {
    throw new Error(`Unsupported subscription plan metadata: ${plan}`)
  }
  return plan
}

function configuredPlanForPrice(
  priceId: string,
  config: StripeProductConfig,
): ShowcaseCheckoutPlan {
  const plan = maybeConfiguredPlanForPrice(priceId, config)
  if (!plan) throw new Error('Stripe subscription price is not a configured Showcase price')
  return plan
}

function maybeConfiguredPlanForPrice(
  priceId: string,
  config: StripeProductConfig,
): ShowcaseCheckoutPlan | null {
  const matches = ([
    ['monthly', config.monthlyPriceId],
    ['annual', config.annualPriceId],
    ['founding', config.foundingPriceId],
  ] as const).filter(([, configuredPriceId]) => configuredPriceId && configuredPriceId === priceId)
  if (matches.length > 1) throw new Error('Stripe price configuration maps one price to multiple plans')
  return matches[0]?.[0] ?? null
}

function requiredConsistentValue(
  label: string,
  values: Array<string | null | undefined>,
): string {
  const value = optionalConsistentValue(label, values)
  if (!value) throw new Error(`${label} is missing`)
  return value
}

function optionalConsistentValue(
  label: string,
  values: Array<string | null | undefined>,
): string | null {
  const normalized = values.filter((value): value is string => typeof value === 'string' && value.length > 0)
  const unique = new Set(normalized)
  if (unique.size > 1) throw new Error(`${label} metadata conflicts`)
  return normalized[0] ?? null
}

function objectId(value: string | { id: string } | null | undefined, label: string): string {
  if (typeof value === 'string' && value.length > 0) return value
  if (value && typeof value === 'object' && value.id) return value.id
  throw new Error(`${label} is missing`)
}
