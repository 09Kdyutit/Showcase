import Link from 'next/link'
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Badge } from '@/components/ui/badge'
import {
  AnimatedSection,
  StaggerContainer,
  StaggerChild,
} from '@/components/landing/animated-section'
import { StickyMobileCTA } from '@/components/landing/sticky-mobile-cta'
import { FaqAccordion } from '@/components/landing/faq-accordion'
import { TrackedSection } from '@/components/landing/tracked-section'
import { TrackedLink } from '@/components/landing/tracked-link'
import { ViewTracker } from '@/components/landing/view-tracker'
import { SectionLabel } from '@/components/shared/section-label'
import { HeroSection } from '@/components/landing/hero-section'
import { ConnectedJourney } from '@/components/landing/connected-journey'
import { FeatureBento } from '@/components/landing/feature-bento'
import { TrustSection } from '@/components/landing/trust-section'

// One narrative, told once: hero (what this is) → journey (what happens to your
// résumé, in order) → features (everything included) → trust → pricing → FAQ → CTA.
// The previous page told the same story four different ways (3D showcase, typewriter,
// marquee, scroll timeline) and visitors reported it as confusing — resist re-adding
// parallel explainer sections.
export default function LandingPage() {
  return (
    // overflow-x-clip (not hidden): hidden creates a scroll container that silently
    // kills every position:sticky descendant (the journey stage); clip doesn't.
    <div className="min-h-screen bg-background text-foreground overflow-x-clip">
      {/* Grain texture overlay */}
      <div className="grain-overlay" aria-hidden="true" />

      <Navbar />
      <StickyMobileCTA />
      <ViewTracker event="landing_viewed" metadata={{ route: '/' }} />

      <main>
        {/* ── Hero ── */}
        <HeroSection />

        {/* ── How it works: the five-step journey (anchor target of the hero CTA) ── */}
        <AnimatedSection>
          <ConnectedJourney />
        </AnimatedSection>

        {/* ── Features ── */}
        <section id="features" className="py-32 px-6">
          <div className="max-w-6xl mx-auto">
            <AnimatedSection className="mb-16">
              <SectionLabel number="02" className="mb-6">Features</SectionLabel>
              <h2
                className="font-bold tracking-tight text-balance"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}
              >
                Everything included.
                <br />All working from the same résumé.
              </h2>
            </AnimatedSection>

            <FeatureBento />
          </div>
        </section>

        {/* ── Trust ── */}
        <AnimatedSection>
          <TrustSection />
        </AnimatedSection>

        {/* ── Pricing ── */}
        <TrackedSection
          event="pricing_viewed"
          id="pricing"
          className="py-32 px-6"
          style={{ borderTop: '1px dashed var(--color-border)', borderBottom: '1px dashed var(--color-border)' }}
        >
          <div className="max-w-4xl mx-auto">
            <AnimatedSection className="mb-16">
              <SectionLabel number="03" className="mb-6">Pricing</SectionLabel>
              <h2
                className="font-bold tracking-tight mb-4 text-balance"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', letterSpacing: '-0.03em' }}
              >
                Start free, upgrade when you are ready.
              </h2>
              <p style={{ color: 'oklch(60% 0.014 262)' }}>
                No trial periods that auto-charge. No credit card to start.
              </p>
            </AnimatedSection>

            <StaggerContainer className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <StaggerChild>
                <div className="feat-card p-8 h-full">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-3"
                    style={{ color: 'oklch(60% 0.014 262)' }}
                  >
                    Free
                  </p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold tracking-tight">$0</span>
                    <span style={{ color: 'oklch(60% 0.014 262)' }}>/month</span>
                  </div>
                  <hr className="divider-dashed mb-6" />
                  <ul className="space-y-3 mb-8">
                    {[
                      'PDF, DOCX, and pasted résumé parsing',
                      'One AI portfolio generation',
                      'One complete 11-dimension Evidence Audit every 24 hours',
                      'Build, edit, and privately preview portfolio drafts',
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm" style={{ color: 'oklch(60% 0.008 255)' }}>
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'oklch(64% 0.022 258)' }} />
                        {f}
                      </li>
                    ))}
                    {['Portfolio regeneration', 'Public portfolio publishing', 'Personalized job feed'].map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm" style={{ color: 'oklch(60% 0.022 258)' }}>
                        <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <TrackedLink
                    href="/signup"
                    event="hero_primary_cta_clicked"
                    ctaLabel="pricing_free_card"
                    className="block w-full text-center py-3 rounded-full text-sm font-semibold transition-all duration-200 hover:opacity-80"
                    style={{
                      background: 'var(--color-surface-300)',
                      border: '1px solid var(--color-border)',
                      color: 'oklch(72% 0.008 255)',
                    }}
                  >
                    Build my portfolio free
                  </TrackedLink>
                </div>
              </StaggerChild>

              <StaggerChild>
                <div
                  className="feat-card p-8 h-full relative overflow-hidden"
                  style={{ borderColor: 'oklch(54% 0.230 255 / 0.4)' }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, oklch(54% 0.230 255 / 0.8), transparent)' }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, oklch(54% 0.230 255 / 0.07), transparent)' }}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <p
                        className="text-xs font-semibold uppercase tracking-widest"
                        style={{ color: 'oklch(63% 0.200 255)' }}
                      >
                        Pro
                      </p>
                      <Badge variant="pro">Publish + scale</Badge>
                    </div>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-4xl font-bold tracking-tight">$15</span>
                      <span style={{ color: 'oklch(60% 0.014 262)' }}>/month</span>
                    </div>
                    <p className="text-xs -mt-4 mb-6" style={{ color: 'oklch(64% 0.022 258)' }}>
                      or $150/year
                    </p>
                    <hr className="divider-dashed mb-6" />
                    <ul className="space-y-3 mb-8">
                      {[
                        'Everything in Free',
                        '10 complete 11-dimension Evidence Audits every 24 hours',
                        'Public portfolio + shareable preview card',
                        'Portfolio regeneration and higher AI limits',
                        'Role-specific application kits, cover letters, and outreach drafts',
                        'Personalized job feed and expanded ATS checks',
                        'Written mock interviews; voice practice when enabled',
                      ].map((f) => (
                        <li key={f} className="flex items-start gap-3 text-sm text-foreground/90">
                          <CheckCircle2
                            className="h-4 w-4 mt-0.5 shrink-0"
                            style={{ color: 'oklch(63% 0.200 255)' }}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <TrackedLink
                      href="/signup"
                      event="hero_primary_cta_clicked"
                      ctaLabel="pricing_pro_card"
                      className="btn-sheen block w-full text-center py-3.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                      style={{
                        background: 'oklch(54% 0.230 255)',
                        boxShadow: '0 0 28px oklch(54% 0.230 255 / 0.3)',
                      }}
                    >
                      Build my portfolio free
                    </TrackedLink>
                    <p className="text-xs text-center mt-3" style={{ color: 'oklch(64% 0.022 258)' }}>
                      No credit card required · Cancel anytime
                    </p>
                  </div>
                </div>
              </StaggerChild>
            </StaggerContainer>
          </div>
        </TrackedSection>

        {/* ── FAQ ── */}
        <section id="faq" className="py-32 px-6 max-w-3xl mx-auto">
          <AnimatedSection className="mb-14">
            <SectionLabel number="04" className="mb-6">FAQ</SectionLabel>
            <h2
              className="font-bold tracking-tight"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.03em' }}
            >
              The honest answers.
            </h2>
          </AnimatedSection>
          <AnimatedSection>
            <FaqAccordion />
          </AnimatedSection>
        </section>

        {/* ── Final CTA ── */}
        <AnimatedSection>
          <section className="py-40 px-6 relative overflow-hidden" style={{ borderTop: '1px dashed var(--color-border)' }}>
            {/* Ambient glow + drifting light behind CTA */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 60% 50% at 50% 50%, oklch(54% 0.230 255 / 0.09), transparent 70%)',
              }}
            />
            <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="ambient-blob ambient-blob--a" style={{ top: '10%', left: '22%', width: 420, height: 420, background: 'oklch(54% 0.230 255 / 0.14)', filter: 'blur(110px)' }} />
              <div className="ambient-blob ambient-blob--b" style={{ bottom: '-10%', right: '18%', width: 380, height: 380, background: 'oklch(58% 0.20 290 / 0.12)', filter: 'blur(110px)' }} />
            </div>
            <div className="relative max-w-3xl mx-auto text-center" style={{ zIndex: 1 }}>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-6"
                style={{ color: 'oklch(54% 0.230 255)' }}
              >
                Get started today
              </p>
              <h2
                className="font-bold tracking-tight mb-6 text-balance"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', letterSpacing: '-0.03em', color: 'oklch(99% 0.005 255)' }}
              >
                Start with your résumé.
                <br />Build everything around it.
              </h2>
              <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: 'oklch(62% 0.016 262)' }}>
                Create an editable portfolio free, then match roles, tailor application materials,
                practice interviews, and publish when you are ready.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <TrackedLink
                  href="/signup"
                  event="hero_primary_cta_clicked"
                  ctaLabel="bottom_cta"
                  className="group btn-sheen cta-glow inline-flex items-center gap-2.5 px-9 py-4 rounded-full font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
                  style={{
                    background: 'oklch(54% 0.230 255)',
                  }}
                >
                  Build my portfolio free
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </TrackedLink>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-full text-sm font-semibold transition-colors duration-200 hover:text-foreground"
                  style={{ color: 'oklch(60% 0.014 262)' }}
                >
                  See pricing
                </Link>
              </div>
              <p className="text-xs mt-6" style={{ color: 'oklch(63% 0.022 258)' }}>
                No credit card required · Set up in minutes
              </p>
            </div>
          </section>
        </AnimatedSection>
      </main>

      <Footer />
    </div>
  )
}
