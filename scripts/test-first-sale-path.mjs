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
const tailorPaywall = source('src/components/billing/tailor-paywall-dialog.tsx')
const tailorStudio = source('src/app/(app)/jobs/[savedJobId]/tailor/page.tsx')
const tailorRoute = source('src/app/api/jobs/[id]/tailor/route.ts')
const interviewPaywall = source('src/components/billing/interview-paywall-dialog.tsx')
const interviewSetup = source('src/app/(app)/interviews/new/page.tsx')
const interviewResults = source('src/app/(app)/interviews/[sessionId]/results/page.tsx')
const interviewUsage = source('src/components/interviews/hub/usage-summary.tsx')
const opportunitiesForYouRoute = source('src/app/api/opportunities/for-you/route.ts')
const opportunitiesView = source('src/components/opportunities/opportunities-view.tsx')
const interviewSessionRoute = source('src/app/api/interviews/sessions/route.ts')
const interviewRetryRoute = source('src/app/api/interviews/sessions/[id]/answers/[questionId]/retry/route.ts')
const interviewUpgradeIntent = source('src/lib/interviews/upgrade-intent.ts')
const interviewEntitlementUsage = source('src/lib/interviews/entitlements/usage.ts')
const rateLimit = source('src/lib/ai/rate-limit.ts')
const featureUsageLeases = source('src/lib/ai/feature-usage-leases.ts')
const useUserHook = source('src/hooks/use-user.ts')
const billing = source('src/app/(app)/billing/page.tsx')
const signup = source('src/app/(auth)/signup/page.tsx')
const onboarding = source('src/app/(app)/onboarding/page.tsx')
const onboardingWalkthrough = source('src/components/onboarding/walkthrough.tsx')
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

expect('newly confirmed users reach résumé intake before any product tour',
  onboarding.includes("useState<Phase>('upload')") &&
  !onboarding.includes("useState<Phase>('boot')") &&
  !onboarding.includes("setPhase(seen ? 'upload' : 'tour')") &&
  onboarding.indexOf("if (phase === 'upload')") > -1 &&
  onboarding.includes('<FileUploadZone onText={handleResumeText} />'))
expect('the workspace tour remains an explicit optional action',
  onboarding.includes('Preview the three-step process · 1 minute') &&
  onboarding.includes('restoreResumeFocusRef.current = true') &&
  onboarding.includes('resumeHeadingRef.current?.focus()') &&
  onboardingWalkthrough.includes("export function Walkthrough({ onDone }") &&
  onboardingWalkthrough.includes('tourHeadingRef.current?.focus()') &&
  onboardingWalkthrough.includes('}, [i])') &&
  !onboardingWalkthrough.includes("e.key === 'ArrowRight' || e.key === 'Enter'") &&
  !onboardingWalkthrough.includes('TOUR_DONE_KEY') &&
  onboardingWalkthrough.includes('Skip tour'))
expect('resume mutations stay disabled until callback admission and JWT refresh are authoritative',
  onboarding.includes('const [admissionPending, setAdmissionPending] = useState(true)') &&
  onboarding.includes('disabled={admissionPending}') &&
  onboarding.includes('aria-busy={admissionPending}') &&
  !onboarding.includes('ADMISSION_REFRESH_PENDING_KEY') &&
  onboarding.includes("data.user?.app_metadata?.showcase_admitted !== true") &&
  onboarding.includes('navigation below is URL') &&
  onboarding.match(/setAdmissionPending\(false\)/g)?.length === 2 &&
  onboarding.includes('aria-disabled={admissionChecking}') &&
  onboarding.includes('resumeHeadingRef.current?.focus()') &&
  onboarding.includes('Try access check again') &&
  onboarding.includes('No résumé was submitted.'))

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
  publishPaywall.includes('Continue with monthly Pro') &&
  publishPaywall.includes('$15/month') &&
  publishPaywall.includes('Continue with annual Pro') &&
  publishPaywall.includes('Save $30') &&
  publishPaywall.includes('$150/year') &&
  (publishPaywall.match(/whitespace-normal/g) ?? []).length >= 2 &&
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
  billing.includes("fromPublish ? 'Continue with Pro' : fromAudit ? 'Increase Audit frequency' : fromExport ? 'Unlock HTML export' : fromTailor ? 'Unlock application kit' : fromInterview ? 'Unlock Interview Lab' : 'Upgrade to Pro'"))
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
  billing.includes('fromPublish || fromAudit || fromExport || fromTailor || fromInterview') &&
  billing.includes("title: 'Export your portfolio'") &&
  billing.includes("titleAccent: 'as HTML.'") &&
  billing.includes('from selected saved portfolio content') &&
  billing.includes("fromExport ? 'Unlock HTML export' : fromTailor ? 'Unlock application kit' : fromInterview ? 'Unlock Interview Lab' : 'Upgrade to Pro'") &&
  billing.includes('it does not download the file') &&
  billing.includes('open Settings → Export, and choose Download HTML'))
