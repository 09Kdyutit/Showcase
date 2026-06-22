import { Globe, Mail, ArrowRight, ExternalLink, Calendar } from 'lucide-react'
import { cn, safeHref } from '@/lib/utils'
import { Reveal } from '@/components/shared/reveal'
import {
  type ThemeProps,
  normalizePortfolioContent,
  getLevelDot,
  PROJECT_ACCENT_COLORS,
  GRADIENT_TEXT_STYLE,
} from './shared'

/**
 * Executive Dark — restrained premium dark design for engineering, product, finance,
 * consulting, and leadership roles. Strong role positioning, compact proof metrics, serious
 * project presentation (Problem/Process/Outcome cards, not visual flourish).
 */
export function ExecutiveDarkTheme({ portfolio, content }: ThemeProps) {
  const {
    hero, about, skills, experience, projects, proof, contact, cta,
    recruiterSummary, featuredResult, initials, skillsByCategory, categoryOrder, hasContent, bioParagraphs,
  } = normalizePortfolioContent(portfolio, content)

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-brand-500/6 rounded-full blur-3xl" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[400px] bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute top-[50%] left-[-10%] w-[550px] h-[450px] bg-emerald-500/4 rounded-full blur-3xl" />
        <div className="absolute top-[78%] right-[5%] w-[480px] h-[420px] bg-amber-500/[0.035] rounded-full blur-3xl" />
        <div className="absolute bottom-[-5%] left-1/3 w-[600px] h-[400px] bg-brand-500/4 rounded-full blur-3xl" />
      </div>

      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.4)]">
              <span className="text-white text-[11px] font-bold">{initials}</span>
            </div>
            <span className="font-semibold text-sm text-foreground truncate">{portfolio.title}</span>
            {portfolio.target_role && (
              <span className="text-xs text-foreground/65 hidden sm:inline truncate">
                · {portfolio.target_role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {safeHref(contact?.linkedin) && (
              <a
                href={safeHref(contact?.linkedin)}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border transition-all"
              >
                <ExternalLink className="h-3 w-3" />
                LinkedIn
              </a>
            )}
            {contact?.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 text-white text-xs font-semibold shrink-0 hover:opacity-90 transition-opacity shadow-[0_0_16px_rgba(99,102,241,0.3)]"
              >
                <Mail className="h-3 w-3" />
                Get in touch
              </a>
            )}
          </div>
        </div>
      </nav>

      <main>

      <section className="relative overflow-hidden">
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-24">
          <div className="relative mb-8 inline-block">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.35)]">
              <span className="text-white text-3xl font-black">{initials}</span>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 blur-2xl opacity-25 -z-10" />
          </div>

          {hero?.tagline && (
            <p className="text-xs font-bold text-brand-400 uppercase tracking-[0.18em] mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse inline-block" />
              {hero.tagline}
            </p>
          )}

          <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-black tracking-tight leading-[1.04] text-balance max-w-4xl mb-6">
            {hero?.headline ?? portfolio.title}
          </h1>

          {hero?.subheadline && (
            <p className="text-xl text-foreground/60 leading-relaxed max-w-2xl mb-8 font-light">
              {hero.subheadline}
            </p>
          )}

          {featuredResult && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-sm text-emerald-300 font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {featuredResult}
            </div>
          )}

          {contact && Object.values(contact).some(Boolean) && (
            <div className="flex flex-wrap items-center gap-2">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_0_24px_rgba(99,102,241,0.3)]"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {contact.email}
                  <ArrowRight className="h-3 w-3" />
                </a>
              )}
              {safeHref(contact.linkedin) && (
                <a
                  href={safeHref(contact.linkedin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.14] text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              )}
              {safeHref(contact.github) && (
                <a
                  href={safeHref(contact.github)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.14] text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  GitHub
                </a>
              )}
              {safeHref(contact.website) && (
                <a
                  href={safeHref(contact.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.14] text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Website
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {proof.length > 0 && (
        <section className="relative border-y border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <div className={cn(
              'grid gap-0',
              proof.length === 2 ? 'grid-cols-2' :
              proof.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4',
            )}>
              {proof.slice(0, 4).map((p, i) => (
                <div
                  key={p.label}
                  className={cn(
                    'text-center px-6 py-2',
                    i < proof.slice(0, 4).length - 1 && 'border-r border-white/[0.06]',
                  )}
                >
                  <p className="text-[clamp(2rem,4vw,3rem)] font-black tracking-tight mb-2 leading-none" style={GRADIENT_TEXT_STYLE}>
                    {p.value}
                  </p>
                  <p className="text-xs text-foreground/70 font-medium leading-snug max-w-[120px] mx-auto">{p.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {recruiterSummary && (
        <section className="py-8 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Globe className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/70 leading-relaxed">{recruiterSummary}</p>
            </div>
          </div>
        </section>
      )}

      {bioParagraphs.length > 0 && (
        <section className="relative py-24 px-6 overflow-hidden">
          <p aria-hidden className="absolute -top-4 -left-2 text-[180px] font-black text-white/[0.025] leading-none select-none pointer-events-none tabular-nums">00</p>
          <Reveal className="max-w-5xl mx-auto relative">
            <h2 className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.2em] mb-12">About</h2>
            <div className="grid lg:grid-cols-[1fr_260px] gap-16 items-start">
              <div className="space-y-6">
                {bioParagraphs.map((para, i) => (
                  <p key={i} className={cn('leading-[1.85]', i === 0 ? 'text-xl text-foreground/90 font-light' : 'text-base text-foreground/65')}>
                    {para}
                  </p>
                ))}
              </div>
              {about?.values && about.values.length > 0 && (
                <div className="space-y-1 pt-1">
                  <h3 className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.2em] mb-5">Working principles</h3>
                  {about.values.map((v) => (
                    <div key={v} className="flex items-start gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
                      <div className="w-1 h-1 rounded-full bg-brand-500/50 shrink-0 mt-2" />
                      <p className="text-sm text-foreground/60 leading-relaxed">{v}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </section>
      )}

      {projects.length > 0 && (
        <section className="relative py-24 px-6 border-t border-white/[0.05] overflow-hidden">
          <p aria-hidden className="absolute -top-4 right-2 text-[180px] font-black text-white/[0.025] leading-none select-none pointer-events-none tabular-nums">01</p>
          <div className="max-w-5xl mx-auto relative">
            <h2 className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.2em] mb-12">Selected work</h2>
            <div className="space-y-6">
              {projects.slice(0, 5).map((proj, i) => (
                <Reveal key={i} className={cn(i > 0 && 'delay-100')}>
                  <article className={cn(
                    'rounded-2xl border p-8 lg:p-10 transition-all duration-300 hover:shadow-[0_0_40px_rgba(99,102,241,0.06)] hover:-translate-y-0.5',
                    PROJECT_ACCENT_COLORS[i % PROJECT_ACCENT_COLORS.length]
                  )}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-black text-muted-foreground/25 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                          <h3 className="text-2xl font-black text-foreground tracking-tight">{proj.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground/80">
                          {[proj.role, (proj as Record<string, unknown>).company as string, (proj as Record<string, unknown>).year as string].filter(Boolean).join(' · ')}
                        </p>
                        {proj.summary && <p className="text-sm text-foreground/55 mt-2 leading-relaxed max-w-2xl">{proj.summary}</p>}
                      </div>
                      {proj.metrics && proj.metrics.length > 0 && (
                        <div className="flex flex-wrap gap-2 shrink-0 pt-1">
                          {proj.metrics.slice(0, 3).map((m, mi) => (
                            <span key={mi} className={cn(
                              'px-3 py-1.5 rounded-lg border text-xs font-bold',
                              i === 0 ? 'bg-brand-500/10 border-brand-500/20 text-brand-300' :
                              i === 1 ? 'bg-violet-500/10 border-violet-500/20 text-violet-300' :
                              'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
                            )}>
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {proj.tags && proj.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-8">
                        {proj.tags.slice(0, 6).map((t) => (
                          <span key={t} className="px-2.5 py-0.5 bg-white/[0.04] border border-white/[0.07] rounded-full text-[11px] text-muted-foreground/70">{t}</span>
                        ))}
                      </div>
                    )}

                    {(proj.problem || proj.process || proj.outcome) && (
                      <div className="grid sm:grid-cols-3 gap-6">
                        {proj.problem && (
                          <div>
                            <p className="text-[9px] font-black text-muted-foreground/65 uppercase tracking-[0.2em] mb-3">Problem</p>
                            <p className="text-sm text-foreground/55 leading-relaxed">{proj.problem}</p>
                          </div>
                        )}
                        {proj.process && (
                          <div>
                            <p className="text-[9px] font-black text-muted-foreground/65 uppercase tracking-[0.2em] mb-3">Process</p>
                            <p className="text-sm text-foreground/55 leading-relaxed">{proj.process}</p>
                          </div>
                        )}
                        {proj.outcome && (
                          <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/[0.18] p-5">
                            <p className="text-[9px] font-black text-emerald-400/60 uppercase tracking-[0.2em] mb-3">Outcome</p>
                            <p className="text-sm text-foreground/90 leading-relaxed font-medium">{proj.outcome}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {proj.links && proj.links.filter((l) => safeHref(l.url)).length > 0 && (
                      <div className="flex gap-3 mt-8 pt-6 border-t border-white/[0.05]">
                        {proj.links.filter((l) => safeHref(l.url)).map((link, li) => (
                          <a key={li} href={safeHref(link.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors font-semibold">
                            <ExternalLink className="h-3 w-3" />
                            {link.label || 'View project'}
                          </a>
                        ))}
                      </div>
                    )}
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {skills.length > 0 && (
        <section className="relative py-24 px-6 border-t border-white/[0.05] overflow-hidden">
          <p aria-hidden className="absolute -top-4 -left-2 text-[180px] font-black text-white/[0.025] leading-none select-none pointer-events-none tabular-nums">02</p>
          <Reveal className="max-w-5xl mx-auto relative">
            <h2 className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.2em] mb-12">Skills & expertise</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {categoryOrder.map((cat) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-muted-foreground/65 uppercase tracking-[0.15em] mb-4">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {skillsByCategory[cat].map((s) => (
                      <span key={s.name} className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors',
                        s.level === 'Expert' ? 'bg-brand-500/10 border-brand-500/25 text-foreground/90' :
                        s.level === 'Advanced' ? 'bg-violet-500/8 border-violet-500/20 text-foreground/80' :
                        s.level === 'Proficient' ? 'bg-emerald-500/8 border-emerald-500/20 text-foreground/75' :
                        'bg-white/[0.03] border-white/[0.08] text-foreground/60',
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getLevelDot(s.level))} />
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {experience.length > 0 && (
        <section className="relative py-24 px-6 border-t border-white/[0.05] overflow-hidden">
          <p aria-hidden className="absolute -top-4 right-2 text-[180px] font-black text-white/[0.025] leading-none select-none pointer-events-none tabular-nums">03</p>
          <Reveal className="max-w-5xl mx-auto relative">
            <h2 className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.2em] mb-12">Experience</h2>
            <div className="space-y-0">
              {experience.map((exp, i) => (
                <div key={i} className="flex gap-8">
                  <div className="hidden sm:flex flex-col items-center pt-1.5">
                    <div className="w-2 h-2 rounded-full bg-brand-500/50 ring-4 ring-brand-500/10 shrink-0" />
                    {i < experience.length - 1 && <div className="w-px flex-1 bg-gradient-to-b from-brand-500/15 to-transparent min-h-[56px] mt-1" />}
                  </div>
                  <div className={cn('flex-1 pb-12', i === experience.length - 1 && 'pb-0')}>
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-4">
                      <div>
                        <h3 className="font-bold text-foreground text-lg leading-tight">{exp.role}</h3>
                        <span className="text-sm text-muted-foreground/80 font-medium">{exp.company}</span>
                      </div>
                      {exp.period && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 shrink-0 font-medium tabular-nums">
                          <Calendar className="h-3 w-3" />
                          {exp.period}
                        </div>
                      )}
                    </div>
                    {exp.bullets && exp.bullets.length > 0 && (
                      <ul className="space-y-2.5 mb-4">
                        {exp.bullets.map((b, bi) => (
                          <li key={bi} className="flex items-start gap-3 text-sm text-foreground/60 leading-relaxed">
                            <div className="w-1 h-1 rounded-full bg-muted-foreground/20 shrink-0 mt-2.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    {exp.metrics && exp.metrics.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {exp.metrics.map((m, mi) => (
                          <span key={mi} className="text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1 rounded-lg font-semibold">{m}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {(cta || contact?.email) && (
        <section className="py-32 px-6 border-t border-white/[0.05]">
          <Reveal className="max-w-5xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-14 text-center">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(99,102,241,0.07),transparent)]" />
              <div className="relative z-10">
                <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-5 tracking-tight">{cta?.headline ?? "Let's work together"}</h2>
                <p className="text-foreground/50 text-lg mb-10 max-w-md mx-auto font-light">
                  Open to the right conversations. Send a note and I&apos;ll respond within 24 hours.
                </p>
                {contact?.email && (
                  <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold text-base hover:opacity-90 transition-opacity shadow-[0_0_40px_rgba(99,102,241,0.35)]">
                    <Mail className="h-4 w-4" />
                    {cta?.buttonLabel ?? 'Get in touch'}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        </section>
      )}

      </main>

      <footer className="py-8 px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <a href="https://showcase.app" className="flex items-center gap-2 group">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-white text-[9px] font-bold">S</span>
            </div>
            <span className="text-xs text-muted-foreground/65 group-hover:text-muted-foreground/80 transition-colors">Built with Showcase</span>
          </a>
          {!hasContent && <p className="text-xs text-muted-foreground/65">Portfolio coming soon</p>}
          <a href="#" className="text-xs text-muted-foreground/65 hover:text-muted-foreground/80 transition-colors">Back to top ↑</a>
        </div>
      </footer>
    </div>
  )
}
