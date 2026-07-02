'use client'

import { useEffect, useRef, useState } from 'react'

const PHRASES = [
  'honest about your work.',
  'evidence, not adjectives.',
  'built from what you actually did.',
  'the proof recruiters trust.',
  'your work, made undeniable.',
]

export function TypewriterSection() {
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Only start typing once the section scrolls into view
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true)
          obs.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const full = PHRASES[phraseIdx]
    let timeout: ReturnType<typeof setTimeout>

    if (!deleting && text === full) {
      timeout = setTimeout(() => setDeleting(true), 1700)
    } else if (deleting && text === '') {
      // Brief pause between phrases; also keeps state updates async for the compiler
      timeout = setTimeout(() => {
        setDeleting(false)
        setPhraseIdx((i) => (i + 1) % PHRASES.length)
      }, 140)
    } else {
      timeout = setTimeout(
        () => setText(full.slice(0, deleting ? text.length - 1 : text.length + 1)),
        deleting ? 35 : 70
      )
    }
    return () => clearTimeout(timeout)
  }, [text, deleting, phraseIdx, started])

  return (
    <section ref={ref} className="py-32 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Mono label */}
        <div
          className="flex items-center gap-4 mb-10"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span className="text-sm" style={{ color: 'oklch(66% 0.022 258)' }}>[ → ]</span>
          <span
            className="text-xs uppercase tracking-widest px-2.5 py-1 rounded"
            style={{
              background: 'var(--color-surface-200)',
              border: '1px solid var(--color-border)',
              color: 'oklch(60% 0.008 255)',
            }}
          >
            Showcase is
          </span>
        </div>

        {/* Typed line */}
        <h2
          className="font-semibold tracking-tight text-balance"
          style={{
            fontSize: 'clamp(2rem, 6.5vw, 4.5rem)',
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            color: 'oklch(99% 0.005 255)',
            minHeight: '1.1em',
          }}
        >
          {/* Static text for screen readers; the animated text is decorative */}
          <span className="sr-only">Showcase is {PHRASES[0]}</span>
          <span aria-hidden="true">
            {text}
            <span className="type-caret" style={{ height: '0.9em', verticalAlign: '-0.06em' }} />
          </span>
        </h2>
      </div>
    </section>
  )
}
