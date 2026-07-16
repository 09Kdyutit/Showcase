#!/usr/bin/env node
import { readFileSync } from 'node:fs'

let failures = 0

function source(path) {
  return readFileSync(path, 'utf8')
}

function expect(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    return
  }
  console.log(`  ❌ ${label}`)
  failures++
}

const dashboard = source('src/app/(app)/dashboard/page.tsx')
const builderIndex = source('src/app/(app)/builder/page.tsx')
const builderEditor = source('src/app/(app)/builder/[portfolioId]/page.tsx')
const publishPaywall = source('src/components/billing/publish-paywall-dialog.tsx')
const billing = source('src/app/(app)/billing/page.tsx')
const signup = source('src/app/(auth)/signup/page.tsx')
const googleButton = source('src/components/auth/google-button.tsx')
const stickyMobileCta = source('src/components/landing/sticky-mobile-cta.tsx')

console.log('Checking the generated-portfolio → Publish/Pro handoff...\n')

expect('dashboard reads the authoritative generation timestamp', dashboard.includes('ai_generated_at'))
expect('dashboard links a generated user to the exact portfolio editor', dashboard.includes('`/builder/${latestGeneratedPortfolio.id}`'))
expect('dashboard prioritizes review/publish before Evidence Audit',
  dashboard.indexOf("label: 'Review and publish your portfolio'") > -1 &&
  dashboard.indexOf("label: 'Review and publish your portfolio'") < dashboard.indexOf("label: 'Run your Evidence Audit'"))
expect('dashboard asks for Publish only after generated-portfolio value and keeps its context',
  dashboard.includes("!isPro && latestGeneratedPortfolio && latestGeneratedPortfolio.status !== 'published'") &&
  dashboard.includes('<Link href={latestPortfolioHref}>') &&
  dashboard.includes('Review &amp; publish') &&
  !dashboard.includes('<Link href="/billing">\n                  <Zap'))
expect('builder list labels generated drafts Review & publish', builderIndex.includes("'Review & publish'"))
expect('first generated portfolio no longer auto-opens a referral dialog',
  !builderEditor.includes('CompletionReferralDialog') &&
  !builderEditor.includes('showcase_referral_prompted'))
expect('generation completion offers an explicit Publish live action',
  builderEditor.includes("label: 'Publish live'") && builderEditor.includes('void togglePublish()'))
expect('a generated private preview keeps a persistent Publish decision in context',
  builderEditor.includes("hero?.headline && portfolio?.status !== 'published'") &&
  builderEditor.includes('Ready to share this portfolio?') &&
  builderEditor.includes('See Pro publishing options') &&
  builderEditor.includes("isPro ? 'Publish now' : 'See Pro publishing options'") &&
  builderEditor.includes('onClick={togglePublish}'))
expect('the persistent Publish decision preserves a private draft until explicit action',
  builderEditor.includes('Your draft stays private until you choose Publish.') &&
  builderEditor.includes('Your draft stays private. Pro unlocks this live URL'))
expect('publish intent still goes through the authenticated publish route',
  builderEditor.includes("fetch('/api/portfolio/publish'"))
expect('the editor never starts Checkout directly',
  !builderEditor.includes("fetch('/api/stripe/create-checkout-session'"))
expect('paywall buttons still route through Billing instead of bypassing the approval hold',
  publishPaywall.includes('router.push(`/billing?${params.toString()}`)') &&
  !publishPaywall.includes("fetch('/api/stripe/create-checkout-session'"))
expect('paywall plan choices fit their decision column with compact, truthful pricing',
  publishPaywall.includes('<span>Monthly Pro</span>') &&
  publishPaywall.includes('$15/month') &&
  publishPaywall.includes('Annual Pro') &&
  publishPaywall.includes('Save $30') &&
  publishPaywall.includes('$150/year') &&
  !publishPaywall.includes('sm:grid-cols-2') &&
  !publishPaywall.includes('Publish live · $15/month'))
expect('mobile paywall shows the upgrade decision before the duplicate portfolio preview',
  publishPaywall.includes('order-2 border-t') &&
  publishPaywall.includes('order-1 space-y-6') &&
  publishPaywall.includes('lg:order-1') &&
  publishPaywall.includes('lg:order-2'))
expect('paywall states the explicit post-payment Publish step',
  publishPaywall.includes('Checkout upgrades your account; it does not publish this draft.') &&
  publishPaywall.includes('return to this portfolio and choose Publish'))
expect('Billing preserves publish intent in its visible decision copy',
  billing.includes("const fromPublish = searchParams.get('source') === 'publish'") &&
  billing.includes("fromPublish ? 'Put your portfolio' : 'Invest in your'") &&
  billing.includes("fromPublish ? 'Continue with Pro' : 'Upgrade to Pro'"))
expect('Billing repeats that Checkout does not auto-publish',
  billing.includes('Checkout upgrades your account; it does not publish your draft.') &&
  billing.includes('return to your portfolio and choose Publish'))
expect('Billing keeps the approved two-step Checkout implementation unchanged',
  billing.includes("fetch('/api/stripe/create-checkout-session'") &&
  billing.includes("body: JSON.stringify({ plan, source: searchParams.get('source') ?? 'billing' })"))
expect('signup intent is measured once without recording form values',
  signup.includes("trackMarketingEvent('signup_started', { route: '/signup', cta_label: method })") &&
  signup.includes("onFocusCapture={() => markSignupStarted('email')}") &&
  signup.includes("onStart={() => markSignupStarted('google')}") &&
  signup.includes('if (signupStarted.current) return') &&
  !signup.includes("trackMarketingEvent('signup_started', { email"))
expect('Google signup exposes a pre-redirect intent callback',
  googleButton.includes('onStart?: () => void') &&
  googleButton.indexOf('onStart?.()') < googleButton.indexOf('signInWithOAuth'))
expect('the mobile sticky CTA uses the same durable click tracking as other signup links',
  stickyMobileCta.includes('<TrackedLink') &&
  stickyMobileCta.includes('event="hero_primary_cta_clicked"') &&
  stickyMobileCta.includes('ctaLabel="sticky_mobile"'))

if (failures > 0) {
  console.log(`\n${failures} first-sale path check(s) failed.`)
  process.exit(1)
}

console.log('\nThe pre-Checkout handoff is intact and the checkout-hardening hold remains respected.')
