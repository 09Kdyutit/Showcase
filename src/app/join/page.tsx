'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Form (needs Suspense for useSearchParams) ─────────────────────────────────

function JoinForm() {
  const searchParams = useSearchParams()
  const group = searchParams.get('g') ?? ''

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          full_name: name.trim() || undefined,
          source: group || 'join_page',
          consent: true,
          website_url_hidden: '',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? json.message ?? 'Something went wrong. Try again.')
        return
      }
      setDone(true)
    } catch {
      setError('Could not connect. Check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-5 text-center animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, color-mix(in oklch, var(--color-brand-500) 25%, transparent), transparent 70%)',
            border: '1px solid color-mix(in oklch, var(--color-brand-500) 30%, transparent)',
            boxShadow: '0 0 40px color-mix(in oklch, var(--color-brand-500) 35%, transparent)',
          }}
        >
          <CheckCircle2 className="h-7 w-7 text-brand-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">You're on the list.</h2>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            We'll reach out when your spot opens. Keep an eye on your inbox.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        autoComplete="name"
        className="w-full rounded-xl px-4 py-3.5 text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        autoComplete="email"
        required
        className="w-full rounded-xl px-4 py-3.5 text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
      />

      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !email.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold  transition-all duration-200 active:scale-[0.98]',
          'disabled:opacity-40 disabled:pointer-events-none',
        )}
        style={{
          background: submitting
            ? 'color-mix(in oklch, var(--color-brand-600) 80%, black)'
            : 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-400))',
          boxShadow: '0 0 24px color-mix(in oklch, var(--color-brand-500) 40%, transparent)',
        }}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Request Access
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  )
}

// ── Animated background orbs ──────────────────────────────────────────────────

function BackgroundOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Primary orb -- top left */}
      <div
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-[0.12]"
        style={{
          background: 'radial-gradient(circle, var(--color-brand-500), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Secondary orb -- bottom right */}
      <div
        className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.08]"
        style={{
          background: 'radial-gradient(circle, var(--color-brand-400), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Subtle center */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(ellipse, var(--color-brand-500), transparent 60%)',
          filter: 'blur(100px)',
        }}
      />
      {/* Very subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(40,20,70,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(40,20,70,0.06) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  )
}

// ── Feature pills ─────────────────────────────────────────────────────────────

const FEATURES = [
  'AI Resume Analysis',
  'Portfolio Builder',
  'Interview Prep',
  'Job Matching',
  'Project Roadmap',
  'ProofScore',
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{ background: 'var(--color-background)' }}
    >
      <BackgroundOrbs />

      <div
        className={cn(
          'relative z-10 flex flex-col items-center text-center px-5 w-full max-w-sm transition-all duration-700',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
      >
        {/* Logo mark */}
        <div className="mb-8">
          <div
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl"
            style={{
              background: 'color-mix(in oklch, var(--color-brand-500) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-brand-500) 15%, transparent)',
            }}
          >
            {/* S logomark */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M13.5 3H6.75C5.09315 3 3.75 4.34315 3.75 6C3.75 7.65685 5.09315 9 6.75 9H11.25C12.9069 9 14.25 10.3431 14.25 12C14.25 13.6569 12.9069 15 11.25 15H4.5"
                stroke="url(#s-grad)"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="s-grad" x1="3.75" y1="3" x2="14.25" y2="15" gradientUnits="userSpaceOnUse">
                  <stop stopColor="oklch(80% 0.18 350)" />
                  <stop offset="1" stopColor="oklch(67% 0.28 340)" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-sm font-semibold tracking-wide text-foreground/90">Showcase</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15] mb-4">
          The career tool
          <br />
          <span className="aurora-text">built for the future.</span>
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-[280px]">
          AI-powered resume analysis, portfolio building, interview prep, and job matching -- all in one place.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-1.5 justify-center mb-8">
          {FEATURES.map((f) => (
            <span
              key={f}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full text-muted-foreground/50 border border-border"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full h-px mb-8" style={{ background: 'linear-gradient(90deg, transparent, rgba(40,20,70,0.10) 50%, transparent)' }} />

        {/* Form */}
        <div className="w-full">
          <p className="text-xs text-muted-foreground/50 uppercase tracking-wider font-semibold mb-4">
            Request Early Access
          </p>
          <Suspense>
            <JoinForm />
          </Suspense>
        </div>

        {/* Footer -- legal only, no app links */}
        <p className="mt-8 text-[10px] text-muted-foreground/30 leading-relaxed">
          By requesting access you agree to our{' '}
          <a href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-muted-foreground/50 transition-colors">
            Privacy Policy
          </a>
          {' '}and{' '}
          <a href="/terms" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-muted-foreground/50 transition-colors">
            Terms
          </a>
          .
        </p>
      </div>
    </div>
  )
}
