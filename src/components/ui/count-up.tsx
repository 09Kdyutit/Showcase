'use client'

import { useEffect, useState } from 'react'

// A number that counts up from 0 with an ease-out curve on mount, then lands with a soft
// settle-pop. Server components can render this directly. The animation is driven entirely
// from inside a requestAnimationFrame callback — the first setState never runs synchronously
// during the effect, which both avoids cascading renders and satisfies the react-hooks
// compiler rule (same pattern as ProofScoreRing).
export function CountUp({
  value,
  duration = 1100,
  className,
}: {
  value: number
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const [landed, setLanded] = useState(false)

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * value))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setLanded(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <span className={`${className ?? ''} ${landed ? 'settle-pop' : ''}`.trim()}>
      {display}
    </span>
  )
}
