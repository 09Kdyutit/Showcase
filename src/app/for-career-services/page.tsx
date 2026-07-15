import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'For Career Services Teams',
  description:
    'Showcase gives students one workspace to turn a resume into an editable portfolio, prepare applications, practice interviews, and improve career materials without handing control to generic AI.',
  alternates: { canonical: '/for-career-services' },
  openGraph: {
    title: 'Showcase for Career Services Teams',
    description: 'Help students move from resume import to portfolio, applications, and interview practice in one connected workspace.',
    url: '/for-career-services',
  },
}

export default function CareerServicesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-4xl mx-auto">
        <Badge variant="outline" className="mb-4">For institutions</Badge>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-balance">
          Give students one place to build the portfolio, applications, and interview skills behind a job search
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-12 max-w-2xl">
          Career services teams spend a limited number of advising hours across hundreds of
          students. Showcase gives each student a structured workspace built from the resume
          they already have: an editable portfolio, role and application tools, written
          interview practice, and specific feedback they can bring into an advising session.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-16">
          {[
            'Import a PDF or DOCX resume, or paste text, then generate a portfolio draft students can fully edit.',
            'Use Evidence Audit to identify concrete improvement areas instead of treating one generic score as the answer.',
            'Compare roles with existing experience, create application kits, and keep the final review and submission with the student.',
            'Practice written, role-aware interview questions with per-answer coaching and drills.',
          ].map((s) => (
            <div key={s} className="glass-card p-5 text-sm text-muted-foreground leading-relaxed">{s}</div>
          ))}
        </div>

        <div className="glass-card p-6 sm:p-8 mb-16 border-emerald-500/10 bg-emerald-500/[0.02]">
          <div className="flex items-start gap-4">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">A boundary worth stating plainly</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Showcase uses student-provided career material as the source for AI-assisted
                suggestions. Students review and can edit the output. Unsupported details should
                not be added; gaps are surfaced for the student or advisor to resolve. Draft
                portfolios stay private, and live portfolio publishing is a Pro feature the
                student must choose to use.
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight mb-6">What stays in the student&apos;s hands</h2>
        <ul className="space-y-2.5 text-sm text-muted-foreground mb-16">
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
            They review and edit AI-assisted portfolio, resume, and application material before using it.
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
            They decide which roles to pursue and submit their own applications; Showcase does not apply on their behalf.
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
            They control whether a portfolio remains private or is published with Pro, and can unpublish it later.
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
            No placement, interview, or employment outcome is guaranteed.
          </li>
        </ul>

        <div className="glass-card p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Dedicated cohort and institutional administration tools are not available yet.
            You can explore the same Free student workspace today with no credit card.
          </p>
          <Button asChild variant="gradient" size="lg" className="gap-2 shadow-glow">
            <Link href="/signup">
              Explore the student workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
