'use client'

import { motion } from 'framer-motion'
import { Mail, ArrowUpRight, Globe, ArrowRight } from 'lucide-react'
import { safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent, getInitials } from './shared'

// ── The preset theme engine ─────────────────────────────────────────────────────
// One world-class, fully responsive portfolio whose entire look is driven by a ThemePreset
// (palette, fonts, background, card style, AND layout). Three structural layouts plus the
// palette/treatment variety give all 30 presets a genuinely distinct, designer-grade feel —
// the engine is the quality, the presets are the variety. All colors are inline so presets
// aren't constrained by the app's fixed Tailwind tokens.

export type BackgroundTreatment =
  | 'grid' | 'aurora' | 'orbs' | 'mesh' | 'scanlines' | 'dots' | 'beams' | 'starfield' | 'solid'
export type CardStyle = 'glass' | 'bordered' | 'elevated' | 'glow'
export type AccentStyle = 'gradient' | 'solid'
export type ThemeLayout = 'standard' | 'sidebar' | 'centered'

export interface ThemePreset {
  id: string
  name: string
  description: string
  badge?: string
  recommendedRoles: string[]
  mode: 'dark' | 'light'
  palette: {
    bg: string
    bg2: string
    text: string
    muted: string
    accent: string
    accent2: string
    border: string
  }
  fonts: { display: string; body: string; mono: string }
  background: BackgroundTreatment
  card: CardStyle
  accentStyle: AccentStyle
  radius: number
  layout?: ThemeLayout
}

const EASE = [0.21, 0.47, 0.32, 0.98] as const

function reveal(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-70px' },
    transition: { duration: 0.65, ease: EASE, delay },
  }
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function accentBg(p: ThemePreset): string {
  return p.accentStyle === 'gradient'
    ? `linear-gradient(120deg, ${p.palette.accent}, ${p.palette.accent2})`
    : p.palette.accent
}

const gradientText = (p: ThemePreset) => ({
  background: accentBg(p),
  WebkitBackgroundClip: 'text' as const,
  WebkitTextFillColor: 'transparent' as const,
  backgroundClip: 'text' as const,
})

function BackgroundLayer({ p }: { p: ThemePreset }) {
  const a = p.palette.accent
  const a2 = p.palette.accent2
  const grain = (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{
      opacity: p.mode === 'dark' ? 0.04 : 0.025, mixBlendMode: p.mode === 'dark' ? 'screen' : 'multiply',
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  )
  let layer: React.ReactNode = null
  switch (p.background) {
    case 'grid':
      layer = <div aria-hidden className="pointer-events-none fixed inset-0" style={{
        backgroundImage: `linear-gradient(${withAlpha(a, 0.06)} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(a, 0.06)} 1px, transparent 1px)`,
        backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse 75% 55% at 50% 0%, #000 30%, transparent 78%)',
      }} />; break
    case 'aurora':
      layer = <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '-18%', left: '-8%', width: '58vw', height: '58vw', background: withAlpha(a, 0.26), filter: 'blur(130px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-22%', right: '-8%', width: '52vw', height: '52vw', background: withAlpha(a2, 0.22), filter: 'blur(140px)', borderRadius: '50%' }} />
      </div>; break
    case 'orbs':
      layer = <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '6%', left: '10%', width: 380, height: 380, background: withAlpha(a, 0.2), filter: 'blur(100px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '44%', right: '6%', width: 440, height: 440, background: withAlpha(a2, 0.18), filter: 'blur(120px)', borderRadius: '50%' }} />
      </div>; break
    case 'mesh':
      layer = <div aria-hidden className="pointer-events-none fixed inset-0" style={{
        background: `radial-gradient(at 18% 16%, ${withAlpha(a, 0.16)} 0px, transparent 45%), radial-gradient(at 84% 26%, ${withAlpha(a2, 0.15)} 0px, transparent 45%), radial-gradient(at 50% 95%, ${withAlpha(a, 0.1)} 0px, transparent 50%)`,
      }} />; break
    case 'scanlines':
      layer = <div aria-hidden className="pointer-events-none fixed inset-0" style={{
        backgroundImage: `repeating-linear-gradient(0deg, ${withAlpha(a, 0.045)} 0px, ${withAlpha(a, 0.045)} 1px, transparent 1px, transparent 4px)`,
        maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, #000 40%, transparent 82%)',
      }} />; break
    case 'dots':
      layer = <div aria-hidden className="pointer-events-none fixed inset-0" style={{
        backgroundImage: `radial-gradient(${withAlpha(a, 0.16)} 1px, transparent 1px)`, backgroundSize: '28px 28px',
        maskImage: 'radial-gradient(ellipse 78% 58% at 50% 0%, #000 25%, transparent 78%)',
      }} />; break
    case 'beams':
      layer = <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '-30%', left: '22%', width: 260, height: '120vh', background: `linear-gradient(${withAlpha(a, 0.14)}, transparent)`, filter: 'blur(70px)', transform: 'rotate(18deg)' }} />
        <div style={{ position: 'absolute', top: '-30%', right: '20%', width: 220, height: '120vh', background: `linear-gradient(${withAlpha(a2, 0.12)}, transparent)`, filter: 'blur(80px)', transform: 'rotate(-14deg)' }} />
      </div>; break
    case 'starfield':
      layer = <div aria-hidden className="pointer-events-none fixed inset-0" style={{
        backgroundImage: `radial-gradient(1px 1px at 20% 30%, ${withAlpha(p.palette.text, 0.5)}, transparent), radial-gradient(1px 1px at 70% 60%, ${withAlpha(p.palette.text, 0.35)}, transparent), radial-gradient(1.5px 1.5px at 45% 80%, ${withAlpha(a, 0.6)}, transparent), radial-gradient(1px 1px at 85% 22%, ${withAlpha(p.palette.text, 0.4)}, transparent), radial-gradient(1px 1px at 12% 70%, ${withAlpha(p.palette.text, 0.3)}, transparent)`,
        backgroundSize: '620px 620px',
      }} />; break
  }
  return <>{layer}{grain}</>
}

