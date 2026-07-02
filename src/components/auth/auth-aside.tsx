'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, FileText, BarChart3, Globe } from 'lucide-react'
import { Logo } from '@/components/shared/logo'

const EASE = [0.21, 0.47, 0.32, 0.98] as const

function useCountUp(target: number, duration = 1500, start = true) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!start) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, start])
  return v
}

const BENEFITS = [
  'Free ProofScore preview, see where you stand',
  'AI-powered resume parsing in seconds',
  'Draft portfolio with no design required',
  'No credit card needed to start',
]

const STEPS = [
  { step: '01', icon: FileText, title: 'Upload your resume', desc: 'PDF or DOCX, we parse everything instantly', color: 'oklch(63% 0.200 255)' },
  { step: '02', icon: BarChart3, title: 'Get your ProofScore', desc: '11 categories scored, gaps identified', color: 'oklch(62% 0.20 295)' },
  { step: '03', icon: Globe, title: 'Publish your portfolio', desc: 'A link that proves your work, not just lists it', color: 'oklch(72% 0.16 162)' },
]

const BARS = [
  { label: 'First impression', score: 78, color: 'oklch(74% 0.16 85)' },
  { label: 'Role alignment', score: 91, color: 'oklch(72% 0.16 162)' },
  { label: 'Proof strength', score: 86, color: 'oklch(63% 0.200 255)' },
  { label: 'Resume quality', score: 72, color: 'oklch(74% 0.16 85)' },
]

export function AuthAside({ variant }: { variant: 'login' | 'signup' }) {
  const glowRef = useRef<HTMLDivElement>(null)
  const score = useCountUp(84, 1600)

  useEffect(() => {
    let raf = 0
    function onMove(e: MouseEvent) {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (glowRef.current) {
          glowRef.current.style.background = `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, oklch(54% 0.230 255 / 0.06), transparent 45%)`
        }
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => { window.removeEventListener('mousemove', onMove); if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden border-r border-border" style={{ background: 'var(--color-surface-0)' }}>
      {/* Aurora blobs */}
      <div className="auth-blob auth-blob-1" style={{ top: '-8%', left: '-6%', width: 460, height: 460, background: 'oklch(54% 0.230 255 / 0.30)' }} />
      <div className="auth-blob auth-blob-2" style={{ bottom: '-12%', right: '-8%', width: 420, height: 420, background: 'oklch(58% 0.22 295 / 0.24)' }} />
      <div className="auth-blob auth-blob-3" style={{ top: '38%', left: '34%', width: 360, height: 360, background: 'oklch(70% 0.16 162 / 0.14)' }} />

      {/* Grid + spotlight */}
      <div className="absolute inset-0 auth-grid pointer-events-none" />
      <div ref={glowRef} className="absolute inset-0 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-12">
        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <Link href="/" className="flex items-center gap-2 w-fit">
            <Logo size="lg" />
          </Link>
        </motion.div>

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center py-10">
          {variant === 'login' ? <ProofScoreCard score={score} /> : <StepsVisual />}
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          {variant === 'login' ? (
            <motion.blockquote
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
              className="text-2xl italic leading-snug mb-5"
              style={{ fontFamily: 'var(--font-serif)', color: 'oklch(92% 0.01 255)' }}
            >
              &ldquo;Turn your experience into evidence.&rdquo;
            </motion.blockquote>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
              className="mb-5"
            >
              <p className="text-sm font-semibold text-foreground mb-3">What you get for free</p>
              <ul className="space-y-2">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[13px]" style={{ color: 'oklch(70% 0.008 255)' }}>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'oklch(63% 0.200 255)' }} />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
          <div className="flex items-center gap-6 text-xs" style={{ color: 'oklch(60% 0.012 255)' }}>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProofScoreCard({ score }: { score: number }) {
  const R = 30
  const C = 2 * Math.PI * R
  const pct = score / 100
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
      className="relative w-80 rounded-2xl p-6 space-y-5"
      style={{
        background: 'oklch(13% 0.008 255 / 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid oklch(54% 0.230 255 / 0.18)',
        boxShadow: '0 24px 70px oklch(0% 0 0 / 0.5), inset 0 1px 0 oklch(97% 0.004 255 / 0.06)',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs mb-1" style={{ color: 'oklch(66% 0.012 255)' }}>ProofScore</p>
          <p className="text-5xl font-bold tabular-nums text-foreground tracking-tight">{score}</p>
          <p className="text-xs font-semibold mt-1" style={{ color: 'oklch(72% 0.16 162)' }}>Strong</p>
        </div>
        <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r={R} fill="none" stroke="oklch(26% 0.012 255)" strokeWidth="7" />
          <motion.circle
            cx="40" cy="40" r={R} fill="none" stroke="url(#aside-ring)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - pct) }}
            transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
          />
          <defs>
            <linearGradient id="aside-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="oklch(63% 0.200 255)" />
              <stop offset="100%" stopColor="oklch(62% 0.20 295)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="space-y-2.5">
        {BARS.map(({ label, score: s, color }, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs w-28 shrink-0" style={{ color: 'oklch(58% 0.008 255)' }}>{label}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'oklch(22% 0.010 255)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${s}%` }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.5 + i * 0.12 }}
              />
            </div>
            <span className="text-xs font-medium w-6 text-right tabular-nums text-foreground">{s}</span>
          </div>
        ))}
      </div>
      <p className="text-xs pt-3" style={{ color: 'oklch(60% 0.012 255)', borderTop: '1px solid oklch(22% 0.010 255)' }}>
        Your score is calculated across 11 hiring categories
      </p>
    </motion.div>
  )
}

function StepsVisual() {
  return (
    <div className="relative w-80">
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
        className="text-xs font-medium uppercase tracking-widest mb-5"
        style={{ color: 'oklch(66% 0.012 255)' }}
      >
        How it works
      </motion.p>
      <div className="relative space-y-3">
        {/* Animated connector line */}
        <motion.div
          className="absolute left-[26px] top-8 bottom-8 w-px origin-top"
          style={{ background: 'linear-gradient(to bottom, oklch(63% 0.200 255), oklch(62% 0.20 295), oklch(72% 0.16 162))' }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1, ease: EASE, delay: 0.4 }}
        />
        {STEPS.map(({ step, icon: Icon, title, desc, color }, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.25 + i * 0.18 }}
            className="relative rounded-2xl p-4 flex gap-4 items-start"
            style={{
              background: 'oklch(13% 0.008 255 / 0.6)',
              backdropFilter: 'blur(14px)',
              border: '1px solid oklch(22% 0.010 255)',
            }}
          >
            <div
              className="relative z-10 w-[52px] h-[52px] -my-1 -mx-1 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: color.replace(')', ' / 0.12)'), border: `1px solid ${color.replace(')', ' / 0.3)')}` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono font-bold" style={{ color }}>{step}</span>
                <p className="text-sm font-semibold text-foreground">{title}</p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'oklch(58% 0.008 255)' }}>{desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
