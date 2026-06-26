'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Zap, CreditCard, ArrowRight, AlertCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Subscription } from '@/types/database'

const PRO_FEATURES = [
  'Full AI portfolio generation',
  'Complete ProofScore audit (all 11 categories)',
  'Resume bullet improvement',
  'Public portfolio at /p/your-name',
  'PDF and recruiter summary export',
  'Role-specific portfolio versions',
  'Unlimited portfolio projects',
]

export default function BillingPage() {
  const searchParams = useSearchParams()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
    searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual'
  )

  useEffect(() => {
    const supabase = createClient()
    supabase.from('subscriptions').select('*').maybeSingle().then(({ data }) => {
      setSub(data)
      setLoading(false)
    })
  }, [])

  const isPro = sub?.status === 'active' || sub?.status === 'trialing'

  async function startCheckout() {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billingCycle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout')
      setCheckoutLoading(false)
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
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription and payment details.</p>
      </div>

      {/* Current plan */}
      <Card className="bg-surface-100 border-border">
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
      </Card>

      {/* Upgrade card (if free) */}
      {!isPro && (
        <div className="relative overflow-hidden rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-950/60 to-surface-100 p-8">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-start justify-between mb-6">
              <div>
                <Badge variant="pro" className="mb-3">
                  <Zap className="h-3 w-3" />
                  Showcase Pro
                </Badge>
                {billingCycle === 'annual' ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">$12.50</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-emerald-400 font-medium mt-1">$150 billed annually  -  save $30</p>
                  </>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">$15</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                )}
              </div>
            </div>

            {/* Billing cycle toggle */}
            <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-xl bg-black/30 border border-white/10">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-sm font-semibold transition-all',
                  billingCycle === 'monthly'
                    ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-[0_0_20px_rgba(99,70,200,0.4)]'
                    : 'text-brand-300 hover:text-brand-200'
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={cn(
                  'relative px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  billingCycle === 'annual'
                    ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-[0_0_20px_rgba(99,70,200,0.4)]'
                    : 'text-brand-300 hover:text-brand-200'
                )}
              >
                Annual
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  billingCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-brand-500/10 border border-brand-500/30 text-brand-300'
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
              onClick={startCheckout}
              loading={checkoutLoading}
              className="w-full sm:w-auto gap-2 shadow-glow"
            >
              <Zap className="h-4 w-4" />
              Upgrade to Pro  -  {billingCycle === 'annual' ? '$150/yr' : '$15/mo'}
              <ArrowRight className="h-4 w-4" />
            </Button>
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
          { q: 'When will I be charged?', a: 'You are charged immediately on upgrade. Your subscription renews monthly on the same date.' },
          { q: 'Can I cancel anytime?', a: 'Yes. You can cancel from the billing portal. You keep Pro access until the end of your billing period.' },
          { q: 'Is there a refund policy?', a: 'We offer refunds within 7 days of purchase if you have not used Pro features. See our refund policy for details.' },
        ].map(({ q, a }) => (
          <div key={q} className="glass-card p-4">
            <p className="text-sm font-medium text-foreground mb-1">{q}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
