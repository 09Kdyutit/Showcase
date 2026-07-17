'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, Zap, CreditCard, ArrowRight, AlertCircle, ExternalLink, Crown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PageShell, PageHeader } from '@/components/shared/page-header'
import type { Subscription } from '@/types/database'

const PRO_FEATURES = [
  'Publish your portfolio at /p/your-name with a social preview card',
  'Regenerate portfolios up to 10 times per day',
  '10 full evidence audits per day',
  '15 tailored applications and 40 cover letters per day',
  '25 resume analyses and 20 ATS checks per day',
  '150 written interviews per billing period',
  'Standalone HTML portfolio export',
]

type CheckoutPlan = 'monthly' | 'annual' | 'founding'

interface FoundingAvailability {
  configured: boolean
  available: boolean
  remaining: number | null
  limit?: number
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [founding, setFounding] = useState<FoundingAvailability | null>(null)
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
    searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual'
  )

  useEffect(() => {
    const supabase = createClient()
    const sessionId = searchParams.get('session_id')
    let cancelled = false

    const fetchSub = async () =>
      (await supabase.from('subscriptions').select('*').maybeSingle()).data
    const fetchFounding = async () => {
      const response = await fetch('/api/stripe/founding-availability', { cache: 'no-store' })
      return response.ok ? response.json() as Promise<FoundingAvailability> : null
    }
    const isProRow = (s: Subscription | null) => s?.status === 'active' || s?.status === 'trialing'

    async function init() {
      const [data, foundingData] = await Promise.all([fetchSub(), fetchFounding()])
      if (cancelled) return
      setSub(data)
      setFounding(foundingData)
      setLoading(false)

      // Returned from a successful Stripe Checkout. The webhook that flips the row to
      // 'active' usually lands within a few seconds, so poll briefly for the fast path.
      if (sessionId && !isProRow(data)) {
        setConfirming(true)
        for (let i = 0; i < 5 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          const fresh = await fetchSub()
          if (cancelled) return
          if (isProRow(fresh)) {
            setSub(fresh)
            setConfirming(false)
            toast.success('Welcome to Showcase Pro! Your account is upgraded.')
            router.refresh()
            router.replace('/billing')
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
              setSub(await fetchSub())
              setConfirming(false)
              toast.success('Welcome to Showcase Pro! Your account is upgraded.')
              router.refresh()
              router.replace('/billing')
              return
            }
          } catch { /* fall through to the finalizing message */ }
        }
        if (!cancelled) {
          setConfirming(false)
          toast.message('Payment received — your upgrade is finalizing. If it does not appear after a few minutes, contact support with your account email and checkout time.')
          router.replace('/billing')
        }
      } else if (sessionId) {
        // Already Pro on arrival (webhook beat the redirect) — just tidy the URL.
        router.refresh()
        router.replace('/billing')
      }
    }

    init()
    return () => { cancelled = true }
  }, [searchParams, router])

  const isPro = sub?.status === 'active' || sub?.status === 'trialing'
  const fromPublish = searchParams.get('source') === 'publish'
  const fromAudit = searchParams.get('source') === 'audit'
  const fromExport = searchParams.get('source') === 'export'
  const fromTailor = searchParams.get('source') === 'tailor'
  const fromUpgradeIntent = fromPublish || fromAudit || fromExport || fromTailor
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
      : {
          title: 'Invest in your',
          titleAccent: 'career.',
          description: 'Manage your subscription and payment details.',
        }

  async function startCheckout(plan: CheckoutPlan = billingCycle) {
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
      if (plan === 'founding') {
        fetch('/api/stripe/founding-availability', { cache: 'no-store' })
          .then((response) => response.ok ? response.json() : null)
          .then((data) => { if (data) setFounding(data) })
          .catch(() => {})
      }
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
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <PageShell>
    <div className="p-6 max-w-3xl mx-auto space-y-8">
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
      {(!fromUpgradeIntent || isPro) && <Card className="bg-surface-100 border-border">
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

      {/* Upgrade card (if free) */}
      {!isPro && (
        <>
        {founding?.configured && founding.available && typeof founding.remaining === 'number' && (
          <div className="relative overflow-hidden rounded-2xl border border-brand-500/35 bg-brand-500/5 p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/70 to-transparent" />
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <Badge variant="pro" className="mb-3"><Crown className="h-3 w-3" /> Founding member</Badge>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">$99</span>
                  <span className="text-muted-foreground">/year</span>
                </div>
              </div>
              <p className="text-sm font-semibold text-brand-300">
                {founding.remaining} of {founding.limit ?? 10} spots left
              </p>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Ten database-capped annual subscriptions at the Founding price. The live counter includes active memberships and unexpired checkout holds.
            </p>
            <ul className="my-6 grid gap-3 text-sm text-foreground/80 sm:grid-cols-2">
              {[
                'Everything in Pro, including your portfolio live',
                '$99/year locked while continuously subscribed',
                'One of ten database-capped Founding memberships',
                'Same product access and limits as Pro',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" /> {feature}
                </li>
              ))}
            </ul>
            <Button
              variant="gradient"
              size="lg"
              onClick={() => startCheckout('founding')}
              loading={checkoutLoading && checkoutPlan === 'founding'}
              disabled={checkoutLoading && checkoutPlan !== 'founding'}
              className="gap-2"
            >
              <Crown className="h-4 w-4" /> Claim a founding spot · $99/year <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="mt-3 text-xs text-muted-foreground/70">
              Renews at $99/year while continuously subscribed. Standard refund policy applies. The live counter includes active members and checkout holds.
            </p>
          </div>
        )}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-50 p-8">
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
            <div className="grid grid-cols-2 gap-1.5 mb-6 p-1 rounded-xl bg-secondary border border-border">
              <button
                onClick={() => setBillingCycle('monthly')}
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
                onClick={() => setBillingCycle('annual')}
                className={cn(
                  'relative px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
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
              className="w-full sm:w-auto gap-2"
            >
              <Zap className="h-4 w-4" />
              {fromPublish ? 'Continue with Pro' : fromAudit ? 'Unlock full Audit' : fromExport ? 'Unlock HTML export' : fromTailor ? 'Unlock application kit' : 'Upgrade to Pro'} - {billingCycle === 'annual' ? '$150/yr' : '$15/mo'}
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
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground/60">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Cancel anytime</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Secure via Stripe</span>
            </div>
          </div>
        </div>
        </>
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