expect('the authoritative Tailor Pro response opens a contextual upgrade decision instead of a dead toast',
  tailorStudio.includes("if (code === 'PRO_REQUIRED')") &&
  tailorStudio.includes('setTailorPaywallOpen(true)') &&
  tailorStudio.includes('<TailorPaywallDialog') &&
  !tailorStudio.includes("toast.error('Tailor Studio requires Pro')"))
expect('Tailor keeps generation behind the server entitlement gate before AI work',
  tailorRoute.includes("code: 'PRO_REQUIRED'") &&
  tailorRoute.indexOf("code: 'PRO_REQUIRED'") < tailorRoute.indexOf('runPromptWithQuota('))
expect('the Tailor decision is contextual, priced, reversible, and routes through Billing only',
  tailorPaywall.includes('Create an application kit for this saved role.') &&
  tailorPaywall.includes('editable résumé draft grounded in your saved experience and this role') &&
  tailorPaywall.includes('Review it before use;') &&
  tailorPaywall.includes('Showcase does not submit applications.') &&
  tailorPaywall.includes('accept or revert suggested experience-bullet changes') &&
  tailorPaywall.includes("router.push(`/billing?plan=${plan}&source=tailor`)") &&
  tailorPaywall.includes("choosePlan('monthly')") &&
  tailorPaywall.includes("choosePlan('annual')") &&
  tailorPaywall.includes('$15/month') &&
  tailorPaywall.includes('$150/year') &&
  tailorPaywall.includes('Save $30') &&
  tailorPaywall.includes('Keep this role saved for free') &&
  tailorPaywall.includes('it does not generate or submit the kit') &&
  !tailorPaywall.includes("fetch('/api/stripe/create-checkout-session'"))
expect('closing the Tailor decision restores focus to the Generate trigger',
  tailorStudio.includes('ref={headerGenerateTriggerRef}') &&
  tailorStudio.includes('ref={primaryGenerateTriggerRef}') &&
  tailorStudio.includes("setGenerateTriggerKind(event.currentTarget === primaryGenerateTriggerRef.current") &&
  tailorStudio.includes("returnFocusRef={generateTriggerKind === 'primary'") &&
  tailorPaywall.includes('onCloseAutoFocus={(event) => {') &&
  tailorPaywall.includes('returnFocusRef.current.focus()'))
expect('Billing preserves Tailor intent and the explicit post-payment Generate step',
  billing.includes("const fromTailor = searchParams.get('source') === 'tailor'") &&
  billing.includes('fromPublish || fromAudit || fromExport || fromTailor || fromInterview') &&
  billing.includes("title: 'Build your role-specific'") &&
  billing.includes("titleAccent: 'application kit.'") &&
  billing.includes('Showcase never submits the application for you.') &&
  billing.includes("fromTailor ? 'Unlock application kit' : fromInterview ? 'Unlock Interview Lab' : 'Upgrade to Pro'") &&
  billing.includes('it does not generate or submit the kit') &&
  billing.includes('return to this saved role, review your options, and choose Generate'))
