import { Mail, ArrowUpRight, Calendar } from 'lucide-react'
import { cn, safeHref } from '@/lib/utils'
import { Reveal } from '@/components/shared/reveal'
import { type ThemeProps, normalizePortfolioContent } from './shared'

/**
 * Clean Editorial — bright, typography-first layout for marketing, consulting, writing,
 * research, and general professional roles. No glow, no gradients, no chip clouds: a single
 * accent color, a serif display face for headlines, and flowing prose case studies instead
 * of grid cards. The opposite design language from Executive Dark on purpose.
 */
export function CleanEditorialTheme({ portfolio, content }: ThemeProps) {
  const {
    hero, about, skills, experience, projects, proof, contact, cta,
    recruiterSummary, featuredResult, categoryOrder, skillsByCategory, hasContent, bioParagraphs,
  } = normalizePortfolioContent(portfolio, content)

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-[#18181b]">
      {/* ── Masthead ───────────────────────────────────────────── */}
      <header className="border-b border-[#18181b]/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-serif text-base font-semibold truncate">{portfolio.title}</p>
            {portfolio.target_role && <p className="text-xs text-[#18181b]/75 truncate">{portfolio.target_role}</p>}
          </div>
          <div className="flex items-center gap-5 shrink-0 text-xs font-medium uppercase tracking-[0.12em]">
            {safeHref(contact?.linkedin) && (
              <a href={safeHref(contact?.linkedin)} target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-[#18181b]/60 hover:text-[#18181b] transition-colors border-b border-transparent hover:border-[#18181b]">
                LinkedIn
              </a>
            )}
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="text-[#18181b] border-b border-[#18181b] pb-0.5">
                Contact
              </a>
            )}
          </div>
        </div>
      </header>

      <main>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16">
        {hero?.tagline && (
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#92400e] mb-6">{hero.tagline}</p>
        )}
        <h1 className="font-serif text-[clamp(2.25rem,5.5vw,4rem)] font-medium leading-[1.08] tracking-tight text-balance mb-8">
          {hero?.headline ?? portfolio.title}
        </h1>
        {hero?.subheadline && (
          <p className="text-lg sm:text-xl leading-relaxed text-[#18181b]/70 border-l-2 border-[#92400e] pl-5 max-w-xl font-light italic">
            {hero.subheadline}
          </p>
        )}
        {featuredResult && (
          <p className="mt-8 text-sm font-semibold tracking-wide">
            <span className="text-[#92400e]">＋</span> {featuredResult}
          </p>
        )}
        {contact?.email && (
          <a href={`mailto:${contact.email}`} className="mt-10 inline-flex items-center gap-2 text-sm font-semibold border-b-2 border-[#18181b] pb-1 hover:gap-3 transition-all">
            <Mail className="h-3.5 w-3.5" />
            {contact.email}
          </a>
        )}
      </section>

      {/* ── Proof metrics — inline, serif numerals, no cards ──── */}
      {proof.length > 0 && (
        <section className="border-y border-[#18181b]/10 bg-[#18181b]/[0.02]">
          <div className="max-w-3xl mx-auto px-6 py-10 flex flex-wrap gap-x-10 gap-y-4">
            {proof.slice(0, 4).map((p) => (
              <div key={p.label}>
                <p className="font-serif text-3xl font-semibold leading-none">{p.value}</p>
                <p className="text-xs text-[#18181b]/75 mt-1.5 uppercase tracking-[0.1em]">{p.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {recruiterSummary && (
        <section className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-sm text-[#18181b]/60 leading-relaxed italic">{recruiterSummary}</p>
        </section>
      )}

      {/* ── About — lede paragraph styling ────────────────────── */}
      {bioParagraphs.length > 0 && (
        <Reveal>
          <section className="max-w-3xl mx-auto px-6 py-16 border-t border-[#18181b]/10">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#18181b]/70 mb-8">About</h2>
            <div className="space-y-5 max-w-2xl">
              {bioParagraphs.map((para, i) => (
                <p key={i} className={cn('leading-[1.8]', i === 0 ? 'font-serif text-2xl leading-[1.4] text-[#18181b]' : 'text-base text-[#18181b]/70')}>
                  {para}
                </p>
              ))}
            </div>
            {about?.values && about.values.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2">
                {about.values.map((v) => (
                  <span key={v} className="text-sm text-[#18181b]/60 before:content-['—_'] before:text-[#92400e]">{v}</span>
                ))}
              </div>
            )}
          </section>
        </Reveal>
      )}

      {/* ── Case studies — flowing prose articles, not grid cards ── */}
      {projects.length > 0 && (
        <section className="border-t border-[#18181b]/10">
          <div className="max-w-3xl mx-auto px-6 py-16">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#18181b]/70 mb-12">Case studies</h2>
            <div className="space-y-20">
              {projects.slice(0, 5).map((proj, i) => (
                <Reveal key={i}>
                  <article className="border-t border-[#18181b]/10 pt-10 first:border-t-0 first:pt-0">
                    <h3 className="font-serif text-3xl font-medium tracking-tight mb-2">{proj.title}</h3>
                    <p className="text-sm text-[#18181b]/75 mb-6">
                      {[proj.role, (proj as Record<string, unknown>).company as string].filter(Boolean).join(' · ')}
                    </p>
                    {proj.summary && <p className="text-lg font-serif text-[#18181b]/80 leading-relaxed mb-6 max-w-2xl">{proj.summary}</p>}

                    <div className="prose-editorial space-y-4 max-w-2xl text-[#18181b]/75 leading-[1.85]">
                      {proj.problem && <p><span className="font-semibold text-[#18181b]">The problem. </span>{proj.problem}</p>}
                      {proj.process && <p><span className="font-semibold text-[#18181b]">The approach. </span>{proj.process}</p>}
                    </div>

                    {proj.outcome && (
                      <p className="mt-6 font-serif text-xl text-[#92400e] border-l-2 border-[#92400e] pl-5 max-w-xl">
                        {proj.outcome}
                      </p>
                    )}

                    {proj.tags && proj.tags.length > 0 && (
                      <p className="mt-6 text-xs uppercase tracking-[0.12em] text-[#18181b]/70">
                        {proj.tags.slice(0, 6).join(' · ')}
                      </p>
                    )}

                    {proj.links && proj.links.filter((l) => safeHref(l.url)).length > 0 && (
                      <div className="flex gap-4 mt-5">
                        {proj.links.filter((l) => safeHref(l.url)).map((link, li) => (
                          <a key={li} href={safeHref(link.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold border-b border-[#18181b] pb-0.5">
                            {link.label || 'View project'}
                            <ArrowUpRight className="h-3 w-3" />
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

      {/* ── Skills — inline grouped lists, not pills ──────────── */}
      {skills.length > 0 && (
        <Reveal>
          <section className="border-t border-[#18181b]/10">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#18181b]/70 mb-10">Capabilities</h2>
              <div className="grid sm:grid-cols-2 gap-8">
                {categoryOrder.map((cat) => (
                  <div key={cat}>
                    <p className="font-serif text-lg font-medium mb-2">{cat}</p>
                    <p className="text-[#18181b]/65 leading-relaxed">
                      {skillsByCategory[cat].map((s) => s.name).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {/* ── Experience — simple CV-style rows ─────────────────── */}
      {experience.length > 0 && (
        <Reveal>
          <section className="border-t border-[#18181b]/10">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#18181b]/70 mb-10">Experience</h2>
              <div className="divide-y divide-[#18181b]/10">
                {experience.map((exp, i) => (
                  <div key={i} className="py-6 first:pt-0 last:pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-3">
                      <h3 className="font-serif text-xl font-medium">{exp.role} <span className="text-[#18181b]/75 font-sans text-base">— {exp.company}</span></h3>
                      {exp.period && (
                        <span className="flex items-center gap-1.5 text-xs text-[#18181b]/70 shrink-0">
                          <Calendar className="h-3 w-3" />
                          {exp.period}
                        </span>
                      )}
                    </div>
                    {exp.bullets && exp.bullets.length > 0 && (
                      <ul className="space-y-1.5 text-[#18181b]/70 leading-relaxed">
                        {exp.bullets.map((b, bi) => <li key={bi}>{b}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {/* ── Contact — colophon style ──────────────────────────── */}
      {(cta || contact?.email) && (
        <Reveal>
          <section className="border-t border-[#18181b]/10">
            <div className="max-w-3xl mx-auto px-6 py-24 text-center">
              <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight mb-4">{cta?.headline ?? "Let's work together"}</h2>
              <p className="text-[#18181b]/60 mb-8 max-w-md mx-auto">
                Open to the right conversations. Send a note and I&apos;ll respond within 24 hours.
              </p>
              {contact?.email && (
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 text-base font-semibold border-b-2 border-[#18181b] pb-1">
                  <Mail className="h-4 w-4" />
                  {cta?.buttonLabel ?? contact.email}
                </a>
              )}
            </div>
          </section>
        </Reveal>
      )}

      </main>

      <footer className="border-t border-[#18181b]/10">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between gap-4 text-xs text-[#18181b]/70">
          <a href="https://showcase.app" className="hover:text-[#18181b]/70 transition-colors">Built with Showcase</a>
          {!hasContent && <p>Portfolio coming soon</p>}
          <a href="#" className="hover:text-[#18181b]/70 transition-colors">Back to top ↑</a>
        </div>
      </footer>
    </div>
  )
}
