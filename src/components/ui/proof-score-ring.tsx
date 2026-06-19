'use client'

import { useEffect, useState } from 'react'
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

export function ProofScoreRing({ score, size = 'md', animate = true, showLabel = true, className }: ProofScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  // When not animating, display the real score directly to avoid setState-in-effect
  const displayScore = animate ? animatedScore : score
  const config = sizes[size]
  const radius = (config.ring - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = displayScore / 100
  const strokeDashoffset = circumference - progress * circumference

  useEffect(() => {
    if (!animate) return
    const duration = 1500
    const start = performance.now()
    const from = 0

    const step = (now: number) => {
      const elapsed = now - start
      const p = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setAnimatedScore(Math.round(from + (score - from) * eased))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [score, animate])

  const getStrokeColor = (s: number) => {
    if (s >= 80) return 'url(#score-gradient-green)'
    if (s >= 60) return 'url(#score-gradient-amber)'
    if (s >= 40) return 'url(#score-gradient-orange)'
    return 'url(#score-gradient-red)'
  }

  return (
    <div className={cn('relative flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: config.ring, height: config.ring }}>
        <svg width={config.ring} height={config.ring} className="-rotate-90">
          <defs>
            <linearGradient id="score-gradient-green" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="score-gradient-amber" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <linearGradient id="score-gradient-orange" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            <linearGradient id="score-gradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f87171" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-surface-300"
          />
          {/* Progress */}
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke={getStrokeColor(displayScore)}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: animate ? 'none' : 'stroke-dashoffset 0.7s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold tabular-nums', config.fontSize, scoreColor(displayScore))}>
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