function cardBase(p: ThemePreset): React.CSSProperties {
  const base: React.CSSProperties = { borderRadius: p.radius }
  switch (p.card) {
    case 'glass': return { ...base, background: withAlpha(p.palette.bg2, p.mode === 'dark' ? 0.5 : 0.72), backdropFilter: 'blur(16px)', border: `1px solid ${p.palette.border}` }
    case 'bordered': return { ...base, background: p.palette.bg2, border: `1px solid ${p.palette.border}` }
    case 'elevated': return { ...base, background: p.palette.bg2, border: `1px solid ${p.palette.border}`, boxShadow: p.mode === 'dark' ? `0 16px 44px ${withAlpha('#000000', 0.45)}` : `0 16px 44px ${withAlpha(p.palette.accent, 0.09)}` }
    case 'glow': return { ...base, background: p.palette.bg2, border: `1px solid ${withAlpha(p.palette.accent, 0.28)}`, boxShadow: `inset 0 1px 0 ${withAlpha('#ffffff', p.mode === 'dark' ? 0.04 : 0.6)}, 0 16px 50px ${withAlpha(p.palette.accent, 0.1)}` }
  }
}

function Chip({ p, children }: { p: ThemePreset; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 12px', borderRadius: 999,
      color: p.palette.text, background: withAlpha(p.palette.accent, 0.09), border: `1px solid ${withAlpha(p.palette.accent, 0.2)}`, fontFamily: p.fonts.body,
    }}>{children}</span>
  )
}

function SectionLabel({ p, n, t }: { p: ThemePreset; n: string; t: string }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <span style={{ fontFamily: p.fonts.mono, fontSize: 12, color: p.palette.accent, letterSpacing: '0.18em' }}>{n}</span>
      <span style={{ height: 1, width: 44, background: accentBg(p) }} />
      <span style={{ fontFamily: p.fonts.mono, fontSize: 11, color: p.palette.muted, letterSpacing: '0.22em', textTransform: 'uppercase' }}>{t}</span>
    </div>
  )
}

// ── Section renderers (shared by all layouts) ────────────────────────────────────

