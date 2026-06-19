import Link from 'next/link'
import { ArrowRight, CheckCircle2, Zap, BarChart3, FileText, Eye, Lock, ChevronDown, Shield, Star, Target, TrendingUp } from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Button } from '@/components/ui/button'
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

const FLOW_STEPS = [
  { icon: FileText, step: '01', title: 'Upload your resume', desc: 'Paste or upload your resume. Showcase parses it instantly — skills, projects, experience, all of it.' },
  { icon: Zap, step: '02', title: 'AI builds your portfolio', desc: 'We turn your experience into structured case studies and proof-of-work, not generic summaries.' },
  { icon: BarChart3, step: '03', title: 'Get your ProofScore', desc: 'An honest audit across 11 categories: what is strong, what is weak, what is missing.' },
  { icon: Target, step: '04', title: 'Discover matched roles', desc: 'Browse jobs and get a personalized feed scored against your real evidence — not keyword guessing.' },
  { icon: ArrowRight, step: '05', title: 'Tailor and apply', desc: 'One click creates a role-specific resume kit. Every change traced to your real experience in the Truth Ledger.' },
]

const PROOF_CATEGORIES = [
  { name: 'First Impression', score: 72, color: 'bg-amber-500' },
  { name: 'Target Role Fit', score: 85, color: 'bg-emerald-500' },
  { name: 'Proof Strength', score: 41, color: 'bg-red-500' },
  { name: 'Project Depth', score: 58, color: 'bg-orange-500' },
  { name: 'Keyword Relevance', score: 79, color: 'bg-brand-500' },
]


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <StickyMobileCTA />

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        {/* Ambient glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-brand-500/4 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 mb-8 animate-fade-in">
            <Badge variant="pro" className="px-3 py-1 text-xs">
              <Zap className="h-3 w-3" />
              AI-powered portfolio builder
            </Badge>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] text-balance mb-6">
            <span className="text-foreground animate-fade-in">Your career is a body of work.</span>
            <br />
            <span className="animate-fade-in" style={{ animationDelay: '120ms' }}>
              <span className="gradient-text">It&apos;s time to show it</span>
            </span>
            <br />
            <span className="text-foreground animate-fade-in" style={{ animationDelay: '240ms' }}>
              as evidence.
            </span>
          </h1>

          <p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed text-balance animate-fade-in"
            style={{ animationDelay: '360ms' }}
          >
            Showcase turns your resume and projects into a professional proof-of-work portfolio —
            with a ProofScore that shows exactly what is strong, what is weak, and what to fix.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-in"
            style={{ animationDelay: '480ms' }}
          >
            <Button asChild variant="gradient" size="xl" className="w-full sm:w-auto gap-2.5 shadow-glow">
              <Link href="/waitlist">
                Join the beta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl" className="w-full sm:w-auto">
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>

          {/* Trust signals */}
          <div
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground/70 animate-fade-in"
            style={{ animationDelay: '560ms' }}
          >
            {['No credit card required', 'Free ProofScore preview', 'Setup in 5 minutes'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" />
                {item}
              </span>
            ))}
          </div>

          {/* Hero demo mockup */}
          <div
            className="mt-16 relative max-w-4xl mx-auto animate-fade-in"
            style={{ animationDelay: '640ms' }}
          >
            <div className="glass-card shadow-premium p-1 overflow-hidden">
              <div className="bg-surface-200 rounded-xl overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                  </div>
                  <div className="flex-1 mx-4 h-6 bg-surface-300 rounded-lg flex items-center px-3">
                    <span className="text-xs text-muted-foreground/60">showcase.app/p/alex-chen</span>
                  </div>
                  <Badge variant="success" className="text-[10px] px-2 py-0.5">Published</Badge>
                </div>

                {/* Mockup content */}
                <div className="p-6 grid md:grid-cols-[1fr_280px] gap-6">
                  {/* Left — portfolio preview */}
                  <div className="space-y-4 text-left">
                    {/* Identity */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">AC</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">Alex Chen</p>
                          <p className="text-xs text-muted-foreground">Product Designer · San Francisco</p>
                        </div>
                      </div>
                    </div>
                    {/* Role tags */}
                    <div className="flex flex-wrap gap-2">
                      {['B2B SaaS', '5 yrs exp', 'Ex-Figma'].map((tag) => (
                        <span key={tag} className="bg-surface-300 rounded-md px-2.5 py-1 text-xs text-muted-foreground/80 border border-border/60">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {/* Positioning statement */}
                    <p className="text-xs text-muted-foreground/80 leading-relaxed border-l-2 border-brand-500/30 pl-3">
                      I help B2B SaaS teams ship interfaces that users actually adopt — specializing in
                      complex checkout flows, design systems, and 0→1 product work.
                    </p>
                    {/* Case study cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-surface-300/60 rounded-xl p-3 border border-border/60">
                        <p className="text-xs font-semibold text-foreground/80 mb-1">Checkout Redesign</p>
                        <p className="text-xs text-emerald-400 font-medium mb-1.5">+24% completion · −18% abandonment</p>
                        <p className="text-xs text-muted-foreground/70 leading-relaxed">Saved ~$180k/month in lost revenue. 12 user interviews, 3 A/B cycles, shipped in 6 weeks.</p>
                      </div>
                      <div className="bg-surface-300/60 rounded-xl p-3 border border-border/60">
                        <p className="text-xs font-semibold text-foreground/80 mb-1">Design System v2</p>
                        <p className="text-xs text-brand-400 font-medium mb-1.5">3 products · 40% faster shipping</p>
                        <p className="text-xs text-muted-foreground/70 leading-relaxed">Led token architecture, built 120-component library. Reduced design-to-dev handoff from 2 wks to 3 days.</p>
                      </div>
                    </div>
                  </div>

                  {/* Right — ProofScore panel */}
                  <div className="glass-card p-5 flex flex-col gap-4 border-brand-500/20 shadow-glow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ProofScore™</span>
                      <Badge variant="warning">Needs Work</Badge>
                    </div>

                    {/* Score ring */}
                    <div className="flex items-center justify-center py-2">
                      <div className="relative w-28 h-28">
                        <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-xl" />
                        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                          <circle
                            cx="60" cy="60" r="50" fill="none"
                            stroke="url(#hero-score-gradient)" strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray="314"
                            strokeDashoffset="100"
                          />
                          <defs>
                            <linearGradient id="hero-score-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#f59e0b" />
                              <stop offset="100%" stopColor="#fb923c" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-black text-amber-400">68</span>
                          <span className="text-[10px] text-muted-foreground/60">/ 100</span>
                        </div>
                      </div>
                    </div>

                    {/* Category bars */}
                    <div className="space-y-2">
                      {PROOF_CATEGORIES.map(({ name, score, color }) => (
                        <div key={name} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-24 shrink-0 leading-tight">{name}</span>
                          <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
                          </div>
                          <span className="text-[10px] font-medium w-5 text-right">{score}</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                      2 critical gaps found. Fixing proof strength could push you to 84+.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow under card */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
          </div>
        </div>

        {/* Scroll cue */}
        <a
          href="#how-it-works"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
        >
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </a>
      </section>

      {/* ─── Showcase vs. ChatGPT / templates ────────────────── */}
      <AnimatedSection>
        <section className="py-20 px-4 sm:px-6 border-y border-border bg-surface-50/30">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center mb-12">Why not just use ChatGPT or a template?</p>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="glass-card p-6">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
                  <Target className="h-4.5 w-4.5 text-brand-400 h-[18px] w-[18px]" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Built around your real work</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  ChatGPT will make things up. Templates show the same layout as everyone else. Showcase only works with what you actually did — and flags every claim that needs evidence.
                </p>
              </div>
              <div className="glass-card p-6 border-brand-500/20">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-[18px] w-[18px] text-brand-400" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">ProofScore tells you exactly what is weak</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No vague feedback. ProofScore audits 11 specific hiring-readiness categories and tells you what is costing you, with concrete fixes — not generic advice.
                </p>
              </div>
              <div className="glass-card p-6">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
                  <TrendingUp className="h-[18px] w-[18px] text-brand-400" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">A public page recruiters will actually open</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your portfolio lives at showcase.app/p/your-name — no &ldquo;.github.io&rdquo;, no &ldquo;notion.so/docs/&rdquo;, no login required. One clean link that works on a phone.
                </p>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ─── Career domains marquee ───────────────────────────── */}
      <section className="py-16 px-4 sm:px-6">
        <CompanyMarquee />
      </section>

      {/* ─── How it works ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-32 px-4 sm:px-6 max-w-6xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <Badge variant="outline" className="mb-4">How it works</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance mb-4">
            From resume to portfolio in minutes
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            No design skills needed. No generic templates. Just your real experience, presented as evidence.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FLOW_STEPS.map(({ icon: Icon, step, title, desc }) => (
            <StaggerChild key={step}>
              <div className="relative group h-full">
                <div className="glass-card p-6 h-full transition-all duration-300 hover:border-brand-500/20 hover:shadow-glow-sm hover:-translate-y-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                      <Icon className="h-5 w-5 text-brand-400" />
                    </div>
                    <span className="text-4xl font-black text-muted-foreground/10 group-hover:text-muted-foreground/20 transition-colors">
                      {step}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
                {step !== '04' && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-border to-transparent z-10" />
                )}
              </div>
            </StaggerChild>
          ))}
        </StaggerContainer>
      </section>

      {/* ─── ProofScore section ───────────────────────────────── */}
      <section className="py-32 px-4 sm:px-6 bg-surface-50/50">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <FadeIn from="left">
            <Badge variant="pro" className="mb-6">
              <BarChart3 className="h-3 w-3" />
              ProofScore Audit
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6 text-balance">
              An honest score that shows exactly where you stand
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              Most portfolios fail silently. Recruiters close the tab without telling you why.
              ProofScore audits your materials across 11 categories and tells you exactly
              what is weak, what evidence is missing, and what to fix first.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'First impression clarity and role positioning',
                'Project depth and case study quality',
                'Proof strength — are your claims backed up?',
                'Keyword relevance for your target role',
                'Hiring risk gaps that could cost you the interview',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground/80">
                  <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild variant="gradient" size="lg" className="gap-2">
              <Link href="/waitlist">
                Join the beta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </FadeIn>

          <FadeIn from="right" delay={0.1}>
            <div className="space-y-3">
              {[
                { cat: 'First Impression Clarity', score: 72, sev: 'major', fix: 'Your headline is vague. Add your specific role and a measurable value prop.' },
                { cat: 'Proof Strength', score: 41, sev: 'critical', fix: 'Only 2 of 8 bullets include measurable outcomes. Add metrics to 3 more.' },
                { cat: 'Project Depth', score: 58, sev: 'major', fix: 'Projects show what you did, not the problem you solved or the impact.' },
                { cat: 'Target Role Alignment', score: 85, sev: 'minor', fix: 'Strong overall. Add 3 more role-specific keywords to push above 90.' },
                { cat: 'Keyword Relevance', score: 79, sev: 'minor', fix: 'Missing: "design systems", "cross-functional", "Figma", "stakeholder alignment".' },
              ].map(({ cat, score, sev, fix }) => (
                <div key={cat} className="glass-card p-4 hover:border-border/60 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{cat}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={sev === 'critical' ? 'danger' : sev === 'major' ? 'warning' : 'success'}>
                        {sev}
                      </Badge>
                      <span
                        className={`text-sm font-bold ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}
                      >
                        {score}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{fix}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="py-32 px-4 sm:px-6 max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Simple pricing</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Start free, upgrade when you are ready
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            No trial periods that auto-charge. Start with a real free tier and upgrade when Showcase proves its value.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <StaggerChild>
            <div className="glass-card p-8 h-full">
              <div className="mb-6">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Free</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Resume parsing and analysis preview',
                  'Basic ProofScore preview (first 3 categories)',
                  'Draft portfolio (unpublished)',
                  '1 portfolio project',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-border mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
                {['Full AI generation', 'Complete ProofScore audit', 'Public portfolio publishing', 'PDF export'].map(
                  (f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground/40">
                      <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  )
                )}
              </ul>
              <Button asChild variant="secondary" size="lg" className="w-full">
                <Link href="/waitlist">Join the beta</Link>
              </Button>
            </div>
          </StaggerChild>

          <StaggerChild>
            <div className="relative glass-card p-8 border-brand-500/30 overflow-hidden h-full">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-2">Pro</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">$15</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                  </div>
                  <Badge variant="pro">Most popular</Badge>
                </div>
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
                      <CheckCircle2 className="h-4 w-4 text-brand-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="gradient" size="lg" className="w-full shadow-glow">
                  <Link href="/waitlist">Join the beta</Link>
                </Button>
                <p className="text-xs text-muted-foreground/60 text-center mt-3">
                  Private beta · Help shape V1 · Early access
                </p>
              </div>
            </div>
          </StaggerChild>
        </StaggerContainer>
      </section>

      {/* ─── Before / After ───────────────────────────────────── */}
      <section className="py-32 px-4 sm:px-6 bg-surface-50/50">
        <AnimatedSection className="max-w-5xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            The same experience. Two completely different outcomes.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            One version gets skimmed and closed. The other gets a call.
          </p>
        </AnimatedSection>

        <StaggerContainer className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          <StaggerChild>
            <div className="glass-card p-6 space-y-4 h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm font-medium text-red-400">Without Showcase</span>
              </div>
              <div className="space-y-3">
                <div className="bg-surface-300 rounded-lg p-4 border-l-2 border-red-500/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground/80">
                    Experienced designer with skills in multiple areas, passionate about creating great user
                    experiences for customers.
                  </p>
                </div>
                <div className="bg-surface-300 rounded-lg p-4 border-l-2 border-red-500/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Recent Project
                  </p>
                  <p className="text-sm text-muted-foreground/80 font-medium mb-1">Redesigned the company website</p>
                  <p className="text-sm text-muted-foreground/60">
                    • Helped improve the website design
                    <br />• Worked with the development team
                    <br />• Made things more user-friendly
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center">
                    <span className="text-red-400 text-xs font-bold">✕</span>
                  </div>
                  <p className="text-xs text-red-400/80">Recruiter closes tab in 8 seconds. No callback.</p>
                </div>
              </div>
            </div>
          </StaggerChild>

          <StaggerChild>
            <div className="glass-card p-6 space-y-4 border-emerald-500/20 h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-emerald-400">With Showcase</span>
              </div>
              <div className="space-y-3">
                <div className="bg-surface-300 rounded-lg p-4 border-l-2 border-emerald-500/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Positioning
                  </p>
                  <p className="text-sm text-foreground/90">
                    Product Designer with 5 years building conversion-focused B2B SaaS interfaces. I help teams
                    ship features that users actually adopt.
                  </p>
                </div>
                <div className="bg-surface-300 rounded-lg p-4 border-l-2 border-emerald-500/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Case Study: Checkout Redesign
                  </p>
                  <p className="text-sm text-foreground/90 font-medium mb-2">
                    +24% checkout completion · 18% cart abandonment reduction
                  </p>
                  <p className="text-sm text-muted-foreground/80">
                    <strong className="text-foreground/70">Problem:</strong> Drop-off at payment step was costing
                    ~$180k/month in lost revenue.
                    <br />
                    <strong className="text-foreground/70">Process:</strong> 12 user interviews, heatmap analysis, 3
                    A/B test cycles.
                    <br />
                    <strong className="text-foreground/70">Outcome:</strong> Redesigned form shipped in 6 weeks,
                    measurable impact in 30 days.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Star className="h-3 w-3 text-emerald-400 fill-emerald-400" />
                  </div>
                  <p className="text-xs text-emerald-400/80">Recruiter screenshots it. Forwards to hiring manager.</p>
                </div>
              </div>
            </div>
          </StaggerChild>
        </StaggerContainer>
      </section>

      {/* ─── Trust & Data Handling ────────────────────────────── */}
      <AnimatedSection>
        <section className="py-20 px-4 sm:px-6 max-w-5xl mx-auto">
          <div className="glass-card p-8 sm:p-12 border-emerald-500/10 bg-emerald-500/[0.015]">
            <div className="flex flex-col sm:flex-row items-start gap-8">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">
                  Built on Trust
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-balance">
                  We never invent experience. Ever.
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
                  Showcase only works with what you provide. Our AI rewrites how you{' '}
                  <em>present</em> real experience — it never fabricates metrics, employers, projects, or
                  certifications. When evidence is missing, we tell you exactly what to add. We never make it up.
                </p>
                <div className="grid sm:grid-cols-3 gap-6">
                  {[
                    {
                      icon: Lock,
                      title: 'Your data stays private',
                      desc: 'Resume content is never shared, indexed, or sold. Processed securely via Anthropic API for your session only.',
                    },
                    {
                      icon: Eye,
                      title: 'You control visibility',
                      desc: 'Your portfolio is private by default. You decide when to publish and who can see your public link.',
                    },
                    {
                      icon: CheckCircle2,
                      title: 'Honest audit scores',
                      desc: 'ProofScore is designed to expose weaknesses — not inflate your confidence. A low score means there is real work to do.',
                    },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ─── FAQ ──────────────────────────────────────────────── */}
      <section className="py-32 px-4 sm:px-6 max-w-3xl mx-auto">
        <AnimatedSection className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Frequently asked questions</h2>
          <p className="text-muted-foreground">The honest answers.</p>
        </AnimatedSection>
        <AnimatedSection>
          <FaqAccordion />
        </AnimatedSection>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────── */}
      <AnimatedSection>
        <section className="py-32 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center relative">
            <div className="absolute inset-0 -z-10 bg-gradient-radial from-brand-500/10 to-transparent" />
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-balance">
              Your work deserves to be seen.
              <span className="block gradient-text mt-1">Start with Showcase.</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Build a portfolio that makes recruiters stop scrolling. Get your ProofScore. Know exactly where you
              stand.
            </p>
            <Button asChild variant="gradient" size="xl" className="shadow-glow gap-2">
              <Link href="/waitlist">
                Join the Showcase beta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground/60 mt-4">
              Private beta · Early access · Help shape V1
            </p>
          </div>
        </section>
      </AnimatedSection>

      <Footer />
    </div>
  )
}
