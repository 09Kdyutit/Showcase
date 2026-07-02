'use client'

import { useRef } from 'react'
import { motion, useScroll, useSpring, useInView } from 'framer-motion'
import {
  FileText, Zap, BarChart3, Target, ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import { SectionLabel } from '@/components/shared/section-label'

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
    detail: 'Skills, projects, experience, education, all extracted and structured automatically. No manual data entry, no forms. Just drop your PDF and watch it come apart into building blocks.',
  },
  {
    icon: Zap, step: '02', title: 'AI builds your portfolio',
    desc: 'We turn your experience into structured case studies.',
    detail: 'Not generic summaries, real proof-of-work. Each project becomes a problem → role → process → outcome narrative that a recruiter can actually scan and trust in seconds.',
  },
  {
    icon: BarChart3, step: '03', title: 'Get your ProofScore',
    desc: 'An honest audit across 11 categories.',
    detail: 'What is strong, what is weak, what is missing. Evidence strength, first-impression clarity, keyword support and more, each scored, each with a concrete fix. No vague feedback.',
  },
  {
    icon: Target, step: '04', title: 'Discover matched roles',
    desc: 'A personalized feed scored against your real evidence.',
    detail: 'Browse jobs ranked by how well your actual proof lines up with what the role demands, not keyword guessing. See where you qualify and where the gaps are before you apply.',
  },
  {
    icon: ArrowRight, step: '05', title: 'Tailor and apply',
    desc: 'One click creates a role-specific resume kit.',
    detail: 'Every change traced back to your real experience in the Truth Ledger. Nothing invented, nothing inflated, just your work, re-framed for the role you actually want.',
  },
]

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 65%', 'end 60%'],
  })
  const fill = useSpring(scrollYProgress, { stiffness: 90, damping: 24, restDelta: 0.001 })

  return (
    <section id="how-it-works" className="py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 36, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-90px' }}
          transition={{ duration: 0.75, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mb-16"
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

        {/* Timeline */}
        <div ref={containerRef} className="relative pl-16 sm:pl-24">
          {/* Track (left rail) */}
          <div className="absolute left-8 sm:left-12 top-6 bottom-6 w-px timeline-track" aria-hidden="true" />
          {/* Progress fill */}
          <motion.div
            className="absolute left-8 sm:left-12 top-6 w-px origin-top"
            style={{
              scaleY: fill,
              height: 'calc(100% - 48px)',
              background: 'linear-gradient(to bottom, oklch(63% 0.200 255), oklch(54% 0.230 255))',
              boxShadow: '0 0 12px oklch(54% 0.230 255 / 0.6)',
            }}
            aria-hidden="true"
          />

          {STEPS.map(({ icon: Icon, step, title, desc, detail }, i) => (
            <TimelineStep
              key={step}
              Icon={Icon}
              step={step}
              title={title}
              desc={desc}
              detail={detail}
              last={i === STEPS.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

const EASE = 'cubic-bezier(0.21, 0.47, 0.32, 0.98)'

function TimelineStep({
  Icon, step, title, desc, detail, last,
}: {
  Icon: LucideIcon
  step: string
  title: string
  desc: string
  detail: string
  last: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const open = useInView(ref, { once: true, margin: '-28% 0px -28% 0px' })

  return (
    <div ref={ref} className={`relative ${last ? '' : 'mb-5'}`}>
      {/* Number node sitting on the rail (in the left gutter) */}
      <div
        className="absolute top-6 -left-14 sm:-left-[4.5rem] z-10 flex items-center justify-center rounded-xl font-mono text-sm font-bold tabular-nums w-12 h-12"
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          transition: `background 0.5s ${EASE}, border-color 0.5s ${EASE}, color 0.5s ${EASE}, transform 0.5s ${EASE}`,
          background: open ? 'oklch(54% 0.230 255 / 0.12)' : 'var(--color-surface-100)',
          borderColor: open ? 'oklch(54% 0.230 255 / 0.45)' : 'var(--color-border)',
          color: open ? 'oklch(73% 0.140 255)' : 'oklch(66% 0.022 258)',
          transform: open ? 'scale(1)' : 'scale(0.92)',
        }}
      >
        {step}
      </div>

      {/* Card */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          transition: `background 0.5s ${EASE}, border-color 0.5s ${EASE}`,
          background: open ? 'var(--color-surface-100)' : 'var(--color-surface-50)',
          borderColor: open ? 'oklch(54% 0.230 255 / 0.22)' : 'var(--color-border)',
        }}
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                transition: `background 0.5s ${EASE} 0.05s, transform 0.5s ${EASE} 0.05s, opacity 0.5s ${EASE} 0.05s`,
                background: open ? 'oklch(54% 0.230 255 / 0.12)' : 'var(--color-surface-200)',
                transform: open ? 'scale(1)' : 'scale(0.9)',
                opacity: open ? 1 : 0.6,
              }}
            >
              <Icon className="h-5 w-5" style={{ color: 'oklch(63% 0.200 255)' }} />
            </div>
            <div className="flex-1 pt-0.5">
              <h3 className="text-xl font-semibold text-foreground tracking-tight">{title}</h3>
              <p className="text-sm mt-1" style={{ color: 'oklch(70% 0.022 258)' }}>{desc}</p>
            </div>
          </div>

          {/* Detail, opens on scroll via grid-rows 0fr to 1fr (smooth, auto height).
              Spacing lives INSIDE the grid (padding) so only grid-template-rows/opacity
              animate, never margin, avoiding layout thrash. */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: open ? '1fr' : '0fr',
              opacity: open ? 1 : 0,
              transition: `grid-template-rows 0.6s ${EASE} 0.1s, opacity 0.5s ${EASE} 0.15s`,
            }}
          >
            <div style={{ overflow: 'hidden', minHeight: 0 }}>
              <div className="pl-14 pt-4">
                <div
                  className="pt-4 text-[15px] leading-relaxed"
                  style={{ borderTop: '1px dashed var(--color-border)', color: 'oklch(62% 0.008 255)' }}
                >
                  {detail}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
