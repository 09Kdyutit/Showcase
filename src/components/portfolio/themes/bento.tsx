'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Mail, ArrowUpRight, ExternalLink, MapPin } from 'lucide-react'
import { cn, safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent } from './shared'

const FONT = "'Space Grotesk', system-ui, sans-serif"

// Infinite horizontal marquee via CSS animation
function Marquee({ items, speed = 40 }: { items: string[]; speed?: number }) {
  const repeated = [...items, ...items, ...items]
  return (
    <div className="overflow-hidden w-full py-4" style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
      <div className="flex whitespace-nowrap" style={{ animation: `marquee ${speed}s linear infinite` }}>
        {repeated.map((item, i) => (
          <span key={i} className="text-sm font-medium px-6 py-2 rounded-full border border-white/10 mx-2 text-white/60 shrink-0">
            {item}
          </span>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }`}</style>
    </div>
  )
}

function BentoCard({ children, className = '', span = 1, tall = false }: {
  children: React.ReactNode; className?: string; span?: 1 | 2; tall?: boolean
}) {
  return (
    <div className={cn(
      'rounded-2xl border border-white/[0.07] relative overflow-hidden',
      span === 2 && 'col-span-2',
      tall && 'row-span-2',
      className,
    )}
      style={{ background: 'rgba(255,255,255,0.025)' }}>
      {children}
    </div>
  )
}

export function BentoTheme({ portfolio, content }: ThemeProps) {
  const { hero, about, skills, experience, projects, proof, contact, initials, bioParagraphs } = normalizePortfolioContent(portfolio, content)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const nameY = useTransform(scrollYProgress, [0, 0.15], [0, -30])
  const accentColor = (content as { accentColor?: string }).accentColor ?? '#a3e635'
  const nameWords = portfolio.title.trim().split(/\s+/)

  return (
    <div ref={containerRef} className="min-h-screen text-white overflow-x-hidden" style={{ fontFamily: FONT, background: '#080c08' }}>

      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: '#080c08' }} />
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse 60% 40% at 20% 20%, ${accentColor}20, transparent)` }} />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-white/[0.06] backdrop-blur-xl" style={{ background: 'rgba(8,12,8,0.85)' }}>
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {hero?.headshotUrl
              ? <img src={hero.headshotUrl} alt={portfolio.title} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/15" />
              : <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: accentColor, color: '#000' }}>{initials}</div>
            }
            <span className="text-sm font-semibold">{portfolio.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {safeHref(contact?.linkedin) && <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="text-xs text-white/40 hover:text-white transition-colors hidden sm:block">LinkedIn</a>}
            {contact?.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105" style={{ background: accentColor, color: '#000' }}>Let&apos;s talk</a>}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-[100svh] flex flex-col justify-center pt-14 px-6 pb-6">
        <div className="max-w-7xl mx-auto w-full">

          {/* Top: name */}
          <motion.div style={{ y: nameY }} className="mb-8">
            {hero?.tagline && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">{hero.tagline}</span>
              </motion.div>
            )}

            <div className="overflow-hidden">
              {nameWords.map((word, wi) => (
                <div key={wi} className="overflow-hidden leading-[0.85]">
                  <motion.div
                    initial={{ y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1 + wi * 0.1 }}
                    style={{
                      fontFamily: "'Syne', 'Space Grotesk', system-ui",
                      fontSize: 'clamp(4.5rem, 12vw, 9rem)',
                      fontWeight: 800,
                      lineHeight: 0.85,
                      letterSpacing: '-0.04em',
                      color: wi % 2 === 1 ? accentColor : 'white',
                    }}>
                    {word}
                  </motion.div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Bento grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[160px] gap-3">

            {/* Role card  -  2 cols */}
            <BentoCard span={2} className="flex flex-col justify-end p-6 lg:p-7">
              <p className="text-xs text-white/30 font-medium mb-1 uppercase tracking-widest">Role</p>
              <p className="text-xl font-bold leading-tight">{portfolio.target_role ?? 'Creative Professional'}</p>
              {hero?.subheadline && <p className="text-sm text-white/50 mt-2 leading-relaxed line-clamp-2">{hero.subheadline}</p>}
            </BentoCard>

            {/* Headshot  -  tall (if available) or proof metric */}
            {hero?.headshotUrl ? (
              <BentoCard tall className="row-span-2">
                <img src={hero.headshotUrl} alt={portfolio.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${accentColor}30 0%, transparent 50%)` }} />
              </BentoCard>
            ) : proof[0] ? (
              <BentoCard className="flex flex-col items-center justify-center p-6">
                <div className="text-4xl font-black mb-1" style={{ color: accentColor }}>{proof[0].value}</div>
                <div className="text-xs text-white/40 text-center">{proof[0].label}</div>
              </BentoCard>
            ) : null}

            {/* Available card */}
            <BentoCard className="flex flex-col items-start justify-between p-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Available</span>
              </div>
              {contact?.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-sm font-bold hover:opacity-70 transition-opacity" style={{ color: accentColor }}>
                  Contact <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </BentoCard>

            {/* Proof metrics */}
            {proof.slice(hero?.headshotUrl ? 0 : 1, hero?.headshotUrl ? 2 : 3).map((p, i) => (
              <BentoCard key={i} className="flex flex-col items-center justify-center p-5">
                <div className="text-3xl font-black mb-1" style={{ color: accentColor }}>{p.value}</div>
                <div className="text-xs text-white/40 text-center leading-snug">{p.label}</div>
              </BentoCard>
            ))}

            {/* About snippet */}
            {bioParagraphs[0] && (
              <BentoCard span={2} className="p-6 lg:p-7 flex flex-col justify-end">
                <p className="text-xs text-white/30 font-medium mb-2 uppercase tracking-widest">About</p>
                <p className="text-sm text-white/65 leading-relaxed line-clamp-3">{bioParagraphs[0]}</p>
              </BentoCard>
            )}

            {/* Location / links */}
            <BentoCard className="flex flex-col justify-between p-5">
              <MapPin className="h-5 w-5 text-white/20" />
              <div className="space-y-2">
                {safeHref(contact?.linkedin) && <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"><ExternalLink className="h-3 w-3" />LinkedIn</a>}
                {safeHref(contact?.github) && <a href={safeHref(contact?.github)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"><ExternalLink className="h-3 w-3" />GitHub</a>}
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* Skills Marquee */}
      {skills.length > 0 && (
        <section className="border-y border-white/[0.06] py-2">
          <Marquee items={skills.map(s => s.name)} speed={35} />
        </section>
      )}

      {/* ── PROJECTS ── */}
      {projects.length > 0 && (
        <section className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-end justify-between mb-12">
              <h2 className="font-black tracking-tight leading-none" style={{ fontFamily: "'Syne', system-ui", fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
                Work<span style={{ color: accentColor }}>.</span>
              </h2>
              <span className="text-xs text-white/30">{projects.length} projects</span>
            </motion.div>

            {/* Projects: alternating large/small bento */}
            <div className="space-y-4">
              {projects.map((proj, i) => {
                const isFeature = i === 0
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                    <div className={cn('rounded-2xl border border-white/[0.07] overflow-hidden group', isFeature ? 'grid lg:grid-cols-2' : '')} style={{ background: 'rgba(255,255,255,0.02)' }}>
                      {proj.imageUrl && (
                        <div className={cn('overflow-hidden', isFeature ? 'min-h-[300px]' : 'h-52')}>
                          <motion.img whileHover={{ scale: 1.04 }} transition={{ duration: 0.6 }} src={proj.imageUrl} alt={proj.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-7 sm:p-9 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                              <span className="text-xs font-black tabular-nums text-white/15 block mb-1">{String(i + 1).padStart(2, '0')}</span>
                              <h3 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Syne', system-ui" }}>{proj.title}</h3>
                              <p className="text-sm text-white/40 mt-1">{proj.role}</p>
                            </div>
                            {proj.links.filter(l => safeHref(l.url)).length > 0 && (
                              <a href={safeHref(proj.links.find(l => safeHref(l.url))?.url)!} target="_blank" rel="noopener noreferrer"
                                className="p-2.5 rounded-xl border border-white/10 hover:border-white/30 transition-all hover:scale-110 shrink-0" style={{ color: accentColor }}>
                                <ArrowUpRight className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                          {proj.tags && <div className="flex flex-wrap gap-1.5 mb-5">{proj.tags.map((t, ti) => <span key={ti} className="text-[11px] px-2.5 py-1 rounded-full border border-white/[0.07] text-white/40">{t}</span>)}</div>}
                          <div className="grid grid-cols-3 gap-4">
                            {[['Problem', proj.problem], ['Process', proj.process], ['Outcome', proj.outcome]].map(([label, text]) => text && (
                              <div key={label}>
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-1.5">{label}</p>
                                <p className="text-xs text-white/55 leading-relaxed">{(text as string).slice(0, 120)}{(text as string).length > 120 ? '…' : ''}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        {proj.metrics.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/[0.05]">
                            {proj.metrics.map((m, mi) => <span key={mi} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: `${accentColor}15`, color: accentColor }}>{m}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── ABOUT + EXPERIENCE ── */}
      {(bioParagraphs.length > 0 || experience.length > 0) && (
        <section className="py-24 px-6 border-t border-white/[0.05]">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16">
            {bioParagraphs.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="text-3xl font-black tracking-tight mb-8" style={{ fontFamily: "'Syne', system-ui" }}>About<span style={{ color: accentColor }}>.</span></h2>
                <div className="space-y-4">{bioParagraphs.map((p, i) => <p key={i} className={cn('leading-[1.8]', i === 0 ? 'text-lg text-white/80' : 'text-sm text-white/50')}>{p}</p>)}</div>
              </motion.div>
            )}
            {experience.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
                <h2 className="text-3xl font-black tracking-tight mb-8" style={{ fontFamily: "'Syne', system-ui" }}>Career<span style={{ color: accentColor }}>.</span></h2>
                <div className="space-y-6">
                  {experience.map((exp, i) => (
                    <div key={i} className="flex gap-4 pb-6 border-b border-white/[0.05] last:border-0">
                      <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-[11px] font-black" style={{ background: accentColor, color: '#000' }}>{exp.company[0]}</div>
                      <div>
                        <div className="font-bold text-sm">{exp.role}</div>
                        <div className="text-xs text-white/40 mb-2">{exp.company} · {exp.period}</div>
                        <ul className="space-y-1">{exp.bullets.slice(0, 2).map((b, bi) => <li key={bi} className="text-xs text-white/45 leading-relaxed">{b}</li>)}</ul>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      {contact?.email && (
        <section className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="rounded-3xl p-12 sm:p-20 relative overflow-hidden border border-white/[0.07]"
              style={{ background: `${accentColor}10` }}>
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 100% at 50% 100%, ${accentColor}15, transparent)` }} />
              <div className="relative z-10 text-center">
                <h2 className="font-black tracking-tight mb-4 leading-none" style={{ fontFamily: "'Syne', system-ui", fontSize: 'clamp(3rem, 7vw, 6rem)' }}>
                  Let&apos;s build<br /><span style={{ color: accentColor }}>something.</span>
                </h2>
                <p className="text-white/40 text-lg mb-10">Open to the right opportunity.</p>
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-base font-black transition-all hover:scale-105 active:scale-95" style={{ background: accentColor, color: '#000' }}>
                  <Mail className="h-4 w-4" /> {contact.email} <ArrowUpRight className="h-5 w-5" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      <footer className="border-t border-white/[0.05] py-6 px-6">
        <div className="max-w-7xl mx-auto flex justify-between text-xs text-white/20">
          <span style={{ fontFamily: "'Syne', system-ui", fontWeight: 700 }}>{portfolio.title}</span>
          <span>Built with Showcase</span>
        </div>
      </footer>
    </div>
  )
}
