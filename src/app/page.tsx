import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { AnimatedSection } from '@/components/landing/animated-section'
import { StickyMobileCTA } from '@/components/landing/sticky-mobile-cta'
import { FaqAccordion } from '@/components/landing/faq-accordion'
import { TrackedSection } from '@/components/landing/tracked-section'
import { TrackedLink } from '@/components/landing/tracked-link'
import { ViewTracker } from '@/components/landing/view-tracker'
import { SectionLabel } from '@/components/shared/section-label'
import { HeroSection } from '@/components/landing/hero-section'
import { ConnectedJourney } from '@/components/landing/connected-journey'
import { ResumeTransformation } from '@/components/landing/resume-transformation'
import { FeatureBento } from '@/components/landing/feature-bento'
import { TrustSection } from '@/components/landing/trust-section'

const FREE_FEATURES = [
  'Upload a PDF or DOCX, or paste your résumé',
  'Create your first editable portfolio draft',
  'Build, edit, and privately preview for free',
  'One complete 11-dimension Evidence Audit every 24 hours',
] as const

const PRO_FEATURES = [
  'Everything in Free',
  'Publish a live portfolio when you are ready',
  'Regenerate portfolios and use higher daily limits',
  '10 complete 11-dimension Evidence Audits every 24 hours',
] as const

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <div className="grain-overlay" aria-hidden="true" />

      <Navbar />
      <StickyMobileCTA />
      <ViewTracker event="landing_viewed" metadata={{ route: '/' }} />

      <main>
        <HeroSection />

        <AnimatedSection>
          <ConnectedJourney />
        </AnimatedSection>

        <AnimatedSection>
          <ResumeTransformation />
        </AnimatedSection>

        <section id="features" className="px-6 pb-24 sm:pb-32">
          <div className="mx-auto max-w-6xl">
            <AnimatedSection className="mb-12 max-w-2xl">
              <SectionLabel number="03" className="mb-6">Supporting tools</SectionLabel>
              <h2
                className="text-balance font-bold tracking-tight"
                style={{ fontSize: 'clamp(2.2rem, 5vw, 3.75rem)', letterSpacing: '-0.035em' }}
              >
                Build first. Then apply and prepare.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                These tools support the portfolio workflow. They all use the experience you have already reviewed.
              </p>
            </AnimatedSection>
            <FeatureBento />
          </div>
        </section>

        <AnimatedSection>
          <TrustSection />
        </AnimatedSection>

        <TrackedSection
          event="pricing_viewed"
          id="pricing"
          className="scroll-mt-24 px-6 py-24 sm:py-32"
        >
          <div className="mx-auto max-w-5xl">
            <AnimatedSection className="mx-auto mb-12 max-w-2xl text-center">
              <SectionLabel number="04" className="mb-6 justify-center">Pricing</SectionLabel>
              <h2
                className="text-balance font-bold tracking-tight"
                style={{ fontSize: 'clamp(2.2rem, 5vw, 3.75rem)', letterSpacing: '-0.035em' }}
              >
                Build for free. Publish when you are ready.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                Free gives you the résumé-to-portfolio workflow. Pro adds live publishing and more room to use the supporting tools.
              </p>
            </AnimatedSection>

            <div className="grid gap-5 md:grid-cols-2">
              <article className="glass-card p-7 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Free</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">$0</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Build and privately review your first portfolio. No credit card required.
                </p>
                <ul className="mt-7 space-y-3 border-t border-dashed border-border pt-6">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/75">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="relative overflow-hidden rounded-3xl border border-brand-500/40 bg-card p-7 shadow-[0_22px_70px_oklch(54%_0.23_255/0.12)] sm:p-8">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent" />
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">Pro</p>
                  <span className="rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-200">
                    Publish + expand
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">$15</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">or $150/year</p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Publish your portfolio and use more of the job-search workspace.
                </p>
                <ul className="mt-7 space-y-3 border-t border-dashed border-border pt-6">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/80">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <TrackedLink
                href="/signup"
                event="hero_primary_cta_clicked"
                ctaLabel="pricing_preview"
                className="group btn-sheen inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-brand-500 px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.99]"
              >
                Create my portfolio free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </TrackedLink>
              <Link href="/pricing" className="min-h-11 px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                Compare all plan details
              </Link>
            </div>
          </div>
        </TrackedSection>

        <section id="faq" className="mx-auto max-w-3xl px-6 pb-24 sm:pb-32">
          <AnimatedSection className="mb-12">
            <SectionLabel number="05" className="mb-6">FAQ</SectionLabel>
            <h2
              className="font-bold tracking-tight"
              style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', letterSpacing: '-0.035em' }}
            >
              Questions before you start.
            </h2>
          </AnimatedSection>
          <AnimatedSection>
            <FaqAccordion />
          </AnimatedSection>
        </section>

        <AnimatedSection>
          <section className="relative overflow-hidden border-t border-dashed border-border px-6 py-28 sm:py-36">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, oklch(54% 0.230 255 / 0.10), transparent 70%)' }}
            />
            <div className="relative z-10 mx-auto max-w-3xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">Start with what you have</p>
              <h2
                className="mt-6 text-balance font-bold tracking-tight"
                style={{ fontSize: 'clamp(2.5rem, 6vw, 4.8rem)', letterSpacing: '-0.04em' }}
              >
                Your résumé is already written. Turn it into something people can explore.
              </h2>
              <TrackedLink
                href="/signup"
                event="hero_primary_cta_clicked"
                ctaLabel="bottom_cta"
                className="group btn-sheen cta-glow mt-9 inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-brand-500 px-8 py-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.99]"
              >
                Create my portfolio free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </TrackedLink>
              <p className="mt-4 text-xs text-muted-foreground">
                No credit card required · Your draft stays private
              </p>
            </div>
          </section>
        </AnimatedSection>
      </main>

      <Footer />
    </div>
  )
}
