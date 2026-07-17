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
const exportPaywall = source('src/components/billing/export-paywall-dialog.tsx')
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
const audit = source('src/app/(app)/audit/page.tsx')
const exportFlow = source('src/lib/portfolio/export-flow.ts')
const exportHandlerStart = builderEditor.indexOf('async function exportHtml(')
const exportHandlerEnd = builderEditor.indexOf('\n  if (loading)', exportHandlerStart)
const exportHandler = builderEditor.slice(exportHandlerStart, exportHandlerEnd)
const publishHandlerStart = builderEditor.indexOf('async function togglePublish()')
const publishHandler = builderEditor.slice(publishHandlerStart, exportHandlerStart)

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
expect('generation completion exposes the generated-draft handoff without requiring a reload',
  builderEditor.includes("setPortfolio(prev => prev ? { ...prev, ai_generated_at: new Date().toISOString() } : prev)"))
expect('a generated private preview keeps a persistent Publish decision in context',
  builderEditor.includes("hero?.headline && portfolio?.status !== 'published'") &&
  builderEditor.includes('Ready to share this portfolio?') &&
  builderEditor.includes('See Pro publishing options') &&
  builderEditor.includes("isPro ? 'Publish now' : 'See Pro publishing options'") &&
  builderEditor.includes('onClick={togglePublish}'))
expect('mobile generated drafts show a stable value summary and Publish decision before the full editor',
  builderEditor.includes("const isGeneratedDraft = Boolean(portfolio?.ai_generated_at) && portfolio?.status !== 'published'") &&
  builderEditor.includes('const hasGeneratedPreview = isGeneratedDraft && Boolean(hero?.headline)') &&
  builderEditor.includes('{hasGeneratedPreview && (') &&
  builderEditor.includes('Your generated portfolio is ready') &&
  builderEditor.includes('Review the complete preview below, keep editing, or unlock its live link.') &&
  builderEditor.includes('mb-6 border-brand-500/25 p-4 lg:hidden') &&
  builderEditor.indexOf('Your generated portfolio is ready') <
    builderEditor.indexOf('{/* Editor column */}') &&
  !builderEditor.includes("hero?.headline ? 'order-2 lg:order-1'") &&
  !builderEditor.includes("hero?.headline ? 'order-1 lg:order-2'"))
expect('generated mobile drafts avoid a duplicate lower Publish card while desktop keeps it in preview context',
  builderEditor.includes("hasGeneratedPreview && 'hidden lg:block'"))
expect('generated drafts keep regeneration secondary to the contextual Publish decision',
  builderEditor.includes('hasGeneratedPreview ? (') &&
  builderEditor.includes('<details className="glass-card group overflow-hidden">') &&
  builderEditor.includes('Want a different AI draft?') &&
  builderEditor.includes('Regeneration · Pro') &&
  builderEditor.includes('View regeneration options') &&
  builderEditor.includes('group-open:rotate-180') &&
  builderEditor.includes('focus-visible:ring-inset'))
expect('the persistent Publish decision preserves a private draft until explicit action',
  builderEditor.includes('Your draft stays private until you choose Publish.') &&
  builderEditor.includes('Your draft stays private. Pro unlocks this live URL'))
expect('Publish flushes the latest editor state and stops when persistence fails',
  builderEditor.includes('const flushEditorSave = useCallback(async (): Promise<boolean>') &&
  publishHandler.includes('const saved = await flushEditorSave()') &&
  publishHandler.includes("toast.error('Save your latest changes before publishing.')") &&
  publishHandler.includes("if (!saved) {\n          toast.error('Save your latest changes before publishing.')\n          return") &&
  publishHandler.indexOf('const saved = await flushEditorSave()') <
    publishHandler.indexOf("fetch('/api/portfolio/publish'") &&
  builderEditor.includes('if (pendingSave) await pendingSave') &&
  builderEditor.includes('saveInFlightRef.current = operation') &&
  builderEditor.indexOf('saveInFlightRef.current = operation') <
    builderEditor.indexOf('const succeeded = await operation') &&
  builderEditor.includes('for (let attempt = 0; attempt < 3; attempt += 1)') &&
  builderEditor.includes('if (!await save(false)) return false') &&
  builderEditor.includes('if (editorSnapshotRef.current === lastSavedRef.current) return true') &&
  publishHandler.includes('publishingRef.current = true') &&
  publishHandler.includes("if (action === 'publish' && generatingRef.current)") &&
  publishHandler.indexOf("const action = portfolio?.status === 'published' ? 'unpublish' : 'publish'") <
    publishHandler.indexOf("if (action === 'publish' && generatingRef.current)") &&
  builderEditor.includes('<fieldset disabled={publishing || exporting} aria-busy={publishing || exporting}') &&
  publishHandler.includes("if (data.code === 'PRO_REQUIRED') {\n          // The publish eligibility request") &&
  publishHandler.indexOf("if (data.code === 'PRO_REQUIRED') {") <
    publishHandler.lastIndexOf('const saved = await flushEditorSave()') &&
  publishHandler.lastIndexOf('const saved = await flushEditorSave()') <
    publishHandler.indexOf('setPublishPaywallOpen(true)') &&
  builderEditor.includes('body: JSON.stringify({ portfolioId, ...snapshot })'))
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
  billing.includes("title: 'Put your portfolio'") &&
  billing.includes("titleAccent: 'live.'") &&
  billing.includes('Unlock a live URL and preview card with Pro.') &&
  billing.includes("fromPublish ? 'Continue with Pro' : fromAudit ? 'Unlock full Audit' : fromExport ? 'Unlock HTML export' : 'Upgrade to Pro'"))