expect('Interview Lab paid choices and real 403 quota denials open one contextual decision instead of dead toasts',
  interviewSetup.includes('function openInterviewPaywall(') &&
  interviewSetup.includes('loading: entitlementLoading') &&
  interviewSetup.includes('const isVerifiedFree = Boolean(') &&
  interviewSetup.includes('!authError && !subscriptionError && !isPro') &&
  interviewSetup.includes('disabled={resolving}') &&
  interviewSetup.includes('disabled={submitting || entitlementLoading}') &&
  interviewSetup.includes("openInterviewPaywall({ kind: 'session-type'") &&
  interviewSetup.includes("openInterviewPaywall({ kind: 'difficulty'") &&
  interviewSetup.includes("openInterviewPaywall({ kind: 'question-count'") &&
  interviewSetup.includes("allowedCodes: ['AUDIO_LIMIT_REACHED']") &&
  interviewSetup.includes("allowedCodes: ['SESSION_LIMIT_REACHED']") &&
  interviewSetup.includes('tier: json.tier') &&
  interviewSetup.includes('<InterviewPaywallDialog') &&
  !interviewSetup.includes("toast.error('This session type requires Pro.')") &&
  !interviewSetup.includes("toast.error('Challenging difficulty requires Pro.')") &&
  !interviewSetup.includes("toast.error('More than 10 questions requires Pro.')"))
expect('Interview retry text survives a real Free retry denial while the upgrade decision opens',
  interviewResults.includes("allowedCodes: ['RETRY_LIMIT_REACHED']") &&
  interviewResults.includes('tier: json.tier') &&
  interviewResults.includes("setInterviewPaywallReason({ kind: 'retry', label: 'more answer retries' })") &&
  interviewResults.includes('onClick={(event) => handleSubmitRetry(retryQuestionId, event.currentTarget)}') &&
  interviewResults.includes('<InterviewPaywallDialog') &&
  interviewResults.includes('sessionStorage.setItem(') &&
  interviewResults.includes('serializeInterviewRetryUpgradeIntent({') &&
  interviewResults.includes('if (!open) clearStoredRetryIntent()') &&
  interviewResults.includes('sessionStorage.removeItem(INTERVIEW_RETRY_CHECKOUT_ORIGIN_STORAGE_KEY)') &&
  interviewResults.includes("toast.error('Could not submit retry. Your answer is still here; please try again.')") &&
  interviewResults.includes('submittingRetryRef.current = false') &&
  interviewResults.indexOf('setRetryResults(') < interviewResults.indexOf("setRetryText('')"))
expect('the Interview Lab decision is contextual, priced, reversible, focus-safe, and routes through Billing only',
  interviewPaywall.includes('additional session styles') &&
  interviewPaywall.includes('up to 30 questions in a written session') &&
  interviewPaywall.includes('up to 150 total interview sessions per billing period') &&
  interviewPaywall.includes("router.push(`/billing?plan=${plan}&source=interview${intent}`)") &&
  interviewPaywall.includes("const intent = retryIntent ? '&intent=retry' : ''") &&
  interviewPaywall.includes("choosePlan('monthly')") &&
  interviewPaywall.includes("choosePlan('annual')") &&
  interviewPaywall.includes('$15/month') &&
  interviewPaywall.includes('$150/year') &&
  interviewPaywall.includes('Save $30') &&
  interviewPaywall.includes('Review existing interviews') &&
  interviewPaywall.includes('Review this completed interview') &&
  interviewPaywall.includes('Choose a Free practice option') &&
  interviewPaywall.includes('Get more answer retries across your billing period') &&
  interviewPaywall.includes('it does not create or start an interview') &&
  interviewPaywall.includes('it does not submit the retry') &&
  interviewPaywall.includes('onCloseAutoFocus={(event) => {') &&
  interviewPaywall.includes('returnFocusRef.current.focus()') &&
  !interviewPaywall.includes('Founding') &&
  !interviewPaywall.includes("fetch('/api/stripe/create-checkout-session'"))