function ProofStats({ p, c }: { p: ThemePreset; c: ReturnType<typeof normalizePortfolioContent> }) {
  if (c.proof.length === 0) return null
  return (
    <motion.div {...reveal(0.3)} style={{ display: 'flex', gap: 44, marginTop: 60, flexWrap: 'wrap' }}>
      {c.proof.slice(0, 4).map((stat, i) => (
        <div key={i}>
          <div style={{ fontFamily: p.fonts.display, fontWeight: 800, fontSize: 38, lineHeight: 1, ...gradientText(p) }}>{stat.value}</div>
          <div style={{ fontSize: 13, color: p.palette.muted, marginTop: 8, letterSpacing: '0.01em' }}>{stat.label}</div>
        </div>
      ))}
    </motion.div>
  )
}

function AboutSection({ p, c }: { p: ThemePreset; c: ReturnType<typeof normalizePortfolioContent> }) {
  if (c.bioParagraphs.length === 0) return null
  return (
    <motion.section {...reveal()} id="about" style={{ padding: '56px 0' }}>
      <SectionLabel p={p} n="01" t="About" />
      <div style={{ maxWidth: 720, display: 'grid', gap: 18 }}>
        {c.bioParagraphs.map((para, i) => (
          <p key={i} style={{ fontSize: 'clamp(1.1rem, 1.7vw, 1.35rem)', lineHeight: 1.7, color: i === 0 ? p.palette.text : p.palette.muted, fontWeight: i === 0 ? 500 : 400 }}>{para}</p>
        ))}
      </div>
    </motion.section>
  )
}

