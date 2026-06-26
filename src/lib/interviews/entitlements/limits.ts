// Pure date/period math, no secrets or DB access  -  deliberately NOT server-only
// guarded, unlike usage.ts/reserve.ts/reconcile.ts, so it stays directly testable
// under plain Node (see scripts/test-interview-entitlements.mjs).

export interface UsagePeriod {
  start: Date
  end: Date
  label: string
}

// Free users: a real calendar month (resets on the 1st), not a rolling 30-day window  - 
// "explain when the limit resets" only makes sense against a fixed, predictable boundary
// a user can actually anticipate, which a rolling window can't give them.
export function freeCalendarMonthPeriod(now: Date = new Date()): UsagePeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))
  return { start, end, label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
}

export interface ProSubscriptionInfo {
  currentPeriodEnd: Date
  priceId: string | null
}

// Pro users: the real Stripe billing period, derived from current_period_end and the
// known interval (monthly vs annual, identified by comparing price_id against the two
// configured Pro price env vars  -  no extra Stripe API call needed). Falls back to a
// 30-day window if price_id is unrecognized (e.g. legacy/test fixture price), which is
// a safe, slightly-conservative approximation, never a wider one.
export function proBillingPeriod(sub: ProSubscriptionInfo, now: Date = new Date()): UsagePeriod {
  const isAnnual = sub.priceId === process.env.STRIPE_PRICE_ID_PRO_ANNUAL
  const isMonthly = sub.priceId === process.env.STRIPE_PRICE_ID_PRO_MONTHLY
  const end = sub.currentPeriodEnd
  const start = new Date(end)
  if (isAnnual) start.setUTCFullYear(start.getUTCFullYear() - 1)
  else if (isMonthly) start.setUTCMonth(start.getUTCMonth() - 1)
  else start.setUTCDate(start.getUTCDate() - 30)

  // A subscription period boundary is fixed at the moment of purchase/renewal, so
  // "now" can fall before start (clock skew/test fixtures) or after end (webhook
  // lag)  -  clamp the label, not the math, since the math must stay exact for the
  // reservation-count partition key.
  void now
  return {
    start, end,
    label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
  }
}

