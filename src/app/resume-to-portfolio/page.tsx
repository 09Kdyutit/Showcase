import type { Metadata } from 'next'
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Globe2,
  Lock,
  Pencil,
  Sparkles,
} from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrackedLink } from '@/components/landing/tracked-link'
import { ViewTracker } from '@/components/landing/view-tracker'

export const metadata: Metadata = {
  title: 'Resume to Portfolio Builder',
  description:
    'Turn a PDF, DOCX, or pasted resume into an editable private portfolio draft, then use the same experience across applications and interview practice. Start free.',
  keywords: [
    'resume to portfolio',
    'resume to portfolio builder',
    'AI portfolio builder',
    'portfolio builder for students',
    'portfolio builder for new graduates',
  ],
  alternates: { canonical: '/resume-to-portfolio' },
  openGraph: {
    title: 'Turn your resume into an editable portfolio | Showcase',
    description:
      'Import the resume you already have, get an editable private portfolio draft, and keep the same career context connected across the rest of your job search.',
    url: '/resume-to-portfolio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Turn your resume into an editable portfolio | Showcase',
    description:
      'Import the resume you already have, get an editable private portfolio draft, and keep the same career context connected across the rest of your job search.',
  },
}

const STEPS = [
  {
    icon: FileText,
    title: 'Import the resume you already have',
    body: 'Upload a PDF or DOCX, or paste the text. Showcase structures your roles, projects, skills, education, and links so you do not start from another blank form.',
  },
  {
    icon: Sparkles,
    title: 'Get a complete first draft',
    body: 'Showcase turns that source material into an editable portfolio with a headline, about section, experience, project case studies, skills, and contact links.',
  },
  {
    icon: Pencil,
    title: 'Edit before anything goes live',
    body: 'Change the writing, themes, colors, images, and sections while the draft stays private. You review every AI-assisted detail before you use or publish it.',
  },
] as const

const CONNECTED_WORKFLOW = [
  'Compare your documented experience with a role before you apply.',
  'Prepare an editable resume kit, cover letter, and outreach draft for that role.',
  'Check ATS readiness and export a clean resume.',
  'Practice written interview answers with coaching and reusable story-bank examples.',
] as const

const FAQ = [
  {
    question: 'Can I build the portfolio without paying?',
    answer:
      'Yes. Free includes resume import, one AI portfolio generation, editing, themes, images, a quality checklist, and private preview. No credit card is required to start.',
  },
  {
    question: 'Does Showcase publish my resume automatically?',
    answer:
      'No. Your generated portfolio is a private draft. Live publishing is a Pro feature, and even after upgrading you must return to the editor and explicitly choose Publish.',
  },
  {
    question: 'Can I correct what the AI writes?',
    answer:
      'Yes. The portfolio stays editable. Showcase is designed to draft from the resume and details you provide, but AI can make mistakes, so you should review and change anything that is not accurate or useful.',
  },
  {
    question: 'What happens after the portfolio is built?',
    answer:
      'The same career context stays available for role matching, application materials, ATS checks, resume exports, interview practice, and opportunities. You do not have to rebuild your story in a separate tool.',
  },
] as const

