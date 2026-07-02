'use client'

import { useEffect, useId, useState } from 'react'
import { cn, scoreColor, scoreLabel } from '@/lib/utils'

interface ProofScoreRingProps {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animate?: boolean
  showLabel?: boolean
  className?: string
}

const sizes = {
  sm: { ring: 80, stroke: 6, fontSize: 'text-xl', labelSize: 'text-xs' },
  md: { ring: 120, stroke: 8, fontSize: 'text-3xl', labelSize: 'text-xs' },
  lg: { ring: 160, stroke: 10, fontSize: 'text-4xl', labelSize: 'text-sm' },
  xl: { ring: 200, stroke: 12, fontSize: 'text-5xl', labelSize: 'text-base' },
}

const glowFor = (s: number) =>
  s >= 80 ? '#34d399' : s >= 60 ? '#fbbf24' : s >= 40 ? '#fb923c' : '#f87171'

export function ProofScoreRing({ score, size = 'md', animate = true, showLabel = true, className }: ProofScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(animate ? 0 : score)
  // `settled` triggers the reveal "pop" the moment the count-up lands on the score
  const [settled, setSettled] = useState(!animate)
  // Stable, SSR-safe unique id for the SVG gradient/filter defs (sanitized for url() refs)
  const uid = `ps${useId().replace(/[^a-z0-9]/gi, '')}`
  const displayScore = animate ? animatedScore : score
  const config = sizes[size]
  const radius = (config.ring - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = displayScore / 100
  const strokeDashoffset = circumference - progress * circumference

  useEffect(() => {
    if (!animate) return
    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const duration = 1600
    const start = performance.now()
    const step = (now: number) => {
      // Reduced motion: land on the final score immediately, still async (post-mount)
      const p = reduce ? 1 : Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setAnimatedScore(Math.round(score * eased))
      if (p < 1) requestAnimationFrame(step)
      else setSettled(true)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [score, animate])

  const getStrokeColor = (s: number) => {
    if (s >= 80) return `url(#${uid}-green)`
    if (s >= 60) return `url(#${uid}-amber)`
    if (s >= 40) return `url(#${uid}-orange)`
    return `url(#${uid}-red)`
  }
  const glow = glowFor(displayScore)

  return (
    <div className={cn('relative flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: config.ring, height: config.ring }}>
        {/* Settle burst — a soft radial glow that blooms once the score lands */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-700"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${glow}38, transparent 68%)`,
            opacity: settled ? 1 : 0,
            filter: 'blur(6px)',
          }}
        />
        <svg
          width={config.ring}
          height={config.ring}
          className="-rotate-90 relative"
          style={{
            transform: `rotate(-90deg) scale(${settled ? 1 : 0.965})`,
            transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <defs>
            <linearGradient id={`${uid}-green`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id={`${uid}-amber`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <linearGradient id={`${uid}-orange`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" /><stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            <linearGradient id={`${uid}-red`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#f87171" />
            </linearGradient>
            <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle
            cx={config.ring / 2} cy={config.ring / 2} r={radius}
            fill="none" stroke="currentColor" strokeWidth={config.stroke}
            className="text-surface-300"
          />
          <circle
            cx={config.ring / 2} cy={config.ring / 2} r={radius}
            fill="none" stroke={getStrokeColor(displayScore)} strokeWidth={config.stroke}
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            filter={`url(#${uid}-glow)`}
            style={{ transition: animate ? 'none' : 'stroke-dashoffset 0.7s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn('font-bold tabular-nums', config.fontSize, scoreColor(displayScore))}
            style={{
              transform: settled ? 'scale(1)' : 'scale(0.94)',
              transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              textShadow: settled ? `0 0 22px ${glow}55` : 'none',
            }}
          >
            {displayScore}
          </span>
          {showLabel && (
            <span className={cn('text-muted-foreground font-medium', config.labelSize)}>
              ProofScore
            </span>
          )}
        </div>
      </div>
      {showLabel && (
        <span className={cn('font-semibold', config.labelSize, scoreColor(score))}>
          {scoreLabel(score)}
        </span>
      )}
    </div>
  )
}
