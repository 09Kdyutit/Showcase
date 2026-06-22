import { Mail, ArrowUpRight, ExternalLink } from 'lucide-react'
import { cn, safeHref } from '@/lib/utils'
import { Reveal } from '@/components/shared/reveal'
import { type ThemeProps, normalizePortfolioContent } from './shared'

const ACCENTS = [
  { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/25', glow: 'rgba(251,146,60,0.25)', grad: 'from-orange-500 to-pink-500' },
  { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/25', glow: 'rgba(244,114,182,0.25)', grad: 'from-pink-500 to-fuchsia-500' },
  { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', glow: 'rgba(34,211,238,0.25)', grad: 'from-cyan-500 to-blue-500' },
  { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', glow: 'rgba(251,191,36,0.25)', grad: 'from-amber-500 to-orange-500' },
]

/**
 * Creative Case Study — highly visual, project-forward layout for design, branding, creative
 * development, and product design. Bold project navigation, oversized type, vibrant
 * orange/pink/cyan accents (deliberately different hue family from Executive Dark's
 * indigo/violet), and case studies built as alternating asymmetric blocks rather than
 * uniform 3-column cards.
 */
export function CreativeCaseStudyTheme({ portfolio, content }: ThemeProps) {
  const {
    hero, about, skills, experience, projects, proof, contact, cta,
    recruiterSummary, featuredResult, initials, hasContent, bioParagraphs,
  } = normalizePortfolioContent(portfolio, content)

  return (
    <div className="min-h-screen bg-[#0c0a14] text-[#fafaf9]">
      {/* ── Bold project nav rail ──────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#0c0a14]/85 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-black">{initials}</span>
            </div>
            <span className="font-black text-sm uppercase tracking-wide truncate">{portfolio.title}</span>
          </div>
          {projects.length > 0 && (
            <div className="hidden md:flex items-center gap-1 overflow-x-auto">
              {projects.slice(0, 5).map((proj, i) => (
                <a
                  key={i}
                  href={`#project-${i}`}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors', ACCENTS[i % ACCENTS.length].text, 'hover:bg-white/5')}
                >
                  {String(i + 1).padStart(2, '0')} · {proj.title.slice(0, 18)}
                </a>
              ))}
            </div>
          )}
          {contact?.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-bold shrink-0">
              <Mail className="h-3 w-3" />
              Hire me
            </a>
          )}
        </div>
      </nav>

      <main>

      {/* ── Hero — oversized, asymmetric ──────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] bg-gradient-to-br from-orange-500/15 to-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-20">
          {hero?.tagline && (
            <p className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-[0.15em] text-orange-300 mb-8">
              {hero.tagline}
            </p>
          )}
          <h1 className="text-[clamp(2.75rem,7vw,5.5rem)] font-black tracking-tight leading-[0.98] text-balance mb-8 max-w-5xl">
            {hero?.headline ?? portfolio.title}
          </h1>
          {hero?.subheadline && (
            <p className="text-xl sm:text-2xl text-white/55 leading-snug max-w-2xl mb-10 font-medium">
              {hero.subheadline}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {featuredResult && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/15 to-pink-500/15 border border-orange-500/25 text-sm font-bold text-orange-200">
                {featuredResult}
              </span>
            )}
            {safeHref(contact?.website) && (
              <a href={safeHref(contact?.website)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 text-sm font-bold text-white/70 hover:text-white hover:border-white/30 transition-all">
                Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {safeHref(contact?.github) && (
              <a href={safeHref(contact?.github)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 text-sm font-bold text-white/70 hover:text-white hover:border-white/30 transition-all">
                GitHub <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Proof strip — vibrant, rotated accents ────────────── */}
      {proof.length > 0 && (
        <section className="border-y border-white/[0.08] bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-6 py-12 flex flex-wrap gap-8">
            {proof.slice(0, 4).map((p, i) => (
              <div key={p.label} className="flex items-baseline gap-3">
                <p className={cn('text-4xl font-black tracking-tight', ACCENTS[i % ACCENTS.length].text)}>{p.value}</p>
                <p className="text-xs text-white/65 font-semibold uppercase tracking-wide max-w-[100px]">{p.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {recruiterSummary && (
        <section className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-sm text-white/50 leading-relaxed max-w-2xl">{recruiterSummary}</p>
        </section>
      )}

      {/* ── About ──────────────────────────────────────────────── */}
      {bioParagraphs.length > 0 && (
        <Reveal>
          <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.08]">
            <div className="grid lg:grid-cols-[120px_1fr] gap-10">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">About</h2>
              <div className="space-y-5 max-w-2xl">
                {bioParagraphs.map((para, i) => (
                  <p key={i} className={cn('leading-relaxed', i === 0 ? 'text-xl text-white/90 font-medium' : 'text-base text-white/55')}>{para}</p>
                ))}
                {about?.values && about.values.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {about.values.map((v, i) => (
                      <span key={v} className={cn('px-3 py-1 rounded-full text-xs font-bold border', ACCENTS[i % ACCENTS.length].bg, ACCENTS[i % ACCENTS.length].border, ACCENTS[i % ACCENTS.length].text)}>
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {/* ── Case studies — alternating asymmetric blocks ──────── */}
      {projects.length > 0 && (
        <section className="border-t border-white/[0.08]">
          {projects.slice(0, 5).map((proj, i) => {
            const accent = ACCENTS[i % ACCENTS.length]
            const flip = i % 2 === 1
            return (
              <Reveal key={i}>
                <article id={`project-${i}`} className="relative border-b border-white/[0.08] overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{ background: `radial-gradient(ellipse 60% 50% at ${flip ? '85%' : '15%'} 30%, ${accent.glow}, transparent)` }}
                  />
                  <div className={cn('relative max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-start', flip && 'lg:[&>*:first-child]:order-2')}>
                    <div className={cn('rounded-3xl aspect-[4/3] bg-gradient-to-br flex items-end p-8', accent.grad)}>
                      <span className="text-white/90 text-7xl font-black tracking-tighter">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <p className={cn('text-xs font-black uppercase tracking-[0.2em] mb-3', accent.text)}>
                        {[proj.role, (proj as Record<string, unknown>).company as string].filter(Boolean).join(' · ') || 'Case study'}
                      </p>
                      <h3 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">{proj.title}</h3>
                      {proj.summary && <p className="text-white/60 leading-relaxed mb-6">{proj.summary}</p>}

                      {proj.tags && proj.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-6">
                          {proj.tags.slice(0, 6).map((t) => (
                            <span key={t} className="px-2.5 py-1 bg-white/[0.06] border border-white/10 rounded-full text-[11px] font-semibold text-white/60">{t}</span>
                          ))}
                        </div>
                      )}

                      <div className="space-y-4 text-sm text-white/55 leading-relaxed">
                        {proj.problem && <p><span className="font-bold text-white/80">Problem — </span>{proj.problem}</p>}
                        {proj.process && <p><span className="font-bold text-white/80">Process — </span>{proj.process}</p>}
                      </div>

                      {proj.outcome && (
                        <p className={cn('mt-6 text-lg font-bold rounded-2xl px-5 py-4 border', accent.bg, accent.border)}>
                          {proj.outcome}
                        </p>
                      )}

                      {proj.metrics && proj.metrics.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {proj.metrics.slice(0, 3).map((m, mi) => (
                            <span key={mi} className={cn('px-3 py-1 rounded-lg text-xs font-bold', accent.bg, accent.text)}>{m}</span>
                          ))}
                        </div>
                      )}

                      {proj.links && proj.links.filter((l) => safeHref(l.url)).length > 0 && (
                        <div className="flex gap-4 mt-6">
                          {proj.links.filter((l) => safeHref(l.url)).map((link, li) => (
                            <a key={li} href={safeHref(link.url)} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1.5 text-sm font-bold', accent.text)}>
                              {link.label || 'View project'}
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </Reveal>
            )
          })}
        </section>
      )}

      {/* ── Skills — compact, de-emphasized relative to projects ── */}
      {skills.length > 0 && (
        <Reveal>
          <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/[0.08]">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-6">Tools & skills</h2>
            <div className="flex flex-wrap gap-2">
              {skills.map((s, i) => (
                <span key={s.name} className={cn('px-3 py-1.5 rounded-full text-sm font-semibold border', ACCENTS[i % ACCENTS.length].bg, ACCENTS[i % ACCENTS.length].border, ACCENTS[i % ACCENTS.length].text)}>
                  {s.name}
                </span>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* ── Experience — compact rows, projects stay the star ─── */}
      {experience.length > 0 && (
        <Reveal>
          <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/[0.08]">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-6">Experience</h2>
            <div className="space-y-3">
              {experience.map((exp, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-3 border-b border-white/[0.06] last:border-0">
                  <p className="font-bold text-white/85">{exp.role} <span className="text-white/65 font-medium">— {exp.company}</span></p>
                  {exp.period && <p className="text-xs text-white/35 shrink-0">{exp.period}</p>}
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* ── Contact — bold colorful CTA ────────────────────────── */}
      {(cta || contact?.email) && (
        <Reveal>
          <section className="border-t border-white/[0.08]">
            <div className="max-w-6xl mx-auto px-6 py-24">
              <div className="rounded-3xl bg-gradient-to-br from-orange-500/15 via-pink-500/10 to-transparent border border-white/10 p-14 text-center">
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-5">{cta?.headline ?? "Let's make something great"}</h2>
                <p className="text-white/50 text-lg mb-10 max-w-md mx-auto">
                  Open to the right conversations. Send a note and I&apos;ll respond within 24 hours.
                </p>
                {contact?.email && (
                  <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-base hover:opacity-90 transition-opacity">
                    <Mail className="h-4 w-4" />
                    {cta?.buttonLabel ?? 'Get in touch'}
                  </a>
                )}
              </div>
            </div>
          </section>
        </Reveal>
      )}

      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between gap-4 text-xs text-white/60">
          <a href="https://showcase.app" className="hover:text-white/60 transition-colors">Built with Showcase</a>
          {!hasContent && <p>Portfolio coming soon</p>}
          <a href="#" className="hover:text-white/60 transition-colors">Back to top ↑</a>
        </div>
      </footer>
    </div>
  )
}
