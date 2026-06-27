'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/shared/logo'

type Step = 'form' | 'success'

interface FormState {
  email: string
  rating: number | null
  what_worked: string
  what_confused_you: string
  missing_features: string
  bugs: string
  would_recommend: boolean | null
  published_portfolio: boolean | null
  sent_to_recruiter: boolean | null
  willingness_to_pay: string
  testimonial_permission: boolean
  followup_permission: boolean
}

const INITIAL: FormState = {
  email: '',
  rating: null,
  what_worked: '',
  what_confused_you: '',
  missing_features: '',
  bugs: '',
  would_recommend: null,
  published_portfolio: null,
  sent_to_recruiter: null,
  willingness_to_pay: '',
  testimonial_permission: false,
  followup_permission: false,
}

const RATING_LABELS: Record<number, string> = {
  1: 'Needs serious work',
  2: 'Not there yet',
  3: 'Rough',
  4: 'Below expectations',
  5: 'Okay',
  6: 'Pretty good',
  7: 'Good',
  8: 'Really good',
  9: 'Excellent',
  10: 'Outstanding',
}

function BetaFeedbackContent() {
  const params = useSearchParams()
  const inviteToken = params.get('token') ?? undefined

  const [step, setStep] = useState<Step>('form')
  const [form, setForm] = useState<FormState>(INITIAL)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.email && !inviteToken) {
      setError('Please enter your email so we can match your feedback.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/beta/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email || undefined,
          invite_token: inviteToken,
          rating: form.rating ?? undefined,
          what_worked: form.what_worked || undefined,
          what_confused_you: form.what_confused_you || undefined,
          missing_features: form.missing_features || undefined,
          bugs: form.bugs || undefined,
          would_recommend: form.would_recommend ?? undefined,
          published_portfolio: form.published_portfolio ?? undefined,
          sent_to_recruiter: form.sent_to_recruiter ?? undefined,
          willingness_to_pay: form.willingness_to_pay || undefined,
          testimonial_permission: form.testimonial_permission,
          followup_permission: form.followup_permission,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setStep('success')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="sm" />
          </Link>
          <span className="text-xs text-muted-foreground/40">Beta Feedback</span>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-20">
        {step === 'success' ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-black text-foreground mb-3 tracking-tight">
              Thank you.
            </h1>
            <p className="text-foreground/60 text-lg mb-8 font-light max-w-sm mx-auto">
              This directly shapes Showcase V1. We read every response.
            </p>
            {form.followup_permission && (
              <p className="text-sm text-muted-foreground/50 mb-8">
                We may follow up to dig deeper. Thank you for letting us.
              </p>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground hover:bg-secondary transition-all"
            >
              Back to Showcase
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-10">
              <p className="text-[10px] font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Beta feedback</p>
              <h1 className="text-3xl font-black text-foreground mb-3 tracking-tight">
                How did Showcase feel?
              </h1>
              <p className="text-foreground/55 leading-relaxed">
                Two minutes of honest feedback directly shapes what we build next. Be blunt  -  we can handle it.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email (if no token) */}
              {!inviteToken && (
                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                    Your email <span className="text-brand-600">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    className="w-full rounded-xl bg-secondary border border-border focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all"
                  />
                </div>
              )}

              {/* Rating */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">
                  Overall rating <span className="text-muted-foreground/30">(1-10)</span>
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => update('rating', n)}
                      className={cn(
                        'rounded-lg py-2.5 text-sm font-bold transition-all',
                        form.rating === n
                          ? 'bg-brand-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                          : 'bg-secondary border border-border text-muted-foreground hover:border-brand-500/30 hover:text-foreground',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {form.rating && (
                  <p className="text-xs text-brand-600 mt-2 font-medium">{RATING_LABELS[form.rating]}</p>
                )}
              </div>

              {/* What worked */}
              <div>
                <label htmlFor="what_worked" className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                  What worked well?
                </label>
                <textarea
                  id="what_worked"
                  value={form.what_worked}
                  onChange={(e) => update('what_worked', e.target.value)}
                  placeholder="What felt useful, smooth, or impressive?"
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-xl bg-secondary border border-border focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all resize-none"
                />
              </div>

              {/* What confused */}
              <div>
                <label htmlFor="what_confused" className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                  What confused you?
                </label>
                <textarea
                  id="what_confused"
                  value={form.what_confused_you}
                  onChange={(e) => update('what_confused_you', e.target.value)}
                  placeholder="What was unclear, unexpected, or frustrating?"
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-xl bg-secondary border border-border focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all resize-none"
                />
              </div>

              {/* Missing */}
              <div>
                <label htmlFor="missing" className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                  What felt missing?
                </label>
                <textarea
                  id="missing"
                  value={form.missing_features}
                  onChange={(e) => update('missing_features', e.target.value)}
                  placeholder="Features, content, or capabilities you expected but did not find"
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-xl bg-secondary border border-border focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all resize-none"
                />
              </div>

              {/* Bugs */}
              <div>
                <label htmlFor="bugs" className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                  Any bugs?
                </label>
                <textarea
                  id="bugs"
                  value={form.bugs}
                  onChange={(e) => update('bugs', e.target.value)}
                  placeholder="Describe anything that broke, errored, or behaved unexpectedly"
                  rows={2}
                  maxLength={2000}
                  className="w-full rounded-xl bg-secondary border border-border focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all resize-none"
                />
              </div>

              {/* Would recommend */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">
                  Would you recommend Showcase to a friend?
                </label>
                <div className="flex gap-3">
                  {[
                    { value: true, label: 'Yes' },
                    { value: false, label: 'Not yet' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => update('would_recommend', opt.value)}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                        form.would_recommend === opt.value
                          ? opt.value
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                          : 'bg-secondary border-border text-muted-foreground hover:border-border',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Published portfolio? */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">
                  Did you publish your portfolio?
                </label>
                <div className="flex gap-3">
                  {[
                    { value: true, label: 'Yes, it\'s live' },
                    { value: false, label: 'Not yet' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => update('published_portfolio', opt.value)}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                        form.published_portfolio === opt.value
                          ? opt.value
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                            : 'bg-secondary border-border text-foreground'
                          : 'bg-secondary border-border text-muted-foreground hover:border-border',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sent to recruiter? */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">
                  Have you shared your portfolio link with a recruiter or employer?
                </label>
                <div className="flex gap-3">
                  {[
                    { value: true, label: 'Yes' },
                    { value: false, label: 'Not yet' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => update('sent_to_recruiter', opt.value)}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                        form.sent_to_recruiter === opt.value
                          ? opt.value
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                            : 'bg-secondary border-border text-foreground'
                          : 'bg-secondary border-border text-muted-foreground hover:border-border',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Willingness to pay */}
              <div>
                <label htmlFor="willingness_to_pay" className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                  Would you pay for Showcase? If yes  -  how much, for what?
                </label>
                <textarea
                  id="willingness_to_pay"
                  value={form.willingness_to_pay}
                  onChange={(e) => update('willingness_to_pay', e.target.value)}
                  placeholder="e.g. $10/month for unlimited portfolios, $20 one-time for a PDF export, nothing until I get a job..."
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-xl bg-secondary border border-border focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all resize-none"
                />
              </div>

              {/* Permissions */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Permissions</p>

                {[
                  {
                    field: 'followup_permission' as const,
                    label: 'You can follow up with me to dig deeper into this feedback.',
                  },
                  {
                    field: 'testimonial_permission' as const,
                    label: 'You can quote my feedback publicly (anonymized by default). I can withdraw this anytime.',
                  },
                ].map(({ field, label }) => (
                  <label key={field} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form[field] as boolean}
                        onChange={(e) => update(field, e.target.checked)}
                      />
                      <div className={cn(
                        'w-4 h-4 rounded border-2 transition-all flex items-center justify-center',
                        (form[field] as boolean)
                          ? 'bg-brand-500 border-brand-500'
                          : 'border-border group-hover:border-brand-500/50',
                      )}>
                        {(form[field] as boolean) && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                      </div>
                    </div>
                    <p className="text-sm text-foreground/60 leading-relaxed">{label}</p>
                  </label>
                ))}
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-600/90 bg-red-500/8 border border-red-500/15 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base transition-all',
                  submitting
                    ? 'bg-secondary text-muted-foreground/40 cursor-not-allowed'
                    : 'bg-gradient-to-r from-brand-500 to-violet-500 text-white hover:opacity-90 shadow-[0_0_30px_rgba(99,102,241,0.3)]',
                )}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit feedback
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground/35">
                Your response is confidential. We never share raw feedback publicly without permission.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function BetaFeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <BetaFeedbackContent />
    </Suspense>
  )
}
