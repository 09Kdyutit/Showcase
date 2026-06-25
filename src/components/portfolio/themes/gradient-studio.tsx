'use client'

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'
import { Mail, ExternalLink, ArrowUpRight, Star } from 'lucide-react'
import { safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent, getInitials } from './shared'

const GRAD_PALETTES = [
  ['#f72585', '#7209b7'],
  ['#4cc9f0', '#4361ee'],
  ['#fb8500', '#ffb703'],
  ['#06d6a0', '#118ab2'],
]

export function GradientStudioTheme({ portfolio, content }: ThemeProps) {
  const { hero, about, skills, experience, projects, proof, contact, initials, bioParagraphs, skillsByCategory, categoryOrder } = normalizePortfolioContent(portfolio, content)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const bgRotate = useTransform(scrollYProgress, [0, 1], [0, 45])
  const [activeProject, setActiveProject] = useState(0)
  const accentColor = (content as { accentColor?: string }).accentColor ?? '#f72585'
  const accentEnd = '#7209b7'

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#fafafa] text-[#0a0a0a] overflow-x-hidden">

      {/* Moving gradient background */}
      <motion.div style={{ rotate: bgRotate }} className="fixed -top-[50%] -left-[50%] w-[200%] h-[200%] pointer-events-none -z-10 opacity-[0.07]"
        animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}>
        <div className="absolute inset-0" style={{ background: `conic-gradient(from 0deg, ${accentColor}, ${accentEnd}, #4cc9f0, #06d6a0, ${accentColor})` }} />
      </motion.div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hero?.headshotUrl ? (
              <img src={hero.headshotUrl} alt={portfolio.title} className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentEnd})` }}>{initials}</div>
            )}
            <div>
              <div className="font-black text-sm">{portfolio.title}</div>
              {portfolio.target_role && <div className="text-xs text-black/40">{portfolio.target_role}</div>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="px-4 py-2 rounded-full text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentEnd})` }}>
                Hire me
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="grid lg:grid-cols-[1fr_auto] gap-12 items-end">
          <div>
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8 text-white" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentEnd})` }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {hero?.tagline ?? 'Available for work'}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, type: 'spring', stiffness: 80 }}
              className="text-6xl sm:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
              {hero?.headline?.split(' ').map((word, i, arr) => (
                <span key={i}>
                  {i === arr.length - 1 ? (
                    <span style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentEnd})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{word}</span>
                  ) : <>{word} </>}
                </span>
              )) ?? portfolio.title}
            </motion.h1>
            {hero?.subheadline && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-xl text-black/50 max-w-xl leading-relaxed mb-10">
                {hero.subheadline}
              </motion.p>
            )}
            {proof.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="flex flex-wrap gap-4">
                {proof.slice(0, 4).map((p, i) => (
                  <div key={i} className="group px-4 py-3 rounded-2xl border-2 border-black/5 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-2xl font-black" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentEnd})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{p.value}</div>
                    <div className="text-xs text-black/40">{p.label}</div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
          {hero?.headshotUrl && (
            <motion.div initial={{ opacity: 0, scale: 0.8, rotate: -5 }} animate={{ opacity: 1, scale: 1, rotate: 3 }} transition={{ delay: 0.2, type: 'spring' }}
              className="relative w-64 h-64 rounded-3xl overflow-hidden shadow-2xl self-center lg:self-end" style={{ boxShadow: `20px 20px 60px ${accentColor}30, -10px -10px 40px ${accentEnd}20` }}>
              <img src={hero.headshotUrl} alt={portfolio.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${accentColor}30, transparent)` }} />
            </motion.div>
          )}
        </div>
      </section>

      {/* Projects — Tabbed spotlight */}
      {projects.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: accentColor }}>Selected Work</div>
              <h2 className="text-4xl font-black">Projects</h2>
            </div>
          </div>
          <div className="flex gap-2 mb-6 flex-wrap">
            {projects.map((proj, i) => (
              <button key={i} onClick={() => setActiveProject(i)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeProject === i ? 'text-white scale-105' : 'bg-black/5 text-black/50 hover:bg-black/10'}`}
                style={activeProject === i ? { background: `linear-gradient(135deg, ${accentColor}, ${accentEnd})` } : {}}>
                {proj.title}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            {projects[activeProject] && (
              <motion.div key={activeProject} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }}>
                <div className="rounded-3xl overflow-hidden shadow-xl border border-black/5">
                  {projects[activeProject].imageUrl && (
                    <div className="h-64 overflow-hidden relative">
                      <img src={projects[activeProject].imageUrl!} alt={projects[activeProject].title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${accentColor}20, ${accentEnd}20)` }} />
                    </div>
                  )}
                  <div className="bg-white p-8 sm:p-10">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-3xl font-black mb-1">{projects[activeProject].title}</h3>
                        <p className="text-black/50">{projects[activeProject].role}</p>
                      </div>
                      {projects[activeProject].links.length > 0 && safeHref(projects[activeProject].links[0].url) && (
                        <a href={safeHref(projects[activeProject].links[0].url)!} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm font-bold transition-all hover:scale-105 px-4 py-2 rounded-full text-white"
                          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentEnd})` }}>
                          View <ArrowUpRight className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    {projects[activeProject].tags && (
                      <div className="flex flex-wrap gap-1.5 mb-6">{projects[activeProject].tags!.map((t, j) => (
                        <span key={j} className="px-3 py-1 text-xs font-bold rounded-full" style={{ background: `${GRAD_PALETTES[j % GRAD_PALETTES.length][0]}15`, color: GRAD_PALETTES[j % GRAD_PALETTES.length][0] }}>{t}</span>
                      ))}</div>
                    )}
                    <div className="grid sm:grid-cols-3 gap-6 text-sm mb-6">
                      {[['Problem', projects[activeProject].problem], ['Process', projects[activeProject].process], ['Outcome', projects[activeProject].outcome]].map(([label, text]) => text && (
                        <div key={label}>
                          <div className="text-xs font-black uppercase tracking-wider mb-2 text-black/30">{label}</div>
                          <p className="text-black/65 leading-relaxed text-sm">{text}</p>
                        </div>
                      ))}
                    </div>
                    {projects[activeProject].metrics.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-6 border-t border-black/5">
                        {projects[activeProject].metrics.map((m, j) => (
                          <span key={j} className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: `${accentColor}10`, color: accentColor }}>
                            <Star className="h-3 w-3 fill-current" />{m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Skills + About */}
      {(categoryOrder.length > 0 || bioParagraphs.length > 0) && (
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12">
            {bioParagraphs.length > 0 && (
              <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: accentColor }}>About</div>
                <h2 className="text-3xl font-black mb-6">My story</h2>
                <div className="space-y-4">{bioParagraphs.map((p, i) => <p key={i} className="text-black/60 leading-relaxed">{p}</p>)}</div>
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}>
              <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: accentColor }}>Skills</div>
              <h2 className="text-3xl font-black mb-6">Expertise</h2>
              <div className="space-y-3">
                {skills.slice(0, 10).map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-black/70 w-28 shrink-0">{s.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
                      <motion.div initial={{ width: 0 }} whileInView={{ width: s.level === 'Expert' ? '95%' : s.level === 'Advanced' ? '78%' : '60%' }}
                        viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.04 }} className="h-full rounded-full"
                        style={{ background: `linear-gradient(to right, ${accentColor}, ${accentEnd})` }} />
                    </div>
                    <span className="text-xs text-black/30 w-16 text-right">{s.level}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: accentColor }}>History</div>
          <h2 className="text-3xl font-black mb-10">Experience</h2>
          <div className="space-y-6">
            {experience.map((exp, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="flex gap-6 p-6 rounded-2xl bg-white shadow-sm border border-black/5 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${GRAD_PALETTES[i % GRAD_PALETTES.length][0]}, ${GRAD_PALETTES[i % GRAD_PALETTES.length][1]})` }}>
                  {exp.company[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-black">{exp.role}</h3>
                      <div className="text-sm font-bold" style={{ color: accentColor }}>{exp.company}</div>
                    </div>
                    <div className="text-xs text-black/30 font-medium shrink-0">{exp.period}</div>
                  </div>
                  <ul className="space-y-1 mt-3">{exp.bullets.slice(0, 2).map((b, j) => <li key={j} className="text-sm text-black/55 flex gap-2"><span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: accentColor }} />{b}</li>)}</ul>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {(contact?.email || contact?.linkedin) && (
        <section className="max-w-6xl mx-auto px-6 py-24">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-3xl p-10 sm:p-16 text-center text-white overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentEnd})` }}>
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_50%,white_1px,transparent_1px),radial-gradient(circle_at_70%_50%,white_1px,transparent_1px)] bg-[size:30px_30px]" />
            <h2 className="text-4xl sm:text-5xl font-black mb-4 relative">Let&apos;s work together</h2>
            <p className="text-white/70 mb-8 text-lg relative">Open to new opportunities</p>
            <div className="flex flex-wrap justify-center gap-3 relative">
              {contact?.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-sm transition-transform hover:scale-105"><Mail className="h-4 w-4" />{contact.email}</a>}
              {safeHref(contact?.linkedin) && <a href={safeHref(contact.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 text-white font-bold text-sm border border-white/20 transition-transform hover:scale-105"><ExternalLink className="h-4 w-4" />LinkedIn</a>}
              {safeHref(contact?.github) && <a href={safeHref(contact.github)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 text-white font-bold text-sm border border-white/20 transition-transform hover:scale-105"><ExternalLink className="h-4 w-4" />GitHub</a>}
            </div>
          </motion.div>
        </section>
      )}

      <footer className="border-t border-black/5 py-6 text-center text-xs text-black/20">
        Built with Showcase
      </footer>
    </div>
  )
}