export default function ResumeToPortfolioPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <ViewTracker event="landing_viewed" metadata={{ route: '/resume-to-portfolio' }} />

      <main>
        <section className="px-4 pb-24 pt-32 sm:px-6 sm:pb-32 sm:pt-40">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Badge variant="outline" className="mb-5">Resume to portfolio</Badge>
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
                Turn your resume into a portfolio you can actually make your own.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Import a PDF or DOCX, or paste your resume. Showcase builds an editable
                private portfolio draft from the experience you provide, then keeps that
                same context connected to applications and interview practice.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild variant="gradient" size="lg" className="gap-2">
                  <TrackedLink
                    href="/signup"
                    event="hero_primary_cta_clicked"
                    ctaLabel="resume_to_portfolio_hero"
                  >
                    Build my portfolio free <ArrowRight className="h-4 w-4" />
                  </TrackedLink>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <TrackedLink
                    href="/#how-it-works"
                    event="hero_secondary_cta_clicked"
                    ctaLabel="resume_to_portfolio_workflow"
                  >
                    See the connected workflow
                  </TrackedLink>
                </Button>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> No credit card required</span>
                <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-emerald-400" /> Private by default</span>
                <span className="flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5 text-emerald-400" /> Everything stays editable</span>
              </div>
            </div>

            <div className="glass-card overflow-hidden p-2 shadow-glow">
              <div className="rounded-xl border border-border bg-surface-100 p-5 sm:p-7">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                      <FileText className="h-5 w-5 text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">resume.pdf</p>
                      <p className="text-xs text-muted-foreground">Your existing experience</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400">Imported</span>
                </div>

                <div className="flex items-center justify-center py-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-500/25 bg-brand-500/10">
                    <ArrowRight className="h-4 w-4 text-brand-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.04] p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Editable portfolio draft</p>
                      <p className="mt-1 text-xs text-muted-foreground">Private until you choose otherwise</p>
                    </div>
                    <Badge variant="default">Draft</Badge>
                  </div>
                  <div className="space-y-3">
                    {['Headline and about', 'Experience and projects', 'Skills and contact links'].map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-lg border border-border bg-surface-50 px-3 py-2.5 text-sm text-foreground/80">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-400" /> {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface-50/40 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">From document to working draft</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Skip the blank canvas without giving up control.
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="glass-card p-6">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10">
                    <Icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="outline" className="mb-5">More than a converter</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Build the portfolio once. Keep using the experience behind it.
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
                A portfolio link is useful. The source material behind it is useful again
                when you compare roles, prepare an application, check a resume, or practice
                an interview. Showcase keeps those steps in one workspace.
              </p>
              <Button asChild variant="gradient" size="lg" className="mt-8 gap-2">
                <TrackedLink
                  href="/signup"
                  event="hero_primary_cta_clicked"
                  ctaLabel="resume_to_portfolio_connected"
                >
                  Start with my resume <ArrowRight className="h-4 w-4" />
                </TrackedLink>
              </Button>
            </div>
            <div className="glass-card p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10">
                  <BriefcaseBusiness className="h-5 w-5 text-brand-400" />
                </div>
                <div>
                  <p className="font-semibold">Your connected job-search workspace</p>
                  <p className="text-xs text-muted-foreground">One source of career context</p>
                </div>
              </div>
              <div className="space-y-3">
                {CONNECTED_WORKFLOW.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border border-border bg-surface-100 p-4 text-sm leading-relaxed text-foreground/80">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface-50/40 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">Free first, Pro when you need a live link</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Build privately before you decide to publish.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="glass-card p-7">
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Free</p>
                <p className="mt-3 text-3xl font-bold">$0</p>
                <ul className="mt-6 space-y-3 text-sm text-foreground/80">
                  {[
                    'PDF, DOCX, and pasted resume import',
                    'One AI portfolio generation',
                    'Full editing, themes, images, and checklist',
                    'Private portfolio preview',
                    'One complete 11-dimension Evidence Audit every 24 hours',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" /> {item}</li>
                  ))}
                </ul>
              </div>
              <div className="glass-card border-brand-500/30 p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-brand-300">Pro</p>
                    <p className="mt-3 text-3xl font-bold">$15<span className="text-base font-normal text-muted-foreground">/month</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">or $150/year</p>
                  </div>
                  <Globe2 className="h-6 w-6 text-brand-400" />
                </div>
                <ul className="mt-6 space-y-3 text-sm text-foreground/80">
                  {[
                    'Live portfolio publishing and preview card',
                    'Portfolio regeneration and higher AI limits',
                    '10 complete 11-dimension Evidence Audits every 24 hours',
                    'Personalized job tools and expanded application workflows',
                    'Standalone HTML portfolio export',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" /> {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight">Resume-to-portfolio questions</h2>
            <div className="mt-8 space-y-4">
              {FAQ.map(({ question, answer }) => (
                <div key={question} className="glass-card p-5">
                  <h3 className="font-semibold">{question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border px-4 py-24 text-center sm:px-6 sm:py-32">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">
              Your resume already has the starting material.
            </h2>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">
              Turn it into an editable private portfolio, then decide when it is ready to share.
            </p>
            <Button asChild variant="gradient" size="lg" className="mt-8 gap-2">
              <TrackedLink
                href="/signup"
                event="hero_primary_cta_clicked"
                ctaLabel="resume_to_portfolio_final"
              >
                Build my portfolio free <ArrowRight className="h-4 w-4" />
              </TrackedLink>
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">No credit card required. Your draft stays private until you choose otherwise.</p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
