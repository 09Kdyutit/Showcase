'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

/**
 * EvidenceScan — the app's signature "AI is working" scene.
 *
 * A stylized résumé document sits under a sweeping scan beam. As the beam passes
 * each line, that line briefly lights up and — for the "evidence" lines — pins a
 * verified marker with a drawn trail. It's the same claim→proof language as the
 * landing hero, reused wherever the product is thinking (parse, generate, audit),
 * replacing plain spinners with a moment that explains what's happening.
 *
 * Pure CSS/DOM animation (no canvas) so it's cheap and crisp. Honors
 * prefers-reduced-motion (renders a calm, fully-scanned static state).
 */

// Line widths (%) and whether each line is a "claim" that gets verified
const LINES = [
  { w: 44, evidence: false }, // name
  { w: 30, evidence: false }, // contact
  { w: 0,  evidence: false }, // gap
  { w: 22, evidence: false }, // section header
  { w: 82, evidence: true },  // experience bullet
  { w: 74, evidence: true },
  { w: 68, evidence: false },
  { w: 0,  evidence: false },
  { w: 20, evidence: false }, // section header
  { w: 78, evidence: true },  // project bullet
  { w: 64, evidence: false },
  { w: 71, evidence: true },
]

export function EvidenceScan({
  messages,
  className,
}: {
  messages?: string[]
  className?: string
}) {
  const [scanTop, setScanTop] = useState(0)
  const [verified, setVerified] = useState<Set<number>>(new Set())
  const [msgIdx, setMsgIdx] = useState(0)
  const rowsRef = useRef<HTMLDivElement>(null)
  // State (not a ref) so it can be read during render for the beam transition without
  // tripping the "no refs during render" rule.
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Reduced motion: skip the sweep and jump to the final "all verified" state. Dispatched
    // from inside requestAnimationFrame so no setState runs synchronously in the effect body
    // (avoids cascading renders + satisfies the react-hooks compiler rule). The normal path
    // needs no setReduce — `reduce` already defaults to false.
    if (prefersReduce) {
      const jump = requestAnimationFrame(() => {
        setReduce(true)
        setVerified(new Set(LINES.map((l, i) => (l.evidence ? i : -1)).filter((i) => i >= 0)))
        setScanTop(100)
      })
      return () => cancelAnimationFrame(jump)
    }

    let raf = 0
    let cancelled = false
    const period = 2600 // one full sweep
    const start = performance.now()

    const tick = (now: number) => {
      if (cancelled) return
      const t = ((now - start) % period) / period
      // ease the beam so it lingers slightly at the ends
      const pos = (1 - Math.cos(t * Math.PI * 2)) / 2
      setScanTop(pos * 100)

      // verify evidence lines as the beam passes their vertical position
      const rows = rowsRef.current
      if (rows) {
        const total = rows.clientHeight
        const beamY = pos * total
        setVerified((prev) => {
          let next = prev
          rows.querySelectorAll<HTMLElement>('[data-evidence="true"]').forEach((el) => {
            const idx = Number(el.dataset.idx)
            const mid = el.offsetTop + el.offsetHeight / 2
            if (beamY >= mid && !prev.has(idx)) {
              if (next === prev) next = new Set(prev)
              next.add(idx)
            }
            // reset just after the beam wraps back to the top
            if (pos < 0.05 && prev.has(idx)) {
              if (next === prev) next = new Set(prev)
              next.delete(idx)
            }
          })
          return next
        })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    let msgTimer: ReturnType<typeof setInterval> | null = null
    if (messages && messages.length > 1) {
      msgTimer = setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), 1900)
    }

    return () => { cancelled = true; cancelAnimationFrame(raf); if (msgTimer) clearInterval(msgTimer) }
  }, [messages])

  return (
    <div className={className}>
      <div
        className="relative mx-auto w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, var(--color-surface-100), var(--color-surface-50))',
          border: '1px solid var(--color-border)',
          boxShadow: 'inset 0 1px 0 oklch(100% 0 0 / 0.05), 0 24px 60px oklch(0% 0 0 / 0.4)',
        }}
      >
        {/* Document header chrome */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/60">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(62% 0.20 25)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(80% 0.15 85)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-verified)' }} />
          <span className="ml-2 text-[10px] tracking-wide" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
            resume.pdf
          </span>
        </div>

        {/* Document body with sweeping beam */}
        <div ref={rowsRef} className="relative px-5 py-5 space-y-2.5" style={{ minHeight: 232 }}>
          {/* scan beam */}
          <div
            aria-hidden
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: `calc(${scanTop}% - 20px)`,
              height: 40,
              background: 'linear-gradient(180deg, transparent, color-mix(in oklch, var(--color-brand-400) 26%, transparent), transparent)',
              transition: reduce ? 'none' : 'top 0.05s linear',
            }}
          >
            <div
              className="absolute left-0 right-0 top-1/2 h-px"
              style={{ background: 'color-mix(in oklch, var(--color-brand-300) 80%, transparent)', boxShadow: '0 0 10px color-mix(in oklch, var(--color-brand-400) 70%, transparent)' }}
            />
          </div>

          {LINES.map((line, i) => {
            if (line.w === 0) return <div key={i} className="h-2" />
            const isV = verified.has(i)
            return (
              <div key={i} data-idx={i} data-evidence={line.evidence} className="relative flex items-center gap-2">
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${line.w}%`,
                    background: isV
                      ? 'color-mix(in oklch, var(--color-verified) 55%, transparent)'
                      : 'var(--color-surface-300)',
                    boxShadow: isV ? '0 0 10px color-mix(in oklch, var(--color-verified) 45%, transparent)' : 'none',
                  }}
                />
                {line.evidence && (
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0 transition-all duration-300"
                    style={{
                      color: 'var(--color-verified)',
                      opacity: isV ? 1 : 0,
                      transform: isV ? 'scale(1)' : 'scale(0.4)',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Rotating status line */}
      {messages && messages.length > 0 && (
        <p
          key={msgIdx}
          className="mt-6 text-center text-sm font-medium text-foreground"
          style={{ animation: 'fadeIn 0.4s ease both' }}
        >
          {messages[msgIdx]}
        </p>
      )}
    </div>
  )
}
