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
    'Showcase helps your students turn résumés and projects into evidence-backed portfolios  -  with an honest ProofScore audit instead of generic AI text. No fabricated experience, no inflated claims.',
  alternates: { canonical: '/for-career-services' },
  openGraph: {
    title: 'Showcase for Career Services Teams',
    description: 'Give students a structured way to turn real coursework and internships into proof, with no fabrication risk.',
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
          Help every student turn their work into evidence  -  not just a nicer-looking résumé
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-12 max-w-2xl">
          Career services teams spend a limited number of advising hours across hundreds of
          students. Showcase gives students a structured first pass  -  a portfolio draft and an
          honest audit of what is missing  -  so your advisors can spend their time on judgment
          calls, not formatting and missing-metric triage.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-16">
          {[
            'Students upload a résumé and get a structured portfolio draft, not a blank page to start from.',
            'ProofScore flags specific, concrete gaps (e.g. "3 of 8 bullets have no measurable outcome") your advisors can act on directly.',
            'Nothing is fabricated  -  Showcase will not invent an internship, metric, or skill a student does not have.',
            'Students control what gets published. A draft stays private until the student chooses to share it.',
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
                Showcase is not designed to fabricate credentials, inflate achievements, or
                mass-produce generic applications. If a student has no measurable outcome for a
                project, ProofScore says so  -  it does not invent one. That is the same behavior
                whether a student finds Showcase on their own or through your program.
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight mb-6">What this is not</h2>
        <ul className="space-y-2.5 text-sm text-muted-foreground mb-16">
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
            Not a guarantee of placement, interviews, or any specific hiring outcome for your students.
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
            Not a replacement for advisor judgment  -  ProofScore flags gaps, it does not coach.
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
            Not a current LinkedIn or campus career-system integration  -  students bring their résumé directly.
          </li>
        </ul>

        <div className="glass-card p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            We are currently in a private beta and have not yet built dedicated cohort or
            institutional tooling. If you want to explore Showcase for your students, tell us
            about your program and we will follow up directly.
          </p>
          <Button asChild variant="gradient" size="lg" className="gap-2 shadow-glow">
            <Link href="/waitlist">
              Tell us about your program
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
