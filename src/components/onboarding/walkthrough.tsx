'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, FileText, LayoutTemplate, Gauge, Send,
  MessagesSquare, Compass, Globe2, Sparkles, CheckCircle2, Lock, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'

// First-run tour: shown once before résumé intake so a brand-new user knows what
// the workspace contains before we ask them for anything. Dismissal is stored in
// localStorage (no schema change); returning users skip straight to upload.
export const TOUR_DONE_KEY = 'showcase_tour_done_v1'

type Slide = {
  icon: LucideIcon
  tone: string
  area: string
  title: string
  desc: string
  points: string[]
  footnote?: string
}

const SLIDES: Slide[] = [
  {
    icon: Sparkles,
    tone: 'oklch(63% 0.20 255)',
    area: 'Welcome to Showcase',
    title: 'One résumé powers everything here.',
    desc: 'Showcase is a connected job-search workspace. You bring the résumé you already have; it becomes the single source of truth behind your portfolio, applications, and interview prep.',
    points: [
      'This tour takes about a minute',
      'Then you drop in your résumé and everything starts from it',
      'Nothing you make here is public unless you choose to publish',
    ],
  },
  {
    icon: LayoutTemplate,
    tone: 'oklch(63% 0.20 255)',
    area: 'Portfolio',
    title: 'Your experience becomes an editable portfolio.',
    desc: 'One generation turns your parsed résumé into a full portfolio draft — hero, case studies, themes. Every word stays editable, and it stays a private draft until you decide otherwise.',
    points: [
      'Case studies built from your real roles and projects',
      'Edit any AI suggestion — you have the final word',
      'Private preview link for your own eyes while you work',
    ],
    footnote: 'AI drafts are grounded in what you provide. Nothing is invented for you to catch later — you review everything.',
  },
  {
    icon: Gauge,
    tone: 'oklch(72% 0.16 162)',
    area: 'Evidence Audit',
    title: 'A score that tells you what to fix.',
    desc: 'The Evidence Audit reads your portfolio like a skeptical recruiter: it scores how provable and specific your story is, and gives a concrete fix per category.',
    points: [
      'Run it daily as you edit — watch the score respond',
      'Free shows your score + 4 core categories',
      'Pro unlocks the full 11-category review',
    ],
  },
  {
    icon: Send,
    tone: 'oklch(70% 0.18 290)',
    area: 'Jobs & Tailor Studio',
    title: 'Apply with materials built per role.',
    desc: 'Compare roles against the experience already in your workspace, then generate a tailored résumé, cover letter, and outreach draft for each application — with an ATS readiness check.',
    points: [
      'Role match shows what aligns with your documented experience',
      'Application kit per job: résumé, cover letter, outreach',
      'You review and you send — Showcase never auto-submits',
    ],
  },
  {
    icon: MessagesSquare,
    tone: 'oklch(75% 0.15 85)',
    area: 'Interview Lab',
    title: 'Practice answers before they count.',
    desc: 'Role-aware written interview practice with coaching on every answer — pointing back at your own projects for the evidence your answers should use.',
    points: [
      'Written practice sessions with per-answer coaching',
      'Drills for the questions you keep fumbling',
      'A story bank that grows out of your real experience',
    ],
    footnote: 'Written practice is live today. Voice practice appears when enabled.',
  },
  {
    icon: Compass,
    tone: 'oklch(70% 0.14 195)',
    area: 'Project Ideas & Opportunities',
    title: 'Thin résumé? Build real evidence.',
    desc: 'When the honest problem is missing experience, Showcase suggests projects worth building and surfaces hackathons, CTFs, and competitions that create real work to talk about.',
    points: [
      'Project ideas matched to the role you want',
      'Opportunities that produce portfolio-worthy artifacts',
      'New work flows straight back into your case studies',
    ],
  },
  {
    icon: Globe2,
    tone: 'oklch(63% 0.20 255)',
    area: 'Publish · Pro',
    title: 'Go live when you say so.',
    desc: 'Free covers building, editing, and private previews. When the portfolio is ready to share, Pro publishes it at a live link with a preview card you can drop into any application or DM.',
    points: [
      'Free: build, edit, private preview — no time limit',
      'Pro ($15/mo or $150/yr): live publishing, full audits, higher limits',
      'First up next: your résumé. That is step one of two.',
    ],
  },
]

export function Walkthrough({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const last = SLIDES.length - 1
  const slide = SLIDES[i]
  const Icon = slide.icon

  const finish = useCallback(() => {
    try { window.localStorage.setItem(TOUR_DONE_KEY, '1') } catch { /* storage unavailable — tour will just show again */ }
    onDone()
  }, [onDone])

  const next = useCallback(() => {
    if (i === last) finish()
    else setI((v) => Math.min(v + 1, last))
  }, [i, last, finish])

  const back = useCallback(() => setI((v) => Math.max(v - 1, 0)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back])

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-6 overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[440px] aurora-mesh opacity-40" />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-[0.07]" />

      <div className="w-full max-w-xl relative">
        <div className="flex items-center justify-between mb-8">
          <Logo size="md" />
          <button
            onClick={finish}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-8" role="tablist" aria-label="Tour progress">
          {SLIDES.map((s, idx) => (
            <button
              key={s.area}
              role="tab"
              aria-selected={idx === i}
              aria-label={s.area}
              onClick={() => setI(idx)}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{
                background: idx <= i ? 'oklch(63% 0.20 255)' : 'rgba(255,255,255,0.09)',
                opacity: idx === i ? 1 : idx < i ? 0.55 : 1,
              }}
            />
          ))}
        </div>

        {/* Slide */}
        <div key={i} className="glass-card p-8" style={{ animation: 'fadeIn 0.4s ease both' }}>
          <div
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: `color-mix(in oklch, ${slide.tone} 16%, transparent)`, border: `1px solid color-mix(in oklch, ${slide.tone} 40%, transparent)` }}
          >
            <Icon className="h-5 w-5" style={{ color: slide.tone }} />
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: slide.tone }}>
            {slide.area}
          </p>
          <h1 className="text-display text-2xl sm:text-3xl font-semibold text-foreground mb-3 leading-[1.1]">
            {slide.title}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{slide.desc}</p>

          <ul className="space-y-2.5 mb-2">
            {slide.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-foreground/85">
                {p.startsWith('Pro ') || p.includes('Pro (')
                  ? <Lock className="h-4 w-4 mt-0.5 shrink-0" style={{ color: slide.tone }} />
                  : <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: slide.tone }} />}
                {p}
              </li>
            ))}
          </ul>

          {slide.footnote && (
            <p className="text-xs text-muted-foreground/70 leading-relaxed pt-4 mt-4" style={{ borderTop: '1px dashed var(--color-border)' }}>
              {slide.footnote}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={back}
            disabled={i === 0}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <p className="text-xs text-muted-foreground/50" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {i + 1} / {SLIDES.length}
          </p>
          <Button variant="gradient" size="md" className="gap-2 px-6" onClick={next}>
            {i === last ? (
              <>
                <FileText className="h-4 w-4" />
                Add my résumé
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
