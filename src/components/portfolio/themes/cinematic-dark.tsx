'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { Mail, Link as LinkedinIcon, ExternalLink, FileText, ArrowRight } from 'lucide-react'
import { safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent } from './shared'
import {
  FadeUp, LineReveal, ScrollProgressBar, CursorGlow, useCountUp,
} from './effects'

// ─── Loading overlay ───────────────────────────────────────────────────────

function LoadingOverlay({ name, headshotUrl, accent, onDone }: {
  name: string; headshotUrl?: string | null; accent: string; onDone: () => void
}) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let p = 0
    const id = setInterval(() => {
      p += Math.random() * 18 + 4
      if (p >= 100) { p = 100; clearInterval(id); setTimeout(onDone, 300) }
      setProgress(Math.min(p, 100))
    }, 60)
    return () => clearInterval(id)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#050508]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeInOut' } }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6"
      >
        {headshotUrl ? (
          <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-white/10"
            style={{ boxShadow: `0 0 40px ${accent}40` }}>
            <img src={headshotUrl} alt={name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black"
            style={{ background: `${accent}20`, border: `2px solid ${accent}40`, color: accent }}>
            {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="text-white text-xl font-bold tracking-[0.25em] uppercase">{name}</span>
        <div className="w-64">
          <div className="flex justify-between text-xs mb-2" style={{ color: `${accent}80` }}>
            <span className="tracking-widest">WELCOME</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: accent, width: `${progress}%` }}
              transition={{ ease: 'linear' }} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Right-side dot navigation ─────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'hero', label: 'HOME' },
  { id: 'about', label: 'ABOUT' },
  { id: 'experience', label: 'EXPERIENCE' },
  { id: 'projects', label: 'PROJECTS' },
  { id: 'skills', label: 'SKILLS' },
  { id: 'contact', label: 'CONTACT' },
]

