'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, Lock, ArrowRight, Zap } from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const FREE_FEATURES = [
  'Resume text parsing',
  'Basic ProofScore preview (3 categories)',
  'Draft portfolio (unpublished)',
  '1 portfolio',
  'Browse job listings (demo data)',
  'Import up to 3 job descriptions',
  'Basic role-content match score',
  '1 ATS check',
  'Pipeline with up to 5 active roles',
]
const FREE_LOCKED = [
  'Full AI generation',
  'Complete ProofScore (11 categories)',
  'Public portfolio publishing',
  'PDF export',
  'Resume bullet improvement',
  'Personalized For You job feed',
  'Full match explanations',
  'Tailor Studio (role-specific resume)',
  'Truth Ledger with source tracing',
  'Interview preparation brief',
  'ATS export validation',
  'Full application pipeline',
]
const PRO_FEATURES = [
  'Everything in Free',
  'Full AI portfolio generation from resume',
  'Complete ProofScore audit — all 11 categories',
  'AI resume bullet improvement',
  'Public portfolio at showcase.app/p/your-name',
  'PDF and recruiter summary export',
  'Role-specific portfolio versions',
  'Unlimited portfolios',
  'Personalized job feed with explainable match scores',
  'Tailor Studio — role-specific resume in one click',
  'Truth Ledger — every change traced to your real experience',
  'Interview evidence brief with STAR story mapping',
  'ATS readiness check and export validation',
  'Full application pipeline with stage tracking',
  'Cover letter and recruiter note generation',
  'Priority AI processing',
  'Email support',
]

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const isAnnual = billing === 'annual'

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Simple, honest pricing
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free with real features. Upgrade when you are ready for full AI generation, complete audits, and public publishing.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <button
            onClick={() => setBilling('monthly')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              !isAnnual
                ? 'bg-surface-200 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
              isAnnual
                ? 'bg-surface-200 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Annual
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Save $30
            </span>
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-20">
          {/* Free */}
          <div className="glass-card p-8 flex flex-col">
            <div className="mb-8">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Free</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-5xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Get started without a credit card.</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-foreground/80">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
              {FREE_LOCKED.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground/40">
                  <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href="/signup">Get started free</Link>
            </Button>
          </div>

          {/* Pro */}
          <div className="relative glass-card p-8 border-brand-500/40 flex flex-col overflow-hidden shadow-glow-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/80 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-brand-500/8 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent pointer-events-none" />
            <div className="relative flex flex-col flex-1">
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-brand-400 uppercase tracking-wider">Showcase Pro</p>
                  <Badge variant="pro">{isAnnual ? 'Best value' : 'Most popular'}</Badge>
                </div>
                {isAnnual ? (
                  <>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-5xl font-bold">$12.50</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-emerald-400 font-medium mb-1">
                      $150 billed annually — save $30 vs monthly
                    </p>
                    <p className="text-sm text-muted-foreground line-through opacity-50">$180/year if monthly</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-5xl font-bold">$15</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Full access. Cancel anytime.</p>
                  </>
                )}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-foreground/90">
                    <CheckCircle2 className="h-4 w-4 text-brand-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="space-y-3">
                <Button asChild variant="gradient" size="lg" className="w-full gap-2 shadow-glow">
                  <Link href={`/signup?plan=${billing}`}>
                    <Zap className="h-4 w-4" />
                    Start with Showcase Pro
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <div className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-400/90 text-center">7-day refund policy — no questions asked</p>
                </div>
                <p className="text-xs text-muted-foreground/60 text-center">Secure payment via Stripe</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-foreground text-center mb-8">Common questions</h2>
          <div className="space-y-4">
            {[
              { q: 'What happens when I cancel?', a: 'You keep Showcase Pro access until the end of your billing period. After that, your account reverts to Free and all your data — portfolio content, ProofScore history, and uploaded materials — is preserved.' },
              { q: 'Is there a free trial for Pro?', a: 'No trial with auto-charge. We have a real Free tier so you can explore the product and see its value before upgrading. Most people upgrade after seeing their first ProofScore audit.' },
              { q: 'Does Showcase guarantee job interviews?', a: 'No. Showcase helps you present your real experience more clearly and professionally. Your results depend on your background, the roles you target, and the market. We help you put your best work forward — not guarantee outcomes.' },
              { q: 'Can I get a refund?', a: 'Yes. If you are not satisfied within the first 7 days of your Showcase Pro subscription, we will refund you in full — no questions asked. Just reach out to our support team.' },
              { q: 'Will Showcase invent experience I do not have?', a: 'Never. Our AI only works with what you provide. It will rewrite and improve how your real experience is presented, but it will not fabricate metrics, employers, projects, or certifications. It will tell you what evidence is missing and suggest where to add proof.' },
              { q: 'Can I have multiple portfolios?', a: 'Yes, Showcase Pro supports unlimited portfolios. This is useful for targeting different roles or industries — for example, a separate portfolio for product management roles and one for consulting roles.' },
              { q: 'What file formats can I import?', a: 'You can paste your resume as plain text, or upload a PDF or DOCX file. Showcase parses it automatically and uses it as the foundation for your portfolio content.' },
              { q: 'Who can see my public portfolio?', a: 'Only you can see your draft portfolio. When you publish it as a Showcase Pro user, your portfolio becomes publicly accessible at showcase.app/p/your-name. You can unpublish it at any time.' },
            ].map(({ q, a }) => (
              <div key={q} className="glass-card p-5">
                <h3 className="font-semibold text-sm text-foreground mb-2">{q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
