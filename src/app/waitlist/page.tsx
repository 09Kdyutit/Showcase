'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Check,
  Copy,
  Sparkles,
  ShieldCheck,
  FileText,
  BarChart3,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Lock,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Pricing data ──────────────────────────────────────────────────────────────

const FREE_FEATURES = [
  'Resume text parsing',
  'Basic ProofScore preview (3 categories)',
  'Draft portfolio (unpublished)',
  '1 portfolio',
]
const PRO_FEATURES = [
  'Everything in Free',
  'Full AI portfolio generation from resume',
  'Complete ProofScore audit — all 11 categories',
  'Public portfolio at showcase.app/p/your-name',
  'Tailor Studio — role-specific resume in one click',
  'Truth Ledger — every change traced to your real experience',
  'Unlimited portfolios',
  'Priority AI processing',
]

// ── UTM helpers ───────────────────────────────────────────────────────────────

function useUtmParams() {
  const params = useSearchParams()
  return {
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
    utm_content: params.get('utm_content') ?? undefined,
    referral_code: params.get('ref') ?? undefined,
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 'form' | 'success'

interface FormState {
  email: string
  full_name: string
  target_role: string
  experience_level: string
  user_type: string
  biggest_challenge: string
  consent: boolean
}

const INITIAL_FORM: FormState = {
  email: '',
  full_name: '',
  target_role: '',
  experience_level: '',
  user_type: '',
  biggest_challenge: '',
  consent: false,
}

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'Is the beta free?',
    a: 'Yes. Beta access is completely free. Early users help us shape the product and will be recognized for it.',
  },
  {
    q: 'When will I get access?',
    a: 'We invite users in small batches. We will email you when your spot is ready. No ETA — but sooner the more context you share below.',
  },
  {
    q: 'Do I need a resume already?',
    a: 'A resume helps but is not required. You can build a portfolio from project descriptions, links, and work history too.',
  },
  {
    q: 'Will Showcase write fake experience?',
    a: 'Never. Showcase only works with what you provide. We do not invent employers, projects, metrics, or certifications.',
  },
  {
    q: 'Will this guarantee a job or interview?',
    a: 'No, and we will never claim that. A stronger portfolio improves your presentation — outcomes depend on many other factors outside our control.',
  },
  {
    q: 'How will my data be used?',
    a: 'Your email is used for beta invites, product updates, and feedback requests only. We never sell it. You can unsubscribe or request deletion at any time.',
  },
  {
    q: 'Can I give feedback?',
    a: 'That is exactly why we are doing this beta. We want blunt, honest feedback to make V1 the best it can be.',
  },
  {
    q: 'Can I unsubscribe?',
    a: 'Yes. Every email includes an unsubscribe link. You can also email us to be removed.',
  },
]

// ── Mock ProofScore display ───────────────────────────────────────────────────

