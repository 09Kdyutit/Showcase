'use client'

import Image from 'next/image'
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Globe2,
  MessageSquareText,
  Search,
  Sparkles,
} from 'lucide-react'
import { HERO } from '@/lib/marketing/positioning'
import { TrackedLink } from './tracked-link'

const TRUST = [
  'No credit card required',
  'Private by default',
  'Review every AI change',
]

const WORKSPACE_ITEMS = [
  {
    icon: BriefcaseBusiness,
    title: 'Portfolio builder',
    status: 'Ready to edit',
    desc: 'Scannable case studies, themes, images, and a quality checklist.',
    tone: '#60a5fa',
  },
  {
    icon: Search,
    title: 'Job toolkit',
    status: 'Match + tailor',
    desc: 'Rank roles, tailor your résumé, and draft cover letters and outreach.',
    tone: '#a78bfa',
  },
  {
    icon: MessageSquareText,
    title: 'Interview Lab',
    status: 'Written now',
    desc: 'Practice role-aware questions and get per-answer coaching. Voice is available when enabled.',
    tone: '#34d399',
  },
  {
    icon: Globe2,
    title: 'Publish and share',
    status: 'Pro',
    desc: 'Turn your private draft into a live portfolio with a shareable preview card.',
    tone: '#fbbf24',
  },
] as const

function CareerWorkspacePreview() {
  return (
    <div
      className="ring-conic relative mx-auto max-w-4xl overflow-hidden rounded-[28px] text-left"
      style={{
        background: 'rgba(7, 20, 51, 0.74)',
        border: '1px solid rgba(147, 197, 253, 0.28)',
        boxShadow: '0 32px 100px rgba(3, 8, 28, 0.52), inset 0 1px 0 rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6" style={{ borderBottom: '1px solid rgba(147, 197, 253, 0.16)' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(96,165,250,0.3)' }}>
            <Sparkles className="h-4 w-4" style={{ color: '#93c5fd' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Your Showcase workspace</p>
            <p className="text-xs" style={{ color: 'rgba(191,219,254,0.68)' }}>One source of truth across the job search</p>
          </div>
        </div>
        <span className="hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex" style={{ color: '#86efac', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(74,222,128,0.22)' }}>
          Private draft
        </span>
      </div>

      <div className="p-4 sm:p-6">
        <div
          className="mb-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(147,197,253,0.14)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(59,130,246,0.14)' }}>
              <FileText className="h-5 w-5" style={{ color: '#93c5fd' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Start with the résumé you already have</p>
              <p className="text-xs" style={{ color: 'rgba(191,219,254,0.68)' }}>Upload PDF or DOCX, or paste your text</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: '#93c5fd', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <CheckCircle2 className="h-3 w-3" /> Parsed and editable
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {WORKSPACE_ITEMS.map(({ icon: Icon, title, status, desc, tone }) => (
            <div key={title} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(147,197,253,0.13)' }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${tone}1f`, border: `1px solid ${tone}38` }}>
                    <Icon className="h-4 w-4" style={{ color: tone }} />
                  </div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tone }}>{status}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(191,219,254,0.68)' }}>{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs leading-relaxed" style={{ color: 'rgba(219,234,254,0.78)', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(96,165,250,0.14)' }}>
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#60a5fa' }} />
          AI drafts stay grounded in your source material. You review and edit everything before it is shared.
        </div>
        <p className="mt-3 text-right text-[9px] uppercase tracking-widest" style={{ color: 'rgba(191,219,254,0.42)' }}>Illustrative product view</p>
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(130% 95% at 50% -5%, #244aa8 0%, #1a3a8f 32%, #122a6b 62%, #0b1a45 82%, #071433 100%)',
      }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="ambient-blob ambient-blob--a" style={{ top: '-12%', left: '18%', width: 560, height: 560, background: 'rgba(96,165,250,0.35)', filter: 'blur(120px)' }} />
        <div className="ambient-blob ambient-blob--b" style={{ bottom: '-18%', right: '14%', width: 520, height: 520, background: 'rgba(99,102,241,0.3)', filter: 'blur(130px)' }} />
        {/* Light running along the hero grid lines (21st.dev GridBeam, CSS-only) */}
        <span className="grid-beam" style={{ left: 'calc(50% - 288px)', animationDelay: '0s' }} />
        <span className="grid-beam" style={{ left: 'calc(50% - 72px)', animationDelay: '2.3s' }} />
        <span className="grid-beam" style={{ left: 'calc(50% + 144px)', animationDelay: '4.1s' }} />
        <span className="grid-beam hidden sm:block" style={{ left: 'calc(50% + 360px)', animationDelay: '5.6s' }} />
      </div>
      <div className="absolute inset-0 pointer-events-none hero-grid" style={{ opacity: 0.4 }} />

      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-28 text-center" style={{ zIndex: 2 }}>
        <div className="mb-7 flex items-center justify-center gap-3" style={{ animation: 'fadeIn 0.7s ease both' }}>
          <Image src="/logo-icon.png" alt="" width={44} height={44} priority className="select-none drop-shadow-lg" />
          <span className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: '#fff', letterSpacing: '-0.03em' }}>Showcase</span>
        </div>

        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: '#bfdbfe', animation: 'fadeIn 0.8s ease 0.08s both' }}>
          Portfolio builder + job-search workspace
        </p>
        <h1
          className="mx-auto mb-7 max-w-5xl text-balance text-aurora"
          style={{
            fontFamily: 'var(--font-fraunces), Georgia, serif',
            fontSize: 'clamp(2.7rem, 7vw, 5.7rem)',
            lineHeight: 1.02,
            letterSpacing: '-0.035em',
            fontWeight: 600,
            // Inline animation would override the .text-aurora keyframes — declare both.
            animation: 'fadeIn 0.9s ease 0.14s both, aurora-pan 9s ease-in-out 1.2s infinite',
          }}
        >
          {HERO.headline}
        </h1>

        <p className="mx-auto mb-8 max-w-3xl text-lg leading-relaxed sm:text-xl" style={{ color: 'rgba(226,236,255,0.86)', animation: 'fadeIn 0.8s ease 0.24s both' }}>
          {HERO.subheadline}
        </p>

        <div className="mb-7 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animation: 'fadeIn 0.8s ease 0.34s both' }}>
          <TrackedLink
            href="/signup"
            event="hero_primary_cta_clicked"
            ctaLabel="hero_primary"
            className="group btn-sheen cta-glow inline-flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
            style={{ background: 'linear-gradient(120deg, #3b82f6, #4f46e5)', color: '#fff' }}
          >
            {HERO.primaryCta.live}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </TrackedLink>
          <TrackedLink
            href="#how-it-works"
            event="hero_secondary_cta_clicked"
            ctaLabel="see_how"
            className="inline-flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.01]"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(147,197,253,0.3)', color: '#e2ecff' }}
          >
            {HERO.secondaryCta}
          </TrackedLink>
        </div>

        <div className="mb-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm" style={{ color: 'rgba(191,219,254,0.75)', animation: 'fadeIn 0.8s ease 0.44s both' }}>
          {TRUST.map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#60a5fa' }} />
              {item}
            </span>
          ))}
        </div>

        <div style={{ animation: 'fadeIn 0.9s ease 0.55s both' }}>
          <CareerWorkspacePreview />
        </div>
      </div>
    </section>
  )
}
