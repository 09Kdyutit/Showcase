'use client'

import { motion } from 'framer-motion'
import { Mail, ArrowUpRight, ExternalLink, Calendar } from 'lucide-react'
import { cn, safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent } from './shared'

const DISPLAY = "'DM Serif Display', 'Georgia', serif"
const SANS = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay },
})

export function CleanEditorialTheme({ portfolio, content }: ThemeProps) {
  const { hero, about, skills, experience, projects, proof, contact, cta, categoryOrder, skillsByCategory, bioParagraphs } = normalizePortfolioContent(portfolio, content)
  const accentColor = (content as { accentColor?: string }).accentColor ?? '#0a0a0a'
  const nameWords = portfolio.title.trim().split(/\s+/)

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#0a0a0a] overflow-x-hidden" style={{ fontFamily: SANS }}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-black/8 backdrop-blur-xl" style={{ background: 'rgba(250,249,247,0.92)' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {hero?.headshotUrl
              ? <img src={hero.headshotUrl} alt={portfolio.title} className="w-7 h-7 rounded-full object-cover ring-1 ring-black/10" />
              : <div className="w-7 h-7 rounded-full border border-black/15 flex items-center justify-center text-[10px] font-bold">{portfolio.title.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
            }
            <span className="text-sm font-semibold truncate max-w-[180px]">{portfolio.title}</span>
            {portfolio.target_role && <span className="text-xs text-black/35 hidden sm:inline">· {portfolio.target_role}</span>}
          </div>
          <div className="flex items-center gap-5 shrink-0 text-xs font-medium">
            {safeHref(contact?.linkedin) && <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-black/50 hover:text-black transition-colors border-b border-transparent hover:border-black/30 pb-0.5">LinkedIn</a>}
            {contact?.email && <a href={`mailto:${contact.email}`} className="text-black border-b border-black pb-0.5 hover:text-black/70 transition-colors">Contact</a>}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20">
        <div className="grid lg:grid-cols-[1fr_auto] gap-16 items-start">
          <div>
            {/* Availability badge */}
            {hero?.tagline && (
              <motion.div {...reveal(0)} className="flex items-center gap-2 mb-10">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">{hero.tagline}</span>
              </motion.div>
            )}

            {/* NAME  -  big editorial serif */}
            <div className="mb-8">
              {nameWords.map((word, wi) => (
                <div key={wi} className="overflow-hidden">
                  <motion.div
                    initial={{ y: '105%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: 0.05 + wi * 0.12 }}
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 'clamp(3.5rem, 8vw, 6.5rem)',
                      lineHeight: 0.95,
                      letterSpacing: '-0.02em',
                      fontStyle: wi === nameWords.length - 1 && nameWords.length > 1 ? 'italic' : 'normal',
                      color: wi === nameWords.length - 1 && nameWords.length > 1 ? accentColor : '#0a0a0a',
                    }}>
                    {word}
                  </motion.div>
                </div>
              ))}
            </div>

            {/* Rule + role */}
            <motion.div {...reveal(0.4)} className="flex items-center gap-4 mb-8">
              <div className="h-px flex-1 max-w-[60px] bg-black/20" />
              <p className="text-sm text-black/40 font-medium">{portfolio.target_role ?? 'Professional'}</p>
            </motion.div>

            {/* Positioning */}
            {hero?.headline && (
              <motion.p {...reveal(0.5)} className="text-xl sm:text-2xl text-black/60 leading-[1.5] max-w-2xl mb-10 font-light" style={{ fontFamily: DISPLAY, fontStyle: 'italic' }}>
                &quot;{hero.headline}&quot;
              </motion.p>
            )}

            {/* Contacts */}
            <motion.div {...reveal(0.6)} className="flex flex-wrap gap-3">
              {contact?.email && (
                <a href={`mailto:${contact.email}`} className="group flex items-center gap-2 px-5 py-3 rounded-xl bg-black text-white text-sm font-semibold hover:bg-black/80 transition-all">
                  <Mail className="h-3.5 w-3.5" /> {contact.email} <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              )}
              {safeHref(contact?.linkedin) && <a href={safeHref(contact?.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl border border-black/15 text-sm text-black/60 hover:text-black hover:border-black/30 transition-all"><ExternalLink className="h-3.5 w-3.5" />LinkedIn</a>}
              {safeHref(contact?.github) && <a href={safeHref(contact?.github)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl border border-black/15 text-sm text-black/60 hover:text-black hover:border-black/30 transition-all"><ExternalLink className="h-3.5 w-3.5" />GitHub</a>}
              {safeHref(contact?.website) && <a href={safeHref(contact?.website)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl border border-black/15 text-sm text-black/60 hover:text-black hover:border-black/30 transition-all"><ExternalLink className="h-3.5 w-3.5" />Website</a>}
            </motion.div>
          </div>

          {/* Headshot */}
          {hero?.headshotUrl && (
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
              className="relative w-72 aspect-[3/4] rounded-2xl overflow-hidden shrink-0 hidden lg:block shadow-xl"
              style={{ transform: 'rotate(-2deg)' }}>
              <img src={hero.headshotUrl} alt={portfolio.title} className="w-full h-full object-cover" />
            </motion.div>
          )}
        </div>

        {/* Proof metrics */}
        {proof.length > 0 && (
          <motion.div {...reveal(0.7)} className="mt-16 grid grid-cols-2 sm:grid-cols-4 divide-x divide-black/10 border border-black/10 rounded-2xl overflow-hidden">
            {proof.slice(0, 4).map((p, i) => (
              <div key={i} className="text-center py-7 px-4">
                <div className="text-3xl font-black mb-1" style={{ fontFamily: DISPLAY, color: accentColor }}>{p.value}</div>
                <div className="text-xs text-black/40">{p.label}</div>
              </div>
            ))}
          </motion.div>
        )}
      </section>

      {/* ── PROJECTS ── */}
      {projects.length > 0 && (
        <section className="border-t border-black/8 py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/35 mb-3">Selected Work</p>
              <h2 className="text-4xl font-medium leading-tight" style={{ fontFamily: DISPLAY }}>Case Studies</h2>
            </motion.div>

            <div className="space-y-5">
              {projects.map((proj, i) => (
                <motion.article key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="group border border-black/8 rounded-2xl overflow-hidden hover:border-black/20 transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ background: '#fff' }}>
                  {proj.imageUrl && (
                    <div className="h-52 overflow-hidden">
                      <motion.img whileHover={{ scale: 1.03 }} transition={{ duration: 0.5 }} src={proj.imageUrl} alt={proj.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-8 sm:p-10">
                    <div className="flex items-start justify-between gap-6 mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs text-black/20 font-black tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                          <h3 className="text-2xl font-medium" style={{ fontFamily: DISPLAY }}>{proj.title}</h3>
                        </div>
                        <p className="text-sm text-black/45">{proj.role}</p>
                      </div>
                      {proj.links.filter(l => safeHref(l.url)).length > 0 && (
                        <a href={safeHref(proj.links.find(l => safeHref(l.url))?.url)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-semibold border-b border-black/20 pb-0.5 hover:border-black transition-colors shrink-0">
                          View <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {proj.tags && <div className="flex flex-wrap gap-1.5 mb-6">{proj.tags.map((t, ti) => <span key={ti} className="text-[11px] px-2.5 py-1 rounded-full bg-black/[0.04] text-black/50">{t}</span>)}</div>}

                    <div className="grid sm:grid-cols-3 gap-6 text-sm mb-6">
                      {[['Problem', proj.problem], ['Process', proj.process], ['Outcome', proj.outcome]].map(([label, text]) => text && (
                        <div key={label}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/30 mb-2">{label}</p>
                          <p className="text-black/65 leading-relaxed">{text}</p>
                        </div>
                      ))}
                    </div>

                    {proj.metrics.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-5 border-t border-black/8">
                        {proj.metrics.map((m, mi) => <span key={mi} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">{m}</span>)}
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
        <section className="border-t border-black/8 py-24 px-6">
          <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_280px] gap-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/35 mb-3">About</p>
              <h2 className="text-4xl font-medium mb-10 leading-tight" style={{ fontFamily: DISPLAY }}>The story</h2>
              <div className="space-y-5">
                {bioParagraphs.map((p, i) => (
                  <p key={i} className={cn('leading-[1.85]', i === 0 ? 'text-lg text-black/80' : 'text-base text-black/55')}>{p}</p>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="lg:sticky lg:top-24 space-y-8">
              {about?.values && about.values.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-black/30 mb-4">Principles</p>
                  <div className="space-y-0">
                    {about.values.map((v, i) => (
                      <div key={i} className="py-3 border-b border-black/8 last:border-0">
                        <p className="text-sm text-black/60 leading-relaxed">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {skills.slice(0, 12).length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-black/30 mb-4">Stack</p>
                  <div className="space-y-2">
                    {skills.slice(0, 10).map((s, i) => (
                      <div key={i} className="flex justify-between text-sm py-1.5 border-b border-black/5 last:border-0">
                        <span className="text-black/70">{s.name}</span>
                        <span className="text-black/30 text-xs">{s.level}</span>
                      </div>
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
        <section className="border-t border-black/8 py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/35 mb-3">History</p>
            <h2 className="text-4xl font-medium mb-16 leading-tight" style={{ fontFamily: DISPLAY }}>Experience</h2>
            <div className="space-y-0">
              {experience.map((exp, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="grid sm:grid-cols-[180px_1fr] gap-4 sm:gap-12 py-10 border-b border-black/8 last:border-0">
                  <div className="sm:text-right">
                    <div className="text-sm font-semibold text-black/80 mb-0.5" style={{ color: accentColor !== '#0a0a0a' ? accentColor : undefined }}>{exp.company}</div>
                    <div className="text-xs text-black/35 flex items-center gap-1 sm:justify-end"><Calendar className="h-3 w-3" />{exp.period}</div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: DISPLAY }}>{exp.role}</h3>
                    <ul className="space-y-2">{exp.bullets.slice(0, 3).map((b, bi) => <li key={bi} className="text-sm text-black/55 leading-relaxed flex gap-2.5"><span className="mt-2 w-1 h-1 rounded-full bg-black/25 shrink-0" />{b}</li>)}</ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      {(cta || contact?.email) && (
        <section className="border-t border-black/8 py-24 px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-5xl mx-auto text-center">
            <h2 className="text-5xl sm:text-7xl font-medium mb-6 leading-none" style={{ fontFamily: DISPLAY, fontStyle: 'italic' }}>
              {cta?.headline ?? "Let's talk."}
            </h2>
            <p className="text-black/40 text-lg mb-10">Open to new opportunities  -  I&apos;d love to hear what you&apos;re building.</p>
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-black text-white text-base font-semibold hover:bg-black/80 transition-all hover:scale-[1.02]">
                <Mail className="h-4 w-4" /> {cta?.buttonLabel ?? contact.email} <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </motion.div>
        </section>
      )}

      <footer className="border-t border-black/8 py-6 px-6">
        <div className="max-w-5xl mx-auto flex justify-between text-xs text-black/25">
          <span>{portfolio.title}</span>
          <span>Built with Showcase</span>
        </div>
      </footer>
    </div>
  )
}
