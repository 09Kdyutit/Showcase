'use client'

import { useEffect, useRef } from 'react'

// The app's living layer: a soft aurora glow that trails the cursor (lerped in rAF so it
// glides, never jitters) plus a sparse field of rising light particles. Mounted once in
// the signed-in layout. Pure transforms — no layout work, no repaint storms. Particles
// use index-derived pseudo-random values so SSR and client markup always match.

function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    let tx = window.innerWidth / 2
    let ty = window.innerHeight / 3
    let x = tx
    let y = ty
    let raf = 0

    const onMove = (e: MouseEvent) => {
      tx = e.clientX
      ty = e.clientY
    }
    const tick = () => {
      x += (tx - x) * 0.08
      y += (ty - y) * 0.08
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <div ref={ref} className="cursor-glow" aria-hidden="true" />
}

const PARTICLE_COUNT = 14

function seeded(i: number, salt: number) {
  // Deterministic 0..1 from index — stable across server and client renders.
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return v - Math.floor(v)
}

function ParticleField() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const size = 1.5 + seeded(i, 1) * 2.5
        return (
          <span
            key={i}
            className="fx-particle"
            style={{
              left: `${4 + seeded(i, 2) * 92}%`,
              width: `${size}px`,
              height: `${size}px`,
              '--p-dur': `${14 + seeded(i, 3) * 14}s`,
              '--p-delay': `${-seeded(i, 4) * 24}s`,
              '--p-sway': `${(seeded(i, 5) - 0.5) * 120}px`,
              '--p-peak': `${0.25 + seeded(i, 6) * 0.4}`,
            } as React.CSSProperties}
          />
        )
      })}
    </div>
  )
}

export function AppFX() {
  return (
    <>
      <CursorGlow />
      <ParticleField />
    </>
  )
}
