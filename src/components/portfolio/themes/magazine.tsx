'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Mail, ArrowUpRight, ExternalLink } from 'lucide-react'
import { cn, safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent } from './shared'

const DISPLAY = "'DM Serif Display', Georgia, serif"
const SANS = "'Plus Jakarta Sans', system-ui, sans-serif"

// Scrolling ticker with category text
function Ticker({ items }: { items: string[] }) {
  const all = [...items, ...items]
  return (
    <div className="overflow-hidden border-y border-black/10" style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
      <div className="flex items-center py-3 whitespace-nowrap" style={{ animation: 'tickerRoll 28s linear infinite' }}>
        {all.map((item, i) => (
          <span key={i} className="text-xs font-bold uppercase tracking-[0.2em] text-black/40 px-8">{item}</span>
        ))}
      </div>
      <style>{`@keyframes tickerRoll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  )
}

// Big editorial section number
function SectionNum({ n }: { n: string }) {
  return <span className="text-[9px] font-black uppercase tracking-[0.25em] opacity-30 mr-4">({n})</span>
}

export function MagazineTheme({ portfolio, content }: ThemeProps) {
  const { hero, about, skills, experience, projects, proof, contact, initials, bioParagraphs, categoryOrder, skillsByCategory } = normalizePortfolioContent(portfolio, content)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const parallaxY = useTransform(scrollYProgress, [0, 0.3], [0, -80])
  const accentColor = (content as { accentColor?: string }).accentColor ?? '#e85d2a'
  const nameWords = portfolio.title.trim().split(/\s+/)

  return (
    <div ref={containerRef} className="min-h-screen text-black overflow-x-hidden" style={{ fontFamily: SANS, background: '#f7f3ee' }}>

      {/* Nav  -  full-width editorial header */}
      <nav className="sticky top-0 z-50 border-b border-black/10 bg-[#f7f3ee]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hero?.headshotUrl
              ? <img src={hero.headshotUrl} alt={portfolio.title} className="w-7 h-7 rounded-full object-cover" />
              : <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: accentColor }}>{initials}</div>
            }
            <span className="text-sm font-bold" style={{ fontFamily: SANS }}>{portfolio.title}</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-black/40">
            {['Work', 'About', 'Contact'].map(s => (
              <a key={s} href={`#${s.toLowerCase()}`} className="hover:text-black transition-colors">{s}</a>
            ))}
          </div>
          {contact?.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black text-white transition-all hover:scale-105" style={{ background: accentColor }}>
              <Mail className="h-3 w-3" /> Say hello
            </a>
          )}
        </div>
      </nav>

      {/* ── HERO ── Editorial spread */}
      <section className="min-h-[95svh] flex flex-col justify-end px-6 pt-16 pb-10 relative overflow-hidden">

        {/* Hero photo  -  fills top right quadrant */}
        {hero?.headshotUrl && (
          <motion.div style={{ y: parallaxY }} className="absolute top-0 right-0 w-[45%] h-full pointer-events-none">
            <img src={hero.headshotUrl} alt={portfolio.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #f7f3ee 0%, transparent 40%)' }} />
          </motion.div>
        )}

        {/* Background if no photo */}
        {!hero?.headshotUrl && (
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 70% 30%, ${accentColor}12 0%, transparent 60%)` }} />
          </div>
        )}

        <div className="max-w-7xl mx-auto w-full relative z-10">
          {/* Availability badge */}
          {hero?.tagline && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="flex items-center gap-2 mb-10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40">{hero.tagline}</span>
            </motion.div>
          )}

          {/* ROLE in editorial sans */}
          {portfolio.target_role && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
              className="text-xs font-black uppercase tracking-[0.3em] text-black/30 mb-6">{portfolio.target_role}</motion.div>
          )}

          {/* NAME  -  large editorial serif */}
          <div className="mb-8 max-w-[65%]">
            {nameWords.map((word, wi) => (
              <div key={wi} className="overflow-hidden">
                <motion.div
                  initial={{ y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.85, delay: 0.15 + wi * 0.1 }}
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 'clamp(4.5rem, 9vw, 8rem)',
                    lineHeight: 0.9,
                    letterSpacing: '-0.02em',
                    fontStyle: wi === nameWords.length - 1 && nameWords.length > 1 ? 'italic' : 'normal',
                    color: wi === nameWords.length - 1 && nameWords.length > 1 ? accentColor : 'black',
                  }}>
                  {word}
                </motion.div>
              </div>
            ))}
          </div>

          {/* Positioning line */}
          {hero?.headline && (
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="text-lg text-black/50 max-w-md leading-relaxed mb-8 font-light" style={{ fontFamily: SANS }}>
              {hero.headline}
            </motion.p>
          )}

          {/* Proof strip */}
          {proof.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="flex flex-wrap gap-8 mb-8 pt-8 border-t border-black/10">
              {proof.slice(0, 4).map((p, i) => (
                <div key={i}>
                  <div className="text-2xl font-black" style={{ fontFamily: DISPLAY }}>{p.value}</div>
                  <div className="text-xs text-black/40 font-medium">{p.label}</div>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }} className="flex items-center gap-3">
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="group flex items-center gap-2 px-6 py-3 rounded-full text-sm font-black text-white transition-all hover:scale-105" style={{ background: accentColor }}>
                <Mail className="h-3.5 w-3.5" /> {contact.email} <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}
            {safeHref(contact?.linkedin) && (
              <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold border border-black/15 hover:border-black/30 text-black/60 hover:text-black transition-all">
                <ExternalLink className="h-3.5 w-3.5" /> LinkedIn
              </a>
            )}
          </motion.div>
        </div>
      </section>

      {/* Ticker */}
      {skills.length > 0 && <Ticker items={skills.map(s => s.name)} />}

      {/* ── PROJECTS ── Magazine spreads */}
      {projects.length > 0 && (
        <section id="work" className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-baseline gap-4 mb-16 pb-4 border-b border-black/10">
              <SectionNum n="01" />
              <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(2.5rem, 4vw, 3.5rem)' }}>Selected Work</h2>
            </div>

            <div className="space-y-20">
              {projects.map((proj, i) => {
                const isEven = i % 2 === 0
                return (
                  <motion.article key={i} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.05 * i }}
                    className={cn('grid gap-10 items-start', proj.imageUrl ? 'lg:grid-cols-[1fr_1fr]' : 'lg:grid-cols-[320px_1fr]')}>

                    {/* Image or number placeholder */}
                    <div className={cn(!isEven && 'lg:order-2')}>
                      {proj.imageUrl ? (
                        <div className="aspect-[4/3] overflow-hidden rounded-xl">
                          <motion.img whileHover={{ scale: 1.04 }} transition={{ duration: 0.6 }} src={proj.imageUrl} alt={proj.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-[4/3] rounded-xl flex items-center justify-center border border-black/8" style={{ background: `${accentColor}08` }}>
                          <span style={{ fontFamily: DISPLAY, fontSize: '5rem', color: `${accentColor}30`, fontStyle: 'italic' }}>{String(i + 1).padStart(2, '0')}</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className={cn('flex flex-col justify-center', !isEven && 'lg:order-1')}>
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/25 mb-3">{String(i + 1).padStart(2, '0')} / {proj.role}</div>
                      <h3 className="mb-3 leading-tight" style={{ fontFamily: DISPLAY, fontSize: 'clamp(2rem, 3.5vw, 2.8rem)' }}>{proj.title}</h3>

                      {proj.tags && (
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {proj.tags.map((t, ti) => (
                            <span key={ti} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: `${accentColor}15`, color: accentColor }}>{t}</span>
                          ))}
                        </div>
                      )}

                      <div className="space-y-4 mb-6">
                        {proj.problem && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-black/25 mb-1.5">Challenge</p>
                            <p className="text-sm text-black/60 leading-relaxed">{proj.problem}</p>
                          </div>
                        )}
                        {proj.outcome && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-black/25 mb-1.5">Result</p>
                            <p className="text-sm font-semibold text-black/80 leading-relaxed">{proj.outcome}</p>
                          </div>
                        )}
                      </div>

                      {proj.metrics.length > 0 && (
                        <div className="flex flex-wrap gap-5 mb-6 py-4 border-t border-b border-black/8">
                          {proj.metrics.slice(0, 3).map((m, mi) => (
                            <div key={mi}>
                              <div className="text-xl font-black" style={{ color: accentColor, fontFamily: DISPLAY }}>{m.split(' ')[0]}</div>
                              <div className="text-[10px] text-black/40 font-medium">{m.split(' ').slice(1).join(' ')}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {proj.links.filter(l => safeHref(l.url)).length > 0 && (
                        <a href={safeHref(proj.links.find(l => safeHref(l.url))?.url)!} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-black hover:gap-3 transition-all" style={{ color: accentColor }}>
                          View project <ArrowUpRight className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </motion.article>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── ABOUT ── */}
      {bioParagraphs.length > 0 && (
        <section id="about" className="py-20 px-6 border-t border-black/8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-baseline gap-4 mb-16 pb-4 border-b border-black/10">
              <SectionNum n="02" />
              <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(2.5rem, 4vw, 3.5rem)' }}>About</h2>
            </div>

            <div className="grid lg:grid-cols-[1fr_380px] gap-16">
              <div className="space-y-5">
                {bioParagraphs.map((p, i) => (
                  <p key={i} className={cn('leading-[1.85]', i === 0 ? 'text-xl text-black/80' : 'text-base text-black/55')}>{p}</p>
                ))}
              </div>

              <div className="space-y-8">
                {/* Skills by category */}
                {categoryOrder.slice(0, 3).map(cat => (
                  <div key={cat}>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-black/30 mb-3">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(skillsByCategory[cat] ?? []).map((s, si) => (
                        <span key={si} className="text-xs px-3 py-1.5 rounded-full border border-black/10 text-black/60 font-medium">{s.name}</span>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Experience */}
                {experience.length > 0 && (
                  <div className="pt-6 border-t border-black/8">
                    {experience.slice(0, 3).map((exp, i) => (
                      <div key={i} className={cn('pb-5 mb-5 border-b border-black/[0.06] last:border-0 last:mb-0 last:pb-0')}>
                        <div className="font-bold text-sm text-black">{exp.role}</div>
                        <div className="text-xs text-black/40 mb-2">{exp.company} · {exp.period}</div>
                        {exp.bullets[0] && <p className="text-xs text-black/50 leading-relaxed">{exp.bullets[0]}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT ── */}
      {contact?.email && (
        <section id="contact" className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="rounded-3xl overflow-hidden relative" style={{ background: accentColor }}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 3px)' }} />
              <div className="relative z-10 p-12 sm:p-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60 mb-4">(03) Contact</div>
                  <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', color: 'white', lineHeight: 0.9 }}>
                    Let&apos;s work<br /><em>together.</em>
                  </h2>
                </div>
                <div className="flex flex-col gap-3">
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 px-8 py-4 rounded-full text-sm font-black bg-white hover:scale-105 transition-transform" style={{ color: accentColor }}>
                    <Mail className="h-4 w-4" /> {contact.email}
                  </a>
                  {safeHref(contact?.linkedin) && (
                    <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-8 py-4 rounded-full text-sm font-bold border-2 border-white/30 text-white hover:border-white transition-all">
                      <ExternalLink className="h-4 w-4" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      <footer className="border-t border-black/8 py-6 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-black/30">
          <span style={{ fontFamily: DISPLAY, fontSize: '1rem' }}>{portfolio.title}</span>
          <span style={{ fontFamily: SANS }}>Built with Showcase</span>
        </div>
      </footer>
    </div>
  )
}
