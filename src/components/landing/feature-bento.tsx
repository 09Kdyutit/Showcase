'use client'

import { motion } from 'framer-motion'
import {
  Zap, BarChart3, Search, Target, MessageSquare, Shield,
  Globe, CheckCircle2, ArrowRight, Mic, Palette,
} from 'lucide-react'

// The Features section, rebuilt as a bento: every cell contains a living miniature of the
// actual feature (score rings, match badges, chat bubbles, before/after rewrites) instead
// of an icon floating in empty space. All figures are fictional demonstration data.

const cellBase: React.CSSProperties = {
  background: 'radial-gradient(120% 120% at 0% 0%, var(--color-surface-100), var(--color-surface-50) 60%)',
  border: '1px solid var(--color-border)',
}

function Cell({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={{ y: -5 }}
      className={`relative rounded-3xl overflow-hidden p-6 group ${className ?? ''}`}
      style={cellBase}
    >
      {/* Hover: brand border + top light */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          border: '1px solid color-mix(in oklch, var(--color-brand-500) 35%, transparent)',
          background: 'radial-gradient(90% 60% at 50% -10%, color-mix(in oklch, var(--color-brand-500) 10%, transparent), transparent)',
        }}
      />
      {children}
    </motion.div>
  )
}

function CellHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="relative mb-5">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-400 group-hover:scale-110 group-hover:-rotate-3"
          style={{
            background: 'linear-gradient(135deg, oklch(54% 0.230 255 / 0.25), oklch(54% 0.230 255 / 0.07))',
            border: '1px solid oklch(54% 0.230 255 / 0.3)',
            boxShadow: 'inset 0 1px 0 oklch(73% 0.140 255 / 0.2)',
          }}
        >
          <Icon className="h-4 w-4" style={{ color: 'oklch(72% 0.16 255)' }} />
        </div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'oklch(64% 0.018 258)' }}>{desc}</p>
    </div>
  )
}

// ── Mini visualizations ────────────────────────────────────────────────────────

function VizPortfolio() {
  return (
    <div
      className="relative rounded-2xl p-4 transition-transform duration-500 group-hover:scale-[1.015]"
      style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full" style={{ background: 'linear-gradient(135deg, oklch(63% 0.20 255), oklch(62% 0.22 285))' }} />
          <div>
            <div className="h-2 w-24 rounded-full" style={{ background: 'oklch(85% 0.01 255 / 0.6)' }} />
            <div className="h-1.5 w-16 rounded-full mt-1" style={{ background: 'oklch(60% 0.02 258 / 0.5)' }} />
          </div>
        </div>
        <span
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'oklch(72% 0.17 160 / 0.12)', color: 'oklch(72% 0.17 160)', border: '1px solid oklch(72% 0.17 160 / 0.25)' }}
        >
          <Globe className="h-2.5 w-2.5" /> LIVE
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg p-2.5" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-border)' }}>
            <div className="h-1.5 w-3/4 rounded-full mb-1.5" style={{ background: 'oklch(80% 0.01 255 / 0.5)' }} />
            <div className="h-1 w-full rounded-full mb-1" style={{ background: 'oklch(55% 0.02 258 / 0.4)' }} />
            <div className="h-1 w-2/3 rounded-full" style={{ background: 'oklch(55% 0.02 258 / 0.4)' }} />
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle2 className="h-2.5 w-2.5" style={{ color: 'oklch(72% 0.17 160)' }} />
              <span className="text-[8px] font-semibold" style={{ color: 'oklch(72% 0.17 160)' }}>evidence attached</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Palette className="h-3 w-3" style={{ color: 'oklch(58% 0.02 258)' }} />
        {['oklch(63% 0.20 255)', 'oklch(62% 0.22 285)', 'oklch(72% 0.17 160)', 'oklch(78% 0.15 85)', 'oklch(65% 0.2 330)'].map((c) => (
          <span key={c} className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ background: c }} />
        ))}
        <span className="text-[9px] ml-1" style={{ color: 'oklch(58% 0.02 258)' }}>40 themes</span>
      </div>
    </div>
  )
}

