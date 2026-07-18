'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  BarChart3,
  FileText,
  Briefcase,
  MessageSquare,
  Search,
  TrendingUp,
  CheckCircle2,
  Trophy,
  Globe2,
  Send,
} from 'lucide-react'
import { usePrefersReducedMotion } from '@/components/landing/animated-section'

// A broad, illustrative product frame rendered in real perspective. It presents
// Showcase as one connected career workspace rather than centering a single score.

const MINI_NAV = [
  { icon: BarChart3, label: 'Workspace', active: true },
  { icon: FileText, label: 'Resume' },
  { icon: Briefcase, label: 'Portfolio' },
  { icon: Search, label: 'Jobs' },
  { icon: MessageSquare, label: 'Interview Lab' },
  { icon: Trophy, label: 'Opportunities' },
]

function FloatingChip({
  className,
  delay = 0,
  children,
}: {
  className?: string
  delay?: number
  children: React.ReactNode
}) {
  return (
    <div
      className={`absolute hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold z-20 ${className ?? ''}`}
      style={{
        background: 'color-mix(in oklch, var(--color-surface-100) 88%, transparent)',
        border: '1px solid color-mix(in oklch, var(--color-brand-500) 26%, var(--color-border))',
        boxShadow: '0 12px 40px oklch(0% 0 0 / 0.5), 0 0 24px color-mix(in oklch, var(--color-brand-500) 12%, transparent), inset 0 1px 0 oklch(100% 0 0 / 0.06)',
        backdropFilter: 'blur(12px)',
        animation: `float 6s ease-in-out ${delay}s infinite`,
      }}
    >
      {children}
    </div>
  )
}

