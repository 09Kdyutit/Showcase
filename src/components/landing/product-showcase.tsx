'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { BarChart3, FileText, Briefcase, MessageSquare, Search, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react'
import { ProofScoreRing } from '@/components/ui/proof-score-ring'

// The below-hero showstopper: a full product frame rendered in real perspective that
// un-tilts and rises as you scroll into it (the Linear/Arc move), ringed by floating
// live-status chips, followed by serif count-up stats. All demonstration data.

const MINI_NAV = [
  { icon: BarChart3, label: 'Dashboard', active: true },
  { icon: FileText, label: 'Resume' },
  { icon: Briefcase, label: 'Portfolio' },
  { icon: TrendingUp, label: 'ProofScore' },
  { icon: Search, label: 'Jobs' },
  { icon: MessageSquare, label: 'Interview Lab' },
]

const CATEGORY_BARS = [
  { name: 'Evidence strength', score: 86, color: 'oklch(72% 0.17 160)' },
  { name: 'Project depth', score: 74, color: 'oklch(72% 0.17 160)' },
  { name: 'Role alignment', score: 68, color: 'oklch(80% 0.15 85)' },
  { name: 'Keyword support', score: 91, color: 'oklch(72% 0.17 160)' },
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

export function ProductShowcase() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
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
          {/* Floating live chips — anchored to the frame itself so they ride its corners */}
          <FloatingChip className="-top-4 left-10" delay={0.4}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'oklch(72% 0.17 160)', boxShadow: '0 0 8px oklch(72% 0.17 160)' }} />
            <span className="text-foreground/90">Interview readiness: <span style={{ color: 'oklch(72% 0.17 160)' }}>Strong</span></span>
          </FloatingChip>
          <FloatingChip className="top-20 -right-7" delay={1.6}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: 'oklch(70% 0.17 255)' }} />
            <span className="text-foreground/90">Portfolio published → <span style={{ color: 'oklch(70% 0.17 255)' }}>/p/your-name</span></span>
          </FloatingChip>
          <FloatingChip className="-bottom-4 left-1/3" delay={2.8}>
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'oklch(72% 0.17 160)' }} />
            <span className="text-foreground/90">3 recruiter views today</span>
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
                style={{ background: 'var(--color-surface-200)', color: 'oklch(65% 0.02 258)' }}
              >
                showcase.app/dashboard
              </div>
              <div className="w-14" />
            </div>

            <div className="flex" style={{ minHeight: '380px' }}>
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
                          color: 'oklch(74% 0.16 255)',
                        }
                      : { color: 'oklch(58% 0.02 258)' }}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                ))}
              </div>

              {/* Main panel */}
              <div className="flex-1 p-5 space-y-4 relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 aurora-mesh opacity-30" />
                <div className="relative">
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'oklch(63% 0.20 255)' }}>Dashboard</p>
                  <p className="text-display text-xl font-semibold text-foreground">Hey, you.</p>
                  <p className="text-xs mt-0.5" style={{ color: 'oklch(62% 0.02 258)' }}>Your ProofScore is 87 — recruiter ready.</p>
                </div>

                <div className="relative grid grid-cols-3 gap-3">
                  <div
                    className="rounded-xl p-3 flex items-center justify-center col-span-1"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-surface-100), color-mix(in oklch, var(--color-brand-900) 35%, var(--color-surface-100)))',
                      border: '1px solid color-mix(in oklch, var(--color-brand-500) 22%, var(--color-border))',
                    }}
                  >
                    <ProofScoreRing score={87} size="sm" animate showLabel={false} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    {CATEGORY_BARS.map(({ name, score, color }) => (
                      <div key={name} className="flex items-center gap-2.5">
                        <span className="text-[10px] w-24 shrink-0 truncate" style={{ color: 'oklch(64% 0.02 258)' }}>{name}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-300)' }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${score}%` }}
                            viewport={{ once: true, amount: 0.6 }}
                            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
                          />
                        </div>
                        <span className="text-[10px] font-bold w-5 text-right stat-number" style={{ color }}>{score}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative grid grid-cols-3 gap-3">
                  {[
                    { label: 'Portfolios', value: '2 live' },
                    { label: 'Jobs matched', value: '14 strong' },
                    { label: 'Mock interviews', value: '5 passed' },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl p-3"
                      style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-border)' }}
                    >
                      <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'oklch(58% 0.02 258)' }}>{label}</p>
                      <p className="text-sm font-bold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div
                  className="relative rounded-xl p-3 flex items-center gap-3"
                  style={{
                    background: 'color-mix(in oklch, var(--color-brand-500) 8%, var(--color-surface-100))',
                    border: '1px solid color-mix(in oklch, var(--color-brand-500) 24%, transparent)',
                  }}
                >
                  <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'oklch(70% 0.17 255)' }} />
                  <p className="text-xs" style={{ color: 'oklch(78% 0.01 255)' }}>
                    <span className="font-semibold text-foreground">Next best action:</span> add a metric to your dashboard case study — it lifts Evidence strength past 90.
                  </p>
                </div>

                <p className="relative text-right text-[9px] uppercase tracking-widest" style={{ color: 'oklch(48% 0.02 258)' }}>
                  Fictional demonstration data
                </p>
              </div>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Serif stats — numbers always in the markup, motion only accents them */}
      <div className="max-w-6xl mx-auto mt-20">
        <hr className="divider-dashed" />
        <div className="py-14 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { n: '11', suffix: '', label: 'audit categories' },
            { n: '5', suffix: ' min', label: 'average setup time' },
            { n: '1', suffix: ' link', label: 'to share everything' },
            { n: '0', suffix: '', label: 'fabrications. ever.' },
          ].map(({ n, suffix, label }, i) => (
            <motion.div
              key={label}
              className="group"
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.09 }}
            >
              <p
                className="text-display font-semibold mb-1.5 tabular-nums transition-transform duration-300 group-hover:scale-105"
                style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)' }}
              >
                <span className="gradient-text">
                  {n}
                  <em style={{ fontStyle: 'italic' }}>{suffix}</em>
                </span>
              </p>
              <p className="text-xs uppercase tracking-widest" style={{ color: 'oklch(65% 0.022 258)' }}>
                {label}
              </p>
            </motion.div>
          ))}
        </div>
        <hr className="divider-dashed" />
      </div>
    </section>
  )
}