function SkillsSection({ p, c }: { p: ThemePreset; c: ReturnType<typeof normalizePortfolioContent> }) {
  if (c.skills.length === 0) return null
  return (
    <motion.section {...reveal()} style={{ padding: '56px 0' }}>
      <SectionLabel p={p} n="02" t="Capabilities" />
      <div style={{ display: 'grid', gap: 24 }}>
        {c.categoryOrder.map((cat) => (
          <div key={cat} className="grid sm:grid-cols-[160px_1fr] gap-x-8 gap-y-3">
            <div style={{ fontFamily: p.fonts.mono, fontSize: 12, color: p.palette.muted, letterSpacing: '0.1em', textTransform: 'uppercase', paddingTop: 4 }}>{cat}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {c.skillsByCategory[cat].map((s, i) => <Chip key={i} p={p}>{s.name}</Chip>)}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

function WorkSection({ p, c }: { p: ThemePreset; c: ReturnType<typeof normalizePortfolioContent> }) {
  if (c.projects.length === 0) return null
  return (
    <motion.section {...reveal()} id="work" style={{ padding: '56px 0' }}>
      <SectionLabel p={p} n="03" t="Selected work" />
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {c.projects.map((proj, i) => {
          const href = proj.links?.[0]?.url
          const inner = (
            <motion.div
              {...reveal(0.05 * i)}
              whileHover={{ y: -6, boxShadow: `0 28px 64px ${withAlpha(p.palette.accent, 0.16)}`, borderColor: withAlpha(p.palette.accent, 0.45) }}
              transition={{ duration: 0.25, ease: EASE }}
              style={{ ...cardBase(p), padding: 26, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', cursor: href ? 'pointer' : 'default' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <h3 style={{ fontFamily: p.fonts.display, fontWeight: 700, fontSize: 20, letterSpacing: '-0.015em', lineHeight: 1.2 }}>{proj.title}</h3>
                {href && <ArrowUpRight size={19} style={{ color: p.palette.accent, flexShrink: 0 }} />}
              </div>
              {proj.summary && <p style={{ fontSize: 14.5, lineHeight: 1.65, color: p.palette.muted, flex: 1 }}>{proj.summary}</p>}
              {proj.outcome && (
                <div style={{ fontSize: 13, color: p.palette.text, padding: '9px 13px', borderRadius: Math.max(8, p.radius - 6), background: withAlpha(p.palette.accent, 0.08), border: `1px solid ${withAlpha(p.palette.accent, 0.16)}`, display: 'flex', gap: 7, alignItems: 'center' }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: p.palette.accent, flexShrink: 0 }} />{proj.outcome}
                </div>
              )}
              {(proj.tags ?? []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                  {(proj.tags ?? []).slice(0, 5).map((t, ti) => (
                    <span key={ti} style={{ fontFamily: p.fonts.mono, fontSize: 11, color: p.palette.muted, padding: '3px 9px', borderRadius: 6, border: `1px solid ${p.palette.border}` }}>{t}</span>
                  ))}
                </div>
              )}
            </motion.div>
          )
          return href
            ? <a key={i} href={safeHref(href)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</a>
            : <div key={i}>{inner}</div>
        })}
      </div>
    </motion.section>
  )
}

function ExperienceSection({ p, c }: { p: ThemePreset; c: ReturnType<typeof normalizePortfolioContent> }) {
  if (c.experience.length === 0) return null
  return (
    <motion.section {...reveal()} id="experience" style={{ padding: '56px 0' }}>
      <SectionLabel p={p} n="04" t="Experience" />
      <div style={{ display: 'grid', gap: 0, position: 'relative' }}>
        {c.experience.map((exp, i) => (
          <motion.div key={i} {...reveal(0.05 * i)} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 18, paddingBottom: i === c.experience.length - 1 ? 0 : 30 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 11, height: 11, borderRadius: 999, background: accentBg(p), marginTop: 6, boxShadow: `0 0 0 4px ${withAlpha(p.palette.accent, 0.12)}` }} />
              {i !== c.experience.length - 1 && <span style={{ width: 1.5, flex: 1, background: p.palette.border, marginTop: 6 }} />}
            </div>
            <div style={{ paddingBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <div style={{ fontFamily: p.fonts.display, fontWeight: 700, fontSize: 17.5 }}>{exp.role}</div>
                <div style={{ fontFamily: p.fonts.mono, fontSize: 12.5, color: p.palette.muted }}>{exp.period}</div>
              </div>
              <div style={{ fontSize: 14, color: p.palette.accent, marginTop: 2 }}>{exp.company}</div>
              {(exp.bullets ?? []).length > 0 && (
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                  {(exp.bullets ?? []).slice(0, 4).map((b, bi) => (
                    <li key={bi} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.6, color: p.palette.muted }}>
                      <span style={{ color: p.palette.accent, flexShrink: 0 }}>▹</span>{b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function SocialLinks({ p, c, center }: { p: ThemePreset; c: ReturnType<typeof normalizePortfolioContent>; center?: boolean }) {
  const links = c.contact
  const entries = ([['LinkedIn', links?.linkedin], ['GitHub', links?.github], ['Website', links?.website]] as const).filter(([, h]) => !!h)
  if (entries.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: center ? 'center' : 'flex-start' }}>
      {entries.map(([label, href]) => (
        <a key={label} href={safeHref(href as string)} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: p.palette.muted, textDecoration: 'none',
          padding: '7px 13px', borderRadius: 999, border: `1px solid ${p.palette.border}`,
        }}><Globe size={14} /> {label}</a>
      ))}
    </div>
  )
}

function ContactSection({ p, c, name }: { p: ThemePreset; c: ReturnType<typeof normalizePortfolioContent>; name: string }) {
  const email = c.contact?.email
  return (
    <motion.section {...reveal()} id="contact" style={{ padding: '80px 0 90px', textAlign: 'center' }}>
      <SectionLabel p={p} n="05" t="Contact" />
      <h2 style={{ fontFamily: p.fonts.display, fontWeight: 800, fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', letterSpacing: '-0.025em', maxWidth: 640, margin: '0 auto', lineHeight: 1.08 }}>
        Let&apos;s build something <span style={gradientText(p)}>worth proving.</span>
      </h2>
      {email && (
        <a href={safeHref(`mailto:${email}`)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 9, marginTop: 28, padding: '14px 28px', borderRadius: p.radius,
          background: accentBg(p), color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 15.5,
          boxShadow: `0 14px 40px ${withAlpha(p.palette.accent, 0.32)}`,
        }}><Mail size={17} /> {email}</a>
      )}
      <div style={{ marginTop: 30 }}><SocialLinks p={p} c={c} center /></div>
      <div style={{ marginTop: 50, fontSize: 12, color: p.palette.muted, fontFamily: p.fonts.mono, letterSpacing: '0.04em' }}>
        {name} · Built with Showcase
      </div>
    </motion.section>
  )
}

function Monogram({ p, name, size = 52 }: { p: ThemePreset; name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3), display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: p.fonts.display, fontWeight: 800, fontSize: size * 0.38, color: '#fff', background: accentBg(p),
      boxShadow: `0 8px 24px ${withAlpha(p.palette.accent, 0.35)}`, flexShrink: 0,
    }}>{getInitials(name)}</div>
  )
}

// ── Layouts ──────────────────────────────────────────────────────────────────────

export function PresetTheme({ portfolio, content, preset }: ThemeProps & { preset: ThemePreset }) {
  const p = preset
  const c = normalizePortfolioContent(portfolio, content)
  const name = portfolio.title || 'Your Name'
  const role = portfolio.target_role
  const email = c.contact?.email
  const layout = p.layout ?? 'standard'

  const ctaPrimary = email && (
    <a href={safeHref(`mailto:${email}`)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: p.radius,
      background: accentBg(p), color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 14.5,
      boxShadow: `0 12px 32px ${withAlpha(p.palette.accent, 0.3)}`,
    }}><Mail size={16} /> Get in touch</a>
  )
  const ctaSecondary = c.projects.length > 0 && (
    <a href="#work" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: p.radius,
      border: `1px solid ${p.palette.border}`, color: p.palette.text, textDecoration: 'none', fontWeight: 600, fontSize: 14.5,
    }}>View work <ArrowRight size={16} /></a>
  )

  const shell = (children: React.ReactNode) => (
    <div style={{ background: p.palette.bg, color: p.palette.text, fontFamily: p.fonts.body, minHeight: '100%', position: 'relative', overflow: 'hidden' }}>
      <BackgroundLayer p={p} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )

  // ── SIDEBAR LAYOUT ──
  if (layout === 'sidebar') {
    return shell(
      <div className="flex flex-col lg:flex-row" style={{ maxWidth: 1240, margin: '0 auto' }}>
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-[380px] lg:shrink-0 flex flex-col justify-between" style={{ padding: '56px 40px' }}>
          <div>
            <Monogram p={p} name={name} size={56} />
            <motion.h1 {...reveal(0.05)} style={{ fontFamily: p.fonts.display, fontWeight: 800, letterSpacing: '-0.025em', fontSize: 'clamp(2.2rem, 4vw, 3rem)', lineHeight: 1.05, marginTop: 26 }}>{name}</motion.h1>
            {role && <p style={{ fontSize: 17, marginTop: 12, ...gradientText(p), fontWeight: 600, display: 'inline-block' }}>{role}</p>}
            {c.hero?.subheadline && <p style={{ fontSize: 14.5, color: p.palette.muted, marginTop: 16, lineHeight: 1.65, maxWidth: 320 }}>{c.hero.subheadline}</p>}
            <nav className="hidden lg:flex" style={{ flexDirection: 'column', gap: 12, marginTop: 32 }}>
              {[['About', '#about'], ['Work', '#work'], ['Experience', '#experience'], ['Contact', '#contact']].map(([l, h]) => (
                <a key={l} href={h} style={{ fontFamily: p.fonts.mono, fontSize: 12.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: p.palette.muted, textDecoration: 'none' }}>— {l}</a>
              ))}
            </nav>
          </div>
          <div style={{ marginTop: 36 }}>
            {c.proof.length > 0 && (
              <div style={{ display: 'flex', gap: 28, marginBottom: 24, flexWrap: 'wrap' }}>
                {c.proof.slice(0, 2).map((s, i) => (
                  <div key={i}><div style={{ fontFamily: p.fonts.display, fontWeight: 800, fontSize: 26, ...gradientText(p) }}>{s.value}</div><div style={{ fontSize: 12, color: p.palette.muted, marginTop: 4 }}>{s.label}</div></div>
                ))}
              </div>
            )}
            <SocialLinks p={p} c={c} />
          </div>
        </aside>
        <main className="flex-1 min-w-0" style={{ padding: '40px 40px 0' }}>
          {c.bioParagraphs.length === 0 && <div style={{ height: 16 }} />}
          <AboutSection p={p} c={c} />
          <SkillsSection p={p} c={c} />
          <WorkSection p={p} c={c} />
          <ExperienceSection p={p} c={c} />
          <ContactSection p={p} c={c} name={name} />
        </main>
      </div>
    )
  }

  // ── CENTERED / EDITORIAL LAYOUT ──
  if (layout === 'centered') {
    return shell(
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
        <header style={{ paddingTop: 40, display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontFamily: p.fonts.display, fontWeight: 700, fontSize: 15, letterSpacing: '0.02em' }}>{name}</span>
        </header>
        <section style={{ padding: '90px 0 60px', textAlign: 'center' }}>
          {role && <motion.div {...reveal(0)} style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}><Chip p={p}>{role}</Chip></motion.div>}
          <motion.h1 {...reveal(0.05)} style={{ fontFamily: p.fonts.display, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, fontSize: 'clamp(2.6rem, 6vw, 4.4rem)' }}>
            {c.hero?.headline ?? name}
          </motion.h1>
          {c.hero?.subheadline && <motion.p {...reveal(0.12)} style={{ marginTop: 22, fontSize: 'clamp(1.05rem, 2vw, 1.3rem)', color: p.palette.muted, maxWidth: 600, margin: '22px auto 0', lineHeight: 1.6 }}>{c.hero.subheadline}</motion.p>}
          <motion.div {...reveal(0.2)} style={{ display: 'flex', gap: 12, marginTop: 30, justifyContent: 'center', flexWrap: 'wrap' }}>{ctaPrimary}{ctaSecondary}</motion.div>
          {c.proof.length > 0 && (
            <motion.div {...reveal(0.3)} style={{ display: 'flex', gap: 44, marginTop: 56, flexWrap: 'wrap', justifyContent: 'center' }}>
              {c.proof.slice(0, 4).map((stat, i) => (
                <div key={i}><div style={{ fontFamily: p.fonts.display, fontWeight: 800, fontSize: 36, ...gradientText(p) }}>{stat.value}</div><div style={{ fontSize: 13, color: p.palette.muted, marginTop: 7 }}>{stat.label}</div></div>
              ))}
            </motion.div>
          )}
        </section>
        <AboutSection p={p} c={c} />
        <SkillsSection p={p} c={c} />
        <WorkSection p={p} c={c} />
        <ExperienceSection p={p} c={c} />
        <ContactSection p={p} c={c} name={name} />
      </div>
    )
  }

  // ── STANDARD LAYOUT ──
  return shell(
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'blur(12px)', background: withAlpha(p.palette.bg, 0.72), borderBottom: `1px solid ${p.palette.border}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '15px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: p.fonts.display, fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>{name}</span>
          <nav style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 13.5, color: p.palette.muted }}>
            {c.projects.length > 0 && <a href="#work" className="hidden sm:inline" style={{ color: 'inherit', textDecoration: 'none' }}>Work</a>}
            {c.experience.length > 0 && <a href="#experience" className="hidden sm:inline" style={{ color: 'inherit', textDecoration: 'none' }}>Experience</a>}
            {email && <a href={safeHref(`mailto:${email}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 999, background: accentBg(p), color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Contact</a>}
          </nav>
        </div>
      </header>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
        <section style={{ padding: '100px 0 60px' }}>
          {role && <motion.div {...reveal(0)}><Chip p={p}>{role}</Chip></motion.div>}
          <motion.h1 {...reveal(0.05)} style={{ fontFamily: p.fonts.display, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.02, fontSize: 'clamp(2.8rem, 7vw, 5.2rem)', margin: '24px 0 0', maxWidth: 900 }}>
            {c.hero?.headline ?? name}
          </motion.h1>
          {c.hero?.subheadline && <motion.p {...reveal(0.12)} style={{ marginTop: 22, fontSize: 'clamp(1.05rem, 2vw, 1.3rem)', color: p.palette.muted, maxWidth: 640, lineHeight: 1.6 }}>{c.hero.subheadline}</motion.p>}
          <motion.div {...reveal(0.2)} style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>{ctaPrimary}{ctaSecondary}</motion.div>
          <ProofStats p={p} c={c} />
        </section>
        <AboutSection p={p} c={c} />
        <SkillsSection p={p} c={c} />
        <WorkSection p={p} c={c} />
        <ExperienceSection p={p} c={c} />
        <ContactSection p={p} c={c} name={name} />
      </div>
    </>
  )
}