function VizProofScore() {
  const bars = [
    { label: 'Evidence', v: 86, c: 'oklch(72% 0.17 160)' },
    { label: 'Depth', v: 74, c: 'oklch(72% 0.17 160)' },
    { label: 'Alignment', v: 61, c: 'oklch(80% 0.15 85)' },
  ]
  return (
    <div className="relative flex flex-col items-center">
      {/* Ring */}
      <div className="relative w-24 h-24 mb-4">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-surface-300)" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r="42" fill="none"
            stroke="url(#bento-ring-grad)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 42}
            initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
            whileInView={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - 0.87) }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
          <defs>
            <linearGradient id="bento-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="oklch(63% 0.20 255)" />
              <stop offset="100%" stopColor="oklch(62% 0.22 285)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground stat-number">87</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        {bars.map(({ label, v, c }, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[9px] w-14 shrink-0" style={{ color: 'oklch(60% 0.02 258)' }}>{label}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-300)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: c }}
                initial={{ width: 0 }}
                whileInView={{ width: `${v}%` }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.4 + i * 0.12 }}
              />
            </div>
            <span className="text-[9px] font-bold w-5 text-right stat-number" style={{ color: c }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VizJobs() {
  const jobs = [
    { role: 'Product Designer', co: 'Fintech startup', score: 88, tone: 'oklch(72% 0.17 160)', label: 'Strong' },
    { role: 'UX Researcher', co: 'Health tech', score: 72, tone: 'oklch(70% 0.16 255)', label: 'Good' },
  ]
  return (
    <div className="space-y-2">
      {jobs.map(({ role, co, score, tone, label }) => (
        <div
          key={role}
          className="flex items-center justify-between rounded-xl p-3 transition-transform duration-300 group-hover:translate-x-0.5"
          style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-border)' }}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{role}</p>
            <p className="text-[9px]" style={{ color: 'oklch(58% 0.02 258)' }}>{co}</p>
          </div>
          <span
            className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full shrink-0"
            style={{ background: `color-mix(in oklch, ${tone} 14%, transparent)`, color: tone, border: `1px solid color-mix(in oklch, ${tone} 28%, transparent)` }}
          >
            <Target className="h-2.5 w-2.5" />
            {score} · {label}
          </span>
        </div>
      ))}
    </div>
  )
}

function VizTailor() {
  return (
    <div className="space-y-2.5">
      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-0)', border: '1px solid oklch(62% 0.22 25 / 0.2)' }}>
        <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: 'oklch(62% 0.18 25)' }}>Before</p>
        <p className="text-[11px] leading-snug" style={{ color: 'oklch(58% 0.02 258)' }}>Worked on analytics dashboard for internal team.</p>
      </div>
      <div className="flex justify-center">
        <ArrowRight className="h-3.5 w-3.5 rotate-90 transition-transform duration-500 group-hover:translate-y-0.5" style={{ color: 'oklch(63% 0.20 255)' }} />
      </div>
      <div className="rounded-xl p-3" style={{ background: 'color-mix(in oklch, oklch(72% 0.17 160) 6%, var(--color-surface-0))', border: '1px solid oklch(72% 0.17 160 / 0.25)' }}>
        <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: 'oklch(72% 0.17 160)' }}>Tailored for the role</p>
        <p className="text-[11px] leading-snug text-foreground/85">Built an ops analytics dashboard adopted by 3 teams, cutting weekly reporting from 4 hours to 20 minutes.</p>
      </div>
    </div>
  )
}

