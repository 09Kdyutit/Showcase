import { ArrowRight, CheckCircle2, FileText, LayoutTemplate } from 'lucide-react'
import { HERO } from '@/lib/marketing/positioning'
import { TrackedLink } from './tracked-link'

const TRUST = [
  'No credit card required',
  'Private until you publish',
  'Review every AI-assisted change',
]

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden px-6 pb-24 pt-36 sm:pb-28 sm:pt-40"
      style={{
        background: 'radial-gradient(120% 100% at 18% 0%, #244aa8 0%, #17377e 34%, #0c2154 68%, #071433 100%)',
      }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: 'absolute', top: '-20%', left: '-8%', width: 620, height: 620, background: 'rgba(96,165,250,0.28)', filter: 'blur(130px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-30%', right: '-8%', width: 560, height: 560, background: 'rgba(99,102,241,0.22)', filter: 'blur(140px)', borderRadius: '50%' }} />
      </div>
      <div className="absolute inset-0 pointer-events-none hero-grid opacity-30" />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="max-w-2xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
            {HERO.eyebrow}
          </p>
          <h1
            className="text-balance font-semibold text-white"
            style={{
              fontFamily: 'var(--font-fraunces), Georgia, serif',
              fontSize: 'clamp(3rem, 6.4vw, 5.5rem)',
              lineHeight: 0.98,
              letterSpacing: '-0.035em',
            }}
          >
            {HERO.headline}
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-blue-100/80 sm:text-lg">
            {HERO.subheadline}
          </p>
          <p className="mt-4 text-sm font-medium text-blue-100/70">
            Built for students, recent graduates, and early-career job seekers.
          </p>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
            <TrackedLink
              href="/signup"
              event="hero_primary_cta_clicked"
              ctaLabel="hero_primary"
              className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]"
              style={{ background: 'linear-gradient(120deg, #3b82f6, #4f46e5)', boxShadow: '0 12px 36px rgba(59,130,246,0.42)' }}
            >
              {HERO.primaryCta.live}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </TrackedLink>
            <TrackedLink
              href="#how-it-works"
              event="hero_secondary_cta_clicked"
              ctaLabel="see_how"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-200/25 bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-blue-50 transition-colors hover:bg-white/[0.1]"
            >
              {HERO.secondaryCta}
            </TrackedLink>
          </div>

          <div className="mt-7 flex flex-col gap-2 text-sm text-blue-100/70 sm:flex-row sm:flex-wrap sm:gap-x-5">
            {TRUST.map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-300" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl" aria-label="Illustration of a résumé becoming a portfolio">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-blue-400/10 blur-3xl" />
          <div className="relative grid gap-4 rounded-[2rem] border border-blue-200/20 bg-[#071433]/70 p-4 shadow-2xl backdrop-blur-xl sm:grid-cols-[0.82fr_auto_1.18fr] sm:items-center sm:p-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-200/70">
                <FileText className="h-4 w-4" />
                Résumé
              </div>
              <div className="space-y-2">
                <div className="h-2 w-2/3 rounded-full bg-white/30" />
                <div className="h-1.5 w-full rounded-full bg-white/15" />
                <div className="h-1.5 w-5/6 rounded-full bg-white/15" />
              </div>
              <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-relaxed text-blue-50/70">
                Internal tooling used by 40 people weekly. Improved CI pipeline and cut deploy time 30%.
              </div>
            </div>

            <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-blue-300 sm:rotate-0" aria-hidden="true" />

            <div className="overflow-hidden rounded-2xl border border-blue-300/25 bg-[#0b1a45]">
              <div className="bg-gradient-to-r from-blue-500/35 to-indigo-500/30 px-4 py-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-100/80">
                  <LayoutTemplate className="h-4 w-4" />
                  Editable portfolio
                </div>
                <p className="mt-3 text-lg font-semibold text-white">Jordan Chen</p>
                <p className="text-xs text-blue-100/70">Software Engineer</p>
              </div>
              <div className="grid gap-2 p-4">
                {['Clear case studies', 'Results made easy to scan', 'Private draft you control'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-blue-50/80">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] uppercase tracking-[0.15em] text-blue-200/45">
            Illustrative product example
          </p>
        </div>
      </div>
    </section>
  )
}
