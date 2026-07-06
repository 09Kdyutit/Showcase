'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion'
import {
  FileText, Zap, BarChart3, Target, ArrowRight, CheckCircle2, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { SectionLabel } from '@/components/shared/section-label'

// How it works, rebuilt as scroll-driven storytelling: the steps scroll on the right
// while a sticky stage on the left morphs through a living miniature of each step —
// parsing, portfolio assembly, ProofScore, job matching, tailoring. All fictional
// demonstration data.

type Step = {
  icon: LucideIcon
  step: string
  title: string
  desc: string
  detail: string
}

const STEPS: Step[] = [
  {
    icon: FileText, step: '01', title: 'Upload your resume',
    desc: 'Paste or upload your resume. Showcase parses it instantly.',
    detail: 'Skills, projects, experience, education — all extracted and structured automatically. No manual data entry, no forms.',
  },
  {
    icon: Zap, step: '02', title: 'AI builds your portfolio',
    desc: 'We turn your experience into structured case studies.',
    detail: 'Each project becomes a problem → role → process → outcome narrative a recruiter can scan and trust in seconds.',
  },
  {
    icon: BarChart3, step: '03', title: 'Get your ProofScore',
    desc: 'An honest audit across 11 categories.',
    detail: 'Evidence strength, first-impression clarity, keyword support and more — each scored, each with a concrete fix.',
  },
  {
    icon: Target, step: '04', title: 'Discover matched roles',
    desc: 'A personalized feed scored against your real evidence.',
    detail: 'Jobs ranked by how well your actual proof lines up with the role — see where you qualify before you apply.',
  },
  {
    icon: ArrowRight, step: '05', title: 'Tailor and apply',
    desc: 'One click creates a role-specific resume kit.',
    detail: 'Every change traced back to your real experience in the Truth Ledger. Nothing invented, nothing inflated.',
  },
]

const EASE = [0.22, 1, 0.36, 1] as const

// ── Stage visuals: one living miniature per step ───────────────────────────────

function chipIn(i: number) {
  return {
    initial: { opacity: 0, scale: 0.7, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.45, ease: EASE, delay: 0.25 + i * 0.07 },
  }
}

function VizParse() {
  const chips = [
    ['React', 'oklch(74% 0.13 200)'], ['Figma', 'oklch(76% 0.15 330)'], ['SQL', 'oklch(75% 0.15 255)'],
    ['3 projects', 'oklch(75% 0.16 285)'], ['2 internships', 'oklch(75% 0.16 160)'], ['BSc CS', 'oklch(81% 0.14 85)'],
    ['Python', 'oklch(75% 0.15 255)'], ['Leadership', 'oklch(76% 0.15 330)'],
  ] as const
  return (
    <div className="h-full flex flex-col justify-center gap-5">
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mx-auto flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-border)', boxShadow: '0 12px 32px oklch(0% 0 0 / 0.4)' }}
      >
        <div className="w-9 h-11 rounded-md relative overflow-hidden" style={{ background: 'oklch(90% 0.01 255)', border: '1px solid oklch(70% 0.02 255)' }}>
          <div className="absolute inset-x-1.5 top-2 h-0.5 rounded" style={{ background: 'oklch(45% 0.02 258)' }} />
          <div className="absolute inset-x-1.5 top-4 h-0.5 rounded" style={{ background: 'oklch(65% 0.02 258)' }} />
          <div className="absolute inset-x-1.5 top-6 h-0.5 rounded" style={{ background: 'oklch(65% 0.02 258)' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">resume.pdf</p>
          <p className="text-[10px]" style={{ color: 'oklch(72% 0.17 160)' }}>✓ parsed in 4 seconds</p>
        </div>
      </motion.div>

      {/* Extraction beam */}
      <motion.div
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.15 }}
        className="mx-auto w-px h-8 origin-top"
        style={{ background: 'linear-gradient(180deg, oklch(63% 0.20 255), transparent)' }}
      />

      <div className="flex flex-wrap justify-center gap-2 max-w-xs mx-auto">
        {chips.map(([label, c], i) => (
          <motion.span
            key={label}
            {...chipIn(i)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: `color-mix(in oklch, ${c} 13%, transparent)`, border: `1px solid color-mix(in oklch, ${c} 32%, transparent)`, color: c }}
          >
            {label}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

function VizBuild() {
  const rows = [
    ['Problem', 'Ops compiled weekly reports by hand', 'oklch(62% 0.18 25)'],
    ['Role', 'Sole builder — intern project', 'oklch(63% 0.20 255)'],
    ['Process', 'Scoped with ops lead, shipped in 6 weeks', 'oklch(62% 0.22 285)'],
    ['Outcome', 'Reporting: 4 hours → 20 minutes weekly', 'oklch(72% 0.17 160)'],
  ] as const
  return (
    <div className="h-full flex flex-col justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="rounded-2xl p-4"
        style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-border)', boxShadow: '0 16px 40px oklch(0% 0 0 / 0.4)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-foreground">Internal Analytics Dashboard</p>
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'oklch(72% 0.17 160 / 0.12)', color: 'oklch(72% 0.17 160)', border: '1px solid oklch(72% 0.17 160 / 0.25)' }}>
            <CheckCircle2 className="h-2.5 w-2.5" /> evidence attached
          </span>
        </div>
        <div className="space-y-2">
          {rows.map(([tag, text, c], i) => (
            <motion.div
              key={tag}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.2 + i * 0.13 }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2"
              style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-border)' }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider w-14 shrink-0" style={{ color: c }}>{tag}</span>
              <span className="text-[11px] truncate" style={{ color: 'oklch(72% 0.01 255)' }}>{text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function VizScore() {
  const bars = [
    ['Evidence strength', 86, 'oklch(72% 0.17 160)'],
    ['First impression', 78, 'oklch(72% 0.17 160)'],
    ['Role alignment', 61, 'oklch(80% 0.15 85)'],
    ['Keyword support', 91, 'oklch(72% 0.17 160)'],
  ] as const
  const R = 40
  const C = 2 * Math.PI * R
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-surface-300)" strokeWidth="9" />
          <motion.circle
            cx="50" cy="50" r={R} fill="none"
            stroke="url(#hiw-ring)" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - 0.87) }}
            transition={{ duration: 1.3, ease: EASE, delay: 0.2 }}
          />
          <defs>
            <linearGradient id="hiw-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="oklch(63% 0.20 255)" />
              <stop offset="100%" stopColor="oklch(62% 0.22 285)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground stat-number">87</span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: 'oklch(63% 0.02 258)' }}>ProofScore</span>
        </div>
      </div>
      <div className="w-full max-w-xs space-y-2.5">
        {bars.map(([label, v, c], i) => (
          <div key={label} className="flex items-center gap-2.5">
            <span className="text-[10px] w-24 shrink-0" style={{ color: 'oklch(62% 0.02 258)' }}>{label}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-300)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: c }}
                initial={{ width: 0 }}
                animate={{ width: `${v}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.35 + i * 0.12 }}
              />
            </div>
            <span className="text-[10px] font-bold w-5 text-right stat-number" style={{ color: c }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VizMatch() {
  const jobs = [
    ['Product Designer', 'Fintech startup', 88, 'oklch(72% 0.17 160)', 'Strong'],
    ['UX Researcher', 'Health tech', 74, 'oklch(70% 0.16 255)', 'Good'],
    ['Design Engineer', 'Dev tools', 65, 'oklch(80% 0.15 85)', 'Fair'],
  ] as const
  return (
    <div className="h-full flex flex-col justify-center gap-2.5">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-[10px] uppercase tracking-widest text-center mb-1"
        style={{ color: 'oklch(60% 0.02 258)' }}
      >
        Ranked by your evidence
      </motion.p>
      {jobs.map(([role, co, score, c, label], i) => (
        <motion.div
          key={role}
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.13 }}
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: 'var(--color-surface-100)', border: `1px solid ${i === 0 ? 'color-mix(in oklch, oklch(72% 0.17 160) 30%, var(--color-border))' : 'var(--color-border)'}`, boxShadow: i === 0 ? '0 8px 28px oklch(0% 0 0 / 0.35)' : undefined }}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{role}</p>
            <p className="text-[10px]" style={{ color: 'oklch(58% 0.02 258)' }}>{co}</p>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: `color-mix(in oklch, ${c} 14%, transparent)`, color: c, border: `1px solid color-mix(in oklch, ${c} 30%, transparent)` }}>
            <Target className="h-2.5 w-2.5" /> {score} · {label}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

function VizTailor() {
  return (
    <div className="h-full flex flex-col justify-center gap-3">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 0.65, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="rounded-xl px-4 py-3"
        style={{ background: 'var(--color-surface-100)', border: '1px solid oklch(62% 0.22 25 / 0.22)' }}
      >
        <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'oklch(62% 0.18 25)' }}>Generic</p>
        <p className="text-[11px] line-through decoration-1" style={{ color: 'oklch(55% 0.02 258)' }}>
          Worked on analytics dashboard for internal team.
        </p>
      </motion.div>
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.3 }}
        className="mx-auto w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: 'oklch(54% 0.230 255 / 0.15)', border: '1px solid oklch(54% 0.230 255 / 0.35)' }}
      >
        <Sparkles className="h-3.5 w-3.5" style={{ color: 'oklch(70% 0.17 255)' }} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.45 }}
        className="rounded-xl px-4 py-3"
        style={{ background: 'color-mix(in oklch, oklch(72% 0.17 160) 6%, var(--color-surface-100))', border: '1px solid oklch(72% 0.17 160 / 0.28)', boxShadow: '0 10px 30px oklch(0% 0 0 / 0.35)' }}
      >
        <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'oklch(72% 0.17 160)' }}>Tailored for Product Designer</p>
        <p className="text-[11px] leading-relaxed text-foreground/90">
          Built an ops analytics dashboard adopted by 3 teams, cutting weekly reporting from 4 hours to 20 minutes.
        </p>
      </motion.div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.75 }}
        className="mx-auto inline-flex items-center gap-1.5 text-[9px] font-mono px-2.5 py-1 rounded-md"
        style={{ background: 'oklch(72% 0.17 160 / 0.08)', border: '1px solid oklch(72% 0.17 160 / 0.22)', color: 'oklch(74% 0.15 160)' }}
      >
        <CheckCircle2 className="h-2.5 w-2.5" /> Truth Ledger: sourced from resume.pdf
      </motion.span>
    </div>
  )
}

const VISUALS = [VizParse, VizBuild, VizScore, VizMatch, VizTailor]

// ── Section ────────────────────────────────────────────────────────────────────

export function HowItWorks() {
  const stepsRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({
    target: stepsRef,
    offset: ['start 0.6', 'end 0.6'],
  })
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const idx = Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)))
    setActive(idx)
  })

  const ActiveViz = VISUALS[active]
  const ActiveIcon = STEPS[active].icon

  return (
    <section id="how-it-works" className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 36, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-90px' }}
          transition={{ duration: 0.75, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mb-20"
        >
          <SectionLabel number="01" className="mb-6">How it works</SectionLabel>
          <h2
            className="font-bold tracking-tight text-balance"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}
          >
            From resume to proof of work,
            <br />in minutes.
          </h2>
        </motion.div>

        {/* NOTE: the stage column must stretch to the full row height (no items-start)
            so the inner sticky element can travel the entire steps column. */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Sticky stage (desktop) */}
          <div className="hidden lg:block">
          <div className="sticky top-28">
            <div
              className="relative rounded-3xl overflow-hidden h-[480px] p-8"
              style={{
                background: 'radial-gradient(120% 120% at 20% 0%, var(--color-surface-100), var(--color-surface-0) 65%)',
                border: '1px solid color-mix(in oklch, var(--color-brand-500) 18%, var(--color-border))',
                boxShadow: '0 30px 80px oklch(0% 0 0 / 0.5), inset 0 1px 0 oklch(100% 0 0 / 0.06)',
              }}
            >
              <div className="pointer-events-none absolute inset-0 dot-grid opacity-25" />
              <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{ background: 'radial-gradient(70% 50% at 50% -10%, color-mix(in oklch, var(--color-brand-500) 14%, transparent), transparent)' }}
              />

              {/* Stage header */}
              <div className="relative flex items-center gap-3 mb-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`icon-${active}`}
                    initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.6, rotate: 12 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, oklch(54% 0.230 255 / 0.25), oklch(54% 0.230 255 / 0.07))',
                      border: '1px solid oklch(54% 0.230 255 / 0.3)',
                    }}
                  >
                    <ActiveIcon className="h-4 w-4" style={{ color: 'oklch(72% 0.16 255)' }} />
                  </motion.div>
                </AnimatePresence>
                <div className="flex-1">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`label-${active}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="text-sm font-bold text-foreground"
                    >
                      {STEPS[active].title}
                    </motion.p>
                  </AnimatePresence>
                </div>
                {/* Step progress dots */}
                <div className="flex items-center gap-1.5">
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      className="rounded-full transition-all duration-400"
                      style={{
                        width: i === active ? 18 : 6,
                        height: 6,
                        background: i === active
                          ? 'linear-gradient(90deg, oklch(63% 0.20 255), oklch(62% 0.22 285))'
                          : i < active ? 'oklch(54% 0.230 255 / 0.5)' : 'var(--color-surface-300)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Morphing visual */}
              <div className="relative h-[calc(100%-56px)]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="absolute inset-0"
                  >
                    <ActiveViz />
                  </motion.div>
                </AnimatePresence>
              </div>

              <p className="absolute bottom-3 right-5 text-[8px] uppercase tracking-widest" style={{ color: 'oklch(45% 0.02 258)' }}>
                Fictional demonstration data
              </p>
            </div>
          </div>
          </div>

          {/* Steps list */}
          <div ref={stepsRef} className="relative">
            {/* Rail */}
            <div className="absolute left-[23px] top-8 bottom-8 w-px timeline-track" aria-hidden="true" />

            {STEPS.map(({ icon: Icon, step, title, desc, detail }, i) => {
              const isActive = i === active
              return (
                <div key={step} className="relative pl-16 py-8 lg:min-h-[180px]">
                  {/* Node */}
                  <div
                    className="absolute left-0 top-8 z-10 w-12 h-12 rounded-xl flex items-center justify-center font-mono text-sm font-bold tabular-nums transition-all duration-400"
                    style={{
                      background: isActive ? 'oklch(54% 0.230 255 / 0.14)' : 'var(--color-surface-100)',
                      border: `1px solid ${isActive ? 'oklch(54% 0.230 255 / 0.5)' : 'var(--color-border)'}`,
                      color: isActive ? 'oklch(74% 0.15 255)' : 'oklch(78% 0.03 258)',
                      boxShadow: isActive ? '0 0 24px oklch(54% 0.230 255 / 0.25)' : 'none',
                      transform: isActive ? 'scale(1.06)' : 'scale(1)',
                    }}
                  >
                    {step}
                  </div>

                  <div className="transition-opacity duration-400" style={{ opacity: isActive ? 1 : 0.72 }}>
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{title}</h3>
                    <p className="text-sm mt-1.5 font-medium" style={{ color: isActive ? 'oklch(74% 0.14 255)' : 'oklch(82% 0.025 258)' }}>{desc}</p>
                    <p className="text-[15px] mt-3 leading-relaxed" style={{ color: 'oklch(82% 0.02 258)' }}>{detail}</p>
                  </div>

                  {/* Mobile inline visual */}
                  <div className="lg:hidden mt-6">
                    <div
                      className="relative rounded-2xl overflow-hidden p-5"
                      style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-border)', minHeight: 300 }}
                    >
                      <div className="pointer-events-none absolute inset-0 dot-grid opacity-20" />
                      {(() => { const V = VISUALS[i]; return <V /> })()}
                    </div>
                  </div>
                  {/* keep Icon referenced for type completeness on mobile header */}
                  <span className="sr-only"><Icon className="h-0 w-0" /></span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
