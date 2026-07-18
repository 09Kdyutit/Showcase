'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FileText, LayoutTemplate, Gauge, Send, MessagesSquare,
  CheckCircle2, Globe2, Lock, type LucideIcon,
} from 'lucide-react'
import { SectionLabel } from '@/components/shared/section-label'

const BRAND = 'oklch(63% 0.200 255)'
const DIM = 'oklch(60% 0.014 262)'
const DIMMER = 'oklch(64% 0.022 258)'

type Step = {
  icon: LucideIcon
  title: string
  short: string
  desc: string
  boundary: string
  stage: React.ReactNode
}

/* Small illustrative stage mocks. All content is demo data and labeled as such
   at the bottom of the stage — never present these as a real user's numbers. */

function StageRow({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: active ? 'oklch(54% 0.230 255 / 0.10)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'oklch(54% 0.230 255 / 0.35)' : 'var(--color-border)'}`,
      }}
    >
      {children}
    </div>
  )
}

function ImportStage() {
  return (
    <div className="space-y-2.5">
      <StageRow active>
        <FileText className="h-4 w-4 shrink-0" style={{ color: BRAND }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">jordan-resume.pdf</p>
          <p className="text-xs" style={{ color: DIM }}>PDF, DOCX, pasted text, or a LinkedIn profile export</p>
        </div>
        <span className="text-xs font-semibold shrink-0" style={{ color: 'oklch(72% 0.16 162)' }}>Parsed ✓</span>
      </StageRow>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          ['Experience', '3 roles, 9 bullet points'],
          ['Projects', '2 with real outcomes'],
          ['Skills', '12 found'],
          ['Links', 'GitHub · LinkedIn'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: DIM }}>{k}</p>
            <p className="text-xs text-foreground/85">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs pt-1" style={{ color: DIMMER }}>Everything stays editable — fix anything the parser got wrong.</p>
    </div>
  )
}

function PortfolioStage() {
  return (
    <div className="space-y-2.5">
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="px-4 py-3" style={{ background: 'linear-gradient(120deg, oklch(54% 0.230 255 / 0.25), oklch(58% 0.20 290 / 0.2))' }}>
          <p className="text-sm font-semibold text-foreground">Jordan Chen — Software Engineer</p>
          <p className="text-xs" style={{ color: 'rgba(226,236,255,0.75)' }}>Case studies built from your parsed experience</p>
        </div>
        <div className="p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {['Internal tooling used by 40 people weekly', 'CI pipeline — deploy time cut 30%'].map((t) => (
            <div key={t} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
              <LayoutTemplate className="h-3.5 w-3.5 shrink-0" style={{ color: BRAND }} />
              <p className="text-xs text-foreground/85 truncate">{t}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs" style={{ color: DIMMER }}>
        <Lock className="h-3.5 w-3.5 shrink-0" />
        Private draft — nothing is visible to anyone until you choose to publish.
      </div>
    </div>
  )
}

function AuditStage() {
  const cats: [string, number][] = [['Evidence & metrics', 74], ['Specificity', 58], ['Structure', 81], ['Credibility', 66]]
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-4 rounded-xl px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-foreground"
          style={{ background: 'conic-gradient(oklch(63% 0.2 255) 0 68%, rgba(255,255,255,0.08) 68% 100%)' }}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--color-surface-100, oklch(18% 0.03 258))' }}>68</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Evidence Audit</p>
          <p className="text-xs" style={{ color: DIM }}>Scores what&apos;s provable — and tells you exactly what to fix next.</p>
        </div>
      </div>
      <div className="space-y-2">
        {cats.map(([name, v]) => (
          <div key={name} className="flex items-center gap-3">
            <p className="w-36 shrink-0 text-xs truncate" style={{ color: DIMMER }}>{name}</p>
            <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full" style={{ width: `${v}%`, background: BRAND }} />
            </div>
            <p className="w-7 text-right text-xs font-semibold text-foreground/80" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs pt-1" style={{ color: DIMMER }}>Free includes all 11 dimensions once every 24 hours. Pro raises the limit to 10.</p>
    </div>
  )
}

function ApplyStage() {
  return (
    <div className="space-y-2.5">
      <StageRow active>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">Frontend Engineer — Series B fintech</p>
          <p className="text-xs" style={{ color: DIM }}>Matched against the experience already in your workspace</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: BRAND, background: 'oklch(54% 0.230 255 / 0.12)', border: '1px solid oklch(54% 0.230 255 / 0.3)' }}>
          Strong match
        </span>
      </StageRow>
      <div className="grid grid-cols-3 gap-2.5">
        {['Tailored résumé', 'Cover letter', 'ATS check'].map((t) => (
          <div key={t} className="rounded-xl px-3 py-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <CheckCircle2 className="h-4 w-4 mx-auto mb-1.5" style={{ color: 'oklch(72% 0.16 162)' }} />
            <p className="text-xs text-foreground/85">{t}</p>
          </div>
        ))}
      </div>
      <p className="text-xs pt-1" style={{ color: DIMMER }}>Showcase prepares the materials. You review them and you send them — it never auto-submits.</p>
    </div>
  )
}