expect('Billing repeats that Checkout does not auto-publish',
  billing.includes('Checkout upgrades your account; it does not publish your draft.') &&
  billing.includes('return to your portfolio and choose Publish'))
expect('Export flushes the exact latest editor state before either the upgrade decision or download',
  exportHandlerStart > -1 &&
  exportHandler.includes('runPortfolioExport<Response>') &&
  exportHandler.includes('lock: exportingRef') &&
  exportHandler.includes('isGenerating: generatingRef.current') &&
  exportHandler.includes('isPublishing: publishingRef.current') &&
  exportHandler.includes('clearTimeout(autosaveTimer.current)') &&
  exportHandler.includes('flushEditorSave,') &&
  exportHandler.includes("fetch('/api/portfolio/export-html'") &&
  exportFlow.includes('if (lock.current || isPublishing) return') &&
  exportFlow.includes('if (!await flushEditorSave())') &&
  exportFlow.indexOf('clearPendingSave()') < exportFlow.indexOf('if (!await flushEditorSave())') &&
  exportFlow.indexOf('if (!await flushEditorSave())') < exportFlow.indexOf('const result = await requestExport()') &&
  !exportFlow.includes('if (!isPro)'))
expect('both Free Export entry points converge on the save-safe contextual paywall',
  (builderEditor.match(/onClick=\{exportHtml\}/g) ?? []).length >= 3 &&
  builderEditor.includes('setExportPaywallOpen(true)') &&
  builderEditor.includes('<ExportPaywallDialog') &&
  builderEditor.includes('See Pro export options') &&
  !builderEditor.includes('<Link href="/billing">\n                        <Lock'))
expect('Publish and Export cannot race into competing requests or dialogs',
  publishHandler.includes('if (publishingRef.current || exportingRef.current) return') &&
  exportHandler.includes('isPublishing: publishingRef.current') &&
  builderEditor.includes('disabled={publishing || exporting}') &&
  builderEditor.includes('fieldset disabled={publishing || exporting} aria-busy={publishing || exporting}'))
expect('a stale client entitlement fails into the same Export decision instead of a dead toast',
  exportHandler.includes("data.code === 'PRO_REQUIRED'") &&
  exportHandler.includes('markNotPro: () => setIsPro(false)') &&
  exportFlow.includes("if (result.kind === 'pro-required')") &&
  (exportFlow.match(/if \(!await flushEditorSave\(\)\)/g) ?? []).length === 2 &&
  exportFlow.indexOf("if (result.kind === 'pro-required')") < exportFlow.lastIndexOf('clearPendingSave()') &&
  exportFlow.lastIndexOf('clearPendingSave()') < exportFlow.indexOf('markNotPro()') &&
  exportFlow.indexOf('markNotPro()') < exportFlow.lastIndexOf('openPaywall()'))
expect('the Export decision is transparent, contextual, and routes through Billing only',
  exportPaywall.includes('Download an HTML snapshot of this portfolio.') &&
  exportPaywall.includes('from selected saved portfolio content') &&
  exportPaywall.includes("router.push(`/billing?plan=${plan}&source=export`)") &&
  exportPaywall.includes("choosePlan('monthly')") &&
  exportPaywall.includes("choosePlan('annual')") &&
  exportPaywall.includes('$15/month') &&
  exportPaywall.includes('$150/year') &&
  exportPaywall.includes('Save $30') &&
  exportPaywall.includes('Keep editing for free') &&
  !exportPaywall.includes('Founding') &&
  !exportPaywall.includes("fetch('/api/stripe/create-checkout-session'") &&
  !builderEditor.includes("fetch('/api/stripe/create-checkout-session'"))
