'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Lightbulb,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProofScoreRing } from '@/components/ui/proof-score-ring'
import { Textarea } from '@/components/ui/textarea'
import { trackMarketingEvent } from '@/lib/marketing/track-client'
import { cn, scoreColor } from '@/lib/utils'
import type { PublicProofScoreResult } from '@/lib/proofscore/public-tool'

interface Capacity {
  cap: number
  remaining: number
  date: string
  resetsAt: string
}

interface ReservationStatus {
  state: 'ready' | 'early' | 'used' | 'expired' | 'invalid'
  reservedFor: string | null
}

interface ScoreResponse {
  data?: {
    result: PublicProofScoreResult
    capacity: { cap: number; remaining: number }
    handoff: { token: string; expiresAt: string } | null
  }
  error?: string
  code?: string
  capacity?: Capacity
}

const LOADING_MESSAGES = [
  'Extracting only what your resume actually says…',
  'Checking claims for supporting evidence…',
  'Scoring all 11 dimensions…',
  'Ranking the two highest-leverage fixes…',
]

function formatUtcDate(value: string | null): string {
  if (!value) return 'the reserved date'
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`))
}

function scoreBand(score: number): string {
  const floor = Math.floor(score / 20) * 20
  return `${floor}-${Math.min(100, floor + 19)}`
}

export function PublicProofScoreTool({ reservationToken }: { reservationToken?: string }) {
  const [resumeText, setResumeText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [capacity, setCapacity] = useState<Capacity | null>(null)
  const [reservation, setReservation] = useState<ReservationStatus | null>(null)
  const [checkingCapacity, setCheckingCapacity] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PublicProofScoreResult | null>(null)
  const [reservationEmail, setReservationEmail] = useState('')
  const [reservationConsent, setReservationConsent] = useState(false)
  const [reservationHoneypot, setReservationHoneypot] = useState('')
  const [reserving, setReserving] = useState(false)
  const [reservationError, setReservationError] = useState('')
  const [reservedFor, setReservedFor] = useState<string | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    trackMarketingEvent('proofscore_tool_viewed', {
      reservation: reservationToken ? 'link_present' : 'none',
    })

    const query = reservationToken ? `?reservation=${encodeURIComponent(reservationToken)}` : ''
    fetch(`/api/proofscore/score${query}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? 'Capacity check failed')
        setCapacity(body.data.capacity)
        setReservation(body.data.reservation)
        if (body.data.capacity.remaining === 0 && body.data.reservation?.state !== 'ready') {
          trackMarketingEvent('proofscore_tool_capped', { remaining: 0 })
        }
      })
      .catch(() => {
        // The POST route checks capacity authoritatively. A failed display-only request should
        // not strand the form or pretend that a capacity number is known.
        setCapacity(null)
      })
      .finally(() => setCheckingCapacity(false))
  }, [reservationToken])

  useEffect(() => {
    if (!submitting) return
    const timer = window.setInterval(() => {
      setLoadingMessage((current) => (current + 1) % LOADING_MESSAGES.length)
    }, 2400)
    return () => window.clearInterval(timer)
  }, [submitting])

  async function submitAudit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setResult(null)
    setSubmitting(true)
    setLoadingMessage(0)
    trackMarketingEvent('proofscore_tool_started', { has_target_role: Boolean(targetRole.trim()) })

    try {
      const response = await fetch('/api/proofscore/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          targetRole,
          reservationToken: reservation?.state === 'ready' ? reservationToken : undefined,
        }),
      })
      const body = await response.json().catch(() => null) as ScoreResponse | null

      if (!response.ok || !body?.data) {
        if (body?.code === 'DAILY_CAP_REACHED') {
          setCapacity(body.capacity ?? { cap: 25, remaining: 0, date: '', resetsAt: '' })
          trackMarketingEvent('proofscore_tool_capped', { remaining: 0 })
        }
        throw new Error(body?.error ?? 'We could not finish the audit. Please try again.')
      }

      setResult(body.data.result)
      setCapacity((current) => current
        ? { ...current, remaining: body.data!.capacity.remaining }
        : null)
      if (body.data.handoff?.token) {
        try {
          window.localStorage.setItem('showcase_parse_token', body.data.handoff.token)
          window.localStorage.setItem('showcase_parse_expires_at', body.data.handoff.expiresAt)
        } catch {
          // Storage can be disabled. The score remains usable; only signup handoff is lost.
        }
      }
      trackMarketingEvent('proofscore_tool_completed', {
        score_band: scoreBand(body.data.result.overallScore),
        remaining: body.data.capacity.remaining,
        has_target_role: Boolean(targetRole.trim()),
      })
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not finish the audit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitReservation(event: FormEvent) {
    event.preventDefault()
    setReservationError('')
    setReserving(true)
    try {
      const response = await fetch('/api/proofscore/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: reservationEmail,
          consent: reservationConsent,
          websiteUrlHidden: reservationHoneypot,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? 'We could not reserve a spot.')
      setReservedFor(body.reservedFor ?? null)
      trackMarketingEvent('proofscore_reservation_submitted', {
        already_reserved: Boolean(body.alreadyReserved),
      })
    } catch (caught) {
      setReservationError(caught instanceof Error ? caught.message : 'We could not reserve a spot.')
    } finally {
      setReserving(false)
    }
  }

  const readyReservation = reservation?.state === 'ready'
  const capReached = capacity?.remaining === 0 && !readyReservation
  const unlocked = result?.categories
    .filter((category) => !category.gated)
    .sort((a, b) => a.priority - b.priority) ?? []

  return (
    <div className="space-y-10 sm:space-y-14">
      <section className="glass-card overflow-hidden border-brand-500/20 shadow-premium">
        <div className="border-b border-border bg-gradient-to-br from-brand-500/[0.10] via-transparent to-transparent px-5 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileSearch className="h-4 w-4 text-brand-400" />
              Free resume audit
            </div>
            <div className="text-xs text-muted-foreground" aria-live="polite">
              {checkingCapacity
                ? 'Checking today’s capacity…'
                : readyReservation
                  ? 'Your reserved audit is ready'
                  : capacity
                    ? `${capacity.remaining} of ${capacity.cap} available today`
                    : 'Capacity verified when you start'}
            </div>
          </div>
        </div>

        {reservation && reservation.state !== 'ready' && (
          <div className={cn(
            'mx-5 mt-5 rounded-xl border px-4 py-3 text-sm sm:mx-8',
            reservation.state === 'early'
              ? 'border-amber-500/20 bg-amber-500/[0.06] text-amber-200'
              : 'border-border bg-surface-200 text-muted-foreground',
          )}>
            {reservation.state === 'early' && `Your one-use reservation opens on ${formatUtcDate(reservation.reservedFor)} (UTC).`}
            {reservation.state === 'used' && 'This one-use reservation has already been used.'}
            {reservation.state === 'expired' && 'This reservation has expired.'}
            {reservation.state === 'invalid' && 'This reservation link is not valid.'}
          </div>
        )}

        {!capReached || readyReservation ? (
          <form onSubmit={submitAudit} className="space-y-5 p-5 sm:p-8">
            <div className="space-y-2">
              <Label htmlFor="proofscore-target-role">Target role <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="proofscore-target-role"
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                maxLength={120}
                placeholder="e.g. Product Designer"
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">Adding a role makes the alignment score more specific. We will infer your latest role if you leave it blank.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <Label htmlFor="proofscore-resume">Paste your resume</Label>
                <span className={cn('text-xs tabular-nums', resumeText.length > 12000 ? 'text-red-400' : 'text-muted-foreground')}>
                  {resumeText.length.toLocaleString()}/12,000
                </span>
              </div>
              <Textarea
                id="proofscore-resume"
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                maxLength={12000}
                placeholder={'Paste the text from your resume here…\n\nTip: include your summary, experience bullets, projects, skills, education, and professional links.'}
                className="min-h-[280px] resize-y text-sm leading-relaxed sm:min-h-[340px]"
                disabled={submitting}
                required
              />
            </div>

            <div className="rounded-xl border border-border bg-surface-200/50 p-3.5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your text is sent to OpenAI to extract structure. Showcase keeps the pasted text and sanitized parse privately for a 48-hour signup handoff; after expiry it cannot be claimed and a daily retention job removes it. Showcase does not use it to train its own models.
                </p>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="gradient"
              size="xl"
              className="w-full gap-2 shadow-glow"
              disabled={submitting || resumeText.trim().length < 200}
            >
              {submitting ? <Sparkles className="h-4 w-4 animate-pulse" /> : <FileSearch className="h-4 w-4" />}
              {submitting ? LOADING_MESSAGES[loadingMessage] : 'Score my resume'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
            <p className="text-center text-xs text-muted-foreground">No account or card required. Numbers come from fixed checks over your resume—not an AI opinion.</p>
          </form>
        ) : (
          <div className="p-5 sm:p-8">
            <ReservationPanel
              email={reservationEmail}
              setEmail={setReservationEmail}
              consent={reservationConsent}
              setConsent={setReservationConsent}
              honeypot={reservationHoneypot}
              setHoneypot={setReservationHoneypot}
              submitting={reserving}
              error={reservationError}
              reservedFor={reservedFor}
              onSubmit={submitReservation}
            />
          </div>
        )}
      </section>

      {result && (
        <div ref={resultRef} className="scroll-mt-24 space-y-8" aria-live="polite">
          <section className="glass-card p-6 sm:p-9">
            <div className="grid items-center gap-7 md:grid-cols-[190px_1fr]">
              <ProofScoreRing score={result.overallScore} size="lg" />
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">Your honest baseline</p>
                <h2 className="mb-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">What your resume proves today</h2>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{result.summary}</p>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">Start here</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Your two weakest dimensions, fully explained</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {unlocked.map((category) => (
                <article key={category.key} className="glass-card p-5 sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-brand-400">Priority {category.priority}</span>
                      <h3 className="mt-1 text-lg font-bold text-foreground">{category.name}</h3>
                    </div>
                    <span className={cn('text-2xl font-bold tabular-nums', scoreColor(category.score))}>{category.score}</span>
                  </div>

                  <div className="space-y-4 text-sm leading-relaxed">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">What the audit found</p>
                      {category.evidence?.map((line) => <p key={line} className="text-foreground/80">{line}</p>)}
                      <p className="mt-2 text-muted-foreground">{category.explanation}</p>
                    </div>
                    <div className="rounded-xl border border-brand-500/15 bg-brand-500/[0.05] p-4">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-300">
                        <Lightbulb className="h-3.5 w-3.5" /> The fix
                      </p>
                      <p className="text-foreground/85">{category.fix}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Truth-safe draft</p>
                      <p className="whitespace-pre-line rounded-lg bg-surface-200 px-3 py-2.5 font-mono text-xs text-foreground/75">{category.example}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="glass-card p-5 sm:p-7">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">All 11 scores</p>
              <h2 className="mt-1 text-xl font-bold text-foreground">Nothing blurred. The numbers are yours.</h2>
            </div>
            <div className="grid gap-2.5 md:grid-cols-2">
              {result.categories.map((category) => (
                <div key={category.key} className="rounded-xl border border-border bg-surface-200/40 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{category.name}</span>
                    <div className="flex items-center gap-2">
                      {category.gated && <Lock className="h-3 w-3 text-muted-foreground/60" aria-label="Fix available after signup" />}
                      <span className={cn('font-bold tabular-nums', scoreColor(category.score))}>{category.score}</span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-300">
                    <div
                      className={cn('h-full rounded-full', category.score >= 70 ? 'bg-emerald-400' : category.score >= 40 ? 'bg-amber-400' : 'bg-red-400')}
                      style={{ width: `${category.score}%` }}
                    />
                  </div>
                  {category.gated && <p className="mt-2 text-xs text-muted-foreground">Specific diagnosis and fix continue in your free account.</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/[0.12] via-surface-100 to-surface-100 p-6 text-center sm:p-9">
            <CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-brand-400" />
            <h2 className="text-2xl font-bold tracking-tight text-foreground">That’s 2 of your 11 fixes.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              The other 9 are already scored above. Continue with a free account to get their specific fixes and carry this parsed resume straight into your first portfolio—no second paste or parse.
            </p>
            <Button asChild variant="gradient" size="xl" className="mt-6 gap-2 shadow-glow">
              <Link
                href="/signup?utm_source=proofscore&utm_medium=free_tool"
                onClick={() => trackMarketingEvent('proofscore_signup_clicked', { score_band: scoreBand(result.overallScore) })}
              >
                Create a free account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">Full audit + one AI-built portfolio. No card.</p>
          </section>
        </div>
      )}
    </div>
  )
}

interface ReservationPanelProps {
  email: string
  setEmail: (value: string) => void
  consent: boolean
  setConsent: (value: boolean) => void
  honeypot: string
  setHoneypot: (value: string) => void
  submitting: boolean
  error: string
  reservedFor: string | null
  onSubmit: (event: FormEvent) => void
}

function ReservationPanel({
  email,
  setEmail,
  consent,
  setConsent,
  honeypot,
  setHoneypot,
  submitting,
  error,
  reservedFor,
  onSubmit,
}: ReservationPanelProps) {
  if (reservedFor) {
    return (
      <div className="py-4 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
        <h2 className="text-xl font-bold text-foreground">Your spot is held for {formatUtcDate(reservedFor)}.</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Check your inbox for the one-use link. It is valid on that date in UTC, and this request will not add you to a marketing list.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-400">Daily compute cap reached</p>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Today’s 25 free audits are done.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Each audit costs real compute, and we would rather run 25 honest ones than 1,000 shallow ones. Leave your email and we will hold one of tomorrow’s 25 spots. You will get one link, good for one audit, and that is the only email this request sends.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="proofscore-reservation-email">Email for the one-use link</Label>
        <Input
          id="proofscore-reservation-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <Label htmlFor="proofscore-reservation-website">Website</Label>
        <Input
          id="proofscore-reservation-website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-pink-500"
          required
        />
        Send me one transactional email containing tomorrow’s reserved ProofScore link. Do not subscribe me to marketing.
      </label>
      {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">{error}</div>}
      <Button type="submit" variant="gradient" size="lg" className="w-full" loading={submitting} disabled={!consent}>
        Save my spot for tomorrow
      </Button>
    </form>
  )
}
