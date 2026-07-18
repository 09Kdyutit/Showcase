'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  FileText,
  Gauge,
  GraduationCap,
  Loader2,
  Mic2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Logo } from '@/components/shared/logo'
import { trackMarketingEvent } from '@/lib/marketing/track-client'

const WORKSPACE_FEATURES = [
  {
    icon: FileText,
    title: 'Build your portfolio',
    description:
      'Import a PDF, DOCX, or pasted resume. Turn it into editable case studies, then refine the theme, images, and quality checklist.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Run your job search',
    description:
      'Compare roles against your actual experience, create tailored application kits, check ATS readiness, and export PDF or DOCX files.',
  },
  {
    icon: Mic2,
    title: 'Practice interviews',
    description:
      'Use written mock interviews, per-answer coaching, drills, and a reusable Story Bank. Voice practice appears when enabled.',
  },
  {
    icon: GraduationCap,
    title: 'Build stronger experience',
    description:
      'Find hackathons, CTFs, and coding competitions that can become the next real project in your portfolio.',
  },
]

const FREE_FEATURES = [
  'Resume import and AI parsing',
  'One generated portfolio with full editing and private preview',
  'One complete 11-dimension Evidence Audit every 24 hours',
  'Written interview practice and daily ATS tools within Free limits',
]

const PRO_FEATURES = [
  'Live publishing with a shareable link and preview card',
  'Portfolio regeneration and higher AI limits',
  '10 complete 11-dimension Evidence Audits every 24 hours',
  'Tailor Studio, personalized job tools, and voice allowances when enabled',
]

type FormState = {
  email: string
  consent: boolean
  website_url_hidden: string
}

function WaitlistContent() {
  const searchParams = useSearchParams()
  const [form, setForm] = useState<FormState>({
    email: '',
    consent: false,
    website_url_hidden: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const attribution = useMemo(
    () => ({
      utm_source: searchParams.get('utm_source') ?? undefined,
      utm_medium: searchParams.get('utm_medium') ?? undefined,
      utm_campaign: searchParams.get('utm_campaign') ?? undefined,
      utm_content: searchParams.get('utm_content') ?? undefined,
      referral_code: searchParams.get('ref') ?? undefined,
      referrer: typeof document === 'undefined' ? undefined : document.referrer || undefined,
    }),
    [searchParams],
  )

  useEffect(() => {
    trackMarketingEvent('landing_viewed', { route: '/waitlist' })
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!form.email.trim()) {
      setError('Enter your email address.')
      return
    }
    if (!form.consent) {
      setError('Confirm that we may send the access update you requested.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          consent: form.consent,
          website_url_hidden: form.website_url_hidden,
          source: 'waitlist_page',
          ...attribution,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? 'Access updates are temporarily unavailable. Please try again.')
      }

      setSubmitted(true)
      trackMarketingEvent('waitlist_submitted', {})
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Access updates are temporarily unavailable. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="Showcase home">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/pricing" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block">
              Pricing
            </Link>
            <Link href="/login" className="rounded-lg border border-border px-4 py-2 font-semibold transition-colors hover:bg-secondary">
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-border px-6 py-20 sm:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.16),transparent_52%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand-400">
                <Sparkles className="h-3.5 w-3.5" />
                Portfolio builder + job-search workspace
              </div>
              <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl">
                One resume. Your whole job search, connected.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                Build an editable portfolio, tailor applications, check ATS readiness, practice interviews, find project opportunities, and publish when you are ready.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-foreground/75">
                {['Free plan, no card', 'Private until you publish', 'Every AI draft stays editable'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-9 flex flex-wrap gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 font-bold text-white transition-opacity hover:opacity-90"
                  onClick={() => trackMarketingEvent('hero_primary_cta_clicked', { cta_label: 'waitlist_start_free' })}
                >
                  Build my portfolio free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#access-updates" className="inline-flex items-center rounded-xl border border-border px-6 py-3.5 font-semibold transition-colors hover:bg-secondary">
                  Request an access update
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-secondary/70 p-4 shadow-2xl shadow-brand-950/20">
              <div className="rounded-2xl border border-border bg-background p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Your workspace</p>
                    <p className="mt-1 text-lg font-bold">From resume to published portfolio</p>
                  </div>
                  <ShieldCheck className="h-7 w-7 text-brand-400" />
                </div>
                <div className="space-y-3">
                  {[
                    ['Resume imported', 'PDF, DOCX, or paste', 'Done'],
                    ['Portfolio draft', 'Editable case studies', 'Ready'],
                    ['Job toolkit', 'Match, tailor, ATS', 'Explore'],
                    ['Interview Lab', 'Written + enabled voice', 'Practice'],
                    ['Live portfolio', 'Shareable link + preview card', 'Pro'],
                  ].map(([title, detail, status]) => (
                    <div key={title} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{title}</p>
                        <p className="text-xs text-muted-foreground">{detail}</p>
                      </div>
                      <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-400">
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">What Showcase actually does</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
              One workspace for building, applying, practicing, and sharing.
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {WORKSPACE_FEATURES.map((feature) => (
                <article key={feature.title} className="rounded-2xl border border-border bg-secondary p-6">
                  <feature.icon className="h-6 w-6 text-brand-400" />
                  <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-secondary p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Gauge className="h-5 w-5 text-brand-400" />
                  Evidence Audit stays in the toolkit
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  It gives an honest 0-100 review across 11 dimensions with specific fixes.
                  Free includes one complete Audit every 24 hours; Pro raises that limit to 10.
                  It supports the workflow instead of defining the whole product.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/40 px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-5 lg:grid-cols-2">
              {[
                { name: 'Free', price: '$0', detail: 'Build before you pay', features: FREE_FEATURES },
                { name: 'Pro', price: '$15/month', detail: 'or $150/year', features: PRO_FEATURES },
              ].map((plan) => (
                <article key={plan.name} className="rounded-3xl border border-border bg-background p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">{plan.name}</p>
                  <p className="mt-3 text-3xl font-black">{plan.price}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.detail}</p>
                  <ul className="mt-7 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm text-foreground/80">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="access-updates" className="px-6 py-20 sm:py-24">
          <div className="mx-auto grid max-w-5xl gap-10 rounded-3xl border border-border bg-secondary p-8 sm:p-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">Access updates</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">If signup is limited, we will tell you when access is available.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                This is a requested access notice, not a sales list. We will not claim a job outcome, sell your address, or ask for a card here.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6" role="status">
                <Check className="h-7 w-7 text-emerald-400" />
                <h3 className="mt-4 text-xl font-bold">Your request is saved.</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  If this address is eligible for an access update, it will receive one. No other action is required.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-background p-6" noValidate>
                <label htmlFor="waitlist-email" className="text-sm font-semibold">Email address</label>
                <input
                  id="waitlist-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500"
                  placeholder="you@example.com"
                  required
                />
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="website_url_hidden">Website</label>
                  <input
                    id="website_url_hidden"
                    name="website_url_hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website_url_hidden}
                    onChange={(event) => setForm((current) => ({ ...current, website_url_hidden: event.target.value }))}
                  />
                </div>
                <label className="mt-4 flex items-start gap-3 text-xs leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(event) => setForm((current) => ({ ...current, consent: event.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-border accent-brand-500"
                  />
                  Send me the Showcase access update I requested. I can unsubscribe at any time.
                </label>
                {error ? <p className="mt-3 text-sm text-red-400" role="alert">{error}</p> : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? 'Saving request...' : 'Request access update'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Showcase is a connected portfolio and job-search workspace.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <WaitlistContent />
    </Suspense>
  )
}
