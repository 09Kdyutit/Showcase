import { Globe, Mail, ArrowRight, ExternalLink, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Static demo data ─────────────────────────────────────────────────────────

const NAME = 'Alex Chen'
const INITIALS = 'AC'
const TITLE = 'Senior Product Designer'
const TAGLINE = 'Lead Designer · B2B SaaS'

const HERO_HEADLINE =
  "The Designer Who Shipped Stripe’s Checkout Redesign (+24% Completion)"
const HERO_SUBHEADLINE =
  'I design B2B checkout flows that convert  -  specializing in the final 20% of the funnel where most revenue is abandoned.'
const FEATURED_RESULT = '$180k/month recovered from abandoned Stripe checkouts'

const PROOF = [
  { value: '+24%', label: 'checkout completion increase' },
  { value: '$180k/mo', label: 'monthly revenue recovered' },
  { value: '3 products', label: 'unified on one design system' },
  { value: '40% faster', label: 'engineering delivery' },
]

const RECRUITER_SUMMARY =
  'Available for Senior IC, Staff Designer, and Design Lead roles at Series B-D B2B SaaS companies. Prefers remote or SF/NYC hybrid.'

const ABOUT_PARAS = [
  'I design checkout and conversion flows for B2B SaaS. The most-cited project on my resume is Stripe Checkout  -  a redesign that recovered $180k/month in abandoned merchant revenue by collapsing a 4-step flow into one progressive screen.',
  'My approach is evidence before aesthetics. Every design decision I make is tied to a measurable outcome: conversion, retention, adoption, speed. I work best in environments where design is a first-class partner to product and engineering  -  not a layer applied at the end.',
  'Currently at Figma, where I lead the editor design system. Previously Stripe, Adobe. Open to senior IC, staff, and lead roles at growth-stage B2B SaaS.',
]

const WORKING_PRINCIPLES = [
  'Evidence before aesthetics  -  every decision tied to a conversion or retention metric',
  'Design systems as product infrastructure, not just Figma libraries',
  'The best copy is no copy  -  reduce cognitive load by removing, not adding',
]

const PROJECTS = [
  {
    title: 'Stripe Checkout Redesign',
    accentClass: 'border-brand-500/30 bg-brand-500/[0.02]',
    metricClass: 'bg-brand-500/10 border-brand-500/20 text-brand-700',
    role: 'Lead Designer',
    year: '2021',
    company: 'Stripe',
    summary: 'End-to-end redesign of Stripe\'s merchant checkout flow  -  the most revenue-critical surface in the product.',
    problem:
      '67% drop-off at the payment screen in a 4-step checkout flow. Fragmented UX was costing Stripe an estimated $180k/month in abandoned orders from SMB merchants who couldn\'t complete onboarding.',
    process:
      '12 user interviews, heatmap + session-replay analysis across 40k sessions, 3 A/B test cycles, and a collaborative design sprint with 2 engineers and the PM over 8 weeks.',
    outcome:
      '+24% checkout completion rate. $180k/month recovered in previously abandoned merchant revenue. -18% abandonment rate on the payment step alone.',
    metrics: ['+24% completion', '$180k/mo recovered', '-18% abandonment'],
    tags: ['Checkout', 'Conversion', 'User Research', 'A/B Testing', 'Figma'],
  },
  {
    title: 'Figma Internal Design System v2',
    accentClass: 'border-violet-500/30 bg-violet-500/[0.02]',
    metricClass: 'bg-violet-500/10 border-violet-500/20 text-violet-700',
    role: 'Design Lead',
    year: '2023',
    company: 'Figma',
    summary: 'Rebuilt Figma\'s internal design system to support 3 product lines with one token architecture.',
    problem:
      '4 internal products running on 3 different UI systems. Design-to-engineering handoff averaged 2 weeks. Inconsistent components were being shipped twice across separate teams, with no shared source of truth.',
    process:
      'Designed token architecture, built 120-component library, integrated Storybook end-to-end, and coordinated a 6-week migration plan with dedicated engineering support per product team.',
    outcome:
      '3 products unified on a single system. Engineering delivery 40% faster. Handoff time reduced from 2 weeks to 3 days across 12 engineers.',
    metrics: ['3 products unified', '40% faster shipping', '2wk → 3 day handoff'],
    tags: ['Design Systems', 'Tokens', 'Storybook', 'Figma', 'Leadership'],
  },
]

const SKILLS_BY_CATEGORY: Record<string, { name: string; level: string }[]> = {
  Design: [
    { name: 'Figma', level: 'Expert' },
    { name: 'Prototyping', level: 'Expert' },
    { name: 'Design Systems', level: 'Expert' },
    { name: 'UI/UX', level: 'Expert' },
  ],
  Research: [
    { name: 'User Research', level: 'Advanced' },
    { name: 'A/B Testing', level: 'Advanced' },
    { name: 'Usability Testing', level: 'Advanced' },
  ],
  Product: [
    { name: 'Stakeholder Management', level: 'Proficient' },
    { name: 'Roadmapping', level: 'Proficient' },
    { name: 'OKRs', level: 'Proficient' },
  ],
  Tools: [
    { name: 'Framer', level: 'Advanced' },
    { name: 'Storybook', level: 'Proficient' },
    { name: 'FigJam', level: 'Advanced' },
  ],
}

const EXPERIENCE = [
  {
    company: 'Figma',
    role: 'Lead Product Designer',
    period: '2022  -  Present',
    bullets: [
      'Led design for core editor features including comments, multiplayer, and the new properties panel  -  shipped to 10M+ users.',
      'Rebuilt the Figma internal design system from 60 to 120+ components across a 6-week migration.',
      'Managed a team of 4 designers across 2 product areas; ran quarterly design reviews with the CPO.',
    ],
    metrics: ['10M+ users impacted', '120 component library', 'Team of 4'],
  },
  {
    company: 'Stripe',
    role: 'Product Designer',
    period: '2020  -  2022',
    bullets: [
      'Redesigned Stripe Checkout end-to-end, increasing merchant completion rate by 24% and recovering $180k/month in abandoned revenue.',
      'Built Stripe\'s first internal design system, adopted by 6 product teams within 3 months of launch.',
    ],
    metrics: ['+24% completion', '$180k/mo recovered', 'First design system at Stripe'],
  },
  {
    company: 'Adobe',
    role: 'UX Designer',
    period: '2019  -  2020',
    bullets: [
      'Designed mobile experiences for Adobe Creative Cloud on iOS and Android.',
      'Shipped Lightroom Mobile v3 UI redesign  -  40M+ active users.',
    ],
    metrics: ['40M+ users'],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLevelDot(level: string) {
  if (level === 'Expert') return 'bg-brand-400'
  if (level === 'Advanced') return 'bg-violet-400'
  if (level === 'Proficient') return 'bg-emerald-500'
  return 'bg-surface-400'
}

function getLevelLabel(level: string) {
  if (level === 'Expert') return 'text-brand-600'
  if (level === 'Advanced') return 'text-violet-600'
  if (level === 'Proficient') return 'text-emerald-600'
  return 'text-muted-foreground/50'
}

const PROJECT_ACCENT_COLORS = [
  'border-brand-500/30 bg-brand-500/[0.02]',
  'border-violet-500/30 bg-violet-500/[0.02]',
  'border-emerald-500/30 bg-emerald-500/[0.02]',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoPortfolioPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Sticky nav ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.4)]">
              <span className="text-white text-[11px] font-bold">{INITIALS}</span>
            </div>
            <span className="font-semibold text-sm text-foreground truncate">{NAME}</span>
            <span className="text-xs text-muted-foreground/50 hidden sm:inline truncate">
              · {TITLE}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://linkedin.com/in/alex-chen"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              LinkedIn
            </a>
            <a
              href="mailto:alex.chen@example.com"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 text-white text-xs font-semibold shrink-0 hover:opacity-90 transition-opacity shadow-[0_0_16px_rgba(99,102,241,0.3)]"
            >
              <Mail className="h-3 w-3" />
              Get in touch
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(40,20,70,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(40,20,70,0.04)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-brand-500/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/4 right-0 w-[500px] h-[400px] bg-violet-500/4 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-24">
          {/* Avatar */}
          <div className="relative mb-8 inline-block">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.35)]">
              <span className="text-white text-3xl font-black">{INITIALS}</span>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 blur-2xl opacity-25 -z-10" />
          </div>

          {/* Tagline */}
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.18em] mb-6 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse inline-block" />
            {TAGLINE}
          </p>

          {/* Headline */}
          <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-black tracking-tight leading-[1.04] text-balance max-w-4xl mb-6">
            {HERO_HEADLINE}
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-foreground/60 leading-relaxed max-w-2xl mb-8 font-light">
            {HERO_SUBHEADLINE}
          </p>

          {/* Featured result */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-sm text-emerald-700 font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {FEATURED_RESULT}
          </div>

          {/* Contact links */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="mailto:alex.chen@example.com"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_0_24px_rgba(99,102,241,0.3)]"
            >
              <Mail className="h-3.5 w-3.5" />
              alex.chen@example.com
              <ArrowRight className="h-3 w-3" />
            </a>
            <a
              href="https://linkedin.com/in/alex-chen"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary border border-border hover:bg-secondary hover:border-border text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              LinkedIn
            </a>
          </div>
        </div>
      </section>

      {/* ── Proof metrics ──────────────────────────────────────── */}
      <section className="border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
            {PROOF.map((p, i) => (
              <div
                key={p.label}
                className={cn(
                  'text-center px-6 py-2',
                  i < 3 && 'border-r border-border',
                )}
              >
                <p
                  className="text-[clamp(2rem,4vw,3rem)] font-black tracking-tight mb-2 leading-none"
                  style={{
                    background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    display: 'inline-block',
                    willChange: 'transform',
                    transform: 'translateZ(0)',
                  }}
                >
                  {p.value}
                </p>
                <p className="text-xs text-muted-foreground/60 font-medium leading-snug max-w-[120px] mx-auto">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recruiter summary ──────────────────────────────────── */}
      <section className="py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-secondary border border-border">
            <Globe className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/70 leading-relaxed">{RECRUITER_SUMMARY}</p>
          </div>
        </div>
      </section>

      {/* ── About ──────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-12">About</p>
          <div className="grid lg:grid-cols-[1fr_260px] gap-16 items-start">
            <div className="space-y-6">
              {ABOUT_PARAS.map((para, i) => (
                <p key={i} className={cn(
                  'leading-[1.85]',
                  i === 0 ? 'text-xl text-foreground/90 font-light' : 'text-base text-foreground/65',
                )}>
                  {para}
                </p>
              ))}
            </div>
            <div className="space-y-1 pt-1">
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-5">Working principles</p>
              {WORKING_PRINCIPLES.map((v) => (
                <div key={v} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                  <div className="w-1 h-1 rounded-full bg-brand-500/50 shrink-0 mt-2" />
                  <p className="text-sm text-foreground/60 leading-relaxed">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Selected Work ──────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-12">Selected work</p>
          <div className="space-y-6">
            {PROJECTS.map((proj, i) => (
              <article
                key={proj.title}
                className={cn(
                  'rounded-2xl border p-8 lg:p-10 transition-all duration-300 hover:shadow-[0_0_40px_rgba(99,102,241,0.06)]',
                  PROJECT_ACCENT_COLORS[i % PROJECT_ACCENT_COLORS.length],
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-black text-muted-foreground/25 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="text-2xl font-black text-foreground tracking-tight">{proj.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground/60">
                      {[proj.role, proj.company, proj.year].filter(Boolean).join(' · ')}
                    </p>
                    {proj.summary && (
                      <p className="text-sm text-foreground/55 mt-2 leading-relaxed max-w-2xl">{proj.summary}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 pt-1">
                    {proj.metrics.slice(0, 3).map((m) => (
                      <span
                        key={m}
                        className={cn(
                          'px-3 py-1.5 rounded-lg border text-xs font-bold',
                          proj.metricClass,
                        )}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-8">
                  {proj.tags.slice(0, 6).map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-0.5 bg-secondary border border-border rounded-full text-[11px] text-muted-foreground/50"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="grid sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] mb-3">Problem</p>
                    <p className="text-sm text-foreground/55 leading-relaxed">{proj.problem}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] mb-3">Process</p>
                    <p className="text-sm text-foreground/55 leading-relaxed">{proj.process}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/[0.18] p-5">
                    <p className="text-[9px] font-black text-emerald-600/60 uppercase tracking-[0.2em] mb-3">Outcome</p>
                    <p className="text-sm text-foreground/90 leading-relaxed font-medium">{proj.outcome}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Skills ─────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-12">Skills & expertise</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {Object.entries(SKILLS_BY_CATEGORY).map(([category, skills]) => (
              <div key={category}>
                <p className="text-[10px] font-bold text-muted-foreground/35 uppercase tracking-[0.15em] mb-4">{category}</p>
                <div className="space-y-3">
                  {skills.map((s) => (
                    <div key={s.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', getLevelDot(s.level))} />
                        <span className="text-sm text-foreground/75">{s.name}</span>
                      </div>
                      <span className={cn('text-[10px] font-semibold', getLevelLabel(s.level))}>
                        {s.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Experience ─────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-12">Experience</p>
          <div className="space-y-0">
            {EXPERIENCE.map((exp, i) => (
              <div key={exp.company} className="flex gap-8">
                <div className="hidden sm:flex flex-col items-center pt-1.5">
                  <div className="w-2 h-2 rounded-full bg-brand-500/50 ring-4 ring-brand-500/10 shrink-0" />
                  {i < EXPERIENCE.length - 1 && (
                    <div className="w-px flex-1 bg-gradient-to-b from-brand-500/15 to-transparent min-h-[56px] mt-1" />
                  )}
                </div>

                <div className={cn('flex-1 pb-12', i === EXPERIENCE.length - 1 && 'pb-0')}>
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-bold text-foreground text-lg leading-tight">{exp.role}</h3>
                      <span className="text-sm text-muted-foreground/60 font-medium">{exp.company}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/40 shrink-0 font-medium tabular-nums">
                      <Calendar className="h-3 w-3" />
                      {exp.period}
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-4">
                    {exp.bullets.map((b, bi) => (
                      <li key={bi} className="flex items-start gap-3 text-sm text-foreground/60 leading-relaxed">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/20 shrink-0 mt-2.5" />
                        {b}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {exp.metrics.map((m) => (
                      <span
                        key={m}
                        className="text-xs text-emerald-600 bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1 rounded-lg font-semibold"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact CTA ────────────────────────────────────────── */}
      <section className="py-32 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-14 text-center">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(99,102,241,0.07),transparent)]" />
            <div className="relative z-10">
              <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-5 tracking-tight">
                Let&apos;s build something together
              </h2>
              <p className="text-foreground/50 text-lg mb-10 max-w-md mx-auto font-light">
                Open to the right conversations. Send a note and I&apos;ll respond within 24 hours.
              </p>
              <a
                href="mailto:alex.chen@example.com"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold text-base hover:opacity-90 transition-opacity shadow-[0_0_40px_rgba(99,102,241,0.35)]"
              >
                <Mail className="h-4 w-4" />
                Get in touch
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <a
            href="https://showcase.app"
            className="flex items-center gap-2 group"
          >
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-white text-[9px] font-bold">S</span>
            </div>
            <span className="text-xs text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
              Built with Showcase
            </span>
          </a>
          <a
            href="#"
            className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          >
            Back to top ↑
          </a>
        </div>
      </footer>
    </div>
  )
}
