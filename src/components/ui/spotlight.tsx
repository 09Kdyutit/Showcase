'use client'

import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Wraps any content in the premium cursor-follow spotlight surface (the same effect
 * the landing feature cards use). Server components can render this directly — it only
 * adds a client mousemove handler that sets --mx/--my CSS vars for the radial glow.
 */
export function Spotlight({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section'
}) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent<HTMLElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <Tag ref={ref as never} onMouseMove={onMove} className={cn('spotlight-card', className)}>
      {children}
    </Tag>
  )
}
