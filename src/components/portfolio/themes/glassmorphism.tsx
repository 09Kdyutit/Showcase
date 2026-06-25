'use client'

import { motion, useScroll, useTransform, useSpring, useMotionValue, useAnimationFrame } from 'framer-motion'
import { useRef, useState, useCallback } from 'react'
import { Globe, Mail, ExternalLink, ArrowRight } from 'lucide-react'
import { cn, safeHref } from '@/lib/utils'
import { type ThemeProps, normalizePortfolioContent, PROJECT_ACCENT_COLORS } from './shared'

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: y * -12, y: x * 12 })
  }, [])

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      animate={{ rotateX: tilt.x, rotateY: tilt.y }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  )
}

function FloatingOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={cn('absolute rounded-full blur-3xl pointer-events-none', className)}
      animate={{ y: [0, -30, 0], scale: [1, 1.05, 1], opacity: [0.6, 0.8, 0.6] }}
      transition={{ duration: 8 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  )
}

export function GlassmorphismTheme({ portfolio, content }: ThemeProps) {
  const { hero, about, skills, experience, projects, proof, contact, initials, bioParagraphs, hasContent, skillsByCategory, categoryOrder } = normalizePortfolioContent(portfolio, content)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const accentColor = (content as { accentColor?: string }).accentColor ?? '#818cf8'

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#080810] text-white overflow-x-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#080810]" />
        <FloatingOrb className="w-[600px] h-[600px] top-[-100px] left-[-100px] bg-violet-600/20" delay={0} />
        <FloatingOrb className="w-[500px] h-[500px] top-[30%] right-[-80px] bg-indigo-500/15" delay={2} />
        <FloatingOrb className="w-[700px] h-[400px] bottom-[10%] left-[20%] bg-purple-500/10" delay={4} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(129,140,248,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] backdrop-blur-2xl bg-white/[0.03]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hero?.headshotUrl ? (
              <img src={hero.headshotUrl} alt={portfolio.title} className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${accentColor}, #a78bfa)` }}>{initials}</div>
            )}
            <span className="font-semibold text-sm">{portfolio.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all">
                <Mail className="h-3 w-3" /> Contact
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section style={{ y: heroY, opacity: heroOpacity }} className="relative min-h-[90vh] flex items-center justify-center text-center px-6 pt-20 pb-32">
        {hero?.headshotUrl && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: 'spring' }}
            className="absolute top-16 right-1/2 translate-x-1/2 sm:right-24 sm:translate-x-0 w-24 h-24 rounded-full overflow-hidden ring-2 ring-white/10 shadow-2xl">
            <img src={hero.headshotUrl} alt={portfolio.title} className="w-full h-full object-cover" />
          </motion.div>
        )}
        <div className={cn('max-w-3xl mx-auto', hero?.headshotUrl && 'pt-28 sm:pt-0')}>
          {hero?.tagline && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-white/10 bg-white/[0.04] backdrop-blur-sm mb-6">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
              {hero.tagline}
            </motion.div>
          )}
          {/* NAME — the centrepiece */}
          <div className="mb-6">
            {portfolio.title.trim().split(/\s+/).map((word, wi, arr) => (
              <div key={wi} className="overflow-hidden leading-[0.88]">
                <motion.div
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.75, delay: 0.15 + wi * 0.12 }}
                  style={{
                    fontFamily: "'Syne', system-ui, sans-serif",
                    fontSize: 'clamp(3.5rem, 9vw, 7rem)',
                    fontWeight: 800,
                    lineHeight: 0.88,
                    letterSpacing: '-0.03em',
                    background: wi === arr.length - 1 && arr.length > 1
                      ? `linear-gradient(135deg, ${accentColor}, #c4b5fd)`
                      : undefined,
                    WebkitBackgroundClip: wi === arr.length - 1 && arr.length > 1 ? 'text' : undefined,
                    WebkitTextFillColor: wi === arr.length - 1 && arr.length > 1 ? 'transparent' : undefined,
                    backgroundClip: wi === arr.length - 1 && arr.length > 1 ? 'text' : undefined,
                    color: wi === arr.length - 1 && arr.length > 1 ? undefined : 'white',
                  }}>
                  {word}
                </motion.div>
              </div>
            ))}
          </div>
          {hero?.headline && (
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="text-base sm:text-lg text-white/50 max-w-lg mx-auto mb-6 leading-relaxed">
              {hero.headline}
            </motion.p>
          )}
          {hero?.subheadline && (
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="text-lg text-white/60 max-w-xl mx-auto mb-10 leading-relaxed">
              {hero.subheadline}
            </motion.p>
          )}
          {proof.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-3">
              {proof.slice(0, 4).map((p, i) => (
                <div key={i} className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm">
                  <div className="text-xl font-bold" style={{ color: accentColor }}>{p.value}</div>
                  <div className="text-xs text-white/50">{p.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-white/40" />
          </motion.div>
        </div>
      </motion.section>

      {/* Projects */}
      {projects.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12">
            <div className="text-xs font-mono tracking-[0.2em] uppercase mb-3" style={{ color: accentColor }}>Selected Work</div>
            <h2 className="text-3xl sm:text-4xl font-bold">Projects</h2>
          </motion.div>
          <div className="grid gap-6">
            {projects.map((proj, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <TiltCard>
                  <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden" style={{ transform: 'translateZ(0)' }}>
                    <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${accentColor}10, transparent 40%)` }} />
                    {proj.imageUrl && (
                      <div className="relative h-48 sm:h-64 overflow-hidden">
                        <img src={proj.imageUrl} alt={proj.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#080810]" />
                      </div>
                    )}
                    <div className="p-6 sm:p-8">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h3 className="text-xl font-bold mb-1">{proj.title}</h3>
                          <p className="text-sm text-white/50">{proj.role}</p>
                        </div>
                        <span className="text-2xl font-black tabular-nums text-white/10">0{i + 1}</span>
                      </div>
                      {proj.tags && proj.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {proj.tags.map((t, j) => <span key={j} className="px-2 py-0.5 text-xs rounded-md border border-white/10 bg-white/[0.04] text-white/60">{t}</span>)}
                        </div>
                      )}
                      <div className="grid sm:grid-cols-3 gap-4 text-sm">
                        {[['Problem', proj.problem], ['Process', proj.process], ['Outcome', proj.outcome]].map(([label, text]) => text && (
                          <div key={label} className="space-y-1.5">
                            <div className="text-xs font-mono uppercase tracking-wider" style={{ color: accentColor }}>{label}</div>
                            <p className="text-white/60 text-xs leading-relaxed">{text}</p>
                          </div>
                        ))}
                      </div>
                      {proj.metrics.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/[0.06]">
                          {proj.metrics.map((m, j) => <span key={j} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: `${accentColor}15`, color: accentColor }}>{m}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      {bioParagraphs.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="text-xs font-mono tracking-[0.2em] uppercase mb-3" style={{ color: accentColor }}>About</div>
              <h2 className="text-3xl font-bold mb-6">Who I am</h2>
              <div className="space-y-4">{bioParagraphs.map((p, i) => <p key={i} className="text-white/60 leading-relaxed">{p}</p>)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
              className="grid grid-cols-2 gap-3">
              {categoryOrder.slice(0, 4).map((cat) => (
                <div key={cat} className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
                  <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: accentColor }}>{cat}</div>
                  <div className="space-y-1.5">
                    {skillsByCategory[cat].slice(0, 4).map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-white/70">{s.name}</span>
                        <span className="text-white/30">{s.level.slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12">
            <div className="text-xs font-mono tracking-[0.2em] uppercase mb-3" style={{ color: accentColor }}>Career</div>
            <h2 className="text-3xl font-bold">Experience</h2>
          </motion.div>
          <div className="relative pl-6 border-l border-white/[0.08] space-y-10">
            {experience.map((exp, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative">
                <div className="absolute -left-[25px] w-3 h-3 rounded-full border-2 border-white/20" style={{ background: accentColor }} />
                <div className="text-xs text-white/40 mb-1 font-mono">{exp.period}</div>
                <h3 className="text-lg font-semibold">{exp.role}</h3>
                <div className="text-sm mb-3" style={{ color: accentColor }}>{exp.company}</div>
                <ul className="space-y-1.5">{exp.bullets.slice(0, 3).map((b, j) => <li key={j} className="text-sm text-white/55 flex gap-2"><span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: accentColor }} />{b}</li>)}</ul>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {(contact?.email || contact?.linkedin) && (
        <section className="max-w-2xl mx-auto px-6 py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <TiltCard>
              <div className="p-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
                <h2 className="text-3xl font-bold mb-3">Let&apos;s connect</h2>
                <p className="text-white/50 mb-8">Open to the right opportunity.</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {contact?.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-transform hover:scale-105 active:scale-95" style={{ background: accentColor }}><Mail className="h-4 w-4" />{contact.email}</a>}
                  {safeHref(contact?.linkedin) && <a href={safeHref(contact.linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all"><ExternalLink className="h-4 w-4" />LinkedIn</a>}
                  {safeHref(contact?.github) && <a href={safeHref(contact.github)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all"><ExternalLink className="h-4 w-4" />GitHub</a>}
                </div>
              </div>
            </TiltCard>
          </motion.div>
        </section>
      )}

      <footer className="border-t border-white/[0.05] py-6 text-center text-xs text-white/20">
        Built with Showcase
      </footer>
    </div>
  )
}