function PracticePublishStage() {
  return (
    <div className="space-y-2.5">
      <div className="rounded-xl px-4 py-3.5 space-y-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: DIM }}>Interview Lab · written practice</p>
        <p className="text-sm text-foreground/90">&ldquo;Tell me about a time you improved a slow process.&rdquo;</p>
        <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'oklch(54% 0.230 255 / 0.08)', border: '1px solid oklch(54% 0.230 255 / 0.22)', color: 'rgba(226,236,255,0.85)' }}>
          <span className="font-semibold" style={{ color: BRAND }}>Coaching: </span>
          Strong situation — now quantify the result. Your CI project has the number: 30% faster deploys.
        </div>
      </div>
      <StageRow>
        <Globe2 className="h-4 w-4 shrink-0" style={{ color: 'oklch(80% 0.14 85)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Publish live when it&apos;s ready</p>
          <p className="text-xs" style={{ color: DIM }}>A shareable link with a preview card — part of Pro</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: 'oklch(80% 0.14 85)' }}>Pro</span>
      </StageRow>
    </div>
  )
}

const STEPS: Step[] = [
  {
    icon: FileText,
    title: 'Import your résumé',
    short: 'PDF, DOCX, paste, or LinkedIn export',
    desc: 'Drop in the résumé you already have. Showcase reads it and structures your roles, projects, skills, and links into editable evidence — no blank forms.',
    boundary: 'Scanned PDFs are read too. If a file can’t be read, we say so and you can paste instead.',
    stage: <ImportStage />,
  },
  {
    icon: LayoutTemplate,
    title: 'Get an editable portfolio',
    short: 'Case studies from your real experience',
    desc: 'One generation turns that evidence into a full portfolio draft — hero, case studies, and themes. Every word stays editable, and it stays private until you decide otherwise.',
    boundary: 'AI drafts are grounded in what you provided. You review and edit everything.',
    stage: <PortfolioStage />,
  },
  {
    icon: Gauge,
    title: 'See exactly what to fix',
    short: 'Evidence Audit: a score with instructions',
    desc: 'The Evidence Audit scores how specific and supported your story is, dimension by dimension, with a concrete fix for each — so improving it is a checklist, not guesswork.',
    boundary: 'Free: one complete 11-dimension Audit every 24 hours. Pro: 10 every 24 hours.',
    stage: <AuditStage />,
  },
  {
    icon: Send,
    title: 'Apply with focus',
    short: 'Role matching, tailored kits, ATS checks',
    desc: 'Compare roles against the experience already in your workspace, then generate a tailored résumé, cover letter, and outreach draft per application — with an ATS readiness check on the result.',
    boundary: 'A match shows alignment, not a hiring prediction. Nothing is ever auto-submitted.',
    stage: <ApplyStage />,
  },
  {
    icon: MessagesSquare,
    title: 'Practice, then publish',
    short: 'Interview coaching · live portfolio with Pro',
    desc: 'Practice role-aware written interviews with per-answer coaching that points back to your own projects. When the portfolio is ready, Pro puts it live at a link you can share anywhere.',
    boundary: 'Written practice is live today; voice practice appears when enabled.',
    stage: <PracticePublishStage />,
  },
]

const ADVANCE_MS = 5200

