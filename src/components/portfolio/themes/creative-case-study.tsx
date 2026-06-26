'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Mail, ArrowUpRight, ExternalLink } from 'lucide-react'
import { safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent } from './shared'

const DISPLAY = "'Syne', 'Space Grotesk', system-ui, sans-serif"
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif"

const ACCENTS = ['#f97316', '#ec4899', '#06b6d4', '#f59e0b', '#8b5cf6']

export function CreativeCaseStudyTheme({ portfolio, content }: ThemeProps) {
  const { hero, about, skills, experience, projects, proof, contact, cta, initials, bioParagraphs, categoryOrder, skillsByCategory } = normalizePortfolioContent(portfolio, content)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const nameX = useTransform(scrollYProgress, [0, 0.15], [0, -60])
  const accentColor = (content as { accentColor?: string }).accentColor ?? '#f97316'
  const nameWords = portfolio.title.trim().split(/\s+/)

  return (
    <div ref={containerRef} className="min-h-screen text-[#fafaf9] overflow-x-hidden" style={{ fontFamily: BODY, background: '#0c0a14' }}>

      {/* Background texture */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0" style={{ background: '#0c0a14' }} />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(249,115,22,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(139,92,246,0.08) 0%, transparent 50%)' }} />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 backdrop-blur-xl border-b border-white/[0.07]" style={{ background: 'rgba(12,10,20,0.85)' }}>
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {hero?.headshotUrl
              ? <img src={hero.headshotUrl} alt={portfolio.title} className="w-8 h-8 rounded-full object-cover" style={{ outline: `2px solid ${accentColor}` }} />
              : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: accentColor }}>{initials}</div>
            }
            <span className="text-sm font-black uppercase tracking-wide truncate" style={{ fontFamily: DISPLAY }}>{portfolio.title}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {safeHref(contact?.linkedin) && <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"><ExternalLink className="h-3 w-3" />LinkedIn</a>}
            {contact?.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-black transition-all hover:scale-105" style={{ background: accentColor }}><Mail className="h-3 w-3" />Contact</a>}
          </div>
        </div>
      </nav>

      {/* ── HERO ── Full viewport */}
      <section className="relative min-h-[100svh] flex items-center pt-16">
        <div className="max-w-6xl mx-auto px-6 py-24 w-full">
          <div className="grid lg:grid-cols-[1fr_320px] gap-12 items-center">
            <div>
              {/* Role */}
              {hero?.tagline && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-3 mb-10">
                  <div className="h-px w-8" style={{ background: accentColor }} />
                  <span className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: accentColor }}>{hero.tagline}</span>
                </motion.div>
              )}

              {/* NAME  -  massive stacked */}
              <motion.div style={{ x: nameX }} className="mb-8">
                {nameWords.map((word, wi) => (
                  <div key={wi} className="overflow-hidden leading-[0.88]">
                    <motion.div
                      initial={{ y: '110%', opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.9, delay: 0.08 + wi * 0.15 }}
                      style={{
                        fontFamily: DISPLAY,
                        fontSize: 'clamp(4rem, 10vw, 8rem)',
                        fontWeight: 800,
                        lineHeight: 0.88,
                        letterSpacing: '-0.04em',
                        color: wi === nameWords.length - 1 && nameWords.length > 1 ? accentColor : '#fafaf9',
                      }}>
                      {word}
                    </motion.div>
                  </div>
                ))}
              </motion.div>

              {/* Headline */}
              {hero?.subheadline && (
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                  className="text-lg text-white/50 leading-relaxed max-w-xl mb-10 font-light">
                  {hero.subheadline}
                </motion.p>
              )}

              {/* CTAs */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="flex flex-wrap gap-3">
                {contact?.email && (
                  <a href={`mailto:${contact.email}`} className="group flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-black hover:scale-105 transition-transform" style={{ background: accentColor }}>
                    <Mail className="h-3.5 w-3.5" /> {contact.email} <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                )}
                {safeHref(contact?.linkedin) && <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-full text-sm border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all"><ExternalLink className="h-3.5 w-3.5" />LinkedIn</a>}
              </motion.div>
            </div>

            {/* Right: headshot OR proof */}
            {hero?.headshotUrl ? (
              <motion.div initial={{ opacity: 0, scale: 0.85, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: -3 }} transition={{ delay: 0.3, duration: 0.9 }}
                className="hidden lg:block relative w-full aspect-[3/4] rounded-2xl overflow-hidden"
                style={{ boxShadow: `0 0 0 1px ${accentColor}30, 0 40px 80px ${accentColor}20` }}>
                <img src={hero.headshotUrl} alt={portfolio.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${accentColor}30 0%, transparent 50%)` }} />
                {proof[0] && (
                  <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl backdrop-blur-xl border border-white/10" style={{ background: 'rgba(12,10,20,0.8)' }}>
                    <div className="text-2xl font-black" style={{ color: accentColor, fontFamily: DISPLAY }}>{proof[0].value}</div>
                    <div className="text-xs text-white/40">{proof[0].label}</div>
                  </div>
                )}
              </motion.div>
            ) : proof.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-2 gap-3">
                {proof.slice(0, 4).map((p, i) => (
                  <div key={i} className="p-5 rounded-2xl border border-white/[0.07] text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-3xl font-black mb-1" style={{ color: ACCENTS[i % ACCENTS.length], fontFamily: DISPLAY }}>{p.value}</div>
                    <div className="text-xs text-white/35">{p.label}</div>
                  </div>
                ))}
              </motion.div>
            ) : null}
          </div>

          {/* Proof strip (when headshot) */}
          {hero?.headshotUrl && proof.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="mt-20 flex flex-wrap gap-4">
              {proof.slice(0, 4).map((p, i) => (
                <div key={i} className="px-6 py-4 rounded-2xl border border-white/[0.07]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="text-2xl font-black" style={{ color: ACCENTS[i % ACCENTS.length], fontFamily: DISPLAY }}>{p.value}</div>
                  <div className="text-xs text-white/35 mt-0.5">{p.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ── PROJECTS ── */}
      {projects.length > 0 && (
        <section className="py-32 px-6 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
              <p className="text-xs font-bold tracking-[0.25em] uppercase mb-4" style={{ color: accentColor }}>Portfolio</p>
              <h2 className="text-5xl font-black tracking-tight leading-none" style={{ fontFamily: DISPLAY }}>Selected Work</h2>
            </motion.div>
            <div className="space-y-6">
              {projects.map((proj, i) => {
                const color = ACCENTS[i % ACCENTS.length]
                return (
                  <motion.article key={i} id={`proj-${i}`} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="rounded-2xl border overflow-hidden" style={{ borderColor: `${color}25`, background: `${color}04` }}>
                    {proj.imageUrl && (
                      <div className="h-60 overflow-hidden">
                        <motion.img whileHover={{ scale: 1.04 }} transition={{ duration: 0.5 }} src={proj.imageUrl} alt={proj.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-8 sm:p-10">
                      <div className="flex items-start justify-between gap-6 mb-6">
                        <div>
                          <div className="text-xs font-black tracking-widest mb-2" style={{ color }}>CASE STUDY {String(i + 1).padStart(2, '0')}</div>
                          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white" style={{ fontFamily: DISPLAY }}>{proj.title}</h3>
                          <p className="text-sm text-white/40 mt-1">{proj.role}</p>
                        </div>
                        {proj.links.filter(l => safeHref(l.url)).length > 0 && (
                          <a href={safeHref(proj.links.find(l => safeHref(l.url))?.url)!} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-black shrink-0 transition-transform hover:scale-105"
                            style={{ background: color }}>
                            View <ArrowUpRight className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {proj.tags && <div className="flex flex-wrap gap-1.5 mb-6">{proj.tags.map((t, ti) => <span key={ti} className="text-[11px] px-2.5 py-1 rounded-full text-white/40 border border-white/[0.07]">{t}</span>)}</div>}
                      <div className="grid sm:grid-cols-3 gap-5 text-sm mb-6">
                        {[['Problem', proj.problem], ['Process', proj.process], ['Outcome', proj.outcome]].map(([label, text]) => text && (
                          <div key={label} className="p-4 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">{label}</p>
                            <p className="text-white/55 leading-relaxed text-sm">{text}</p>
                          </div>
                        ))}
                      </div>
                      {proj.metrics.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-white/[0.05]">
                          {proj.metrics.map((m, mi) => <span key={mi} className="text-xs font-bold px-3 py-1.5 rounded-full text-black" style={{ background: color }}>{m}</span>)}
                        </div>
                      )}
                    </div>
                  </motion.article>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── ABOUT + SKILLS ── */}
      {(bioParagraphs.length > 0 || categoryOrder.length > 0) && (
        <section className="py-32 px-6 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-16">
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <p className="text-xs font-bold tracking-[0.25em] uppercase mb-4" style={{ color: accentColor }}>About</p>
                <h2 className="text-4xl font-black tracking-tight mb-10 leading-none" style={{ fontFamily: DISPLAY }}>Who I am</h2>
                <div className="space-y-5">{bioParagraphs.map((p, i) => <p key={i} className={`leading-[1.8] ${i === 0 ? 'text-lg text-white/80' : 'text-white/50'}`}>{p}</p>)}</div>
              </motion.div>
              {experience.length > 0 && (
                <div className="mt-16">
                  <p className="text-xs font-bold tracking-[0.25em] uppercase mb-8 text-white/30">Experience</p>
                  <div className="space-y-8">
                    {experience.map((exp, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                        className="flex gap-5 pb-8 border-b border-white/[0.05] last:border-0">
                        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-xs font-black text-black" style={{ background: ACCENTS[i % ACCENTS.length] }}>{exp.company[0]}</div>
                        <div>
                          <div className="font-black text-white text-sm" style={{ fontFamily: DISPLAY }}>{exp.role}</div>
                          <div className="text-xs mb-2" style={{ color: ACCENTS[i % ACCENTS.length] }}>{exp.company} · {exp.period}</div>
                          <ul className="space-y-1">{exp.bullets.slice(0, 2).map((b, bi) => <li key={bi} className="text-xs text-white/45 leading-relaxed">{b}</li>)}</ul>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="lg:sticky lg:top-24 space-y-6">
              {categoryOrder.map((cat, ci) => (
                <div key={cat}>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25 mb-3">{cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skillsByCategory[cat].map((s, si) => (
                      <span key={si} className="text-xs px-2.5 py-1 rounded-full border text-white/50" style={{ borderColor: `${ACCENTS[ci % ACCENTS.length]}30`, background: `${ACCENTS[ci % ACCENTS.length]}08` }}>{s.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      {(cta || contact?.email) && (
        <section className="py-32 px-6 border-t border-white/[0.06]">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-6xl mx-auto text-center">
            <h2 className="text-5xl sm:text-7xl font-black tracking-tight mb-6 leading-none" style={{ fontFamily: DISPLAY, color: accentColor }}>
              {cta?.headline ?? "Let's create."}
            </h2>
            <p className="text-white/40 text-xl mb-10 font-light">Ready to build something great together?</p>
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-base font-bold text-black hover:scale-105 transition-transform" style={{ background: accentColor }}>
                <Mail className="h-4 w-4" /> {cta?.buttonLabel ?? contact.email} <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </motion.div>
        </section>
      )}

      <footer className="border-t border-white/[0.05] py-6 px-6">
        <div className="max-w-6xl mx-auto flex justify-between text-xs text-white/20">
          <span style={{ fontFamily: DISPLAY }}>{portfolio.title}</span>
          <span>Built with Showcase</span>
        </div>
      </footer>
    </div>
  )
}
