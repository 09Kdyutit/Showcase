'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { TrackedLink } from './tracked-link'
import { EvidenceField } from './evidence-field'
import { ProofAssembly } from './proof-assembly'

const TRUST = ['No credit card required', 'Free ProofScore preview', 'Setup in 5 minutes']

// Shared headline so the blurred base layer and the sharp spotlight layer stay identical.
const HEADLINE = (
  <>
    Your résumé lists claims.
    <br />
    Showcase turns them into{' '}
    <span
      style={{
        fontStyle: 'italic',
        background: 'linear-gradient(100deg, #93c5fd, #60a5fa 55%, #818cf8)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      evidence.
    </span>
  </>
)

const HEADLINE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-fraunces), Georgia, serif',
  fontSize: 'clamp(2.6rem, 6.5vw, 5rem)',
  lineHeight: 1.05,
  letterSpacing: '-0.02em',
  fontWeight: 600,
}

export function HeroSection() {
  const sharpRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let raf = 0
    function onMove(e: MouseEvent) {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const sharp = sharpRef.current
        if (!sharp) return
        const r = sharp.getBoundingClientRect()
        sharp.style.setProperty('--mx', `${e.clientX - r.left}px`)
        sharp.style.setProperty('--my', `${e.clientY - r.top}px`)
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => { window.removeEventListener('mousemove', onMove); if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <section
      className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(130% 95% at 50% -5%, #244aa8 0%, #1a3a8f 32%, #122a6b 62%, #0b1a45 82%, #071433 100%)',
      }}
    >
      {/* Blue glow orbs — bright, non-blurry accents so it reads BLUE, not black */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: 'absolute', top: '-12%', left: '18%', width: 560, height: 560, background: 'rgba(96,165,250,0.35)', filter: 'blur(120px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-18%', right: '14%', width: 520, height: 520, background: 'rgba(99,102,241,0.3)', filter: 'blur(130px)', borderRadius: '50%' }} />
      </div>
      <div className="absolute inset-0 pointer-events-none hero-grid" style={{ opacity: 0.4 }} />

      {/* The Evidence Field — drifting unproven claims, periodically caught and
          verified, their trails feeding the proof engine below */}
      <EvidenceField />

      <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16 text-center" style={{ zIndex: 2 }}>
        {/* Brand lockup — the first thing you see */}
        <div className="flex items-center justify-center gap-3 mb-9" style={{ animation: 'fadeIn 0.7s ease both' }}>
          <Image src="/logo-icon.png" alt="" width={48} height={48} priority className="select-none drop-shadow-lg" />
          <span className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
            Showcase
          </span>
        </div>

        {/* Headline — Fraunces serif, blur-to-sharp under the cursor */}
        <div className="sui-headline relative mb-7" style={{ animation: 'fadeIn 0.9s ease 0.12s both' }}>
          <h1 className="sui-headline-base" style={HEADLINE_STYLE} aria-hidden="true">{HEADLINE}</h1>
          <h1 ref={sharpRef} className="sui-headline-sharp" style={HEADLINE_STYLE}>{HEADLINE}</h1>
        </div>

        {/* Subtext */}
        <p
          className="text-lg sm:text-xl max-w-xl mx-auto mb-8 leading-relaxed"
          style={{ color: 'rgba(226,236,255,0.85)', animation: 'fadeIn 0.8s ease 0.24s both' }}
        >
          Upload your résumé — Showcase builds your portfolio, <span style={{ color: '#93c5fd', fontWeight: 600 }}>scores the proof</span> behind every claim, and shows you exactly how to make it stronger. It never invents anything.
        </p>

        {/* CTAs — primary is a vibrant blue */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8" style={{ animation: 'fadeIn 0.8s ease 0.34s both' }}>
          <TrackedLink
            href="/signup"
            event="hero_primary_cta_clicked"
            ctaLabel="hero_primary"
            className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
            style={{ background: 'linear-gradient(120deg, #3b82f6, #4f46e5)', color: '#fff', boxShadow: '0 10px 34px rgba(59,130,246,0.45)' }}
          >
            Get started free
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </TrackedLink>
          <TrackedLink
            href="#how-it-works"
            event="hero_secondary_cta_clicked"
            ctaLabel="see_how"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.01]"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(147,197,253,0.3)', color: '#e2ecff' }}
          >
            See how it works
          </TrackedLink>
        </div>

        {/* Trust */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm mb-9"
          style={{ color: 'rgba(191,219,254,0.75)', animation: 'fadeIn 0.8s ease 0.44s both' }}
        >
          {TRUST.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#60a5fa' }} />
              {t}
            </span>
          ))}
        </div>

        {/* The Proof Engine — the centerpiece the Evidence Field feeds into */}
        <div style={{ animation: 'fadeIn 0.9s ease 0.6s both' }}>
          <ProofAssembly />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-9 left-1/2 -translate-x-1/2 flex flex-col items-center overflow-hidden" style={{ animation: 'fadeIn 1s ease 1s both', zIndex: 2, height: 44 }}>
        <div className="w-px h-full scroll-line" style={{ background: 'rgba(147,197,253,0.6)' }} />
      </div>
    </section>
  )
}