export function ConnectedJourney() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(false)

  // Only auto-advance while the section is on screen and the user hasn't taken over.
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (paused || !inView) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setActive((a) => (a + 1) % STEPS.length), ADVANCE_MS)
    return () => clearInterval(t)
  }, [paused, inView])

  const pick = useCallback((i: number) => {
    setActive(i)
    setPaused(true)
  }, [])

  const step = STEPS[active]

  const stagePanel = (
    <div
      key={active}
      className="ring-conic overflow-hidden rounded-2xl p-5 sm:p-6"
      style={{
        background: 'rgba(7, 20, 51, 0.55)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 24px 80px rgba(3, 8, 28, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(18px)',
        animation: 'fadeIn 0.45s ease both',
      }}
    >
      <p className="mb-4 text-sm leading-relaxed" style={{ color: 'oklch(70% 0.012 262)' }}>{step.desc}</p>
      {step.stage}
      <div className="mt-4 flex items-start justify-between gap-4 pt-3" style={{ borderTop: '1px dashed var(--color-border)' }}>
        <p className="text-xs leading-relaxed" style={{ color: DIMMER }}>{step.boundary}</p>
        <p className="shrink-0 text-[9px] uppercase tracking-widest pt-0.5" style={{ color: 'oklch(50% 0.02 258)' }}>Illustrative</p>
      </div>
    </div>
  )

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-32 px-6"
      style={{
        borderTop: '1px dashed var(--color-border)',
        borderBottom: '1px dashed var(--color-border)',
        background: 'linear-gradient(180deg, oklch(21% 0.036 258), oklch(17% 0.032 258))',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-14 max-w-2xl">
          <SectionLabel number="01" className="mb-6">How it works</SectionLabel>
          <h2
            className="font-bold tracking-tight text-balance mb-4"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}
          >
            Your résumé goes in.
            <br />Here&apos;s what comes out.
          </h2>
          <p className="text-sm leading-relaxed max-w-xl" style={{ color: DIM }}>
            Five steps, one thread: the same real experience powers every one of them,
            so you never rebuild your story from scratch.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(300px,360px)_1fr] lg:gap-8 lg:items-start">
          {/* Step rail */}
          <div className="flex flex-col gap-2.5" role="tablist" aria-label="How Showcase works">
            {STEPS.map(({ icon: Icon, title, short }, i) => {
              const isActive = i === active
              return (
                <div key={title}>
                  <button
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => pick(i)}
                    className="w-full cursor-pointer rounded-2xl px-4 py-3.5 text-left transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
                    style={{
                      background: isActive ? 'oklch(54% 0.230 255 / 0.10)' : 'rgba(255,255,255,0.025)',
                      border: `1px solid ${isActive ? 'oklch(54% 0.230 255 / 0.4)' : 'var(--color-border)'}`,
                      boxShadow: isActive ? '0 0 32px oklch(54% 0.230 255 / 0.12)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300"
                        style={{
                          background: isActive ? 'oklch(54% 0.230 255 / 0.2)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isActive ? 'oklch(54% 0.230 255 / 0.45)' : 'var(--color-border)'}`,
                          boxShadow: isActive ? '0 0 22px oklch(54% 0.230 255 / 0.4)' : 'none',
                        }}
                      >
                        <Icon className="h-4 w-4" style={{ color: isActive ? BRAND : DIM }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold" style={{ color: isActive ? 'var(--color-foreground, #fff)' : 'oklch(78% 0.01 258)' }}>
                          <span className="mr-2 text-xs font-bold" style={{ color: isActive ? BRAND : 'oklch(50% 0.02 258)', fontVariantNumeric: 'tabular-nums' }}>
                            {i + 1}
                          </span>
                          {title}
                        </p>
                        <p className="mt-0.5 text-xs truncate" style={{ color: DIM }}>{short}</p>
                      </div>
                    </div>
                    {/* Progress line for the auto-advance, only under the active step */}
                    {isActive && !paused && (
                      <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="h-full rounded-full journey-progress" style={{ background: BRAND }} />
                      </div>
                    )}
                  </button>
                  {/* Mobile: stage renders inline under the active step */}
                  {isActive && <div className="mt-2.5 lg:hidden">{stagePanel}</div>}
                </div>
              )
            })}
          </div>

          {/* Desktop stage */}
          <div className="hidden lg:block lg:sticky lg:top-24">{stagePanel}</div>
        </div>

        <p className="mt-10 text-sm max-w-2xl leading-relaxed" style={{ color: DIMMER }}>
          Showcase presents documented experience. It does not submit applications, promise
          hiring outcomes, or add skills you haven&apos;t provided — review every draft before using it.
        </p>
      </div>

      <style>{`
        .journey-progress { animation: journeyFill ${ADVANCE_MS}ms linear both; }
        @keyframes journeyFill { from { width: 0%; } to { width: 100%; } }
        @media (prefers-reduced-motion: reduce) {
          .journey-progress { animation: none; width: 100%; }
        }
      `}</style>
    </section>
  )
}
