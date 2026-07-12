'use client'

import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// "Your trajectory" — a self-drawing SVG sparkline of evidence scores over time. No chart
// library (keeps the bundle tiny). Turns a one-time diagnostic into a returning habit:
// people come back to watch the number climb. Only rendered when there are 2+ audits.

export interface TrajectoryPoint {
  score: number
  date: string // ISO
}

export function ProofScoreTrajectory({ points }: { points: TrajectoryPoint[] }) {
  const pathRef = useRef<SVGPathElement>(null)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const el = pathRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const len = el.getTotalLength()
    if (!reduce) {
      el.style.strokeDasharray = `${len}`
      el.style.strokeDashoffset = `${len}`
    }
    // setState always dispatched from inside the rAF callback (a deferred boundary), never
    // synchronously in the effect body — avoids cascading renders + the react-hooks rule.
    const raf = requestAnimationFrame(() => {
      if (!reduce) {
        el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)'
        el.style.strokeDashoffset = '0'
      }
      setDrawn(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [points])

  if (points.length < 2) return null

  const W = 320
  const H = 72
  const pad = 6
  const scores = points.map((p) => p.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = Math.max(max - min, 1)
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2)
  const y = (s: number) => H - pad - ((s - min) / range) * (H - pad * 2)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`

  const first = scores[0]
  const last = scores[scores.length - 1]
  const delta = last - first
  const up = delta > 0
  const flat = delta === 0
  const trendColor = up ? 'oklch(72% 0.17 160)' : flat ? 'oklch(70% 0.02 258)' : 'oklch(66% 0.19 25)'
  const TrendIcon = up ? TrendingUp : flat ? Minus : TrendingDown

  return (
    <div className="glass-card p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your trajectory</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Evidence score across {points.length} audits</p>
        </div>
        <span
          className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: `color-mix(in oklch, ${trendColor} 12%, transparent)`, color: trendColor, border: `1px solid color-mix(in oklch, ${trendColor} 28%, transparent)` }}
        >
          <TrendIcon className="h-3 w-3" />
          {up ? '+' : ''}{delta} {up ? 'since you started' : flat ? 'no change yet' : 'this run'}
        </span>
      </div>

      <div className="flex items-end gap-4">
        <div className="shrink-0">
          <p className="text-4xl font-bold text-foreground stat-number leading-none">{last}</p>
          <p className="text-xs text-muted-foreground mt-1">now</p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="flex-1 h-[72px] w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="traj-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(63% 0.20 255)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="oklch(63% 0.20 255)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="traj-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(63% 0.20 255)" />
              <stop offset="100%" stopColor="oklch(62% 0.22 285)" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#traj-fill)" opacity={drawn ? 1 : 0} style={{ transition: 'opacity 0.6s ease 0.4s' }} />
          <path ref={pathRef} d={linePath} fill="none" stroke="url(#traj-line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* endpoint dot */}
          <circle cx={x(points.length - 1)} cy={y(last)} r="3.5" fill="oklch(62% 0.22 285)" opacity={drawn ? 1 : 0} style={{ transition: 'opacity 0.4s ease 1s' }}>
            <animate attributeName="r" values="3.5;5;3.5" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
    </div>
  )
}
