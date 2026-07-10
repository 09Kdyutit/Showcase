'use client'

import { motion } from 'framer-motion'
import { X, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'

// Illustrative transformation: the same source material becomes a clearer case-study
// structure. It compares information quality, not invented hiring outcomes.

const EASE = [0.22, 1, 0.36, 1] as const

const RED = 'oklch(62% 0.20 25)'
const GREEN = 'oklch(70% 0.16 160)'
const AMBER = 'oklch(76% 0.15 85)'

function Stamp({
  text,
  color,
  delay,
  icon: Icon,
}: {
  text: string
  color: string
  delay: number
  icon: React.ElementType
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 2.6, rotate: -20 }}
      whileInView={{ opacity: 1, scale: 1, rotate: -6 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ type: 'spring', stiffness: 320, damping: 17, delay }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-[0.14em] text-sm select-none"
      style={{
        color,
        border: `2.5px solid ${color}`,
        background: `color-mix(in oklch, ${color} 8%, transparent)`,
        boxShadow: `0 0 26px color-mix(in oklch, ${color} 22%, transparent), inset 0 0 14px color-mix(in oklch, ${color} 8%, transparent)`,
      }}
    >
      <Icon className="h-4 w-4" />
      {text}
    </motion.div>
  )
}

function AttentionMeter({
  label,
  fill,
  from,
  to,
  color,
  delay,
}: {
  label: string
  fill: string
  from: string
  to: string
  color: string
  delay: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'oklch(58% 0.02 258)' }}>{label}</span>
        <span className="text-[11px] font-bold stat-number" style={{ color }}>{fill}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-300)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, color-mix(in oklch, ${color} 70%, white))` }}
          initial={{ width: from }}
          whileInView={{ width: to }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.8, ease: [0.3, 0.1, 0.3, 1], delay }}
        />
      </div>
    </div>
  )
}

/** Animated energy beam between the two cards: particles stream out of the weak card,
    through the core, into the strong one (left→right on desktop, top→bottom on mobile). */
function Beam() {
  return (
    <div className="flex lg:flex-col items-center justify-center gap-3 py-2 lg:py-0 lg:px-1 self-center">
      <div className="relative flex items-center justify-center">
        {/* Icon core */}
        <motion.div
          initial={{ scale: 0, rotate: -120 }}
          whileInView={{ scale: 1, rotate: 0 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.4 }}
          className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center breathe-glow"
          style={{
            background: 'linear-gradient(135deg, oklch(54% 0.230 255), oklch(62% 0.22 285))',
            boxShadow: '0 0 34px oklch(54% 0.230 255 / 0.55)',
          }}
        >
          <Sparkles className="h-5 w-5 text-white" />
        </motion.div>
        {/* Particle stream: horizontal through the core on desktop */}
        <div className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-px">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
              style={{ background: 'oklch(70% 0.17 255)', boxShadow: '0 0 8px oklch(63% 0.20 255)' }}
              animate={{ x: [-64, 64], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.38, ease: 'linear' }}
            />
          ))}
        </div>
        {/* Vertical stream on mobile (cards stack) */}
        <div className="lg:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-px">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{ background: 'oklch(70% 0.17 255)', boxShadow: '0 0 8px oklch(63% 0.20 255)' }}
              animate={{ y: [-48, 48], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5, ease: 'linear' }}
            />
          ))}
        </div>
      </div>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest lg:[writing-mode:vertical-rl] lg:rotate-180"
        style={{ color: 'oklch(66% 0.14 255)' }}
      >
        Showcase rebuilds it
      </p>
    </div>
  )
}

export function BeforeAfter() {
  return (
    <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-6 items-stretch">

      {/* ── Without Showcase ── */}
      <motion.div
        initial={{ opacity: 0, x: -28 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative rounded-3xl p-6 sm:p-7 flex flex-col gap-4"
        style={{
          background: 'radial-gradient(130% 130% at 0% 0%, color-mix(in oklch, oklch(62% 0.20 25) 5%, var(--color-surface-50)), var(--color-surface-0) 65%)',
          border: `1px solid color-mix(in oklch, ${RED} 22%, var(--color-border))`,
          filter: 'saturate(0.85)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: RED }}>
            <span className="w-2 h-2 rounded-full" style={{ background: RED, boxShadow: `0 0 8px ${RED}` }} />
            Without Showcase
          </span>
        </div>

        {/* Resume doc */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-border)' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'oklch(56% 0.02 258)' }}>Résumé bullet</p>
          <p className="text-sm leading-relaxed" style={{ color: 'oklch(66% 0.01 258)' }}>
            Built an internal analytics dashboard and worked with operations.
          </p>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface-100)', border: `1px solid color-mix(in oklch, ${RED} 18%, var(--color-border))` }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: RED }}>What the evidence shows</p>
          <p className="text-sm leading-relaxed" style={{ color: 'oklch(62% 0.015 258)' }}>
            No problem stated. No outcome. No way to tell if this mattered or took a weekend.
          </p>
        </div>

        <AttentionMeter label="Evidence clarity" fill="Low" from="100%" to="18%" color={RED} delay={0.5} />

        <div className="mt-auto pt-2">
          <Stamp text="Evidence gaps" color={RED} delay={1.9} icon={X} />
          <p className="text-xs mt-3" style={{ color: `color-mix(in oklch, ${RED} 75%, transparent)` }}>Scope and outcome remain unclear.</p>
        </div>
      </motion.div>

      {/* ── Beam ── */}
      <Beam />

      {/* ── With Showcase ── */}
      <motion.div
        initial={{ opacity: 0, x: 28 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
        className="relative rounded-3xl p-6 sm:p-7 flex flex-col gap-4"
        style={{
          background: 'radial-gradient(130% 130% at 100% 0%, color-mix(in oklch, oklch(70% 0.16 160) 6%, var(--color-surface-100)), var(--color-surface-50) 65%)',
          border: `1px solid color-mix(in oklch, ${GREEN} 30%, var(--color-border))`,
          boxShadow: `0 24px 70px oklch(0% 0 0 / 0.45), 0 0 44px color-mix(in oklch, ${GREEN} 9%, transparent)`,
        }}
      >
        <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, color-mix(in oklch, ${GREEN} 70%, transparent), transparent)` }} />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: GREEN }}>
            <span className="w-2 h-2 rounded-full" style={{ background: GREEN, boxShadow: `0 0 8px ${GREEN}` }} />
            With Showcase
          </span>
        </div>

        {/* Case study rows assemble */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-border)' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'oklch(70% 0.01 255)' }}>
            Case study: Internal Analytics Dashboard
          </p>
          <div className="space-y-1.5">
            {([
              ['Problem', 'Ops compiled weekly reports by hand', 'oklch(62% 0.18 25)'],
              ['Role', 'Sole builder — intern project', 'oklch(63% 0.20 255)'],
              ['Process', 'Scoped with ops lead, shipped in 6 weeks', 'oklch(62% 0.22 285)'],
              ['Outcome', 'Not yet quantified', AMBER],
            ] as const).map(([tag, text, c], i) => (
              <motion.div
                key={tag}
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.5 + i * 0.12 }}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5"
                style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-border)' }}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider w-14 shrink-0" style={{ color: c }}>{tag}</span>
                <span className="text-[11px] truncate" style={{ color: 'oklch(74% 0.01 255)' }}>{text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ProofScore flag */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.45, ease: EASE, delay: 1.0 }}
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: `color-mix(in oklch, ${AMBER} 6%, transparent)`, border: `1px solid color-mix(in oklch, ${AMBER} 26%, transparent)` }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: AMBER }} />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: AMBER }}>ProofScore flag</p>
            <p className="text-sm leading-snug" style={{ color: 'oklch(74% 0.01 255)' }}>
              Outcome not yet quantified. Add hours saved or adoption rate before sending.
            </p>
          </div>
        </motion.div>

        <AttentionMeter label="Evidence clarity" fill="Structured" from="18%" to="88%" color={GREEN} delay={0.6} />

        <div className="mt-auto pt-2 flex items-center gap-4 flex-wrap">
          <Stamp text="Ready to review" color={GREEN} delay={2.1} icon={CheckCircle2} />
          <p className="text-xs flex items-center gap-1.5" style={{ color: `color-mix(in oklch, ${GREEN} 85%, transparent)` }}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            The remaining evidence gap is explicit.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