function VizInterview() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, oklch(54% 0.230 255), oklch(62% 0.22 285))' }}>
          <Mic className="h-3 w-3 text-white" />
        </div>
        <div className="rounded-xl rounded-tl-sm p-2.5 text-[11px] leading-snug" style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-border)', color: 'oklch(75% 0.01 255)' }}>
          Walk me through a project where the outcome surprised you.
        </div>
      </div>
      <div className="flex items-start gap-2 flex-row-reverse">
        <div className="w-6 h-6 rounded-full shrink-0" style={{ background: 'var(--color-surface-300)' }} />
        <div className="rounded-xl rounded-tr-sm p-2.5 text-[11px] leading-snug" style={{ background: 'color-mix(in oklch, var(--color-brand-500) 10%, var(--color-surface-0))', border: '1px solid color-mix(in oklch, var(--color-brand-500) 22%, transparent)', color: 'oklch(80% 0.01 255)' }}>
          When I shipped the dashboard, adoption tripled in a week…
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {['Structure 82', 'Clarity 78', 'Evidence 90'].map((s) => (
          <span key={s} className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'oklch(72% 0.17 160 / 0.1)', color: 'oklch(72% 0.17 160)', border: '1px solid oklch(72% 0.17 160 / 0.22)' }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

function VizLedger() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 rounded-xl p-3" style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-border)' }}>
        <p className="text-[11px] text-foreground/85 leading-snug">
          &ldquo;Cut weekly reporting from 4 hours to 20 minutes&rdquo;
        </p>
      </div>
      <div className="hidden sm:block h-px w-8 shrink-0" style={{ background: 'linear-gradient(90deg, oklch(72% 0.17 160 / 0.6), oklch(72% 0.17 160 / 0.15))' }} />
      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1.5 rounded-lg shrink-0 w-fit"
        style={{ background: 'oklch(72% 0.17 160 / 0.08)', border: '1px solid oklch(72% 0.17 160 / 0.25)', color: 'oklch(74% 0.15 160)' }}
      >
        <CheckCircle2 className="h-3 w-3" />
        sourced: resume.pdf · line 12
      </span>
    </div>
  )
}

// ── The bento ──────────────────────────────────────────────────────────────────

export function FeatureBento() {
  return (
    <div className="grid md:grid-cols-6 gap-5">
      <Cell className="md:col-span-4" delay={0}>
        <CellHeader
          icon={Zap}
          title="AI Portfolio Builder"
          desc="Turns your resume into structured, evidence-based case studies — published at one clean link. No design skills needed."
        />
        <VizPortfolio />
      </Cell>

      <Cell className="md:col-span-2" delay={0.08}>
        <CellHeader
          icon={BarChart3}
          title="ProofScore Audit"
          desc="An 11-category hiring-readiness score with concrete fixes."
        />
        <VizProofScore />
      </Cell>

      <Cell className="md:col-span-2" delay={0.16}>
        <CellHeader
          icon={Search}
          title="Job Matching"
          desc="Roles scored against your real evidence — not keyword bingo."
        />
        <VizJobs />
      </Cell>

      <Cell className="md:col-span-2" delay={0.24}>
        <CellHeader
          icon={Target}
          title="Tailor Studio"
          desc="One click rewrites your resume kit for a specific job."
        />
        <VizTailor />
      </Cell>

      <Cell className="md:col-span-2" delay={0.32}>
        <CellHeader
          icon={MessageSquare}
          title="Interview Lab"
          desc="Live AI voice interviews, scored across six dimensions."
        />
        <VizInterview />
      </Cell>

      <Cell className="md:col-span-6" delay={0.4}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="lg:max-w-sm shrink-0">
            <CellHeader
              icon={Shield}
              title="Truth Ledger"
              desc="Every claim is logged. Every AI change is sourced. Nothing fabricated, ever."
            />
          </div>
          <div className="flex-1">
            <VizLedger />
          </div>
        </div>
      </Cell>

      <p className="md:col-span-6 text-center text-[10px] uppercase tracking-widest" style={{ color: 'oklch(48% 0.02 258)' }}>
        Fictional demonstration data
      </p>
    </div>
  )
}