expect('exhausted Interview Lab usage keeps monthly plan and purchase context through Billing',
  interviewUsage.includes('href="/billing?plan=monthly&source=interview"') &&
  interviewUsage.includes('$15/mo or $150/yr'))
expect('Billing preserves Interview Lab intent and explains the manual post-payment return',
  billing.includes("const explicitInterviewRetry = searchParams.get('source') === 'interview' && searchParams.get('intent') === 'retry'") &&
  billing.includes('const fromInterviewRetry = explicitInterviewRetry || fromStoredInterviewReturn') &&
  billing.includes('hasStoredRetryCheckoutOrigin') &&
  billing.includes('fromPublish || fromAudit || fromExport || fromTailor || fromInterview') &&
  billing.includes("title: 'Continue your interview'") &&
  billing.includes("titleAccent: 'practice.'") &&
  billing.includes('up to 30 questions per written session') &&
  billing.includes('up to 150 total interview sessions per billing period') &&
  billing.includes("title: 'Retry this interview'") &&
  billing.includes('it does not submit the retry') &&
  billing.includes('Your typed draft is kept in this browser tab') &&
  billing.includes('isPro && fromInterviewRetry && storedInterviewIntent') &&
  billing.includes('Your retry is ready to continue') &&
  billing.includes('Return to completed interview') &&
  billing.includes("fromInterview ? 'Unlock Interview Lab' : 'Upgrade to Pro'") &&
  billing.includes('it does not create or start an interview') &&
  billing.includes('return to Interview Lab and choose New Interview'))
expect('a retained retry draft cannot take over an unrelated Checkout return',
  billing.includes('INTERVIEW_RETRY_CHECKOUT_ORIGIN_STORAGE_KEY') &&
  billing.includes('interviewRetryCheckoutOriginValue(storedInterviewIntent)') &&
  billing.includes('const billingReturnPath = hasStoredRetryCheckoutOrigin') &&
  billing.includes('const fromStoredInterviewReturn = hasStoredRetryCheckoutOrigin') &&
  billing.includes('sessionStorage.removeItem(INTERVIEW_RETRY_CHECKOUT_ORIGIN_STORAGE_KEY)') &&
  billing.includes('sessionStorage.removeItem(INTERVIEW_UPGRADE_INTENT_STORAGE_KEY)'))
expect('Billing never labels a paid account Free when its subscription read fails',
  billing.includes("const [planReadError, setPlanReadError] = useState<string | null>(null)") &&
  billing.includes("const { data, error } = await supabase.from('subscriptions').select('*').maybeSingle()") &&
  billing.includes('if (error) throw new Error(error.message)') &&
  billing.includes('No checkout has been started.') &&
  billing.includes('Showcase will not label your account Free or offer another checkout') &&
  billing.includes('!confirming && !isPro') &&
  billing.indexOf('if (planReadError)') >= 0 &&
  billing.indexOf('{/* Upgrade card (if free) */}') >= 0 &&
  billing.indexOf('if (planReadError)') < billing.indexOf('{/* Upgrade card (if free) */}'))
expect('Billing plan selection and contextual CTA remain usable and announced on narrow screens',
  billing.includes('role="group" aria-label="Billing cycle"') &&
  billing.includes("aria-pressed={billingCycle === 'monthly'}") &&
  billing.includes("aria-pressed={billingCycle === 'annual'}") &&
  billing.includes('flex flex-col items-center justify-center gap-1') &&
  billing.includes('h-auto min-h-11 w-full gap-2 whitespace-normal px-4 py-3 text-center') &&
  billing.includes('p-5 sm:p-8'))
expect('only authoritative Free 403 entitlement denials can be offered an Interview upgrade',
  interviewUpgradeIntent.includes("input.status === 403") &&
  interviewUpgradeIntent.includes("input.tier === 'free'") &&
  interviewSessionRoute.includes('code: e.code, tier: e.tier') &&
  interviewRetryRoute.includes('code: e.code, tier: e.tier') &&
  interviewSessionRoute.includes("code: 'SESSION_TYPE_REQUIRES_PRO', tier") &&
  interviewSessionRoute.includes("code: 'DIFFICULTY_REQUIRES_PRO', tier"))
