'use client'

import { motion, useScroll, useTransform, useSpring, MotionValue } from 'framer-motion'
import { useRef } from 'react'
import { Mail, ExternalLink, MoveRight } from 'lucide-react'
import { safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent } from './shared'

function use3DCard(strength = 15) {
  const x = useSpring(0, { stiffness: 200, damping: 25 })
  const y = useSpring(0, { stiffness: 200, damping: 25 })

  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / rect.width - 0.5
    const cy = (e.clientY - rect.top) / rect.height - 0.5
    x.set(cy * -strength)
    y.set(cx * strength)
  }
  const onMouseLeave = () => { x.set(0); y.set(0) }
  return { x, y, onMouseMove, onMouseLeave }
}

function Card3D({ children, className = '', strength = 12 }: { children: React.ReactNode; className?: string; strength?: number }) {
  const { x, y, onMouseMove, onMouseLeave } = use3DCard(strength)
  return (
    <motion.div onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
      style={{ rotateX: x, rotateY: y, transformStyle: 'preserve-3d', perspective: 1200 }}
      className={`will-change-transform ${className}`}>
      {children}
    </motion.div>
  )
}

function ParallaxLayer({ scrollY, depth, children, className = '' }: { scrollY: MotionValue<number>; depth: number; children: React.ReactNode; className?: string }) {
  const y = useTransform(scrollY, [0, 1], [0, depth])
  return <motion.div style={{ y }} className={className}>{children}</motion.div>
}

