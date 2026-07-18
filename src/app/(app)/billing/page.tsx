'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Zap, CreditCard, ArrowRight, AlertCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PageShell, PageHeader } from '@/components/shared/page-header'
import type { Subscription } from '@/types/database'
import {
  hasMatchingInterviewRetryCheckoutOrigin,
  INTERVIEW_UPGRADE_INTENT_STORAGE_KEY,
  INTERVIEW_RETRY_CHECKOUT_ORIGIN_STORAGE_KEY,
  interviewRetryCheckoutOriginValue,
  parseInterviewRetryUpgradeIntent,
  type InterviewRetryUpgradeIntent,
} from '@/lib/interviews/upgrade-intent'

const PRO_FEATURES = [
  'Publish your portfolio at /p/your-name with a social preview card',
  'Regenerate portfolios up to 10 times per day',
  '10 full evidence audits per day',
  '15 tailored applications and 40 cover letters per day',
  '25 resume analyses and 20 ATS checks per day',
  'Up to 150 total interview sessions per billing period',
  'Standalone HTML portfolio export',
]

type CheckoutPlan = 'monthly' | 'annual'

export default function BillingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [planReadError, setPlanReadError] = useState<string | null>(null)
  const [planRetryKey, setPlanRetryKey] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null)
  const [storedInterviewIntent] = useState<InterviewRetryUpgradeIntent | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return parseInterviewRetryUpgradeIntent(
        sessionStorage.getItem(INTERVIEW_UPGRADE_INTENT_STORAGE_KEY)
      )
    } catch {
      return null
    }
  })
  const [storedRetryCheckoutOrigin] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return sessionStorage.getItem(INTERVIEW_RETRY_CHECKOUT_ORIGIN_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const hasStoredRetryCheckoutOrigin = hasMatchingInterviewRetryCheckoutOrigin(
    storedRetryCheckoutOrigin,
    storedInterviewIntent,
  )
  const billingCycle: 'monthly' | 'annual' = searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual'

  function selectBillingCycle(plan: 'monthly' | 'annual') {
    const next = new URLSearchParams(searchParams.toString())
    next.set('plan', plan)
    router.replace(`/billing?${next.toString()}`)
  }

  useEffect(() => {
    const supabase = createClient()
    const sessionId = searchParams.get('session_id')
    const billingReturnPath = hasStoredRetryCheckoutOrigin
      ? '/billing?source=interview&intent=retry'
      : '/billing'
    let cancelled = false

    const fetchSub = async () => {
      const { data, error } = await supabase.from('subscriptions').select('*').maybeSingle()
      if (error) throw new Error(error.message)
      return data
    }
    const isProRow = (s: Subscription | null) => s?.status === 'active' || s?.status === 'trialing'

    function failPlanRead(error: unknown) {
      if (cancelled) return
      console.error(
        '[billing] subscription verification failed:',
        error instanceof Error ? error.message : 'unknown error',
      )
      setConfirming(false)
      setLoading(false)
      setPlanReadError('Your current plan could not be verified. No checkout has been started. Please try again.')
    }

    async function init() {
      let data: Subscription | null
      try {
        data = await fetchSub()
      } catch (error) {
        failPlanRead(error)
        return
      }
      if (cancelled) return
      setSub(data)
      setLoading(false)

      // Returned from a successful Stripe Checkout. The webhook that flips the row to
      // 'active' usually lands within a few seconds, so poll briefly for the fast path.
      if (sessionId && !isProRow(data)) {
        setConfirming(true)
        for (let i = 0; i < 5 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          let fresh: Subscription | null
          try {
            fresh = await fetchSub()
          } catch (error) {
            failPlanRead(error)
            return
          }
          if (cancelled) return
          if (isProRow(fresh)) {
            setSub(fresh)
            setConfirming(false)
            toast.success('Welcome to Showcase Pro! Your account is upgraded.')
            router.refresh()
            router.replace(billingReturnPath)
            return
          }
        }
        // Webhook hasn't landed. Don't leave a paying customer stuck — reconcile directly
        // against Stripe, which self-heals Pro from the paid session even if the webhook was
        // lost entirely. This is the payment safety net.
        if (!cancelled) {
          try {
            const res = await fetch('/api/stripe/reconcile-session', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            })
            const j = await res.json().catch(() => ({}))
            if (!cancelled && j.pro) {
              let reconciledSub: Subscription | null
              try {
                reconciledSub = await fetchSub()
              } catch (error) {
                failPlanRead(error)
                return
              }
              setSub(reconciledSub)
              setConfirming(false)
              toast.success('Welcome to Showcase Pro! Your account is upgraded.')
              router.refresh()
              router.replace(billingReturnPath)
              return
            }
          } catch { /* fall through to the finalizing message */ }
        }
        if (!cancelled) {
          setConfirming(false)
          toast.message('Payment received — your upgrade is finalizing. If it does not appear after a few minutes, contact support with your account email and checkout time.')
          router.replace(billingReturnPath)
        }
      } else if (sessionId) {
        // Already Pro on arrival (webhook beat the redirect) — just tidy the URL.
        router.refresh()
        router.replace(billingReturnPath)
      }
    }

    void init().catch(failPlanRead)
    return () => { cancelled = true }
  }, [searchParams, router, hasStoredRetryCheckoutOrigin, planRetryKey])

  const isPro = sub?.status === 'active' || sub?.status === 'trialing'
  const fromPublish = searchParams.get('source') === 'publish'
  const fromAudit = searchParams.get('source') === 'audit'
  const fromExport = searchParams.get('source') === 'export'
  const fromTailor = searchParams.get('source') === 'tailor'
  const explicitInterviewRetry = searchParams.get('source') === 'interview' && searchParams.get('intent') === 'retry'
  const fromStoredInterviewReturn = hasStoredRetryCheckoutOrigin && (
    searchParams.has('session_id') || searchParams.get('canceled') === 'true'
  )
  const fromInterview = searchParams.get('source') === 'interview' || fromStoredInterviewReturn
  const fromInterviewRetry = explicitInterviewRetry || fromStoredInterviewReturn
  const fromUpgradeIntent = fromPublish || fromAudit || fromExport || fromTailor || fromInterview
  const billingHeader = fromPublish
    ? {
        title: 'Put your portfolio',
        titleAccent: 'live.',
        description: 'Unlock a live URL and preview card with Pro. Your draft stays private until you explicitly publish it after checkout.',
      }
    : fromAudit
      ? {
          title: 'Unlock your full',
          titleAccent: 'Evidence Audit.',
          description: 'Free calculates your score from 4 core categories. Pro evaluates the full 11-category Audit and recalculates from every category supported by your saved materials, so it may change. It adds analysis and fixes where the material supports them, with up to 10 full audits per day.',
        }
      : fromExport
        ? {
            title: 'Export your portfolio',
            titleAccent: 'as HTML.',
            description: 'Unlock a hostable HTML snapshot from selected saved portfolio content, using its color treatment and an export-ready layout. No build tools are required; saved image URLs and Google Fonts remain externally referenced.',
          }
        : fromTailor
          ? {
              title: 'Build your role-specific',
              titleAccent: 'application kit.',
              description: 'Unlock a tailored résumé draft, Truth Ledger, and interview brief grounded in your saved resume and this role. Showcase never submits the application for you.',
            }
          : fromInterviewRetry
            ? {
                title: 'Retry this interview',
                titleAccent: 'answer.',
                description: 'Pro adds more answer retries across your billing period, plus six additional interview session styles, challenging difficulty, and up to 30 questions per written session.',
              }
          : fromInterview
            ? {
                title: 'Continue your interview',
                titleAccent: 'practice.',
                description: 'Pro adds six additional interview session styles, challenging difficulty, up to 30 questions per written session, and up to 150 total interview sessions per billing period.',
              }
            : {
                title: 'Invest in your',
                titleAccent: 'career.',
                description: 'Manage your subscription and payment details.',
              }

  async function startCheckout(plan: CheckoutPlan = billingCycle) {
    try {
      if (fromInterviewRetry && storedInterviewIntent) {
        sessionStorage.setItem(
          INTERVIEW_RETRY_CHECKOUT_ORIGIN_STORAGE_KEY,
          interviewRetryCheckoutOriginValue(storedInterviewIntent),
        )
      } else {
        sessionStorage.removeItem(INTERVIEW_RETRY_CHECKOUT_ORIGIN_STORAGE_KEY)
        sessionStorage.removeItem(INTERVIEW_UPGRADE_INTENT_STORAGE_KEY)
      }
    } catch {
      // Checkout remains usable when browser storage is disabled. Without a durable
      // marker, the generic Stripe return must not claim a retained retry handoff.
    }
    setCheckoutLoading(true)
    setCheckoutPlan(plan)
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, source: searchParams.get('source') ?? 'billing' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout')
      setCheckoutLoading(false)
      setCheckoutPlan(null)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/create-portal-session', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal')
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (planReadError) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
          <PageHeader
            eyebrow="Billing"
            title="We could not verify"
            titleAccent="your plan."
            description="Showcase will not label your account Free or offer another checkout until your current subscription can be read authoritatively."
          />
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <p className="text-sm leading-relaxed text-muted-foreground">{planReadError}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setLoading(true)
                  setPlanReadError(null)
                  setPlanRetryKey((key) => key + 1)
                }}
              >
                Try plan check again
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
    <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
      <PageHeader
        eyebrow="Billing"
        title={billingHeader.title}
        titleAccent={billingHeader.titleAccent}
        description={billingHeader.description}
      />

      {confirming && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3">
          <span className="h-4 w-4 rounded-full border-2 border-brand-400/40 border-t-brand-300 animate-spin shrink-0" />
          <p className="text-sm text-brand-200">Confirming your upgrade with Stripe. This usually takes a few seconds…</p>
        </div>
      )}

      {/* Current plan */}
      {!confirming && (!fromUpgradeIntent || isPro) && <Card className="bg-surface-100 border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            Current plan
            <Badge variant={isPro ? 'pro' : 'default'}>
              {isPro ? 'Pro' : 'Free'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPro ? (
            <>
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Active Pro subscription
              </div>
              {sub?.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  {sub.cancel_at_period_end
                    ? `Cancels on ${new Date(sub.current_period_end).toLocaleDateString()}`
                    : `Renews on ${new Date(sub.current_period_end).toLocaleDateString()}`
                  }
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openPortal}
                  loading={portalLoading}
                  className="gap-1.5"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Manage subscription
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              You are on the Free plan with limited features.
            </div>
          )}
        </CardContent>
      </Card>}

      {isPro && fromInterviewRetry && storedInterviewIntent && (
        <Card className="border-brand-500/30 bg-brand-500/5">
          <CardHeader>
            <CardTitle className="text-base">Your retry is ready to continue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your account has Pro access. Checkout did not submit the retry, and your typed draft is still in this browser tab for you to review.
            </p>
            <Button asChild type="button" className="h-auto min-h-10 whitespace-normal text-center">
              <Link href={`/interviews/${storedInterviewIntent.sessionId}/results`}>Return to completed interview</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upgrade card (if free) */}
      {!confirming && !isPro && (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-50 p-5 sm:p-8">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent" />
          <div className="relative">
            <div className="mb-6">
              <Badge variant="pro" className="mb-3">
                <Zap className="h-3 w-3" />
                Showcase Pro
              </Badge>
              {billingCycle === 'annual' ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">$150</span>
                    <span className="text-muted-foreground">/year</span>
                  </div>
                  <p className="text-sm text-emerald-400 font-medium mt-1">$12.50/month equivalent · save $30</p>
                </>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">$15</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              )}
            </div>

            {/* Billing cycle toggle */}
            <div role="group" aria-label="Billing cycle" className="mb-6 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-secondary p-1">
              <button
                type="button"
                aria-pressed={billingCycle === 'monthly'}
                onClick={() => selectBillingCycle('monthly')}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-sm font-semibold transition-all',
                  billingCycle === 'monthly'
                    ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                aria-pressed={billingCycle === 'annual'}
                onClick={() => selectBillingCycle('annual')}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition-all sm:flex-row sm:gap-2 sm:px-3',
                  billingCycle === 'annual'
                    ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Annual
                <span className={cn(
                  'text-xs font-bold px-1.5 py-0.5 rounded-full',
                  billingCycle === 'annual'
                    ? 'bg-white/20 text-white'
                    : 'bg-brand-950 border border-brand-700/40 text-brand-300'
                )}>
                  Save $30
                </span>
              </button>
            </div>

            <ul className="space-y-2.5 mb-8">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-foreground/80">
                  <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant="gradient"
              size="lg"
              onClick={() => startCheckout(billingCycle)}
              loading={checkoutLoading && checkoutPlan === billingCycle}
              disabled={checkoutLoading && checkoutPlan !== billingCycle}
              className="h-auto min-h-11 w-full gap-2 whitespace-normal px-4 py-3 text-center sm:w-auto sm:px-7"
            >
              <Zap className="h-4 w-4" />
              {fromPublish ? 'Continue with Pro' : fromAudit ? 'Unlock full Audit' : fromExport ? 'Unlock HTML export' : fromTailor ? 'Unlock application kit' : fromInterview ? 'Unlock Interview Lab' : 'Upgrade to Pro'} - {billingCycle === 'annual' ? '$150/yr' : '$15/mo'}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {fromPublish && (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Checkout upgrades your account; it does not publish your draft. After payment, return to your portfolio and choose Publish.
              </p>
            )}
            {fromAudit && (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Checkout upgrades your account; it does not rerun the audit you just viewed. After payment, return to Evidence Audit and run it again to evaluate all 11 categories. Categories without enough saved material are marked unavailable instead of being guessed.
              </p>
            )}
            {fromExport && (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Checkout upgrades your account; it does not download the file. After payment, return to this portfolio, open Settings → Export, and choose Download HTML.
              </p>
            )}
            {fromTailor && (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Checkout upgrades your account; it does not generate or submit the kit. After payment, return to this saved role, review your options, and choose Generate.
              </p>
            )}
            {fromInterviewRetry ? (
              <div className="mt-3 max-w-xl space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Checkout upgrades your account; it does not submit the retry. After payment, return to this completed interview and choose Submit Retry.
                </p>
                {storedInterviewIntent && (
                  <>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Your typed draft is kept in this browser tab until you submit or cancel it.
                    </p>
                    <Button asChild type="button" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal text-center">
                      <Link href={`/interviews/${storedInterviewIntent.sessionId}/results`}>Return to completed interview</Link>
                    </Button>
                  </>
                )}
              </div>
            ) : fromInterview && (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Checkout upgrades your account; it does not create or start an interview. After payment, return to Interview Lab and choose New Interview.
              </p>
            )}
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground/60">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Cancel anytime</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Secure via Stripe</span>
            </div>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Billing FAQ</h2>
        {[
          { q: 'When will I be charged?', a: 'You are charged immediately on upgrade. Your subscription renews on the monthly or annual cycle you choose.' },
          { q: 'Can I cancel anytime?', a: 'Yes. You can cancel from the billing portal. You keep Pro access until the end of your billing period.' },
          { q: 'Is there a refund policy?', a: 'You may request a refund within 7 days if you have not substantively used Pro features. See our refund policy for the exact conditions.' },
        ].map(({ q, a }) => (
          <div key={q} className="glass-card p-4">
            <p className="text-sm font-medium text-foreground mb-1">{q}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </div>
    </PageShell>
  )
}
