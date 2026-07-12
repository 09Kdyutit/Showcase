#!/usr/bin/env node
// Verifies static Stripe configuration is internally consistent: test/live keys match,
// configured Price IDs actually exist and are active, webhook secret is well-formed.
import Stripe from 'stripe'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? ''
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
  const monthlyPriceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY ?? ''
  const annualPriceId = process.env.STRIPE_PRICE_ID_PRO_ANNUAL ?? ''
  const foundingPriceId = process.env.STRIPE_PRICE_ID_FOUNDING_ANNUAL ?? ''

  const secretMode = secretKey.startsWith('sk_live_') ? 'live' : secretKey.startsWith('sk_test_') ? 'test' : 'unknown'
  const publishableMode = publishableKey.startsWith('pk_live_') ? 'live' : publishableKey.startsWith('pk_test_') ? 'test' : 'unknown'

  record('Secret key is a recognized format (sk_test_ or sk_live_)', secretMode !== 'unknown', `mode: ${secretMode}`)
  record('Publishable key is a recognized format (pk_test_ or pk_live_)', publishableMode !== 'unknown', `mode: ${publishableMode}`)
  record('Secret and publishable keys are in the SAME mode (no test/live mismatch)', secretMode === publishableMode, `secret=${secretMode}, publishable=${publishableMode}`)
  record('Webhook secret has the correct whsec_ prefix', webhookSecret.startsWith('whsec_'), `length: ${webhookSecret.length}`)
  record('Webhook secret has no embedded whitespace (known prior corruption mode)', !/\s/.test(webhookSecret))

  if (secretMode === 'unknown') {
    console.log('\n  Stripe config test: cannot proceed without a valid secret key\n')
    process.exit(1)
  }

  const stripe = new Stripe(secretKey)

  try {
    const monthly = await stripe.prices.retrieve(monthlyPriceId)
    record(
      'Monthly Price is active USD $15 recurring monthly',
      monthly.active === true && monthly.currency === 'usd' && monthly.unit_amount === 1500
        && monthly.recurring?.interval === 'month' && monthly.recurring.interval_count === 1,
      `${monthly.id}, active=${monthly.active}, ${monthly.currency} ${monthly.unit_amount}, ${monthly.recurring?.interval}`,
    )
  } catch (e) {
    record('Monthly Price is active USD $15 recurring monthly', false, e.message)
  }

  try {
    const annual = await stripe.prices.retrieve(annualPriceId)
    record(
      'Annual Price is active USD $150 recurring yearly',
      annual.active === true && annual.currency === 'usd' && annual.unit_amount === 15000
        && annual.recurring?.interval === 'year' && annual.recurring.interval_count === 1,
      `${annual.id}, active=${annual.active}, ${annual.currency} ${annual.unit_amount}, ${annual.recurring?.interval}`,
    )
  } catch (e) {
    record('Annual Price is active USD $150 recurring yearly', false, e.message)
  }

  if (foundingPriceId) {
    try {
      const founding = await stripe.prices.retrieve(foundingPriceId)
      record(
        'Founding Price is active USD $99 recurring yearly',
        founding.active === true && founding.currency === 'usd' && founding.unit_amount === 9900
          && founding.recurring?.interval === 'year' && founding.recurring.interval_count === 1,
        `${founding.id}, active=${founding.active}, ${founding.currency} ${founding.unit_amount}, ${founding.recurring?.interval}`,
      )
    } catch (e) {
      record('Founding Price is active USD $99 recurring yearly', false, e.message)
    }
  } else {
    record('Founding Price omitted, so the Founding offer remains disabled', true)
  }

  // Confirm the key actually authenticates (real API call, read-only)
  try {
    await stripe.balance.retrieve()
    record('Secret key successfully authenticates against the Stripe API', true)
  } catch (e) {
    record('Secret key successfully authenticates against the Stripe API', false, e.message)
  }

  console.log(`\n  Stripe config test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
