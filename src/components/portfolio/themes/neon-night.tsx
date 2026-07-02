'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Mail, ExternalLink, Zap } from 'lucide-react'
import { safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent } from './shared'

const NEON_COLORS = ['#00f5ff', '#bf00ff', '#ff006e', '#00ff88', '#ff9500']

function NeonBorder({ color = '#00f5ff', className = '' }: { color?: string; className?: string }) {
  return (
    <div className={`absolute inset-0 rounded-xl pointer-events-none ${className}`}
      style={{ boxShadow: `0 0 0 1px ${color}22, inset 0 0 20px ${color}08` }} />
  )
}

export function NeonNightTheme({ portfolio, content }: ThemeProps) {
  const { hero, about, skills, experience, projects, proof, contact, initials, bioParagraphs, skillsByCategory, categoryOrder } = normalizePortfolioContent(portfolio, content)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const accentColor = (content as { accentColor?: string }).accentColor ?? '#00f5ff'

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#03020a] text-white overflow-x-hidden font-mono">
      {/* Fixed scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-10 opacity-[0.025]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1) 1px, transparent 1px, transparent 3px)' }} />

      {/* Background grid */}
      <div className="fixed inset-0 -z-10" style={{ backgroundImage: `linear-gradient(${accentColor}08 1px, transparent 1px), linear-gradient(90deg, ${accentColor}08 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,245,255,0.1),transparent)]" />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl" style={{ background: 'rgba(3,2,10,0.9)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span style={{ color: accentColor }} className="text-sm font-bold tracking-widest">&gt;_ {portfolio.title}</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs" style={{ color: `${accentColor}80` }}>
            {['work', 'about', 'contact'].map((s) => (
              <button key={s} onClick={() => document.getElementById(s)?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">{s}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-28 pb-36">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          <div className="text-xs tracking-[0.4em] uppercase mb-6 flex items-center gap-3" style={{ color: accentColor }}>
            <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-2 h-4 inline-block" style={{ background: accentColor }} />
            STATUS: AVAILABLE
          </div>
          {hero?.headshotUrl && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="mb-8">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden" style={{ boxShadow: `0 0 30px ${accentColor}40, 0 0 60px ${accentColor}20` }}>
                <img src={hero.headshotUrl} alt={portfolio.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 20px ${accentColor}20` }} />
              </div>
            </motion.div>
          )}
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: 'spring' }}
            className="text-5xl sm:text-8xl font-bold tracking-tight mb-6 leading-none">
            <span className="block text-white/20 text-base mb-2 tracking-[0.3em]">HELLO, I AM</span>
            {portfolio.title.split(' ').map((word, i) => (
              <motion.span key={i} className="block" initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.1 }}
                style={{ textShadow: `0 0 40px ${accentColor}60` }}>
                {word}
              </motion.span>
            ))}
          </motion.h1>
          {hero?.subheadline && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-lg max-w-xl mb-10" style={{ color: `${accentColor}90` }}>
              {hero.subheadline}
            </motion.p>
          )}
          {proof.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="flex flex-wrap gap-4 mb-10">
              {proof.slice(0, 4).map((p, i) => (
                <div key={i} className="text-center px-4 py-3 rounded border" style={{ borderColor: `${accentColor}30`, background: `${accentColor}08` }}>
                  <div className="text-2xl font-black" style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}60` }}>{p.value}</div>
                  <div className="text-xs text-white/40 mt-0.5">{p.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* Projects */}
      {projects.length > 0 && (
        <section id="work" className="max-w-6xl mx-auto px-6 py-24">
          <div className="flex items-center gap-4 mb-12">
            <span style={{ color: accentColor }} className="text-sm tracking-[0.3em]">01.</span>
            <h2 className="text-2xl font-bold tracking-widest uppercase">Selected Work</h2>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${accentColor}40, transparent)` }} />
          </div>
          <div className="space-y-6">
            {projects.map((proj, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="relative rounded-xl p-6 sm:p-8 overflow-hidden" style={{ background: `${accentColor}05`, border: `1px solid ${accentColor}20` }}>
                  <NeonBorder color={accentColor} />
                  {proj.imageUrl && (
                    <div className="mb-6 -mx-8 -mt-8 h-48 overflow-hidden rounded-t-xl">
                      <img src={proj.imageUrl} alt={proj.title} className="w-full h-full object-cover opacity-60" style={{ filter: `saturate(0.8) hue-rotate(-10deg)` }} />
                      <div className="absolute inset-x-0 top-0 h-48" style={{ background: `linear-gradient(to bottom, transparent, ${accentColor}10, #03020a)` }} />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-xs tracking-widest mb-1" style={{ color: accentColor }}>PROJECT_{String(i + 1).padStart(2, '0')}</div>
                      <h3 className="text-xl font-bold tracking-wide" style={{ textShadow: `0 0 20px ${accentColor}30` }}>{proj.title}</h3>
                      <p className="text-sm text-white/40 mt-1">{proj.role}</p>
                    </div>
                    {proj.links.length > 0 && (
                      <div className="flex gap-2">
                        {proj.links.slice(0, 2).map((l, j) => safeHref(l.url) && (
                          <a key={j} href={safeHref(l.url)!} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs rounded border transition-all hover:scale-105"
                            style={{ borderColor: `${accentColor}40`, color: accentColor, background: `${accentColor}10` }}>
                            <ExternalLink className="h-3 w-3 inline mr-1" />{l.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {proj.tags && <div className="flex flex-wrap gap-1.5 mb-4">{proj.tags.map((t, j) => <span key={j} className="text-xs px-2 py-0.5 rounded-sm" style={{ background: `${NEON_COLORS[j % NEON_COLORS.length]}15`, color: NEON_COLORS[j % NEON_COLORS.length] }}>{t}</span>)}</div>}
                  <div className="grid sm:grid-cols-3 gap-4 text-xs">
                    {[['Problem', proj.problem], ['Process', proj.process], ['Outcome', proj.outcome]].map(([label, val]) => val && (
                      <div key={label}>
                        <div className="tracking-widest mb-1.5 text-white/30">{label.toUpperCase()}</div>
                        <p className="text-white/60 leading-relaxed">{val}</p>
                      </div>
                    ))}
                  </div>
                  {proj.metrics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t" style={{ borderColor: `${accentColor}15` }}>
                      {proj.metrics.map((m, j) => <span key={j} className="text-xs flex items-center gap-1" style={{ color: accentColor }}><Zap className="h-3 w-3" />{m}</span>)}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {categoryOrder.length > 0 && (
        <section id="about" className="max-w-6xl mx-auto px-6 py-24">
          <div className="flex items-center gap-4 mb-12">
            <span style={{ color: accentColor }} className="text-sm tracking-[0.3em]">02.</span>
            <h2 className="text-2xl font-bold tracking-widest uppercase">Stack</h2>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${accentColor}40, transparent)` }} />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryOrder.map((cat, ci) => {
              const neon = NEON_COLORS[ci % NEON_COLORS.length]
              return (
                <motion.div key={cat} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: ci * 0.05 }}
                  className="relative p-5 rounded-xl" style={{ background: `${neon}05`, border: `1px solid ${neon}20` }}>
                  <NeonBorder color={neon} />
                  <div className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: neon }}>{cat}</div>
                  <div className="space-y-2">
                    {skillsByCategory[cat].map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                          <motion.div initial={{ width: 0 }} whileInView={{ width: s.level === 'Expert' ? '95%' : s.level === 'Advanced' ? '78%' : '60%' }}
                            viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.05 }} className="h-full rounded-full" style={{ background: neon, boxShadow: `0 0 6px ${neon}` }} />
                        </div>
                        <span className="text-white/60 shrink-0 w-24 truncate">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
          {bioParagraphs.length > 0 && (
            <div className="mt-12 max-w-2xl">
              {bioParagraphs.slice(0, 2).map((p, i) => (
                <motion.p key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-white/50 text-sm leading-relaxed mb-4">{p}</motion.p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="flex items-center gap-4 mb-12">
            <span style={{ color: accentColor }} className="text-sm tracking-[0.3em]">03.</span>
            <h2 className="text-2xl font-bold tracking-widest uppercase">Experience</h2>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${accentColor}40, transparent)` }} />
          </div>
          <div className="space-y-8">
            {experience.map((exp, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="grid sm:grid-cols-[180px_1fr] gap-4 sm:gap-8 pb-8 border-b" style={{ borderColor: `${accentColor}10` }}>
                <div>
                  <div className="text-xs text-white/30">{exp.period}</div>
                  <div className="text-sm font-bold mt-1" style={{ color: accentColor }}>{exp.company}</div>
                </div>
                <div>
                  <h3 className="text-base font-bold mb-3">{exp.role}</h3>
                  <ul className="space-y-1.5">{exp.bullets.slice(0, 3).map((b, j) => <li key={j} className="text-xs text-white/50 flex gap-2"><span style={{ color: accentColor }} className="mt-0.5">›</span>{b}</li>)}</ul>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {(contact?.email || contact?.linkedin) && (
        <section id="contact" className="max-w-3xl mx-auto px-6 py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-xs tracking-[0.4em] uppercase mb-4" style={{ color: accentColor }}>04. CONTACT</div>
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-8 leading-none" style={{ textShadow: `0 0 60px ${accentColor}40` }}>
              LET&apos;S BUILD<br />SOMETHING
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {contact?.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105" style={{ background: accentColor, color: '#000', boxShadow: `0 0 20px ${accentColor}40` }}><Mail className="h-4 w-4" />{contact.email}</a>}
              {safeHref(contact?.linkedin) && <a href={safeHref(contact.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm border transition-all hover:scale-105" style={{ borderColor: `${accentColor}40`, color: accentColor }}><ExternalLink className="h-4 w-4" />LinkedIn</a>}
              {safeHref(contact?.github) && <a href={safeHref(contact.github)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm border transition-all hover:scale-105" style={{ borderColor: `${accentColor}40`, color: accentColor }}><ExternalLink className="h-4 w-4" />GitHub</a>}
              {safeHref(contact?.website) && <a href={safeHref(contact.website)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm border transition-all hover:scale-105" style={{ borderColor: `${accentColor}40`, color: accentColor }}><ExternalLink className="h-4 w-4" />Website</a>}
            </div>
          </motion.div>
        </section>
      )}

      <footer className="border-t text-center py-6 text-xs" style={{ borderColor: `${accentColor}10`, color: `${accentColor}30` }}>
        &gt;_ BUILT WITH SHOWCASE
      </footer>
    </div>
  )
}
