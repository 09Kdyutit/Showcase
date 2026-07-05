'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

// Lightweight in-app changelog. A subtle "What's new" pill with an unseen-update dot; the
// latest entry id is compared against localStorage so returning users see a nudge when
// something shipped. Pure client, no backend. Update CHANGELOG to publish.

interface Entry { id: string; date: string; title: string; items: string[] }

const CHANGELOG: Entry[] = [
  {
    id: '2026-07-04',
    date: 'July 2026',
    title: 'Your job search, more connected',
    items: [
      'Command palette — press ⌘K (Ctrl+K) to jump anywhere instantly.',
      'Portfolio views — see how many people opened your public portfolio, and from where.',
      'ProofScore trajectory — watch your score climb over time on the dashboard.',
      'Shareable ProofScore + referral rewards — invite friends, earn bonus AI credits.',
      'Weekly digest — your ProofScore trend and jobs to follow up on, once a week.',
    ],
  },
]

const LATEST = CHANGELOG[0]?.id ?? ''

export function WhatsNew() {
  const [open, setOpen] = useState(false)
  const [unseen, setUnseen] = useState(false)

  useEffect(() => {
    // Dispatched from inside rAF (a deferred boundary) so setState never runs synchronously
    // in the effect body.
    const raf = requestAnimationFrame(() => {
      if (localStorage.getItem('sc_whatsnew_seen') !== LATEST) setUnseen(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  function openModal() {
    setOpen(true)
    setUnseen(false)
    localStorage.setItem('sc_whatsnew_seen', LATEST)
  }

  return (
    <>
      <button
        onClick={openModal}
        className="hidden lg:flex fixed bottom-5 right-5 z-40 items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors group"
        style={{
          background: 'color-mix(in oklch, var(--color-surface-100) 92%, transparent)',
          border: '1px solid color-mix(in oklch, var(--color-brand-500) 22%, var(--color-border))',
          boxShadow: '0 8px 28px oklch(0% 0 0 / 0.4)',
          backdropFilter: 'blur(10px)',
        }}
        aria-label="What's new"
      >
        <Sparkles className="h-3.5 w-3.5 text-brand-300" />
        What&apos;s new
        {unseen && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(72% 0.17 160)', boxShadow: '0 0 8px oklch(72% 0.17 160)' }} />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.15s ease' }} />
          <div
            role="dialog"
            aria-label="What's new"
            className="relative w-full max-w-md rounded-2xl overflow-hidden glass-card"
            style={{ animation: 'scaleIn 0.16s cubic-bezier(0.22,1,0.36,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 relative">
              <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
              <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% -10%, color-mix(in oklch, var(--color-brand-500) 14%, transparent), transparent)' }} />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'oklch(63% 0.20 255)' }}>What&apos;s new · {LATEST && CHANGELOG[0].date}</p>
                <h2 className="text-display text-xl font-semibold text-foreground mb-4">{CHANGELOG[0]?.title}</h2>
                <ul className="space-y-2.5">
                  {CHANGELOG[0]?.items.map((it, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/85">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-brand-300" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
