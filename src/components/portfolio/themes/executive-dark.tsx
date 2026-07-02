'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Mail, ExternalLink, ArrowUpRight, Calendar } from 'lucide-react'
import { cn, safeHref } from '@/lib/utils'
import {
  type ThemeProps,
  normalizePortfolioContent,
  getLevelDot,
  PROJECT_ACCENT_COLORS,
} from './shared'

const FONT = "'Space Grotesk', 'Plus Jakarta Sans', system-ui, sans-serif"

const stagger = (i: number) => ({ initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: i * 0.09 } })

export function ExecutiveDarkTheme({ portfolio, content }: ThemeProps) {
  const {
    hero, about, skills, experience, projects, proof, contact, cta,
    initials, skillsByCategory, categoryOrder, bioParagraphs,
  } = normalizePortfolioContent(portfolio, content)

  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -40])
  const accentColor = (content as { accentColor?: string }).accentColor ?? '#818cf8'

  // Split the portfolio name into words for staggered reveal
  const nameWords = portfolio.title.trim().split(/\s+/)

  return (
    <div ref={containerRef} className="relative min-h-screen text-white overflow-x-hidden" style={{ fontFamily: FONT, background: '#080810' }}>

      {/* Background: radial glow + subtle grid */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0" style={{ background: '#080810' }} />
        <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${accentColor}18, transparent)` }} />
        <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center border-b border-white/[0.05] backdrop-blur-2xl" style={{ background: 'rgba(8,8,16,0.8)' }}>
        <div className="max-w-6xl mx-auto px-6 w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {hero?.headshotUrl
              ? <img src={hero.headshotUrl} alt={portfolio.title} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20" />
              : <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: accentColor }}>{initials}</div>
            }
            <span className="text-sm font-semibold text-white/80 truncate max-w-[180px]">{portfolio.title}</span>
            {portfolio.target_role && <span className="text-xs text-white/30 hidden sm:inline">· {portfolio.target_role}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {safeHref(contact?.linkedin) && (
              <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white border border-white/[0.06] hover:border-white/20 transition-all">
                <ExternalLink className="h-3 w-3" /> LinkedIn
              </a>
            )}
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90" style={{ background: accentColor }}>
                <Mail className="h-3 w-3" /> Contact
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <motion.section style={{ opacity: heroOpacity, y: heroY }} className="relative min-h-[100svh] flex items-center pt-14">
        <div className="max-w-6xl mx-auto px-6 py-24 w-full">
          <div className="grid lg:grid-cols-[1fr_380px] gap-12 items-center">

            {/* Left: name + context */}
            <div>
              {/* Role badge */}
              {(portfolio.target_role || hero?.tagline) && (
                <motion.div {...stagger(0)} className="flex items-center gap-2 mb-8">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
                  <span className="text-xs font-semibold tracking-[0.18em] uppercase text-white/50">
                    {hero?.tagline ?? portfolio.target_role}
                  </span>
                </motion.div>
              )}

              {/* NAME  -  the centerpiece */}
              <div className="mb-8 overflow-hidden">
                {nameWords.map((word, wi) => (
                  <div key={wi} className="overflow-hidden leading-[0.9]">
                    <motion.div
                      initial={{ y: '110%', opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.75, delay: 0.1 + wi * 0.12 }}
                      className="font-bold tracking-tight"
                      style={{
                        fontFamily: "'Syne', 'Space Grotesk', system-ui, sans-serif",
                        fontSize: 'clamp(3.5rem, 9vw, 7rem)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.03em',
                        color: wi === nameWords.length - 1 && nameWords.length > 1 ? 'transparent' : 'white',
                        background: wi === nameWords.length - 1 && nameWords.length > 1
                          ? `linear-gradient(135deg, ${accentColor}, #c4b5fd)`
                          : undefined,
                        WebkitBackgroundClip: wi === nameWords.length - 1 && nameWords.length > 1 ? 'text' : undefined,
                        backgroundClip: wi === nameWords.length - 1 && nameWords.length > 1 ? 'text' : undefined,
                      }}>
                      {word}
                    </motion.div>
                  </div>
                ))}
              </div>

              {/* Positioning headline */}
              {hero?.headline && (
                <motion.p {...stagger(3)} className="text-lg sm:text-xl text-white/50 font-light leading-relaxed max-w-xl mb-8" style={{ fontFamily: FONT }}>
                  {hero.headline}
                </motion.p>
              )}

              {/* CTAs */}
              <motion.div {...stagger(4)} className="flex flex-wrap items-center gap-3">
                {contact?.email && (
                  <a href={`mailto:${contact.email}`} className="group flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]" style={{ background: accentColor }}>
                    <Mail className="h-3.5 w-3.5" />
                    {contact.email}
                    <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                )}
                {safeHref(contact?.linkedin) && (
                  <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-all">
                    <ExternalLink className="h-3.5 w-3.5" /> LinkedIn
                  </a>
                )}
                {safeHref(contact?.github) && (
                  <a href={safeHref(contact?.github)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-all">
                    <ExternalLink className="h-3.5 w-3.5" /> GitHub
                  </a>
                )}
                {safeHref(contact?.website) && (
                  <a href={safeHref(contact?.website)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-all">
                    <ExternalLink className="h-3.5 w-3.5" /> Website
                  </a>
                )}
              </motion.div>
            </div>

            {/* Right: headshot OR proof metrics */}
            <div className="flex flex-col gap-6">
              {hero?.headshotUrl ? (
                <motion.div initial={{ opacity: 0, scale: 0.9, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 2 }} transition={{ delay: 0.4, duration: 0.8 }}
                  className="relative w-full max-w-[340px] mx-auto lg:mx-0">
                  <div className="rounded-2xl overflow-hidden aspect-[4/5]" style={{ boxShadow: `0 30px 80px ${accentColor}25, 0 0 0 1px ${accentColor}20` }}>
                    <img src={hero.headshotUrl} alt={portfolio.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${accentColor}25 0%, transparent 40%)` }} />
                  </div>
                  {/* Floating proof metric */}
                  {proof[0] && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}
                      className="absolute -left-6 bottom-12 px-4 py-3 rounded-xl border border-white/10 backdrop-blur-xl text-center" style={{ background: 'rgba(8,8,16,0.85)' }}>
                      <div className="text-2xl font-black" style={{ color: accentColor }}>{proof[0].value}</div>
                      <div className="text-xs text-white/40 mt-0.5 max-w-[100px]">{proof[0].label}</div>
                    </motion.div>
                  )}
                </motion.div>
              ) : proof.length > 0 ? (
                <motion.div {...stagger(2)} className="grid grid-cols-2 gap-3">
                  {proof.slice(0, 4).map((p, i) => (
                    <div key={i} className="px-5 py-5 rounded-2xl border border-white/[0.07] text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="text-3xl font-black mb-1" style={{ color: accentColor }}>{p.value}</div>
                      <div className="text-xs text-white/40 leading-snug">{p.label}</div>
                    </div>
                  ))}
                </motion.div>
              ) : null}
            </div>
          </div>

          {/* Proof strip (when headshot shown, show metrics below) */}
          {hero?.headshotUrl && proof.length > 0 && (
            <motion.div {...stagger(5)} className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-0 border border-white/[0.06] rounded-2xl overflow-hidden">
              {proof.slice(0, 4).map((p, i) => (
                <div key={i} className={cn('text-center px-6 py-6', i < proof.slice(0, 4).length - 1 && 'border-r border-white/[0.06]')}>
                  <div className="text-3xl font-black mb-1" style={{ color: accentColor }}>{p.value}</div>
                  <div className="text-xs text-white/40">{p.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Scroll hint */}
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2.5 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20">
          <div className="w-5 h-8 rounded-full border border-white/15 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-white/30" />
          </div>
          <span className="text-[10px] tracking-widest uppercase">Scroll</span>
        </motion.div>
      </motion.section>

      {/* ── PROJECTS ── */}
      {projects.length > 0 && (
        <section className="py-32 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-end justify-between mb-16">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: accentColor }}>Selected Work</p>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-none" style={{ fontFamily: "'Syne', system-ui" }}>Projects</h2>
              </div>
              <div className="text-xs text-white/20 hidden sm:block">{projects.length} case {projects.length === 1 ? 'study' : 'studies'}</div>
            </motion.div>

            <div className="space-y-5">
              {projects.map((proj, i) => (
                <motion.article key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="group relative rounded-2xl border border-white/[0.07] overflow-hidden transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>

                  {proj.imageUrl && (
                    <div className="h-52 overflow-hidden">
                      <motion.img whileHover={{ scale: 1.03 }} transition={{ duration: 0.5 }} src={proj.imageUrl} alt={proj.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 top-0 h-52" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(8,8,16,1))' }} />
                    </div>
                  )}

                  <div className="p-8 sm:p-10">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-black text-white/15 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white" style={{ fontFamily: "'Syne', system-ui" }}>{proj.title}</h3>
                        </div>
                        <p className="text-sm text-white/40 font-medium">{proj.role}</p>
                        {proj.summary && <p className="text-sm text-white/50 mt-2 leading-relaxed max-w-xl">{proj.summary}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        {proj.metrics.slice(0, 2).map((m, mi) => (
                          <span key={mi} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: `${accentColor}15`, color: accentColor }}>{m}</span>
                        ))}
                      </div>
                    </div>

                    {proj.tags && proj.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-8">
                        {proj.tags.map((t, ti) => <span key={ti} className="text-[11px] px-2.5 py-1 rounded-full border border-white/[0.07] text-white/40">{t}</span>)}
                      </div>
                    )}

                    {(proj.problem || proj.process || proj.outcome) && (
                      <div className="grid sm:grid-cols-3 gap-5">
                        {proj.problem && (
                          <div className="rounded-xl p-5 border border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.015)' }}>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30 mb-3">Problem</p>
                            <p className="text-sm text-white/55 leading-relaxed">{proj.problem}</p>
                          </div>
                        )}
                        {proj.process && (
                          <div className="rounded-xl p-5 border border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.015)' }}>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30 mb-3">Process</p>
                            <p className="text-sm text-white/55 leading-relaxed">{proj.process}</p>
                          </div>
                        )}
                        {proj.outcome && (
                          <div className="rounded-xl p-5 border" style={{ background: `${accentColor}08`, borderColor: `${accentColor}25` }}>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-3" style={{ color: `${accentColor}80` }}>Outcome</p>
                            <p className="text-sm leading-relaxed font-medium text-white/80">{proj.outcome}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {proj.links.filter(l => safeHref(l.url)).length > 0 && (
                      <div className="flex gap-4 mt-8 pt-6 border-t border-white/[0.05]">
                        {proj.links.filter(l => safeHref(l.url)).map((link, li) => (
                          <a key={li} href={safeHref(link.url)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition-opacity" style={{ color: accentColor }}>
                            <ExternalLink className="h-3 w-3" /> {link.label || 'View project'}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ABOUT ── */}
      {bioParagraphs.length > 0 && (
        <section className="py-32 px-6 border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_300px] gap-16 items-start">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: accentColor }}>About</p>
              <h2 className="text-4xl font-black tracking-tight mb-10 leading-none" style={{ fontFamily: "'Syne', system-ui" }}>Background</h2>
              <div className="space-y-5">
                {bioParagraphs.map((p, i) => (
                  <motion.p key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className={cn('leading-[1.8]', i === 0 ? 'text-lg text-white/80' : 'text-base text-white/50')}>
                    {p}
                  </motion.p>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="lg:sticky lg:top-24 space-y-8">
              {about?.values && about.values.length > 0 && (
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/30 mb-4">Principles</p>
                  <div className="space-y-0">
                    {about.values.map((v, i) => (
                      <div key={i} className="flex items-start gap-3 py-3 border-b border-white/[0.05] last:border-0">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />
                        <p className="text-sm text-white/55 leading-relaxed">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {skills.length > 0 && (
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/30 mb-4">Top Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.slice(0, 12).map((s, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full border" style={{ background: s.level === 'Expert' ? `${accentColor}12` : 'rgba(255,255,255,0.03)', borderColor: s.level === 'Expert' ? `${accentColor}30` : 'rgba(255,255,255,0.07)', color: s.level === 'Expert' ? accentColor : 'rgba(255,255,255,0.5)' }}>{s.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ── EXPERIENCE ── */}
      {experience.length > 0 && (
        <section className="py-32 px-6 border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
              <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: accentColor }}>Career</p>
              <h2 className="text-4xl font-black tracking-tight leading-none" style={{ fontFamily: "'Syne', system-ui" }}>Experience</h2>
            </motion.div>
            <div className="space-y-0">
              {experience.map((exp, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="grid sm:grid-cols-[200px_1fr] gap-6 sm:gap-12 py-10 border-b border-white/[0.05] last:border-0">
                  <div className="sm:text-right">
                    <div className="text-sm font-bold text-white/80 mb-1" style={{ color: accentColor }}>{exp.company}</div>
                    <div className="text-xs text-white/30 flex items-center gap-1.5 sm:justify-end"><Calendar className="h-3 w-3" />{exp.period}</div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4">{exp.role}</h3>
                    <ul className="space-y-2.5">
                      {exp.bullets.slice(0, 4).map((b, bi) => (
                        <li key={bi} className="flex gap-3 text-sm text-white/50 leading-relaxed">
                          <span className="mt-2 w-1 h-1 rounded-full shrink-0" style={{ background: `${accentColor}60` }} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SKILLS GRID ── */}
      {categoryOrder.length > 0 && (
        <section className="py-32 px-6 border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
              <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: accentColor }}>Expertise</p>
              <h2 className="text-4xl font-black tracking-tight leading-none" style={{ fontFamily: "'Syne', system-ui" }}>Skills</h2>
            </motion.div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {categoryOrder.map((cat, ci) => (
                <motion.div key={cat} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: ci * 0.06 }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/30 mb-4">{cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skillsByCategory[cat].map((s, si) => (
                      <span key={si} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs" style={{ background: s.level === 'Expert' ? `${accentColor}12` : 'rgba(255,255,255,0.03)', borderColor: s.level === 'Expert' ? `${accentColor}30` : 'rgba(255,255,255,0.07)', color: s.level === 'Expert' ? accentColor : 'rgba(255,255,255,0.55)' }}>
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getLevelDot(s.level))} />
                        {s.name}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      {(cta || contact?.email) && (
        <section className="py-32 px-6 border-t border-white/[0.05]">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="relative rounded-3xl overflow-hidden border border-white/[0.07] p-12 sm:p-20 text-center"
              style={{ background: 'rgba(255,255,255,0.015)' }}>
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 60% at 50% 0%, ${accentColor}10, transparent)` }} />
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${accentColor}50, transparent)` }} />
              <div className="relative z-10">
                <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 leading-none" style={{ fontFamily: "'Syne', system-ui" }}>
                  {cta?.headline ?? "Let's work together"}
                </h2>
                <p className="text-white/40 text-lg mb-10 max-w-sm mx-auto font-light">Open to the right opportunity. I respond within 24 hours.</p>
                {contact?.email && (
                  <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]" style={{ background: accentColor }}>
                    <Mail className="h-4 w-4" />
                    {cta?.buttonLabel ?? contact.email}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      <footer className="py-8 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-xs text-white/20">
          <span>{portfolio.title}</span>
          <span>Built with Showcase</span>
        </div>
      </footer>
    </div>
  )
}
