'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * The Proof Assembly — the hero's centerpiece machine.
 *
 * On a loop, a vague résumé claim appears flagged "unproven", a scan sweeps it,
 * an evidence trail draws downward, and the claim re-assembles as a specific,
 * cited, verified statement. This is the product doing its job, live, labeled
 * as an example. Honors prefers-reduced-motion (shows the final verified state).
 */

const EXAMPLES = [
  {
    claim: 'Improved checkout performance',
    proof: 'Cut checkout load time from 3.1s to 1.4s',
    source: 'resume.pdf · experience, bullet 2',
  },
  {
    claim: 'Team player with leadership skills',
    proof: 'Mentored 2 interns through their first production launch',
    source: 'resume.pdf · experience, bullet 4',
  },
  {
    claim: 'Worked on the analytics dashboard',
    proof: 'Built a seller dashboard used by 1,200 merchants weekly',
    source: 'portfolio · case study, outcome',
  },
]

// stage: 0 claim-in → 1 scanning → 2 verified → 3 fade-out
const STAGE_MS = [1100, 900, 2600, 450]

export function ProofAssembly() {
  const [idx, setIdx] = useState(0)
  const [stage, setStage] = useState(0)
  const [frozen, setFrozen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const advance = (s: number, i: number) => {
      if (cancelled) return
      setStage(s)
      setIdx(i)
      const next = s === 3 ? 0 : s + 1
      const nextIdx = s === 3 ? (i + 1) % EXAMPLES.length : i
      timer.current = setTimeout(() => advance(next, nextIdx), STAGE_MS[s])
    }
    // async kick-off keeps state updates out of the synchronous effect body
    timer.current = setTimeout(() => {
      if (cancelled) return
      if (reduce) { setFrozen(true); setStage(2) } // static verified state, no loop
      else advance(0, 0)
    }, 0)
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current) }
  }, [])

  const ex = EXAMPLES[idx]
  const verified = stage >= 2
  const fading = stage === 3

  return (
    <div
      className="relative mx-auto w-full max-w-lg select-none"
      style={{
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
      aria-label="Example: Showcase turns a vague claim into a verified, cited statement"
    >
      {/* Engine intake glow — where the Evidence Field trails land */}
      <div
        aria-hidden
        className="absolute -top-3 left-1/2 -translate-x-1/2 w-40 h-6 rounded-full"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(52,211,153,0.25), transparent 70%)',
          filter: 'blur(4px)',
        }}
      />

      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(8, 18, 48, 0.72)',
          border: '1px solid rgba(147, 197, 253, 0.16)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 60px rgba(2, 8, 28, 0.55)',
          backdropFilter: 'blur(14px)',
        }}
      >
        {/* mono header strip */}
        <div
          className="flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.14em]"
          style={{
            fontFamily: 'var(--font-geist-mono), monospace',
            color: 'rgba(147, 197, 253, 0.55)',
            borderBottom: '1px solid rgba(147, 197, 253, 0.10)',
          }}
        >
          <span>proof engine</span>
          <span>example</span>
        </div>

        <div className="p-5 sm:p-6">
          {/* The claim — dim, flagged until verified */}
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-sm sm:text-[15px] transition-all duration-500"
              style={{
                fontFamily: 'var(--font-geist-mono), monospace',
                color: verified ? 'rgba(191,219,254,0.38)' : 'rgba(226,236,255,0.85)',
                textDecoration: verified ? 'line-through rgba(191,219,254,0.35)' : 'none',
              }}
            >
              &ldquo;{ex.claim}&rdquo;
            </p>
            <span
              className="flex items-center gap-1 shrink-0 text-[10px] font-semibold uppercase tracking-wider transition-opacity duration-300"
              style={{ color: '#fbbf24', opacity: verified ? 0 : 1 }}
            >
              <AlertTriangle className="h-3 w-3" />
              unproven
            </span>
          </div>

          {/* Scan beam + trail column */}
          <div className="relative my-4 h-8">
            {/* vertical evidence trail draws downward while scanning */}
            <div
              aria-hidden
              className="absolute left-4 top-0 w-px"
              style={{
                height: stage >= 1 ? '100%' : '0%',
                background: 'linear-gradient(180deg, rgba(52,211,153,0.7), rgba(52,211,153,0.15))',
                boxShadow: '0 0 8px rgba(52,211,153,0.5)',
                transition: 'height 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
            {/* horizontal scan beam sweeps during stage 1 */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-1/2 h-px overflow-hidden"
              style={{ opacity: stage === 1 ? 1 : 0, transition: 'opacity 0.2s ease' }}
            >
              <div
                className="h-full w-1/3"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.9), transparent)',
                  animation: stage === 1 && !frozen ? 'shimmer 0.9s linear infinite' : 'none',
                }}
              />
            </div>
            <span
              className="absolute left-8 top-1/2 -translate-y-1/2 text-[10px] tracking-wide"
              style={{
                fontFamily: 'var(--font-geist-mono), monospace',
                color: 'rgba(147,197,253,0.5)',
              }}
            >
              {stage === 0 ? 'reading claim…' : stage === 1 ? 'finding evidence…' : 'evidence found'}
            </span>
          </div>

          {/* The verified statement — assembles in with its citation */}
          <div
            className="transition-all duration-500"
            style={{
              opacity: verified ? 1 : 0,
              transform: verified ? 'translateY(0)' : 'translateY(8px)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#34d399' }} />
              <div className="min-w-0">
                <p className="text-sm sm:text-[15px] font-semibold leading-snug" style={{ color: '#f0f7ff' }}>
                  {ex.proof}
                </p>
                <p
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    fontFamily: 'var(--font-geist-mono), monospace',
                    color: 'rgba(110, 231, 183, 0.85)',
                    background: 'rgba(52, 211, 153, 0.08)',
                    border: '1px solid rgba(52, 211, 153, 0.22)',
                  }}
                >
                  {ex.source} · verified
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p
        className="mt-3 text-center text-[11px]"
        style={{ color: 'rgba(191,219,254,0.5)' }}
      >
        Missing proof is flagged, never invented.
      </p>
    </div>
  )
}
