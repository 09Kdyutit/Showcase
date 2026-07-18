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
const navbar = source('src/components/shared/navbar.tsx')
const careerServices = source('src/app/for-career-services/page.tsx')
const resumeToPortfolio = source('src/app/resume-to-portfolio/page.tsx')
const sitemap = source('src/app/sitemap.ts')
const robots = source('src/app/robots.ts')
const pricingMetadata = source('src/app/pricing/layout.tsx')
const genericPaywall = source('src/components/ui/paywall.tsx')

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
expect('signup preserves the free-portfolio promise and explains the immediate next step',
  signup.includes('Build your portfolio free') &&
  signup.includes('Create your account, then upload a PDF/DOCX résumé or paste the text to start a private, editable portfolio draft. No credit card required.') &&
  signup.includes('Create free account') &&
  signup.includes("router.push('/onboarding')") &&
  !signup.includes('Create account and import résumé') &&
  !signup.includes('mb-3 text-sm text-muted-foreground lg:hidden'))
expect('Google signup exposes a pre-redirect intent callback',
  googleButton.includes('onStart?: () => void') &&
  googleButton.indexOf('onStart?.()') < googleButton.indexOf('signInWithOAuth'))
expect('the mobile sticky CTA uses the same durable click tracking as other signup links',
  stickyMobileCta.includes('<TrackedLink') &&
  stickyMobileCta.includes('event="hero_primary_cta_clicked"') &&
  stickyMobileCta.includes('ctaLabel="sticky_mobile"'))
expect('desktop and mobile navbar signup CTAs record durable click intent',
  navbar.includes('ctaLabel="navbar_desktop"') &&
  navbar.includes('ctaLabel="navbar_mobile"') &&
  (navbar.match(/event="hero_primary_cta_clicked"/g) ?? []).length >= 2)
expect('career-services visitors have an organizer-specific inquiry path alongside student signup',
  careerServices.includes('mailto:hello@tryshowcase.ink?subject=Showcase%20Portfolio%20Sprint%20request') &&
  careerServices.includes('Ask about a no-cost, organizer-hosted 30-minute Portfolio Sprint') &&
  careerServices.includes('up to five') &&
  careerServices.includes('do not ask your organization for a member list') &&
  careerServices.includes('volunteers create their own accounts') &&
  careerServices.includes('ctaLabel="career_services_sprint_request_top"') &&
  careerServices.includes('ctaLabel="career_services_sprint_request_bottom"') &&
  careerServices.includes('ctaLabel="career_services_student_workspace_top"'))
expect('high-intent resume-to-portfolio discovery has a claim-safe measured signup path',
  resumeToPortfolio.includes("alternates: { canonical: '/resume-to-portfolio' }") &&
  resumeToPortfolio.includes("twitter: {") &&
  resumeToPortfolio.includes("card: 'summary_large_image'") &&
  resumeToPortfolio.includes('Turn your resume into a portfolio you can actually make your own.') &&
  resumeToPortfolio.includes('editable private portfolio draft') &&
  resumeToPortfolio.includes('No credit card required') &&
  resumeToPortfolio.includes('Your draft stays private') &&
  (resumeToPortfolio.match(/href="\/signup"/g) ?? []).length === 3 &&
  (resumeToPortfolio.match(/event="hero_primary_cta_clicked"/g) ?? []).length === 3 &&
  resumeToPortfolio.includes('ctaLabel="resume_to_portfolio_hero"') &&
  resumeToPortfolio.includes('ctaLabel="resume_to_portfolio_connected"') &&
  resumeToPortfolio.includes('ctaLabel="resume_to_portfolio_final"') &&
  resumeToPortfolio.includes('<ViewTracker event="landing_viewed"') &&
  resumeToPortfolio.includes('metadata={{ route: \'/resume-to-portfolio\' }}'))
expect('public discovery exposes only canonical acquisition pages',
  sitemap.includes("path: '/resume-to-portfolio'") &&
  sitemap.includes("path: '/pricing'") &&
  sitemap.includes("path: '/for-career-services'") &&
  sitemap.includes('configuredAppUrl()') &&
  !/path: '\/(?:signup|login|waitlist|proofscore|demo|api|privacy|terms|refund)/.test(sitemap) &&
  pricingMetadata.includes("alternates: { canonical: '/pricing' }") &&
  pricingMetadata.includes("url: '/pricing'"))
expect('crawler guidance links the sitemap while excluding private, retired, and token routes',
  robots.includes('`${appUrl}/sitemap.xml`') &&
  robots.includes("allow: ['/', '/resume-to-portfolio']") &&
  robots.includes("'/api/'") &&
  robots.includes("'/dashboard'") &&
  robots.includes("'/proof/'") &&
  robots.includes("'/proofscore'") &&
  robots.includes("'/shared/'") &&
  robots.includes("'/waitlist'"))
expect('the $15 monthly upgrade card preserves the advertised monthly plan in Billing',
  genericPaywall.includes("router.push('/billing?plan=monthly')") &&
  genericPaywall.includes('$15/month · Cancel anytime') &&
  billing.includes("searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual'"))

if (failures > 0) {
  console.log(`\n${failures} first-sale path check(s) failed.`)
  process.exit(1)
}

console.log('\nThe pre-Checkout handoff is intact and the checkout-hardening hold remains respected.')