export function Minimal3DTheme({ portfolio, content }: ThemeProps) {
  const { hero, about, skills, experience, projects, proof, contact, initials, bioParagraphs, skillsByCategory, categoryOrder } = normalizePortfolioContent(portfolio, content)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95])
  const accentColor = (content as { accentColor?: string }).accentColor ?? '#0066ff'

  return (
    <div ref={containerRef} className="relative min-h-screen bg-white text-[#0a0a0a] overflow-x-hidden">

      {/* Subtle grid lines */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/90 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
            {hero?.headshotUrl ? (
              <img src={hero.headshotUrl} alt={portfolio.title} className="w-8 h-8 rounded-full object-cover ring-2 ring-black/10" />
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-black/10 flex items-center justify-center text-xs font-bold">{initials}</div>
            )}
            <span className="font-medium text-sm">{portfolio.title}</span>
          </motion.div>
          {contact?.email && (
            <motion.a initial={{ opacity: 0 }} animate={{ opacity: 1 }} href={`mailto:${contact.email}`}
              className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-white transition-transform hover:scale-105" style={{ background: accentColor }}>
              <Mail className="h-3 w-3" /> Get in touch
            </motion.a>
          )}
        </div>
      </nav>

      {/* Hero — full viewport with 3D card */}
      <section className="min-h-screen flex items-center justify-center pt-16 px-6 relative overflow-hidden">
        {/* Floating accent shapes */}
        <motion.div animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-32 right-16 w-64 h-64 rounded-full opacity-10 blur-2xl"
          style={{ background: accentColor }} />
        <motion.div animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute bottom-32 left-16 w-48 h-48 rounded-full opacity-10 blur-3xl"
          style={{ background: accentColor }} />

        <motion.div style={{ scale: heroScale }} className="max-w-4xl mx-auto text-center relative z-10">
          {hero?.headshotUrl && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="mx-auto mb-8 w-28 h-28 rounded-2xl overflow-hidden shadow-xl" style={{ boxShadow: `0 20px 60px ${accentColor}30` }}>
              <img src={hero.headshotUrl} alt={portfolio.title} className="w-full h-full object-cover" />
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-black/10 mb-8" style={{ color: accentColor }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
            {hero?.tagline ?? 'Available for new projects'}
          </motion.div>
          {hero?.headline && (
            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: 'spring', stiffness: 80 }}
              className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] mb-8">
              {hero.headline}
            </motion.h1>
          )}
          {hero?.subheadline && (
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="text-lg sm:text-xl text-black/40 max-w-xl mx-auto mb-10 leading-relaxed">
              {hero.subheadline}
            </motion.p>
          )}
          {proof.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-6">
              {proof.slice(0, 4).map((p, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl font-black" style={{ color: accentColor }}>{p.value}</div>
                  <div className="text-xs text-black/40 mt-0.5">{p.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-black/20 text-xs">
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <MoveRight className="rotate-90 h-4 w-4" />
          </motion.div>
          scroll
        </div>
      </section>

      {/* Projects — 3D tilt cards */}
      {projects.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 rounded-full" style={{ background: accentColor }} />
              <span className="text-xs font-medium text-black/40 tracking-widest uppercase">Selected Work</span>
            </div>
            <h2 className="text-4xl font-black">Projects</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-6">
            {projects.map((proj, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card3D strength={8}>
                  <div className="relative rounded-2xl overflow-hidden border border-black/8 shadow-lg hover:shadow-xl transition-shadow bg-white group" style={{ transformStyle: 'preserve-3d' }}>
                    {proj.imageUrl ? (
                      <div className="h-48 overflow-hidden">
                        <motion.img whileHover={{ scale: 1.05 }} transition={{ duration: 0.4 }} src={proj.imageUrl} alt={proj.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-3" style={{ background: accentColor }} />
                    )}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-black text-lg">{proj.title}</h3>
                          <p className="text-sm text-black/40">{proj.role}</p>
                        </div>
                        {proj.links.length > 0 && safeHref(proj.links[0].url) && (
                          <a href={safeHref(proj.links[0].url)!} target="_blank" rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full text-white" style={{ background: accentColor }}>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {proj.tags && <div className="flex flex-wrap gap-1 mb-4">{proj.tags.slice(0, 4).map((t, j) => <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-black/5 text-black/50">{t}</span>)}</div>}
                      <p className="text-sm text-black/55 leading-relaxed mb-4">{proj.outcome || proj.summary}</p>
                      {proj.metrics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-4 border-t border-black/5">
                          {proj.metrics.slice(0, 3).map((m, j) => <span key={j} className="text-xs font-medium px-2 py-1 rounded-md" style={{ background: `${accentColor}10`, color: accentColor }}>{m}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </Card3D>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* About + Skills */}
      {(bioParagraphs.length > 0 || categoryOrder.length > 0) && (
        <section className="max-w-5xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-[1fr_280px] gap-16 items-start">
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full" style={{ background: accentColor }} />
                  <span className="text-xs font-medium text-black/40 tracking-widest uppercase">About</span>
                </div>
                <h2 className="text-4xl font-black mb-8">Background</h2>
                <div className="space-y-4 mb-8">{bioParagraphs.map((p, i) => <p key={i} className="text-black/60 leading-relaxed">{p}</p>)}</div>
              </motion.div>
              {experience.length > 0 && (
                <div className="space-y-5">
                  {experience.map((exp, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                      className="flex gap-5 py-4 border-b border-black/5 last:border-0">
                      <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-black text-white" style={{ background: accentColor }}>{exp.company[0]}</div>
                      <div>
                        <div className="font-black text-sm">{exp.role}</div>
                        <div className="text-xs font-medium mb-1.5" style={{ color: accentColor }}>{exp.company} · {exp.period}</div>
                        <ul className="space-y-1">{exp.bullets.slice(0, 2).map((b, j) => <li key={j} className="text-xs text-black/50">{b}</li>)}</ul>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="lg:sticky lg:top-24">
              <div className="text-xs font-medium text-black/40 tracking-widest uppercase mb-4">Stack</div>
              <div className="space-y-2">
                {skills.slice(0, 12).map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between text-sm py-2 border-b border-black/5 last:border-0">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.level === 'Expert' ? `${accentColor}15` : 'rgba(0,0,0,0.05)', color: s.level === 'Expert' ? accentColor : 'rgba(0,0,0,0.4)' }}>{s.level}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Contact */}
      {(contact?.email || contact?.linkedin) && (
        <section className="max-w-5xl mx-auto px-6 py-24">
          <Card3D strength={6}>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="p-10 sm:p-16 rounded-3xl text-center" style={{ background: `${accentColor}08`, border: `2px solid ${accentColor}20` }}>
              <h2 className="text-4xl sm:text-5xl font-black mb-3">Ready to build?</h2>
              <p className="text-black/40 mb-8 text-lg">I&apos;m open to the right opportunities.</p>
              <div className="flex flex-wrap justify-center gap-3">
                {contact?.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white transition-transform hover:scale-105" style={{ background: accentColor }}><Mail className="h-4 w-4" />{contact.email}</a>}
                {safeHref(contact?.linkedin) && <a href={safeHref(contact.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm border-2 border-black/10 bg-white transition-transform hover:scale-105"><ExternalLink className="h-4 w-4" />LinkedIn</a>}
                {safeHref(contact?.github) && <a href={safeHref(contact.github)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm border-2 border-black/10 bg-white transition-transform hover:scale-105"><ExternalLink className="h-4 w-4" />GitHub</a>}
              </div>
            </motion.div>
          </Card3D>
        </section>
      )}

      <footer className="border-t border-black/5 py-6 text-center text-xs text-black/20">
        Built with Showcase
      </footer>
    </div>
  )
}