function WorkspaceCard({
  icon: Icon,
  eyebrow,
  title,
  children,
  className = '',
  accent = 'oklch(70% 0.17 255)',
}: {
  icon: typeof Briefcase
  eyebrow: string
  title: string
  children: React.ReactNode
  className?: string
  accent?: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl p-3.5 ${className}`}
      style={{
        background: 'linear-gradient(135deg, var(--color-surface-100), color-mix(in oklch, var(--color-brand-900) 22%, var(--color-surface-100)))',
        border: '1px solid color-mix(in oklch, var(--color-brand-500) 18%, var(--color-border))',
      }}
    >
      <div
        className="absolute -right-6 -top-7 h-20 w-20 rounded-full opacity-15"
        style={{ background: accent, filter: 'blur(18px)' }}
      />
      <div className="relative flex items-start gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklch, ${accent} 14%, transparent)`, color: accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>{eyebrow}</p>
          <p className="mt-0.5 text-xs font-semibold text-foreground">{title}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

export function ProductShowcase() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'center 0.55'],
  })
  const rotateX = useTransform(scrollYProgress, [0, 1], [16, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.35, 1], [0.55, 0.9, 1])

  return (
    <section className="relative px-6 pb-8 pt-10 overflow-visible">
      {/* Ambient glow bleeding up from behind the frame */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-10 w-[900px] h-[500px] opacity-70"
        style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 40%, oklch(48% 0.20 258 / 0.32), transparent 70%)', filter: 'blur(30px)' }}
      />

      <div ref={ref} className="relative max-w-5xl mx-auto" style={{ perspective: '1400px' }}>
        <motion.div
          style={reduce ? undefined : { rotateX, scale, opacity, transformStyle: 'preserve-3d' }}
          className="relative rounded-2xl"
        >
          {/* Floating capability chips — illustrative, not user activity or traction. */}
          <FloatingChip className="-top-4 left-10" delay={0.4}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'oklch(72% 0.17 160)', boxShadow: '0 0 8px oklch(72% 0.17 160)' }} />
            <span className="text-foreground/90">Resume parsed → <span style={{ color: 'oklch(72% 0.17 160)' }}>portfolio ready to edit</span></span>
          </FloatingChip>
          <FloatingChip className="top-20 -right-7" delay={1.6}>
            <Globe2 className="h-3.5 w-3.5" style={{ color: 'oklch(70% 0.17 255)' }} />
            <span className="text-foreground/90">Pro publishing → <span style={{ color: 'oklch(70% 0.17 255)' }}>live link + preview card</span></span>
          </FloatingChip>
          <FloatingChip className="-bottom-4 left-1/3" delay={2.8}>
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'oklch(72% 0.17 160)' }} />
            <span className="text-foreground/90">Application drafts stay grounded in your experience</span>
          </FloatingChip>

          {/* Frame */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: 'var(--color-surface-50)',
              border: '1px solid color-mix(in oklch, var(--color-brand-500) 20%, var(--color-border))',
              boxShadow: '0 40px 120px oklch(0% 0 0 / 0.6), 0 0 80px color-mix(in oklch, var(--color-brand-500) 10%, transparent), inset 0 1px 0 oklch(100% 0 0 / 0.07)',
            }}
          >
            {/* Window chrome */}
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ background: 'var(--color-surface-100)', borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(60% 0.19 25)' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(78% 0.15 85)' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(70% 0.17 160)' }} />
              </div>
              <div
                className="flex-1 max-w-sm mx-auto text-center text-xs py-1 rounded-md font-medium"
                style={{ background: 'var(--color-surface-200)', color: 'oklch(90% 0.015 258)' }}
              >
                app.tryshowcase.ink/dashboard
              </div>
              <div className="w-14" />
            </div>

            <div className="flex" style={{ minHeight: '430px' }}>
              {/* Mini sidebar */}
              <div
                className="hidden sm:flex flex-col gap-1 w-40 shrink-0 p-3"
                style={{ background: 'var(--color-surface-0)', borderRight: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center gap-2 px-2 py-2 mb-2">
                  <span
                    className="w-5 h-5 rounded-md"
                    style={{ background: 'linear-gradient(135deg, oklch(54% 0.230 255), oklch(63% 0.200 255))', boxShadow: '0 0 10px oklch(54% 0.230 255 / 0.5)' }}
                  />
                  <span className="text-xs font-bold text-foreground tracking-wide">Showcase</span>
                </div>
                {MINI_NAV.map(({ icon: Icon, label, active }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                    style={active
                      ? {
                          background: 'color-mix(in oklch, var(--color-brand-500) 13%, transparent)',
                          border: '1px solid color-mix(in oklch, var(--color-brand-500) 26%, transparent)',
                          color: 'oklch(91% 0.08 255)',
                        }
                      : { color: 'oklch(90% 0.025 258)' }}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                ))}
              </div>

              {/* Main panel */}
              <div className="flex-1 p-4 sm:p-5 space-y-3 relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 aurora-mesh opacity-30" />
                <div className="relative">
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'oklch(63% 0.20 255)' }}>Your career workspace</p>
                  <p className="text-display text-xl font-semibold text-foreground">From resume to portfolio, applications, and interviews.</p>
                  <p className="text-xs mt-0.5" style={{ color: 'oklch(68% 0.02 258)' }}>One source of truth for the work you&apos;ve actually done.</p>
                </div>

                <div className="relative grid grid-cols-2 md:grid-cols-6 gap-2.5">
                  <WorkspaceCard
                    icon={Briefcase}
                    eyebrow="Portfolio"
                    title="Editable case studies"
                    className="col-span-2 md:col-span-3"
                  >
                    <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: 'oklch(72% 0.02 258)' }}>
                      Turn your real work into scannable projects, then refine every section.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {['Themes', 'Images', 'Quality checklist'].map((item) => (
                        <span key={item} className="rounded-md px-1.5 py-0.5 text-[8px]" style={{ background: 'var(--color-surface-300)', color: 'oklch(78% 0.02 258)' }}>{item}</span>
                      ))}
                    </div>
                  </WorkspaceCard>

                  <WorkspaceCard
                    icon={Search}
                    eyebrow="Job match + application kit"
                    title="Ranked against your actual experience"
                    className="col-span-2 md:col-span-3"
                    accent="oklch(72% 0.17 160)"
                  >
                    <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: 'oklch(72% 0.02 258)' }}>
                      See the evidence behind each match, then tailor your resume, cover letter, and outreach draft.
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[8px] font-medium" style={{ color: 'oklch(80% 0.10 160)' }}>
                      <CheckCircle2 className="h-3 w-3" /> Claims stay reviewable before you send
                    </div>
                  </WorkspaceCard>

                  <WorkspaceCard
                    icon={MessageSquare}
                    eyebrow="Interview Lab"
                    title="Practice, coach, improve"
                    className="col-span-2 md:col-span-2"
                    accent="oklch(78% 0.15 85)"
                  >
                    <p className="mt-1.5 text-[9px] leading-relaxed" style={{ color: 'oklch(72% 0.02 258)' }}>
                      Written practice with per-answer coaching. Voice when enabled.
                    </p>
                  </WorkspaceCard>

                  <WorkspaceCard
                    icon={Trophy}
                    eyebrow="Opportunities"
                    title="Build new experience"
                    className="col-span-1 md:col-span-2"
                    accent="oklch(72% 0.14 310)"
                  >
                    <p className="mt-1.5 text-[9px] leading-relaxed" style={{ color: 'oklch(72% 0.02 258)' }}>
                      Hackathons, CTFs, and coding competitions.
                    </p>
                  </WorkspaceCard>

                  <WorkspaceCard
                    icon={TrendingUp}
                    eyebrow="Evidence Audit"
                    title="Complete 11-dimension review"
                    className="col-span-1 md:col-span-2"
                    accent="oklch(74% 0.13 195)"
                  >
                    <p className="mt-1.5 text-[9px] leading-relaxed" style={{ color: 'oklch(72% 0.02 258)' }}>
                      Specific fixes, with unsupported gaps left visible.
                    </p>
                  </WorkspaceCard>
                </div>

                <div
                  className="relative rounded-xl px-3.5 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center"
                  style={{
                    background: 'color-mix(in oklch, var(--color-brand-500) 9%, var(--color-surface-100))',
                    border: '1px solid color-mix(in oklch, var(--color-brand-500) 26%, transparent)',
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Globe2 className="h-4 w-4 shrink-0" style={{ color: 'oklch(70% 0.17 255)' }} />
                    <div className="min-w-0">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'oklch(70% 0.17 255)' }}>Pro publishing</p>
                      <p className="truncate text-[10px] text-foreground">Publish a live portfolio link with its own preview card.</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-semibold" style={{ background: 'var(--color-brand-500)', color: 'white' }}>
                    <Send className="h-3 w-3" /> Publish when ready
                  </span>
                </div>

                <p className="relative text-right text-[9px] uppercase tracking-widest" style={{ color: 'oklch(70% 0.03 258)' }}>
                  Illustrative product view
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Product facts, not fabricated usage or outcome statistics. */}
      <div className="max-w-6xl mx-auto mt-20">
        <hr className="divider-dashed" />
        <div className="py-14 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 'PDF · DOCX · paste', label: 'resume inputs' },
            { value: '11 dimensions', label: 'Evidence Audit' },
            { value: 'Written + voice*', label: 'interview practice' },
            { value: 'Free', label: 'build before you publish' },
          ].map(({ value, label }, i) => (
            <motion.div
              key={label}
              className="group"
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.09 }}
            >
              <p
                className="text-display font-semibold mb-1.5 transition-transform duration-300 group-hover:scale-105"
                style={{ fontSize: 'clamp(1.45rem, 3.2vw, 2.4rem)' }}
              >
                <span className="gradient-text">{value}</span>
              </p>
              <p className="text-xs uppercase tracking-widest" style={{ color: 'oklch(65% 0.022 258)' }}>
                {label}
              </p>
              {label === 'interview practice' ? (
                <p className="mt-1 text-[9px]" style={{ color: 'oklch(58% 0.02 258)' }}>* Voice when enabled</p>
              ) : null}
            </motion.div>
          ))}
        </div>
        <hr className="divider-dashed" />
      </div>
    </section>
  )
}
