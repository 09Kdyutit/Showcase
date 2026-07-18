'use client'

import { useState } from 'react'
import { CheckCircle2, Lock, ArrowRight, Zap } from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { TrackedLink } from '@/components/landing/tracked-link'
import { configuredAppHost } from '@/lib/app-url'

const APP_HOST = configuredAppHost()
const VOICE_INTERVIEWS_AVAILABLE = process.env.NEXT_PUBLIC_INTERVIEW_VOICE_AVAILABLE === 'true'

const FREE_FEATURES = [
  'PDF, DOCX, and pasted resume import with up to 3 analyses / day',
  'One AI portfolio generation',
  'One Evidence Audit score / day with 4 core categories',
  'Build, edit, and privately preview portfolio drafts',
  '5 AI bullet improvements / day',
  'Browse job listings (demo data)',
  'Import up to 3 job descriptions / day',
  'Basic role-content match score',
  '1 ATS check / day',
  '5 written interview sessions / month',
  'Up to 5 saved, non-archived jobs',
]
const FREE_LOCKED = [
  'Public portfolio publishing',
  'Portfolio regeneration and additional AI-built portfolios',
  'Higher daily AI limits',
  'Complete 11-category Evidence Audit breakdown',
  ...(VOICE_INTERVIEWS_AVAILABLE ? ['Live voice and recorded interviews'] : []),
  'Standalone HTML portfolio export',
  'Personalized For You job feed',
  'Full match explanations',
  'Tailor Studio application kits',
]
const PRO_FEATURES = [
  'Everything in Free',
  `Publish a live portfolio at ${APP_HOST}/p/your-name`,
  '10 portfolio generations and 10 complete 11-category audits / day',
  '25 resume analyses and 50 bullet improvements / day',
  '15 tailored application kits and 40 cover letters / day',
  ...(VOICE_INTERVIEWS_AVAILABLE ? ['20 voice or recorded interviews / billing period'] : []),
  '150 written interviews / billing period',
  'Role- and company-aware written practice when context is available, with per-answer feedback',
  'Standalone HTML portfolio export',
  'Personalized job feed with explainable match scores (listing inventory may include demo data)',
  'Tailor Studio application kit for a role - you review and submit it',
  'Source-grounded AI suggestions that you review and edit',
  '20 ATS readiness checks / day',
  'Application stage tracking without the Free five-job cap',
]

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const isAnnual = billing === 'annual'

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'oklch(63% 0.20 255)' }}>Pricing</p>
          <h1 className="text-display text-4xl sm:text-[3.25rem] font-semibold tracking-tight mb-4 leading-[1.04] text-balance">
            Simple, honest{' '}
            <em style={{ fontStyle: 'italic', color: 'oklch(70% 0.17 255)' }}>pricing.</em>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            Start free with resume import, an editable portfolio, job-search tools, and
            written interview practice. Pro adds live publishing, complete audits,
            personalized matching, application kits, and higher limits.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="grid grid-cols-2 max-w-xs mx-auto gap-2 mb-12 p-1 rounded-2xl bg-secondary border border-border">
          <button
            onClick={() => setBilling('monthly')}
            className={cn(
              'px-4 py-3 rounded-xl text-sm font-semibold transition-all',
              !isAnnual
                ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-glow-sm'
                : 'text-brand-300 hover:text-brand-200',
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={cn(
              'relative px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
              isAnnual
                ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-glow-sm'
                : 'text-brand-300 hover:text-brand-200',
            )}
          >
            Annual
            <span className={cn(
              'text-xs font-bold px-1.5 py-0.5 rounded-full',
              isAnnual ? 'bg-secondary text-foreground' : 'bg-brand-500/10 border border-brand-500/30 text-brand-300',
            )}>
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
                <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground/75">
                  <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild variant="secondary" size="lg" className="w-full">
              <TrackedLink href="/signup" event="hero_primary_cta_clicked" ctaLabel="pricing_page_free_card">Build my portfolio free</TrackedLink>
            </Button>
          </div>

          {/* Pro */}
          <div className="holo-border relative glass-card p-8 border-brand-500/40 flex flex-col overflow-hidden shadow-glow-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/80 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-brand-500/8 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent pointer-events-none" />
            <div className="relative flex flex-col flex-1">
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-brand-400 uppercase tracking-wider">Showcase Pro</p>
                  <Badge variant="pro">{isAnnual ? 'Best value' : 'Monthly'}</Badge>
                </div>
                {isAnnual ? (
                  <>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-5xl font-bold">$150</span>
                      <span className="text-muted-foreground">/year</span>
                    </div>
                    <p className="text-sm text-emerald-400 font-medium mb-1">
                      $12.50/month equivalent - save $30
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
                  <TrackedLink href="/signup" event="hero_primary_cta_clicked" ctaLabel="pricing_page_pro_card">
                    <Zap className="h-4 w-4" />
                    Build my portfolio free
                    <ArrowRight className="h-4 w-4" />
                  </TrackedLink>
                </Button>
                <div className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-400/90 text-center">7-day refund eligibility before substantive Pro use</p>
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
              { q: 'What happens when I cancel?', a: 'You keep Showcase Pro access until the end of your billing period. After that, your account reverts to Free and all your data - portfolio content, audit history, and uploaded materials - is preserved.' },
              { q: 'Is there a free trial for Pro?', a: 'No trial with auto-charge. Free lets you import a resume, build and preview a portfolio, browse jobs, run daily career checks, and practice written interviews before deciding whether Pro is worth it.' },
              { q: 'Does Showcase guarantee job interviews?', a: 'No. Showcase helps you present your real experience more clearly and professionally. Your results depend on your background, the roles you target, and the market. We help you put your best work forward - not guarantee outcomes.' },
              { q: 'Can I get a refund?', a: 'You can request a refund within 7 days if you have not substantively used Pro features. See the refund policy for the exact conditions.' },
              { q: 'How does Showcase keep AI suggestions grounded?', a: 'Showcase uses the resume and career information you provide as its source material. You review and can edit every generated suggestion. Unsupported details should not be added, and Evidence Audit flags gaps instead of filling them with invented metrics or experience.' },
              { q: 'Can I have multiple portfolios?', a: 'Yes. You can build and edit portfolio drafts on Free. Your first AI generation is included; regenerating or AI-building additional portfolios requires Pro, and publishing any live portfolio is a Pro feature.' },
              { q: 'What file formats can I import?', a: 'You can paste your resume as plain text, or upload a PDF or DOCX file. Showcase parses it automatically and uses it as the foundation for your portfolio content.' },
              { q: 'Who can see my public portfolio?', a: `Only you can see your draft portfolio. When you publish it as a Showcase Pro user, it becomes publicly accessible at ${APP_HOST}/p/your-name. You can unpublish it at any time.` },
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