expect('subscription read failures stay transient instead of being mislabeled as Free',
  rateLimit.includes('export async function isProUserStrict(') &&
  rateLimit.includes('if (error) {') &&
  rateLimit.includes('if (!data) return false') &&
  rateLimit.includes('if (!data.current_period_end) return true') &&
  interviewEntitlementUsage.includes("'ENTITLEMENT_UNAVAILABLE'") &&
  interviewEntitlementUsage.includes('subscription verification failed') &&
  interviewEntitlementUsage.includes("'Your Pro billing period could not be verified right now. Please try again shortly.'") &&
  interviewEntitlementUsage.includes("'pro',") &&
  interviewEntitlementUsage.includes('503,') &&
  !interviewEntitlementUsage.includes("import { isProUser }") &&
  interviewSessionRoute.includes('planContext = await resolvePlanContext(serviceSupabase, user.id)') &&
  interviewSessionRoute.indexOf('planContext = await resolvePlanContext(serviceSupabase, user.id)') < interviewSessionRoute.indexOf('const limits = getPlanLimits(tier)') &&
  useUserHook.includes('subscriptionError') &&
  useUserHook.includes('if (subRes.error)') &&
  useUserHook.includes('setLoading(false)') &&
  interviewSetup.includes('const isVerifiedFree = Boolean(') &&
  interviewSetup.includes('!authError && !subscriptionError && !isPro'))
expect('written question-count entitlement is rejected before reservation, session creation, or AI work',
  interviewSessionRoute.includes('if (!isWrittenQuestionCountAllowed(tier, input.deliveryMode, input.questionCount))') &&
  interviewSessionRoute.includes("code: 'QUESTION_COUNT_EXCEEDS_PLAN'") &&
  !interviewSessionRoute.includes('if (input.durationMinutes > limits.maxSessionMinutes)') &&
  interviewSessionRoute.indexOf('if (!isWrittenQuestionCountAllowed(tier, input.deliveryMode, input.questionCount))') >= 0 &&
  interviewSessionRoute.indexOf('await reserveSessionUsage(') >= 0 &&
  interviewSessionRoute.indexOf(".from('interview_sessions')") >= 0 &&
  interviewSessionRoute.indexOf('await generatePersonalizedQuestions(') >= 0 &&
  interviewSessionRoute.indexOf('if (!isWrittenQuestionCountAllowed(tier, input.deliveryMode, input.questionCount))') < interviewSessionRoute.indexOf('await reserveSessionUsage(') &&
  interviewSessionRoute.indexOf('if (!isWrittenQuestionCountAllowed(tier, input.deliveryMode, input.questionCount))') < interviewSessionRoute.indexOf(".from('interview_sessions')") &&
  interviewSessionRoute.indexOf('if (!isWrittenQuestionCountAllowed(tier, input.deliveryMode, input.questionCount))') < interviewSessionRoute.indexOf('await generatePersonalizedQuestions('))
