import Link from 'next/link'
import { ArrowRight, CheckCircle2, Lock, Star } from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Badge } from '@/components/ui/badge'
import {
  AnimatedSection,
  StaggerContainer,
  StaggerChild,
  FadeIn,
} from '@/components/landing/animated-section'
import { StickyMobileCTA } from '@/components/landing/sticky-mobile-cta'
import { FaqAccordion } from '@/components/landing/faq-accordion'
import { CompanyMarquee } from '@/components/landing/company-marquee'
import { TrackedSection } from '@/components/landing/tracked-section'
import { TrackedLink } from '@/components/landing/tracked-link'
import { ViewTracker } from '@/components/landing/view-tracker'
import { SectionLabel } from '@/components/shared/section-label'
import { HeroSection } from '@/components/landing/hero-section'
import { TypewriterSection } from '@/components/landing/typewriter-section'
import { HowItWorks } from '@/components/landing/how-it-works'
import { SpotlightCard } from '@/components/landing/spotlight-card'
import { TrustSection } from '@/components/landing/trust-section'

const FEATURES = [
  { icon: 'Zap', title: 'AI Portfolio Builder', desc: 'Turns your resume into structured, evidence-based case studies. No design skills needed.' },
  { icon: 'BarChart3', title: 'ProofScore Audit', desc: '11-category hiring-readiness score. Tells you exactly what is weak and how to fix it.' },
  { icon: 'Search', title: 'Job Matching', desc: 'Browse roles scored against your real evidence. Find jobs where you actually qualify.' },
  { icon: 'Target', title: 'Tailor Studio', desc: 'One click to create a role-specific resume kit, traced back to your Truth Ledger.' },
  { icon: 'MessageSquare', title: 'Interview Lab', desc: 'AI-powered practice. Get scored on STAR structure, clarity, and evidence strength.' },
  { icon: 'Shield', title: 'Truth Ledger', desc: 'Every claim is logged. Every AI change is sourced. Nothing fabricated, ever.' },
] as const

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Grain texture overlay */}
      <div className="grain-overlay" aria-hidden="true" />

      <Navbar />
      <StickyMobileCTA />
      <ViewTracker event="landing_viewed" metadata={{ route: '/' }} />

      <main>
        {/* ── Hero ── */}
        <HeroSection />

        {/* ── Stats strip ── */}
        <AnimatedSection>
          <div className="max-w-6xl mx-auto px-6">
            <hr className="divider-dashed" />
            <div className="py-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { n: '11', label: 'audit categories' },
                { n: '5 min', label: 'average setup time' },
                { n: '1 link', label: 'to share everything' },
                { n: '0', label: 'fabrications. ever.' },
              ].map(({ n, label }) => (
                <div key={label}>
                  <p
                    className="font-bold mb-1.5 tabular-nums text-foreground"
                    style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', letterSpacing: '-0.04em' }}
                  >
                    {n}
                  </p>
                  <p className="text-xs uppercase tracking-widest" style={{ color: 'oklch(65% 0.022 258)' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <hr className="divider-dashed" />
          </div>
        </AnimatedSection>

        {/* ── Typewriter statement ── */}
        <TypewriterSection />

        {/* ── Career domains marquee ── */}
        <section className="py-12 px-6">
          <CompanyMarquee />
        </section>

        {/* ── How it works (scroll timeline) ── */}
        <HowItWorks />

        {/* ── Why Showcase ── */}
        <AnimatedSection>
          <TrackedSection
            event="comparison_viewed"
            className="py-32 px-6"
            style={{ borderTop: '1px dashed var(--color-border)', borderBottom: '1px dashed var(--color-border)', background: 'linear-gradient(180deg, oklch(21% 0.036 258), oklch(17% 0.032 258))' }}
          >
            <div className="max-w-6xl mx-auto">
              <div className="mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                <div>
                  <SectionLabel number="02" className="mb-6">Why Showcase</SectionLabel>
                  <h2
                    className="font-bold tracking-tight text-balance"
                    style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}
                  >
                    Not ChatGPT.
                    <br />Not a template.
                  </h2>
                </div>
                <p
                  className="text-sm leading-relaxed max-w-xs lg:text-right"
                  style={{ color: 'oklch(60% 0.014 262)' }}
                >
                  ChatGPT makes things up. Templates look like everyone else.
                  Showcase only works with what you actually did.
                </p>
              </div>

              <StaggerContainer className="grid sm:grid-cols-3 gap-5">
                {([
                  {
                    icon: 'Target',
                    title: 'Built around your real work',
                    desc: 'Showcase only works with what you provide, and flags every claim that needs evidence.',
                  },
                  {
                    icon: 'BarChart3',
                    title: 'ProofScore tells you exactly what is weak',
                    desc: 'No vague feedback. 11 specific categories, concrete fixes, no generic advice.',
                  },
                  {
                    icon: 'Eye',
                    title: 'A public page recruiters will actually open',
                    desc: 'showcase.app/p/your-name, clean, fast, no login required, works on any device.',
                  },
                ] as const).map(({ icon, title, desc }, i) => (
                  <StaggerChild key={title}>
                    <SpotlightCard
                      icon={icon}
                      index={`0${i + 1}`}
                      title={title}
                      desc={desc}
                    />
                  </StaggerChild>
                ))}
              </StaggerContainer>
            </div>
          </TrackedSection>
        </AnimatedSection>

        {/* ── Features ── */}
        <section className="py-32 px-6">
          <div className="max-w-6xl mx-auto">
            <AnimatedSection className="mb-16">
              <SectionLabel number="03" className="mb-6">Features</SectionLabel>
              <h2
                className="font-bold tracking-tight text-balance"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}
              >
                Everything you need
                <br />to prove your value.
              </h2>
            </AnimatedSection>

            <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(({ icon, title, desc }, i) => (
                <StaggerChild key={title}>
                  <SpotlightCard
                    icon={icon}
                    index={`0${i + 1}`}
                    title={title}
                    desc={desc}
                  />
                </StaggerChild>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* ── Built for ── */}
        <AnimatedSection>
          <TrackedSection
            event="audience_section_viewed"
            id="built-for"
            className="py-32 px-6"
            style={{ borderTop: '1px dashed var(--color-border)', borderBottom: '1px dashed var(--color-border)', background: 'linear-gradient(180deg, oklch(21% 0.036 258), oklch(17% 0.032 258))' }}
          >
            <div className="max-w-5xl mx-auto">
              <SectionLabel number="04" className="mb-6">Built for</SectionLabel>
              <h2
                className="font-bold tracking-tight mb-12 text-balance max-w-2xl"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}
              >
                Early-career job seekers who have real work to show but no clear way to prove it.
              </h2>
              <StaggerContainer className="grid sm:grid-cols-2 gap-5">
                {([
                  {
                    icon: 'GraduationCap',
                    title: 'The Student',
                    desc: 'Turning coursework and internships into credible, recruiter-ready case studies.',
                  },
                  {
                    icon: 'Rocket',
                    title: 'The New Grad',
                    desc: 'Making side projects and first roles understandable to people who hire.',
                  },
                  {
                    icon: 'Briefcase',
                    title: 'The Early Pro',
                    desc: 'Translating day-to-day work into measurable, defensible evidence.',
                  },
                  {
                    icon: 'Repeat',
                    title: 'The Switcher',
                    desc: 'Connecting previous experience to a brand-new target role.',
                  },
                ] as const).map(({ icon, title, desc }, i) => (
                  <StaggerChild key={title}>
                    <SpotlightCard icon={icon} index={`0${i + 1}`} title={title} desc={desc} />
                  </StaggerChild>
                ))}
              </StaggerContainer>
              <p className="text-sm mt-10 max-w-2xl leading-relaxed" style={{ color: 'oklch(64% 0.022 258)' }}>
                Showcase is not designed to fabricate credentials, inflate achievements, or mass-produce
                generic applications. If the evidence is not there, we tell you it is missing. We do not invent it.
              </p>
            </div>
          </TrackedSection>
        </AnimatedSection>

        {/* ── ProofScore spotlight ── */}
        <section className="py-32 px-6">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <FadeIn from="left">
              <SectionLabel number="05" className="mb-6">ProofScore</SectionLabel>
              <h2
                className="font-bold tracking-tight mb-6 text-balance"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', letterSpacing: '-0.03em' }}
              >
                ProofScore does not just score your résumé. It improves it.
              </h2>
              <p className="text-lg leading-relaxed mb-8" style={{ color: 'oklch(62% 0.02 255)' }}>
                Most portfolios fail silently. Recruiters close the tab without telling you why.
                ProofScore audits your materials across 11 categories, shows you exactly what is
                weak and what evidence is missing, then rewrites your bullets and tells you the
                specific line to add so your score actually goes up. It is a scan and a fix in one.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'First impression clarity and role positioning',
                  'Project depth and case study quality',
                  'Proof strength: are your claims backed up?',
                  'Keyword relevance for your target role',
                  'Hiring risk gaps that could cost you the interview',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-foreground/80">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'oklch(54% 0.230 255)' }} />
                    {item}
                  </li>
                ))}
              </ul>
              <TrackedLink
                href="/signup"
                event="hero_primary_cta_clicked"
                ctaLabel="proofscore_spotlight"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-sm text-white transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: 'oklch(54% 0.230 255)',
                  boxShadow: '0 0 32px oklch(54% 0.230 255 / 0.25)',
                }}
              >
                Get your ProofScore
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </TrackedLink>
            </FadeIn>

            <FadeIn from="right" delay={0.1}>
              <div className="space-y-3">
                {[
                  { cat: 'First-impression clarity', score: 72, sev: 'major', fix: 'Your headline is vague. Add your specific role and a measurable value prop.' },
                  { cat: 'Evidence strength', score: 41, sev: 'critical', fix: 'Only 2 of 8 bullets include measurable outcomes. Add metrics to 3 more.' },
                  { cat: 'Project depth', score: 58, sev: 'major', fix: 'Projects show what you did, not the problem you solved or the impact.' },
                  { cat: 'Target-role alignment', score: 85, sev: 'minor', fix: 'Strong overall. Add 3 more role-specific keywords to push above 90.' },
                  { cat: 'Keyword support', score: 79, sev: 'minor', fix: 'Missing: "design systems", "cross-functional", "Figma".' },
                ].map(({ cat, score, sev, fix }) => (
                  <div key={cat} className="feat-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{cat}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={sev === 'critical' ? 'danger' : sev === 'major' ? 'warning' : 'success'}>
                          {sev}
                        </Badge>
                        <span
                          className={`text-sm font-bold tabular-nums ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}
                        >
                          {score}
                        </span>
                      </div>
                    </div>
                    <div
                      className="h-1 rounded-full overflow-hidden mb-2"
                      style={{ background: 'var(--color-surface-300)' }}
                    >
                      <div
                        className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <p className="text-xs" style={{ color: 'oklch(60% 0.014 262)' }}>{fix}</p>
                  </div>
                ))}
                <p className="text-xs text-center pt-1" style={{ color: 'oklch(62% 0.022 258)' }}>
                  Fictional demonstration data
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── Before / After ── */}
        <section
          className="py-32 px-6"
          style={{ borderTop: '1px dashed var(--color-border)', background: 'linear-gradient(180deg, oklch(21% 0.036 258), oklch(17% 0.032 258))' }}
        >
          <div className="max-w-5xl mx-auto">
            <AnimatedSection className="mb-16">
              <SectionLabel number="06" className="mb-6">Real results</SectionLabel>
              <h2
                className="font-bold tracking-tight text-balance mb-4"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', letterSpacing: '-0.03em' }}
              >
                The same experience.
                <br />Two completely different outcomes.
              </h2>
              <p style={{ color: 'oklch(60% 0.014 262)' }}>
                One version gets skimmed and closed. The other gets a call.
              </p>
              <p className="text-xs mt-2 uppercase tracking-widest" style={{ color: 'oklch(62% 0.022 258)' }}>
                Fictional demonstration data
              </p>
            </AnimatedSection>

            <StaggerContainer className="grid md:grid-cols-2 gap-6">
              <StaggerChild>
                <div className="feat-card h-full space-y-4">
                  <div
                    className="flex items-center gap-2 pb-4"
                    style={{ borderBottom: '1px dashed var(--color-border)' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-sm font-medium" style={{ color: 'oklch(62% 0.22 25)' }}>
                      Without Showcase
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: 'var(--color-surface-200)',
                        border: '1px solid oklch(62% 0.22 25 / 0.18)',
                      }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'oklch(60% 0.014 262)' }}>
                        Résumé bullet
                      </p>
                      <p className="text-sm" style={{ color: 'oklch(60% 0.008 255)' }}>
                        Built an internal analytics dashboard and worked with operations.
                      </p>
                    </div>
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: 'var(--color-surface-200)',
                        border: '1px solid oklch(62% 0.22 25 / 0.18)',
                      }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'oklch(60% 0.014 262)' }}>
                        What a recruiter sees
                      </p>
                      <p className="text-sm" style={{ color: 'oklch(60% 0.014 262)' }}>
                        No problem stated. No outcome. No way to tell if this mattered or took a weekend.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: 'oklch(62% 0.22 25 / 0.12)',
                          color: 'oklch(62% 0.22 25)',
                        }}
                      >
                        ✕
                      </div>
                      <p className="text-xs" style={{ color: 'oklch(62% 0.22 25 / 0.85)' }}>
                        Recruiter closes tab in 8 seconds. No callback.
                      </p>
                    </div>
                  </div>
                </div>
              </StaggerChild>

              <StaggerChild>
                <div
                  className="feat-card h-full space-y-4"
                  style={{ borderColor: 'oklch(65% 0.17 160 / 0.22)' }}
                >
                  <div
                    className="flex items-center gap-2 pb-4"
                    style={{ borderBottom: '1px dashed oklch(65% 0.17 160 / 0.3)' }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(65% 0.17 160)' }} />
                    <span className="text-sm font-medium" style={{ color: 'oklch(65% 0.17 160)' }}>
                      With Showcase
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: 'var(--color-surface-200)',
                        border: '1px solid oklch(65% 0.17 160 / 0.18)',
                      }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'oklch(60% 0.014 262)' }}>
                        Case Study: Internal Analytics Dashboard
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: 'oklch(72% 0.008 255)' }}>
                        <strong style={{ color: 'oklch(82% 0.008 255)', fontWeight: 500 }}>Problem:</strong>{' '}
                        Operations manually compiled weekly reports in spreadsheets.{' '}
                        <strong style={{ color: 'oklch(82% 0.008 255)', fontWeight: 500 }}>Role:</strong>{' '}
                        Sole builder, intern project.{' '}
                        <strong style={{ color: 'oklch(82% 0.008 255)', fontWeight: 500 }}>Process:</strong>{' '}
                        Scoped with ops lead, shipped in 6-week internship.{' '}
                        <strong style={{ color: 'oklch(82% 0.008 255)', fontWeight: 500 }}>Outcome:</strong>{' '}
                        Not yet quantified.
                      </p>
                    </div>
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: 'oklch(74% 0.16 85 / 0.06)',
                        border: '1px solid oklch(74% 0.16 85 / 0.2)',
                      }}
                    >
                      <p
                        className="text-xs font-semibold uppercase tracking-wider mb-1"
                        style={{ color: 'oklch(74% 0.16 85)' }}
                      >
                        ProofScore flag
                      </p>
                      <p className="text-sm" style={{ color: 'oklch(72% 0.008 255)' }}>
                        Outcome not yet quantified. Add hours saved or adoption rate before sending.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center"
                        style={{ background: 'oklch(65% 0.17 160 / 0.12)' }}
                      >
                        <Star className="h-3 w-3" style={{ color: 'oklch(65% 0.17 160)', fill: 'oklch(65% 0.17 160)' }} />
                      </div>
                      <p className="text-xs" style={{ color: 'oklch(65% 0.17 160 / 0.9)' }}>
                        A recruiter can see exactly what was built, why, and what to ask in the interview.
                      </p>
                    </div>
                  </div>
                </div>
              </StaggerChild>
            </StaggerContainer>
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
              <SectionLabel number="07" className="mb-6">Pricing</SectionLabel>
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
                      'Resume parsing and analysis preview',
                      'Basic ProofScore preview (first 3 categories)',
                      'Draft portfolio (unpublished)',
                      '1 portfolio project',
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm" style={{ color: 'oklch(60% 0.008 255)' }}>
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'oklch(64% 0.022 258)' }} />
                        {f}
                      </li>
                    ))}
                    {['Full AI generation', 'Complete ProofScore audit', 'Public portfolio publishing', 'PDF export'].map((f) => (
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
                    Get started free
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
                      <Badge variant="pro">Most popular</Badge>
                    </div>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-4xl font-bold tracking-tight">$15</span>
                      <span style={{ color: 'oklch(60% 0.014 262)' }}>/month</span>
                    </div>
                    <hr className="divider-dashed mb-6" />
                    <ul className="space-y-3 mb-8">
                      {[
                        'Everything in Free',
                        'Full AI portfolio generation from resume',
                        'Complete ProofScore audit (all 11 categories)',
                        'Resume bullet improvement',
                        'Public portfolio at /p/your-name',
                        'PDF and recruiter summary export',
                        'Role-specific portfolio versions',
                        'Unlimited portfolio projects',
                        'Priority AI processing',
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
                      className="block w-full text-center py-3.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        background: 'oklch(54% 0.230 255)',
                        boxShadow: '0 0 28px oklch(54% 0.230 255 / 0.3)',
                      }}
                    >
                      Get started free
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
            <SectionLabel number="08" className="mb-6">FAQ</SectionLabel>
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
            {/* Ambient glow behind CTA */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 60% 50% at 50% 50%, oklch(54% 0.230 255 / 0.09), transparent 70%)',
              }}
            />
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
                Stop listing claims.
                <br />Start proving them.
              </h2>
              <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: 'oklch(62% 0.016 262)' }}>
                Build a portfolio that makes recruiters stop scrolling.
                Get your ProofScore. Know exactly where you stand.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <TrackedLink
                  href="/signup"
                  event="hero_primary_cta_clicked"
                  ctaLabel="bottom_cta"
                  className="group inline-flex items-center gap-2.5 px-9 py-4 rounded-full font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
                  style={{
                    background: 'oklch(54% 0.230 255)',
                    boxShadow: '0 0 48px oklch(54% 0.230 255 / 0.35)',
                  }}
                >
                  Get started free
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
