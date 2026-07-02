'use client'

import { useRef } from 'react'
import {
  ArrowUpRight, Target, BarChart3, Eye, Zap, Search,
  MessageSquare, Shield, FileText, GraduationCap, Rocket,
  Briefcase, Repeat, type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  Target, BarChart3, Eye, Zap, Search, MessageSquare, Shield, FileText,
  GraduationCap, Rocket, Briefcase, Repeat,
}

export type SpotlightIcon = keyof typeof ICONS

export function SpotlightCard({
  icon,
  index,
  title,
  desc,
}: {
  icon: SpotlightIcon
  index: string
  title: string
  desc: string
}) {
  const Icon = ICONS[icon] ?? Target
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className="spotlight-card group h-full p-7 sm:p-8 flex flex-col"
    >
      <div className="spotlight-dots" aria-hidden="true" />

      {/* Top row: icon + index */}
      <div className="flex items-start justify-between mb-7">
        <div className="spotlight-icon w-12 h-12 rounded-2xl flex items-center justify-center">
          <Icon className="h-5 w-5" style={{ color: 'oklch(73% 0.140 255)' }} />
        </div>
        <span
          className="spotlight-index font-mono text-sm font-bold tabular-nums"
          style={{ color: 'oklch(60% 0.022 258)' }}
        >
          {index}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2.5 tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed flex-1" style={{ color: 'oklch(54% 0.008 255)' }}>
        {desc}
      </p>

      {/* Reveal arrow */}
      <div className="spotlight-arrow mt-6 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'oklch(73% 0.140 255)' }}>
        <span className="h-px w-7" style={{ background: 'oklch(63% 0.200 255 / 0.6)' }} />
        <ArrowUpRight className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}