function ProofScoreWidget() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-left">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-400" />
          <span className="text-sm font-semibold text-foreground">ProofScore™</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-3xl font-black"
            style={{
              background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'inline-block',
              willChange: 'transform',
              transform: 'translateZ(0)',
            }}
          >
            84
          </span>
          <span className="text-xs text-muted-foreground/50 font-medium">/100</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {[
          { label: 'First impression clarity', score: 90, color: 'bg-emerald-500' },
          { label: 'Proof strength', score: 68, color: 'bg-amber-500' },
          { label: 'Target role alignment', score: 85, color: 'bg-brand-500' },
          { label: 'Project depth', score: 72, color: 'bg-violet-500' },
        ].map((item) => (
          <div key={item.label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] text-muted-foreground/60">{item.label}</span>
              <span className="text-[11px] font-semibold text-foreground/80">{item.score}</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', item.color)}
                style={{ width: `${item.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-white/[0.05]">
        <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest mb-2">Evidence gaps found</p>
        <div className="space-y-1.5">
          {['3 bullets have no measurable outcome', 'Leadership claims lack team size', 'Project depth: missing problem statement'].map((gap) => (
            <div key={gap} className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60 shrink-0" />
              {gap}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Flow steps display ────────────────────────────────────────────────────────

function HowItWorksFlow() {
  const steps = [
    {
      icon: FileText,
      title: 'Upload your resume',
      desc: 'Paste text or upload a file. Showcase parses every role, project, and bullet.',
      color: 'text-brand-400 bg-brand-500/10',
    },
    {
      icon: Sparkles,
      title: 'Generate your portfolio',
      desc: 'AI rewrites your experience into a polished, role-specific proof-of-work portfolio.',
      color: 'text-violet-400 bg-violet-500/10',
    },
    {
      icon: BarChart3,
      title: 'Run ProofScore',
      desc: 'Get an honest 0–100 audit across 11 dimensions — from proof strength to first impression.',
      color: 'text-amber-400 bg-amber-500/10',
    },
    {
      icon: Lightbulb,
      title: 'Fix evidence gaps',
      desc: 'See exactly which claims are unsupported, which bullets are vague, and what to do next.',
      color: 'text-emerald-400 bg-emerald-500/10',
    },
  ]

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {steps.map((s, i) => (
        <div
          key={s.title}
          className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-colors"
        >
          <div className="absolute -top-3 -left-1 text-[10px] font-black text-muted-foreground/20 tabular-nums">
            {String(i + 1).padStart(2, '0')}
          </div>
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-4', s.color)}>
            <s.icon className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-foreground text-sm mb-2">{s.title}</h3>
          <p className="text-xs text-muted-foreground/60 leading-relaxed">{s.desc}</p>
        </div>
      ))}
    </div>
  )
}

// ── FAQ accordion ─────────────────────────────────────────────────────────────

function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {FAQ.map((item, i) => (
        <div
          key={i}
          className="border border-white/[0.06] rounded-xl overflow-hidden"
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-sm font-medium text-foreground/80">{item.q}</span>
            {open === i
              ? <ChevronUp className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            }
          </button>
          {open === i && (
            <div className="px-5 pb-4">
              <p className="text-sm text-muted-foreground/70 leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Success state ─────────────────────────────────────────────────────────────

function SuccessState({
  referralCode,
  alreadyJoined,
}: {
  referralCode?: string
  alreadyJoined?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const shareUrl = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://showcase.app'}/waitlist?ref=${referralCode}`
    : null

  function copyLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
        <Check className="h-8 w-8 text-emerald-400" />
      </div>

      <h2 className="text-3xl font-black text-foreground mb-3 tracking-tight">
        {alreadyJoined ? "You're already on the list" : "You're on the Showcase beta list"}
      </h2>
      <p className="text-foreground/60 text-lg mb-10 max-w-sm mx-auto font-light">
        {alreadyJoined
          ? "We already have your spot saved. We'll email you when your invite is ready."
          : "We'll email you when your invite is ready. No ETA, but we move fast."}
      </p>

      {/* What happens next */}
      <div className="text-left max-w-sm mx-auto mb-10 space-y-4">
        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-4">What happens next</p>
        {[
          'We invite early users in small batches.',
          'You build or audit a portfolio with Showcase.',
          'You share feedback so we can shape V1.',
          'Beta users may get early recognition — nothing promised until it exists.',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[9px] font-black text-brand-400">{i + 1}</span>
            </div>
            <p className="text-sm text-foreground/65 leading-relaxed">{step}</p>
          </div>
        ))}
      </div>

      {/* Referral share card */}
      {shareUrl && (
        <div className="max-w-sm mx-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-left">
          <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest mb-2">Share Showcase</p>
          <p className="text-sm text-foreground/65 mb-4 leading-relaxed">
            Tell a friend who should have a better portfolio. They&apos;ll join with your referral link.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 min-w-0">
              <p className="text-xs text-muted-foreground/60 truncate font-mono">{shareUrl}</p>
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs font-semibold text-brand-400 hover:bg-brand-500/20 transition-colors shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function WaitlistContent() {
  const utmParams = useUtmParams()
  const [step, setStep] = useState<Step>('form')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [referralCode, setReferralCode] = useState<string | undefined>()
  const [alreadyJoined, setAlreadyJoined] = useState(false)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const isAnnual = billing === 'annual'
  const formCardRef = useRef<HTMLDivElement>(null)

  // Capture localStorage UTMs on mount
  useEffect(() => {
    if (utmParams.utm_source) {
      try {
        localStorage.setItem('showcase_utm', JSON.stringify(utmParams))
      } catch {}
    }
  }, [utmParams])

  const scrollToForm = useCallback(() => {
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.email) { setError('Email is required.'); return }
    if (!form.consent) { setError('Please agree to receive beta updates.'); return }

    setSubmitting(true)

    try {
      let storedUtm: Record<string, string> = {}
      try {
        storedUtm = JSON.parse(localStorage.getItem('showcase_utm') ?? '{}')
      } catch {}

      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          full_name: form.full_name || undefined,
          target_role: form.target_role || undefined,
          experience_level: form.experience_level || undefined,
          user_type: form.user_type || undefined,
          biggest_challenge: form.biggest_challenge || undefined,
          consent: form.consent,
          ...utmParams,
          utm_source: utmParams.utm_source ?? storedUtm.utm_source,
          utm_medium: utmParams.utm_medium ?? storedUtm.utm_medium,
          utm_campaign: utmParams.utm_campaign ?? storedUtm.utm_campaign,
          utm_content: utmParams.utm_content ?? storedUtm.utm_content,
          source: 'waitlist_page',
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setReferralCode(data.referral_code)
      setAlreadyJoined(data.already_joined ?? false)
      setStep('success')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function update(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.4)]">
              <span className="text-white text-[11px] font-bold">S</span>
            </div>
            <span className="font-bold text-sm text-foreground">Showcase</span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-[10px] font-bold text-brand-400 uppercase tracking-widest">
              Private Beta
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'How it works', href: '#how-it-works' },
              { label: 'ProofScore', href: '#proof-score' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'FAQ', href: '#faq' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <button
            onClick={scrollToForm}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-[0_0_16px_rgba(99,102,241,0.3)]"
          >
            Join Beta
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-24 px-6">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[1100px] h-[700px] bg-brand-500/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-[600px] h-[500px] bg-violet-500/4 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_400px] gap-16 items-center">

            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/8 border border-brand-500/15 text-xs font-semibold text-brand-400 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                Private beta — limited spots
              </div>

              <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-black tracking-tight leading-[1.02] text-balance mb-6">
                Your resume says what you did.{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, #818cf8, #a78bfa, #c4b5fd)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    display: 'inline',
                    willChange: 'transform',
                    transform: 'translateZ(0)',
                  }}
                >
                  Showcase proves what you can do.
                </span>
              </h1>

              <p className="text-xl text-foreground/60 leading-relaxed max-w-xl mb-10 font-light">
                Showcase turns your resume, projects, and work history into a proof-of-work portfolio — then audits it with ProofScore so you know exactly what to fix before applying.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10">
                <button
                  onClick={scrollToForm}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(99,102,241,0.35)]"
                >
                  Join the beta
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#how-it-works"
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  See how it works
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                {[
                  'We never invent experience',
                  'You control what gets published',
                  'Resume files stay private',
                ].map((t) => (
                  <div key={t} className="flex items-center gap-2 text-xs text-muted-foreground/50">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70 shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — product widget */}
            <div className="hidden lg:block" id="proof-score">
              <ProofScoreWidget />
            </div>
          </div>
        </div>
      </section>

      {/* ── Waitlist Form Card ────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/[0.05]" ref={formCardRef}>
        <div className="max-w-xl mx-auto">

          {step === 'success' ? (
            <SuccessState referralCode={referralCode} alreadyJoined={alreadyJoined} />
          ) : (
            <>
              <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-foreground mb-3 tracking-tight">
                  Join the private beta
                </h2>
                <p className="text-foreground/55 leading-relaxed">
                  We invite early users in small batches. The more context you share, the sooner we can match your invite to what we are testing.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Hidden honeypot */}
                <input
                  type="text"
                  name="website_url_hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute -left-[9999px] opacity-0 pointer-events-none h-0 w-0"
                  onChange={(e) => {
                    // Detect fill without state to avoid re-renders
                    const el = e.currentTarget
                    el.dataset.filled = el.value ? '1' : '0'
                  }}
                />

                {/* Email — required */}
                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    Email <span className="text-brand-400">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all"
                    required
                  />
                </div>

                {/* Full name */}
                <div>
                  <label htmlFor="full_name" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    Full name <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    id="full_name"
                    type="text"
                    autoComplete="name"
                    placeholder="Alex Chen"
                    value={form.full_name}
                    onChange={(e) => update('full_name', e.target.value)}
                    className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all"
                  />
                </div>

                {/* Target role */}
                <div>
                  <label htmlFor="target_role" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    Target role <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    id="target_role"
                    type="text"
                    placeholder="Product Designer, SWE, PM, Marketing..."
                    value={form.target_role}
                    onChange={(e) => update('target_role', e.target.value)}
                    className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all"
                  />
                </div>

                {/* Experience level */}
                <div>
                  <label htmlFor="experience_level" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    Experience level <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <select
                    id="experience_level"
                    value={form.experience_level}
                    onChange={(e) => update('experience_level', e.target.value)}
                    className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground outline-none transition-all appearance-none"
                  >
                    <option value="" className="bg-neutral-900">Select your level...</option>
                    <option value="student" className="bg-neutral-900">Student</option>
                    <option value="new_grad" className="bg-neutral-900">New grad (0–1 year)</option>
                    <option value="early" className="bg-neutral-900">Early career (1–3 years)</option>
                    <option value="mid" className="bg-neutral-900">Mid-level (3–7 years)</option>
                    <option value="switcher" className="bg-neutral-900">Career switcher</option>
                    <option value="freelancer" className="bg-neutral-900">Freelancer / consultant</option>
                  </select>
                </div>

                {/* What are you building */}
                <div>
                  <label htmlFor="user_type" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    What are you building? <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <select
                    id="user_type"
                    value={form.user_type}
                    onChange={(e) => update('user_type', e.target.value)}
                    className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground outline-none transition-all appearance-none"
                  >
                    <option value="" className="bg-neutral-900">Select your goal...</option>
                    <option value="job_search" className="bg-neutral-900">Job search portfolio</option>
                    <option value="internship" className="bg-neutral-900">Internship portfolio</option>
                    <option value="career_switch" className="bg-neutral-900">Career switch portfolio</option>
                    <option value="freelance" className="bg-neutral-900">Freelance / client portfolio</option>
                    <option value="personal_brand" className="bg-neutral-900">Personal brand portfolio</option>
                  </select>
                </div>

                {/* Biggest challenge */}
                <div>
                  <label htmlFor="biggest_challenge" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    Biggest challenge <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <select
                    id="biggest_challenge"
                    value={form.biggest_challenge}
                    onChange={(e) => update('biggest_challenge', e.target.value)}
                    className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground outline-none transition-all appearance-none"
                  >
                    <option value="" className="bg-neutral-900">What is your biggest problem?</option>
                    <option value="weak_resume" className="bg-neutral-900">My resume is weak</option>
                    <option value="no_projects" className="bg-neutral-900">I do not know what projects to show</option>
                    <option value="looks_unprofessional" className="bg-neutral-900">My portfolio looks unprofessional</option>
                    <option value="no_proof" className="bg-neutral-900">I have no measurable proof of impact</option>
                    <option value="recruiter_insight" className="bg-neutral-900">I do not know what recruiters want</option>
                    <option value="role_versions" className="bg-neutral-900">I need role-specific portfolio versions</option>
                  </select>
                </div>

                {/* Consent */}
                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.consent}
                        onChange={(e) => update('consent', e.target.checked)}
                      />
                      <div className={cn(
                        'w-4.5 h-4.5 rounded-md border-2 transition-all flex items-center justify-center',
                        form.consent
                          ? 'bg-brand-500 border-brand-500'
                          : 'border-white/[0.2] group-hover:border-brand-500/50 bg-transparent',
                      )}>
                        {form.consent && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </div>
                    </div>
                    <p className="text-sm text-foreground/60 leading-relaxed">
                      I agree to receive beta access updates and product emails from Showcase. I can unsubscribe anytime.
                    </p>
                  </label>
                </div>

                {/* Privacy note */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground/50 leading-relaxed">
                    We never sell your email. We use it only for beta access, product updates, and feedback requests.
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-400/90 bg-red-500/8 border border-red-500/15 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !form.consent}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base transition-all',
                    submitting || !form.consent
                      ? 'bg-white/[0.06] text-muted-foreground/40 cursor-not-allowed'
                      : 'bg-gradient-to-r from-brand-500 to-violet-500 text-white hover:opacity-90 shadow-[0_0_30px_rgba(99,102,241,0.3)]',
                  )}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      Join the Showcase beta
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-4">How it works</p>
          <h2 className="text-3xl font-black text-foreground mb-3 tracking-tight max-w-lg">
            From messy resume to proof-of-work portfolio
          </h2>
          <p className="text-foreground/50 mb-12 max-w-xl">
            Four steps. No fluff, no fake experience. Just a portfolio that shows exactly what you can do and where the gaps are.
          </p>
          <HowItWorksFlow />
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-4 text-center">Pricing</p>
          <h2 className="text-3xl font-black text-foreground mb-3 tracking-tight text-center">
            Simple, honest pricing
          </h2>
          <p className="text-foreground/50 text-center max-w-md mx-auto mb-10">
            Beta access is free. Here&apos;s what Pro looks like once we open up.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <button
              onClick={() => setBilling('monthly')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                !isAnnual ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                isAnnual ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Annual
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Save $30
              </span>
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col">
              <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">Free</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-foreground">$0</span>
                <span className="text-muted-foreground/60">/month</span>
              </div>
              <p className="text-sm text-foreground/50 mb-6">Get started without a credit card.</p>
              <ul className="space-y-3 mb-8 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-foreground/70">
                    <Check className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/[0.06] to-white/[0.02] p-8 flex flex-col overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-brand-400 uppercase tracking-widest">Showcase Pro</p>
                <span className="text-[10px] font-bold text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {isAnnual ? 'Best value' : 'Most popular'}
                </span>
              </div>
              {isAnnual ? (
                <>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-black text-foreground">$12.50</span>
                    <span className="text-muted-foreground/60">/month</span>
                  </div>
                  <p className="text-sm text-emerald-400 font-medium mb-1">$150 billed annually — save $30</p>
                  <p className="text-sm text-muted-foreground/40 line-through mb-6">$180/year if monthly</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-black text-foreground">$15</span>
                    <span className="text-muted-foreground/60">/month</span>
                  </div>
                  <p className="text-sm text-foreground/50 mb-6">Full access. Cancel anytime.</p>
                </>
              )}
              <ul className="space-y-3 mb-8 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-foreground/80">
                    <Check className="h-4 w-4 text-brand-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={scrollToForm}
                className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-[0_0_24px_rgba(99,102,241,0.3)]"
              >
                <Zap className="h-4 w-4" />
                Join the beta to get early Pro pricing
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why beta users matter ─────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-4">Why beta</p>
              <h2 className="text-3xl font-black text-foreground mb-6 tracking-tight">
                We are not launching to everyone yet — on purpose.
              </h2>
              <p className="text-foreground/60 leading-relaxed mb-6">
                We are inviting a small group of beta users who will actually use Showcase, tell us what is broken, and help us build the best version before we open it widely.
              </p>
              <p className="text-foreground/60 leading-relaxed mb-8">
                This is not a waitlist to watch a product launch. It is an invitation to help build one.
              </p>
              <button
                onClick={scrollToForm}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(99,102,241,0.25)]"
              >
                Join the beta
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'We never invent experience',
                  desc: 'Showcase only uses what you provide. No fake projects, employers, metrics, or certifications — ever.',
                  color: 'text-emerald-400 bg-emerald-500/10',
                },
                {
                  icon: Lock,
                  title: 'You control what gets published',
                  desc: 'Nothing goes live without your review. Every portfolio starts as a private draft.',
                  color: 'text-brand-400 bg-brand-500/10',
                },
                {
                  icon: FileText,
                  title: 'Resume files stay private by default',
                  desc: 'Uploaded resumes are not publicly accessible. You decide what portions to include.',
                  color: 'text-violet-400 bg-violet-500/10',
                },
                {
                  icon: Lightbulb,
                  title: 'No dark patterns, no fake scarcity',
                  desc: 'We are not counting down a timer or inventing a waitlist number. Just honest early access.',
                  color: 'text-amber-400 bg-amber-500/10',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', item.color)}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground mb-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground/60 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-4 text-center">FAQ</p>
          <h2 className="text-3xl font-black text-foreground mb-12 tracking-tight text-center">Questions answered</h2>
          <FAQAccordion />
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────── */}
      <section className="py-32 px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-14 text-center">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(99,102,241,0.08),transparent)]" />
            <div className="relative z-10">
              <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-5 tracking-tight">
                Turn your experience into evidence.
              </h2>
              <p className="text-foreground/50 text-lg mb-10 max-w-md mx-auto font-light">
                Join the beta and help us build the portfolio tool you wish existed.
              </p>
              <button
                onClick={scrollToForm}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold text-base hover:opacity-90 transition-opacity shadow-[0_0_40px_rgba(99,102,241,0.35)]"
              >
                Join the Showcase beta
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">S</span>
                </div>
                <span className="font-bold text-sm">Showcase</span>
              </div>
              <p className="text-xs text-muted-foreground/40">Turn your experience into evidence.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground/40">
              <Link href="/privacy" className="hover:text-muted-foreground/70 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-muted-foreground/70 transition-colors">Terms</Link>
              <Link href="/refund" className="hover:text-muted-foreground/70 transition-colors">Refund</Link>
              <a href="mailto:hello@showcase.app" className="hover:text-muted-foreground/70 transition-colors">Contact</a>
            </div>
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
