'use client'

import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Interactive 3D tilt: the surface leans toward the cursor in real perspective, with a
 * specular glare that tracks the pointer. Server components can render this directly —
 * it only adds client pointer handlers. Honors prefers-reduced-motion (no tilt).
 *
 * Wrap card content; put anything that should visually lift off the surface in a child
 * with className="tilt-layer" (or "tilt-layer-sm").
 */
export function Tilt3D({
  children,
  className,
  innerClassName,
  max = 7,
}: {
  children: ReactNode
  className?: string
  innerClassName?: string
  max?: number
}) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const reduce = useRef(false)

  function onEnter() {
    reduce.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce.current) outer.current?.setAttribute('data-active', 'true')
  }

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce.current) return
    const el = outer.current
    const box = inner.current
    if (!el || !box) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    box.style.setProperty('--ry', `${(px - 0.5) * (max * 2)}deg`)
    box.style.setProperty('--rx', `${(0.5 - py) * (max * 2)}deg`)
    box.style.setProperty('--gx', `${px * 100}%`)
    box.style.setProperty('--gy', `${py * 100}%`)
  }

  function onLeave() {
    const el = outer.current
    const box = inner.current
    el?.setAttribute('data-active', 'false')
    if (box) {
      box.style.setProperty('--rx', '0deg')
      box.style.setProperty('--ry', '0deg')
    }
  }

  return (
    <div
      ref={outer}
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn('tilt-3d', className)}
    >
      <div ref={inner} className={cn('tilt-3d-inner', innerClassName)}>
        {children}
      </div>
    </div>
  )
}
