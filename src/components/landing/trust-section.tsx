'use client'

import { useRef } from 'react'
import { Shield, Lock, Eye, Download, type LucideIcon } from 'lucide-react'

const EM = 'oklch(72% 0.16 162)' // emerald accent

const ITEMS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Lock,
    title: 'Private by default',
    desc: 'Resume content is stored for your account and processed by the providers needed to run Showcase. It is not sold or publicly indexed.',
  },
  {
    icon: Eye,
    title: 'You control visibility',
    desc: 'Portfolio drafts stay private. Pro lets you publish or unpublish, while shared score and interview summaries use token-protected links.',
  },
  {
    icon: Download,
    title: 'Your data, your call',
    desc: 'Download a career packet or request account deletion from Settings. Any limited retention is explained in the Privacy Policy.',
  },
]

export function TrustSection() {
  const cardRef = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <section className="py-24 px-6 max-w-5xl mx-auto">
      <div
        ref={cardRef}
        onMouseMove={onMove}
        className="trust-card group relative overflow-hidden rounded-[28px] p-10 sm:p-14"
      >
        {/* emerald cursor spotlight */}
        <div className="trust-spotlight" aria-hidden="true" />
        {/* dotted texture */}
        <div className="trust-dots" aria-hidden="true" />
        {/* ambient corner glow */}
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${EM.replace(')', ' / 0.10)')}, transparent 70%)`, filter: 'blur(20px)' }}
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex flex-col sm:flex-row items-start gap-7 mb-10">
            {/* Glowing shield */}
            <div className="relative shrink-0">
              <span
                className="absolute inset-0 rounded-2xl"
                style={{ background: EM.replace(')', ' / 0.35)'), filter: 'blur(16px)' }}
                aria-hidden="true"
              />
              <div
                className="trust-shield relative w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${EM.replace(')', ' / 0.28)')}, ${EM.replace(')', ' / 0.08)')})`,
                  border: `1px solid ${EM.replace(')', ' / 0.4)')}`,
                  boxShadow: `inset 0 1px 0 ${EM.replace(')', ' / 0.3)')}`,
                }}
              >
                <Shield className="h-6 w-6" style={{ color: EM }} />
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: EM, boxShadow: `0 0 10px ${EM}` }} />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: EM }}>
                  Built on control
                </p>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold mb-4 tracking-tight" style={{ letterSpacing: '-0.025em' }}>
                AI drafts.{' '}
                <span style={{ color: EM }}>You stay in control.</span>
              </h2>
              <p className="leading-relaxed max-w-2xl text-[15px]" style={{ color: 'oklch(56% 0.008 255)' }}>
                Showcase is designed to ground drafts in the resume and details you provide. AI can
                make mistakes, so every output stays editable and yours to review before you export,
                apply, or publish. When support is thin, the audit flags the gap instead of silently
                filling it.
              </p>
            </div>
          </div>

          {/* Sub-cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            {ITEMS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="trust-item rounded-2xl p-5">
                <div
                  className="trust-item-icon w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: EM.replace(')', ' / 0.10)'),
                    border: `1px solid ${EM.replace(')', ' / 0.22)')}`,
                  }}
                >
                  <Icon className="h-4.5 w-4.5" style={{ color: EM, width: 18, height: 18 }} />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1.5">{title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'oklch(69% 0.022 258)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