function DotNav({ accent }: { accent: string }) {
  const [active, setActive] = useState('hero')

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id)
        }
      },
      { threshold: 0.4 }
    )
    NAV_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  return (
    <div className="fixed right-5 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 items-center">
      {NAV_SECTIONS.map((s) => (
        <button
          key={s.id}
          onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}
          className="group flex items-center gap-2"
          title={s.label}
        >
          <span className={`text-[9px] tracking-widest opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block`}
            style={{ color: active === s.id ? accent : 'rgba(255,255,255,0.4)' }}>
            {s.label}
          </span>
          <motion.div
            animate={{ scale: active === s.id ? 1 : 0.6 }}
            className="w-2 h-2 rounded-full transition-colors"
            style={{ background: active === s.id ? accent : 'rgba(255,255,255,0.3)',
              boxShadow: active === s.id ? `0 0 8px ${accent}80` : 'none' }}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Marquee ticker ────────────────────────────────────────────────────────

function Marquee({ items, accent }: { items: string[]; accent: string }) {
  if (!items.length) return null
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden border-y py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-8 text-xs font-bold tracking-widest uppercase">
            <span className="text-white/60">{item}</span>
            <span style={{ color: accent }}>•</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Animated stat counter ─────────────────────────────────────────────────

function StatCounter({ value, label, accent }: { value: string; label: string; accent: string }) {
  const { ref, displayed } = useCountUp(value)
  return (
    <div ref={ref} className="text-center px-6">
      <div className="text-3xl sm:text-4xl font-black" style={{ color: accent }}>{displayed}</div>
      <div className="text-xs text-white/40 tracking-widest uppercase mt-1">{label}</div>
    </div>
  )
}

// ─── Main theme ────────────────────────────────────────────────────────────

export function CinematicDarkTheme({ portfolio, content }: ThemeProps) {
  const {
    hero, about, skills, experience, projects, proof, contact, cta,
    bioParagraphs, skillsByCategory, categoryOrder,
  } = normalizePortfolioContent(portfolio, content)

  const [loaded, setLoaded] = useState(false)
  const accent = (content as { accentColor?: string }).accentColor ?? '#e91e8c'
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -60])

  const allSkillNames = skills.map(s => s.name)

  // Separate experience types
  const experienceCards = experience.slice(0, 6)

  return (
    <>
      <AnimatePresence>
        {!loaded && (
          <LoadingOverlay
            name={portfolio.title}
            headshotUrl={hero?.headshotUrl}
            accent={accent}
            onDone={() => setLoaded(true)}
          />
        )}
      </AnimatePresence>

      <div ref={containerRef} className="relative min-h-screen text-white overflow-x-hidden"
        style={{ fontFamily: "'Inter', sans-serif", background: '#050508' }}>

        {/* Font import */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@300;400;500;600;700&display=swap');
          .font-display { font-family: 'Anton', 'Impact', sans-serif; }
        `}</style>

        <ScrollProgressBar color={accent} />
        <CursorGlow color={accent} size={500} opacity={0.08} />
        <DotNav accent={accent} />

        {/* Ambient background glow */}
        <div className="fixed inset-0 pointer-events-none -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full blur-[120px] opacity-20"
            style={{ background: `radial-gradient(ellipse, ${accent}, transparent 70%)` }} />
        </div>

        {/* ── NAV ──────────────────────────────────────────────────────── */}
        <motion.nav
          initial={{ y: -20, opacity: 0 }} animate={loaded ? { y: 0, opacity: 1 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between px-6 sm:px-10"
          style={{ background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-3">
            {hero?.headshotUrl ? (
              <img src={hero.headshotUrl} alt={portfolio.title}
                className="w-8 h-8 rounded-full object-cover"
                style={{ boxShadow: `0 0 0 2px ${accent}40` }} />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: `${accent}20`, color: accent }}>
                {portfolio.title.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
            )}
            <span className="text-sm font-semibold text-white/90">{portfolio.title}</span>
            <span className="hidden sm:block text-white/30 text-xs ml-1">· {portfolio.target_role ?? ''}</span>
          </div>
          <div className="flex items-center gap-2">
            {contact?.linkedin && (
              <a href={safeHref(contact.linkedin)} target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:brightness-110"
                style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}>
                <LinkedinIcon className="w-3 h-3" /> LinkedIn
              </a>
            )}
            {contact?.email && (
              <a href={`mailto:${contact.email}`}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-white transition-all hover:brightness-110"
                style={{ background: accent }}>
                Resume
              </a>
            )}
          </div>
        </motion.nav>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center pt-16 px-6 sm:px-12 overflow-hidden">
          <motion.div style={{ y: heroY }} className="w-full max-w-5xl mx-auto">
            {/* Badge pill */}
            {hero?.tagline && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={loaded ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full text-xs font-medium tracking-widest uppercase"
                style={{ background: `${accent}12`, border: `1px solid ${accent}30`, color: accent }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
                {hero.tagline}
              </motion.div>
            )}

            {/* Main headline */}
            <div className="font-display overflow-hidden mb-4">
              {['HI, I\'M', portfolio.title.toUpperCase()].map((line, i) => (
                <motion.div key={i}
                  initial={{ y: '110%', opacity: 0 }}
                  animate={loaded ? { y: '0%', opacity: 1 } : {}}
                  transition={{ delay: 0.5 + i * 0.12, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="block leading-none"
                  style={{
                    fontSize: 'clamp(3rem, 10vw, 8rem)',
                    color: i === 0 ? 'rgba(255,255,255,0.85)' : accent,
                    textShadow: i === 1 ? `0 0 60px ${accent}40` : 'none',
                  }}>
                  {line}
                </motion.div>
              ))}
            </div>

            {/* Subtitle */}
            {hero?.subheadline && (
              <motion.p
                initial={{ opacity: 0 }} animate={loaded ? { opacity: 1 } : {}}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="text-white/50 text-base sm:text-lg max-w-2xl mb-2 leading-relaxed">
                {hero.subheadline}
              </motion.p>
            )}

            {/* Status */}
            {cta?.headline && (
              <motion.div
                initial={{ opacity: 0 }} animate={loaded ? { opacity: 1 } : {}}
                transition={{ delay: 0.9 }}
                className="flex items-center gap-2 text-sm text-white/40 mb-8">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
                {cta.headline}
              </motion.div>
            )}

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={loaded ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 1.0, duration: 0.5 }}
              className="flex flex-wrap items-center gap-3 mb-16">
              <button
                onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:brightness-110 hover:scale-[1.02]"
                style={{ background: accent }}>
                Take the Tour <ArrowRight className="w-4 h-4" />
              </button>
              {contact?.linkedin && (
                <a href={safeHref(contact.linkedin)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
                  <LinkedinIcon className="w-4 h-4" /> LinkedIn
                </a>
              )}
              {contact?.email && (
                <a href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
                  <FileText className="w-4 h-4" /> Resume
                </a>
              )}
            </motion.div>

            {/* Proof stats */}
            {proof.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }} animate={loaded ? { opacity: 1 } : {}}
                transition={{ delay: 1.1 }}
                className="flex flex-wrap"
                style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                {proof.slice(0, 4).map((p, i) => (
                  <div key={i} style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                    <StatCounter value={p.value} label={p.label} accent={accent} />
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>

          {/* Scroll hint */}
          <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            initial={{ opacity: 0 }} animate={loaded ? { opacity: 1 } : {}} transition={{ delay: 1.4 }}>
            <span className="text-[10px] tracking-[0.3em] text-white/30 uppercase">Scroll</span>
            <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="w-[1px] h-8" style={{ background: `linear-gradient(to bottom, ${accent}60, transparent)` }} />
          </motion.div>
        </section>

        {/* ── SKILLS MARQUEE ───────────────────────────────────────────── */}
        {allSkillNames.length > 0 && <Marquee items={allSkillNames} accent={accent} />}

        {/* ── ABOUT ────────────────────────────────────────────────────── */}
        {(about?.bio || about?.values?.length) && (
          <section id="about" className="max-w-6xl mx-auto px-6 sm:px-12 py-28">
            <FadeUp>
              <div className="text-xs tracking-[0.4em] text-white/30 uppercase mb-4 flex items-center gap-3">
                <span className="w-8 h-[1px] bg-white/20" />
                ABOUT
              </div>
              <div className="font-display leading-none mb-12"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', color: 'white' }}>
                {(hero?.headline || 'BUILDER,\nLEADER,\nENGINEER').split(/[,\n]/).filter(Boolean).map((w, i) => (
                  <div key={i}>{w.trim().toUpperCase()}{i < 2 ? ',' : ''}</div>
                ))}
              </div>
            </FadeUp>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-5">
                {bioParagraphs.map((p, i) => (
                  <FadeUp key={i} delay={i * 0.08}>
                    <p className="text-white/55 leading-relaxed text-sm sm:text-base">{p}</p>
                  </FadeUp>
                ))}
              </div>
              {about?.values && about.values.length > 0 && (
                <FadeUp delay={0.1}>
                  <div className="rounded-2xl p-6 space-y-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-xs tracking-widest text-white/30 uppercase mb-4">Core Values</div>
                    {about.values.map((v, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accent }} />
                        <span className="text-white/60 text-sm">{v}</span>
                      </div>
                    ))}
                  </div>
                </FadeUp>
              )}
            </div>
          </section>
        )}

        {/* ── EXPERIENCE ───────────────────────────────────────────────── */}
        {experienceCards.length > 0 && (
          <section id="experience" className="max-w-6xl mx-auto px-6 sm:px-12 py-28">
            <FadeUp>
              <div className="text-xs tracking-[0.4em] text-white/30 uppercase mb-4 flex items-center gap-3">
                <span className="w-8 h-[1px] bg-white/20" />
                EXPERIENCE
              </div>
              <div className="font-display leading-none mb-12"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', color: 'white' }}>
                ROLES IN<br />MOTION
              </div>
            </FadeUp>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {experienceCards.map((exp, i) => (
                <FadeUp key={i} delay={i * 0.07}>
                  <motion.div
                    whileHover={{ y: -4, borderColor: `${accent}40` }}
                    className="rounded-2xl p-6 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-[10px] tracking-widest font-bold uppercase mb-3 flex items-center gap-2"
                      style={{ color: accent }}>
                      <span className="w-4 h-4 flex items-center justify-center rounded border"
                        style={{ borderColor: `${accent}40` }}>✦</span>
                      {exp.role?.includes('VP') || exp.role?.includes('President') || exp.role?.includes('Lead') ? 'LEADERSHIP' :
                        exp.role?.includes('Intern') ? 'INTERNSHIP' :
                        exp.role?.includes('Research') ? 'RESEARCH' : 'ROLE'}
                    </div>
                    <div className="font-bold text-white text-base mb-1">{exp.role}</div>
                    <div className="text-white/50 text-sm mb-2">{exp.company}</div>
                    {exp.period && (
                      <div className="text-xs text-white/30 mb-4" style={{ color: accent + '70' }}>{exp.period}</div>
                    )}
                    {exp.bullets.slice(0, 2).map((b, j) => (
                      <div key={j} className="flex items-start gap-2 text-white/40 text-xs leading-relaxed">
                        <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0 bg-white/20" />
                        {b}
                      </div>
                    ))}
                  </motion.div>
                </FadeUp>
              ))}
            </div>
          </section>
        )}

        {/* ── PROJECTS ─────────────────────────────────────────────────── */}
        {projects.length > 0 && (
          <section id="projects" className="max-w-6xl mx-auto px-6 sm:px-12 py-28">
            <FadeUp>
              <div className="text-xs tracking-[0.4em] text-white/30 uppercase mb-4 flex items-center gap-3">
                <span className="w-8 h-[1px] bg-white/20" />
                FEATURED PROJECTS
              </div>
              <div className="font-display leading-none mb-12"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', color: 'white' }}>
                CASE<br />STUDIES
              </div>
            </FadeUp>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {projects.map((proj, i) => (
                <FadeUp key={i} delay={i * 0.08}>
                  <motion.div
                    whileHover={{ y: -6, borderColor: `${accent}40` }}
                    className="group rounded-2xl overflow-hidden transition-all"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {/* Image */}
                    {proj.imageUrl ? (
                      <div className="relative h-48 overflow-hidden">
                        <img src={proj.imageUrl} alt={proj.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(5,5,8,0.9))' }} />
                        <div className="absolute bottom-4 left-4 text-[10px] tracking-widest text-white/50 uppercase">
                          {proj.role || 'Project'}
                        </div>
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${accent}10, ${accent}05)` }}>
                        <span className="font-display text-4xl" style={{ color: `${accent}40` }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                    )}

                    <div className="p-6">
                      {proj.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {proj.tags.slice(0, 3).map((tag, j) => (
                            <span key={j} className="px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide"
                              style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}25` }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <h3 className="font-bold text-white text-lg mb-2">{proj.title}</h3>
                      {proj.summary && <p className="text-white/45 text-sm leading-relaxed mb-4">{proj.summary}</p>}
                      {proj.outcome && (
                        <div className="text-xs px-3 py-2 rounded-lg mb-4"
                          style={{ background: `${accent}10`, color: `${accent}cc`, border: `1px solid ${accent}20` }}>
                          {proj.outcome}
                        </div>
                      )}
                      {proj.links?.length > 0 && (
                        <div className="flex gap-3">
                          {proj.links.map((link, j) => (
                            <a key={j} href={safeHref(link.url)} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs transition-colors hover:text-white"
                              style={{ color: `${accent}80` }}>
                              VIEW CASE STUDY <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </FadeUp>
              ))}
            </div>
          </section>
        )}

        {/* ── SKILLS ───────────────────────────────────────────────────── */}
        {categoryOrder.length > 0 && (
          <section id="skills" className="max-w-6xl mx-auto px-6 sm:px-12 py-28">
            <FadeUp>
              <div className="text-xs tracking-[0.4em] text-white/30 uppercase mb-4 flex items-center gap-3">
                <span className="w-8 h-[1px] bg-white/20" />
                TOOLKIT
              </div>
              <div className="font-display leading-none mb-12"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', color: 'white' }}>
                CAPABILITY<br />STACK
              </div>
            </FadeUp>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {categoryOrder.map((cat, i) => (
                <FadeUp key={cat} delay={i * 0.06}>
                  <div className="rounded-2xl p-6"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-xs font-bold tracking-widest uppercase mb-4"
                      style={{ color: accent }}>{cat}</div>
                    <div className="flex flex-wrap gap-2">
                      {skillsByCategory[cat].map((skill, j) => (
                        <motion.span key={j}
                          whileHover={{ scale: 1.05, borderColor: `${accent}60` }}
                          className="px-3 py-1.5 rounded-full text-xs font-medium text-white/70 transition-all"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          {skill.name}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </section>
        )}

        {/* ── CONTACT ──────────────────────────────────────────────────── */}
        <section id="contact" className="max-w-6xl mx-auto px-6 sm:px-12 py-28">
          <div className="rounded-3xl p-10 sm:p-16 relative overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Glow accent */}
            <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-30"
              style={{ background: accent }} />

            <FadeUp>
              <div className="text-xs tracking-[0.4em] text-white/30 uppercase mb-6 flex items-center gap-3">
                <span className="w-8 h-[1px] bg-white/20" />
                CONTACT
              </div>
              <div className="font-display leading-none mb-6"
                style={{ fontSize: 'clamp(2rem, 6vw, 5rem)', color: 'white' }}>
                LET&apos;S BUILD<br />SOMETHING<br />EXCEPTIONAL
              </div>
              {about?.bio && (
                <p className="text-white/40 text-sm max-w-md mb-10 leading-relaxed">
                  {about.bio.split('.')[0]}.
                </p>
              )}
              <div className="flex flex-wrap gap-4">
                {contact?.email && (
                  <a href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:brightness-110 hover:scale-[1.02]"
                    style={{ background: accent }}>
                    <Mail className="w-4 h-4" /> EMAIL {portfolio.title.split(' ')[0].toUpperCase()}
                  </a>
                )}
                {contact?.linkedin && (
                  <a href={safeHref(contact.linkedin)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:bg-white/10"
                    style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}>
                    <LinkedinIcon className="w-4 h-4" /> LINKEDIN
                  </a>
                )}
                {contact?.website && (
                  <a href={safeHref(contact.website)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:bg-white/10"
                    style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}>
                    <ExternalLink className="w-4 h-4" /> WEBSITE
                  </a>
                )}
              </div>
            </FadeUp>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-8 px-2">
            <span className="text-xs text-white/20">{portfolio.title}</span>
            <span className="text-xs text-white/15">Built with Showcase</span>
          </div>
        </section>
      </div>
    </>
  )
}