expect('personalised opportunity matching is enforced as Pro on the server before profile data or scoring',
  opportunitiesForYouRoute.includes("import { isProUserStrict } from '@/lib/ai/rate-limit'") &&
  opportunitiesForYouRoute.includes('isPro = await isProUserStrict(user.id)') &&
  opportunitiesForYouRoute.includes("code: 'SUBSCRIPTION_VERIFICATION_FAILED'") &&
  opportunitiesForYouRoute.includes('if (!isPro)') &&
  opportunitiesForYouRoute.includes("code: 'PRO_REQUIRED'") &&
  opportunitiesForYouRoute.includes('Personalised opportunity matching requires Pro.') &&
  opportunitiesForYouRoute.indexOf('await isProUserStrict(user.id)') >= 0 &&
  opportunitiesForYouRoute.indexOf("code: 'PRO_REQUIRED'") >= 0 &&
  opportunitiesForYouRoute.indexOf(".from('resumes')") >= 0 &&
  opportunitiesForYouRoute.indexOf('fetchAllOpportunities()') >= 0 &&
  opportunitiesForYouRoute.indexOf('await isProUserStrict(user.id)') < opportunitiesForYouRoute.indexOf(".from('resumes')") &&
  opportunitiesForYouRoute.indexOf("code: 'PRO_REQUIRED'") < opportunitiesForYouRoute.indexOf('fetchAllOpportunities()') &&
  opportunitiesView.includes('loading: entitlementLoading') &&
  opportunitiesView.includes('authError') &&
  opportunitiesView.includes('subscriptionError') &&
  opportunitiesView.includes('const isVerifiedFree = Boolean(') &&
  opportunitiesView.includes("view === 'for-you'") &&
  opportunitiesView.includes('void fetchForYou()') &&
  opportunitiesView.includes('Your plan could not be verified') &&
  opportunitiesView.includes('isVerifiedFree || forYouAccessDenied'))
expect('Free and Pro receive the same complete 11-dimension Audit result',
  audit.includes('{sortedCategories.map((cat, i) => (') &&
  audit.includes('{sortedCategories.length} dimensions reviewed') &&
  !audit.includes('if (cat.gated)') &&
  !audit.includes('visibleCategories') &&
  !audit.includes('gatedCategories'))
expect('the authoritative Free success limit exposes one clear, priced frequency upgrade route',
  featureUsageLeases.includes("denial.tierAtReservation === 'free' && denial.denialReason === 'success_limit'") &&
  featureUsageLeases.includes('upgradeAvailable:') &&
  audit.includes("data.code === 'RATE_LIMITED' && data.upgradeAvailable === true") &&
  audit.includes('setAuditLimitReached(true)') &&
  audit.includes('{auditLimitReached && <AuditLimitUpgradeCard />}') &&
  audit.includes('Run more complete Audits.') &&
  audit.includes('Free includes one complete 11-dimension Evidence Audit every 24 hours.') &&
  audit.includes('Pro raises that frequency to 10 complete Audits every 24 hours.') &&
  audit.includes('Your last result stays saved; Checkout does not rerun it.') &&
  audit.includes('href="/billing?plan=monthly&source=audit"') &&
  (audit.match(/\/billing\?plan=monthly&source=audit/g) ?? []).length === 1 &&
  audit.includes('Increase Audit frequency · $15/mo') &&
  audit.includes('Or $150/year (save $30) · cancel anytime') &&
  audit.includes('h-auto w-full gap-2 whitespace-normal') &&
  !audit.includes('Founding') &&
  !audit.includes("fetch('/api/stripe/create-checkout-session'"))
expect('Billing preserves frequency-only Audit intent without changing the held Checkout implementation',
  billing.includes("const fromAudit = searchParams.get('source') === 'audit'") &&
  billing.includes("title: 'Run more complete'") &&
  billing.includes("titleAccent: 'Evidence Audits.'") &&
  billing.includes('Free includes one complete 11-dimension Evidence Audit every 24 hours.') &&
  billing.includes('Pro raises the frequency to 10 complete Audits every 24 hours') &&
  billing.includes('both plans review the same 11 dimensions') &&
  billing.includes("fromAudit ? 'Increase Audit frequency' : fromExport ? 'Unlock HTML export' : fromTailor ? 'Unlock application kit' : fromInterview ? 'Unlock Interview Lab' : 'Upgrade to Pro'") &&
  billing.includes('it does not rerun an Audit') &&
  billing.includes('Your last complete Audit stays saved.') &&
  !billing.includes('Free calculates your score from 4 core categories.'))
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
  signup.includes('Create your account, then upload a PDF/DOCX résumé or paste the text. You&apos;ll review what we find before Showcase creates a private, editable portfolio draft. No credit card required.') &&
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