expect('Export copy qualifies external assets and never promises a fully embedded file',
  exportPaywall.includes('Saved image URLs and Google Fonts remain externally referenced') &&
  builderEditor.includes('Saved images and Google Fonts remain loaded from their existing URLs.') &&
  !builderEditor.includes('includes all fonts and styles') &&
  !exportPaywall.includes('your saved content, theme, and styles') &&
  !exportPaywall.includes('fully self-contained'))
expect('mobile users can reach Settings and the Export decision without horizontal modal overflow',
  builderEditor.includes('overflow-x-auto') &&
  builderEditor.includes('<TabsList className="mb-5 min-w-max">') &&
  exportPaywall.includes('w-[calc(100%-2rem)]') &&
  exportPaywall.includes('max-h-[92vh]') &&
  exportPaywall.includes('min-h-12 w-full') &&
  exportPaywall.includes('whitespace-normal'))
expect('closing the Export decision restores focus to the exact trigger that opened it',
  builderEditor.includes('returnFocusRef={exportTriggerRef}') &&
  exportPaywall.includes('onCloseAutoFocus={(event) => {') &&
  exportPaywall.includes('returnFocusRef.current.focus()'))
expect('Billing preserves Export intent and states the manual post-payment download step',
  billing.includes("const fromExport = searchParams.get('source') === 'export'") &&
  billing.includes('fromPublish || fromAudit || fromExport') &&
  billing.includes("title: 'Export your portfolio'") &&
  billing.includes("titleAccent: 'as HTML.'") &&
  billing.includes('from selected saved portfolio content') &&
  billing.includes("fromExport ? 'Unlock HTML export' : 'Upgrade to Pro'") &&
  billing.includes('it does not download the file') &&
  billing.includes('open Settings → Export, and choose Download HTML'))
expect('a completed Free audit exposes one clear, priced route to the full 11-category result',
  audit.includes('const visibleCategories = sortedCategories.filter((category) => !category.gated)') &&
  audit.includes('const gatedCategories = sortedCategories.filter((category) => category.gated)') &&
  audit.indexOf('{visibleCategories.map((cat, i) => (') < audit.indexOf('<FullAuditUpgradeCard gatedCategoryCount={gatedCategoryCount} />') &&
  audit.includes('See all 11 audit categories.') &&
  audit.includes('Free shows a score based on') &&
  audit.includes('A Pro rerun evaluates the full 11-category Audit') &&
  audit.includes('recalculates the score from every category supported by your saved materials, so it may change') &&
  audit.includes('wherever the material supports one') &&
  audit.includes('href="/billing?plan=monthly&source=audit"') &&
  (audit.match(/\/billing\?plan=monthly&source=audit/g) ?? []).length === 1 &&
  audit.includes('See Pro options · $15/mo') &&
  audit.includes('Or $150/year (save $30) · cancel anytime') &&
  audit.includes('gatedCategoryCount > 0') &&
  audit.includes('rerun the Audit to evaluate this category against your saved materials') &&
  !audit.includes("unlock this category&apos;s analysis and next fix") &&
  audit.includes("gatedCategoryCount > 0 ? 'Core category breakdown' : 'Full category breakdown'") &&
  audit.includes('flex flex-col items-start gap-1 sm:flex-row') &&
  audit.includes('h-auto w-full gap-2 whitespace-normal') &&
  !audit.includes('Founding') &&
  !audit.includes("fetch('/api/stripe/create-checkout-session'"))
expect('Billing preserves full-audit intent without changing the held Checkout implementation',
  billing.includes("const fromAudit = searchParams.get('source') === 'audit'") &&
  billing.includes("title: 'Unlock your full'") &&
  billing.includes("titleAccent: 'Evidence Audit.'") &&
  billing.includes('Free calculates your score from 4 core categories.') &&
  billing.includes('Pro evaluates the full 11-category Audit') &&
  billing.includes('recalculates from every category supported by your saved materials, so it may change') &&
  billing.includes('where the material supports them') &&
  billing.includes("fromAudit ? 'Unlock full Audit' : fromExport ? 'Unlock HTML export' : 'Upgrade to Pro'") &&
  billing.includes('it does not rerun the audit you just viewed') &&
  billing.includes('return to Evidence Audit and run it again to evaluate all 11 categories') &&
  billing.includes('marked unavailable instead of being guessed'))
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
