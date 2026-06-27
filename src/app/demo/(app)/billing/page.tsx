'use client'

import { CheckCircle2, CreditCard, Zap, Shield, AlertCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PRO_FEATURES = [
  'Full AI portfolio generation from resume',
  'Complete ProofScore (all 11 categories)',
  'Public portfolio at /p/alex-chen',
  'PDF & recruiter summary export',
  'Role-specific portfolio versions',
  'Unlimited portfolio projects',
  'Resume bullet improvement',
  'Priority AI processing',
  'Email support',
]

const USAGE = [
  { label: 'AI portfolio generations', used: 3, limit: 'unlimited' },
  { label: 'ProofScore audits', used: 7, limit: 'unlimited' },
  { label: 'Portfolios published', used: 1, limit: 'unlimited' },
  { label: 'Resume uploads', used: 2, limit: 'unlimited' },
]

export default function DemoBillingPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Plan</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription and payment details.</p>
      </div>

      {/* Current plan card */}
      <div className="glass-card p-6 border-brand-500/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.03] to-violet-500/[0.03]" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Showcase Pro</h2>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="pro">Pro</Badge>
                <Badge variant="success">Active</Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-foreground">$15</p>
              <p className="text-xs text-muted-foreground">per month</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-6 text-sm">
            <div className="p-3 rounded-xl bg-surface-200/60 border border-border/40">
              <p className="text-xs text-muted-foreground mb-0.5">Active since</p>
              <p className="font-medium text-foreground">January 15, 2026</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-200/60 border border-border/40">
              <p className="text-xs text-muted-foreground mb-0.5">Next renewal</p>
              <p className="font-medium text-foreground">July 17, 2026</p>
            </div>
          </div>

          <div className="flex items-start gap-2 mb-5 p-3 rounded-xl bg-surface-200/40">
            <Shield className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/80">
              Secure billing via Stripe  -  your card is never stored by Showcase.
            </p>
          </div>

          <Button variant="outline" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Manage subscription
            <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      </div>

      {/* Usage this period */}
      <Card className="bg-surface-100 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Usage this period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {USAGE.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-foreground/80">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{item.used}</span>
                <span className="text-xs text-muted-foreground">of</span>
                <Badge variant="pro" className="text-[10px] px-2">{item.limit}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pro features */}
      <Card className="bg-surface-100 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Everything included in Pro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {PRO_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-sm text-foreground/80">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cancel / downgrade */}
      <div className="glass-card p-6 border-border/40">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-foreground mb-1">Want to cancel?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can cancel anytime. You keep Pro access until{' '}
              <span className="text-foreground font-medium">July 17, 2026</span>.
              We offer a 7-day money-back guarantee.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="text-xs text-brand-600 hover:text-brand-700 transition-colors font-medium">
            Contact support
          </button>
          <span className="text-muted-foreground/30 text-xs">·</span>
          <Button variant="destructive" size="sm" className="text-xs opacity-70 hover:opacity-100">
            Cancel subscription
          </Button>
        </div>
      </div>

      {/* Refund policy */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground/50">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3" />
          7-day money-back guarantee
        </div>
        <span>·</span>
        <span>No questions asked</span>
        <span>·</span>
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-3 w-3" />
          Stripe-secured
        </div>
      </div>
    </div>
  )
}
