#!/usr/bin/env node

// PII-free, read-only authority audit for Showcase's first real sale.
// This script only performs Supabase SELECT/auth.admin.listUsers calls and Stripe LIST calls.
// It never creates, updates, deletes, expires, reconciles, or otherwise mutates provider state.
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const DEV_ACCOUNT_EMAIL = 'babyxo@showcaseapp.dev'
const TEST_EMAIL_RE = /example\.com$/
const COMP_SUB_PREFIX = 'comp_founder_grant'
const PAID_DB_STATUSES = new Set(['active', 'trialing'])
const PAID_STRIPE_STATUSES = new Set(['active', 'trialing'])

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const stripeKey = process.env.STRIPE_SECRET_KEY

if (!supabaseUrl || !serviceKey || !stripeKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and STRIPE_SECRET_KEY are required')
}
if (!stripeKey.startsWith('sk_live_')) {
  throw new Error('First-sale authority requires a live Stripe secret key')
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const stripe = new Stripe(stripeKey)

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isExcludedEmail(email) {
  return email === DEV_ACCOUNT_EMAIL || TEST_EMAIL_RE.test(email)
}

function currentEntitlement(row) {
  if (!row || !PAID_DB_STATUSES.has(row.status)) return false
  if (String(row.stripe_subscription_id ?? '').startsWith(COMP_SUB_PREFIX)) return false
  if (!row.current_period_end) return true
  return Date.parse(row.current_period_end) > Date.now()
}

async function readAuthUsers() {
  const rows = []
  const perPage = 1000
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`)
    const batch = data?.users ?? []
    rows.push(...batch)
    if (batch.length < perPage) return rows
  }
}

async function selectAll(table, columns, configure = (query) => query) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const query = configure(supabase.from(table).select(columns)).range(from, from + pageSize - 1)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) return rows
  }
}

async function stripeList(fetchPage) {
  const rows = []
  let startingAfter
  for (;;) {
    const page = await fetchPage({ limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) })
    rows.push(...page.data)
    if (!page.has_more || page.data.length === 0) return rows
    startingAfter = page.data.at(-1).id
  }
}

function objectId(value) {
  if (!value) return null
  return typeof value === 'string' ? value : value.id ?? null
}

const authUsers = await readAuthUsers()
const legitimateUsers = authUsers.filter((user) => !isExcludedEmail(normalizeEmail(user.email)))
const legitimateIds = new Set(legitimateUsers.map((user) => user.id))
const emailToUserId = new Map(
  legitimateUsers
    .map((user) => [normalizeEmail(user.email), user.id])
    .filter(([email]) => Boolean(email))
)

const [profiles, resumes, portfolios, dbSubscriptions, trustedEvents, usageEvents] = await Promise.all([
  selectAll('profiles', 'id'),
  selectAll('resumes', 'user_id'),
  selectAll('portfolios', 'user_id,status,ai_generated_at'),
  selectAll('subscriptions', 'user_id,status,current_period_end,stripe_customer_id,stripe_subscription_id'),
  selectAll(
    'trusted_events',
    'user_id,event_name,occurred_at',
    (query) => query.in('user_id', [...legitimateIds])
  ),
  selectAll(
    'usage_events',
    'user_id,event_name,created_at',
    (query) => query.in('user_id', [...legitimateIds]).in('event_name', ['checkout_initiated'])
  ),
])

const [customers, checkoutSessions, stripeSubscriptions, paymentIntents, invoices, charges] = await Promise.all([
  stripeList((params) => stripe.customers.list(params)),
  stripeList((params) => stripe.checkout.sessions.list(params)),
  stripeList((params) => stripe.subscriptions.list({ ...params, status: 'all' })),
  stripeList((params) => stripe.paymentIntents.list(params)),
  stripeList((params) => stripe.invoices.list(params)),
  stripeList((params) => stripe.charges.list(params)),
])

const customerToUserId = new Map()
for (const row of dbSubscriptions) {
  if (legitimateIds.has(row.user_id) && row.stripe_customer_id) {
    customerToUserId.set(row.stripe_customer_id, row.user_id)
  }
}
for (const customer of customers) {
  const metadataUserId = customer.metadata?.user_id
  const emailUserId = emailToUserId.get(normalizeEmail(customer.email))
  const userId = legitimateIds.has(metadataUserId) ? metadataUserId : emailUserId
  if (userId) customerToUserId.set(customer.id, userId)
}

function resolveUserId(object) {
  const metadataUserId = object?.metadata?.user_id
  if (legitimateIds.has(metadataUserId)) return metadataUserId
  const referenceUserId = object?.client_reference_id
  if (legitimateIds.has(referenceUserId)) return referenceUserId
  return customerToUserId.get(objectId(object?.customer)) ?? null
}

const paymentIntentToUserId = new Map(
  paymentIntents.map((intent) => [intent.id, resolveUserId(intent)]).filter(([, userId]) => userId)
)
for (const charge of charges) {
  if (!resolveUserId(charge)) {
    const userId = paymentIntentToUserId.get(objectId(charge.payment_intent))
    if (userId) charge.metadata = { ...charge.metadata, user_id: userId }
  }
}

const mappedCustomers = customers.filter((row) => customerToUserId.has(row.id))
const mappedSessions = checkoutSessions.filter((row) => resolveUserId(row))
const mappedStripeSubscriptions = stripeSubscriptions.filter((row) => resolveUserId(row))
const mappedPaymentIntents = paymentIntents.filter((row) => resolveUserId(row))
const mappedInvoices = invoices.filter((row) => resolveUserId(row))
const mappedCharges = charges.filter((row) => resolveUserId(row))

const paidStripeUserIds = new Set([
  ...mappedSessions
    .filter((row) => row.livemode && row.payment_status === 'paid' && Number(row.amount_total ?? 0) > 0)
    .map(resolveUserId),
  ...mappedPaymentIntents
    .filter((row) => row.livemode && row.status === 'succeeded' && Number(row.amount_received ?? 0) > 0)
    .map(resolveUserId),
  ...mappedInvoices
    .filter((row) => row.livemode && row.paid === true && Number(row.amount_paid ?? 0) > 0)
    .map(resolveUserId),
  ...mappedCharges
    .filter((row) => row.livemode && row.paid === true && row.status === 'succeeded'
      && Number(row.amount ?? 0) > Number(row.amount_refunded ?? 0))
    .map(resolveUserId),
].filter(Boolean))

const activeStripeSubscriptionByUser = new Map()
for (const subscription of mappedStripeSubscriptions) {
  if (!subscription.livemode || !PAID_STRIPE_STATUSES.has(subscription.status)) continue
  const userId = resolveUserId(subscription)
  if (userId) activeStripeSubscriptionByUser.set(userId, subscription)
}

const currentDbSubscriptionByUser = new Map()
for (const subscription of dbSubscriptions) {
  if (!legitimateIds.has(subscription.user_id) || !currentEntitlement(subscription)) continue
  currentDbSubscriptionByUser.set(subscription.user_id, subscription)
}

const verifiedPayingUserIds = [...legitimateIds].filter((userId) => {
  const db = currentDbSubscriptionByUser.get(userId)
  const live = activeStripeSubscriptionByUser.get(userId)
  if (!db || !live || !paidStripeUserIds.has(userId)) return false
  return db.stripe_subscription_id === live.id
})

const uniqueNormalizedEmails = new Set(legitimateUsers.map((user) => normalizeEmail(user.email)).filter(Boolean))
const trustedCounts = Object.fromEntries(
  ['portfolio_generated', 'portfolio_published', 'publish_paywall_viewed', 'checkout_completed']
    .map((eventName) => [
      eventName,
      new Set(trustedEvents.filter((row) => row.event_name === eventName).map((row) => row.user_id)).size,
    ])
)

const result = {
  generatedAt: new Date().toISOString(),
  mode: 'live-read-only',
  users: {
    rawAuth: authUsers.length,
    excluded: authUsers.length - legitimateUsers.length,
    legitimate: legitimateUsers.length,
    matchingProfiles: profiles.filter((row) => legitimateIds.has(row.id)).length,
    confirmed: legitimateUsers.filter((row) => Boolean(row.email_confirmed_at || row.confirmed_at)).length,
    signedIn: legitimateUsers.filter((row) => Boolean(row.last_sign_in_at)).length,
    duplicateNormalizedIdentities: legitimateUsers.length - uniqueNormalizedEmails.size,
  },
  funnel: {
    resumeUsers: new Set(resumes.filter((row) => legitimateIds.has(row.user_id)).map((row) => row.user_id)).size,
    portfolioUsers: new Set(portfolios.filter((row) => legitimateIds.has(row.user_id)).map((row) => row.user_id)).size,
    generatedPortfolioUsers: new Set(
      portfolios.filter((row) => legitimateIds.has(row.user_id) && row.ai_generated_at).map((row) => row.user_id)
    ).size,
    publishedPortfolioUsers: new Set(
      portfolios.filter((row) => legitimateIds.has(row.user_id) && row.status === 'published').map((row) => row.user_id)
    ).size,
    trusted: trustedCounts,
    checkoutInitiatedUsers: new Set(usageEvents.map((row) => row.user_id)).size,
  },
  database: {
    subscriptionRows: dbSubscriptions.length,
    currentLegitimateEntitlementUsers: currentDbSubscriptionByUser.size,
  },
  stripe: {
    mappedToCurrentUsers: {
      customers: mappedCustomers.length,
      checkoutSessions: mappedSessions.length,
      subscriptions: mappedStripeSubscriptions.length,
      paymentIntents: mappedPaymentIntents.length,
      invoices: mappedInvoices.length,
      charges: mappedCharges.length,
    },
    activeSubscriptionUsers: activeStripeSubscriptionByUser.size,
    paidObjectUsers: paidStripeUserIds.size,
  },
  authority: {
    verifiedPayingUsers: verifiedPayingUserIds.length,
    firstSaleVerified: verifiedPayingUserIds.length > 0,
  },
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
