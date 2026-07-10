import type { Metadata } from 'next'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { PublicProofScoreTool } from '@/components/proofscore/public-proofscore-tool'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_DEFINITIONS, type ProofScoreCategoryKey } from '@/lib/proofscore/engine'

export const metadata: Metadata = {
  title: 'Free Resume ProofScore — See What Your Resume Actually Proves',
  description:
    'Paste your resume and get an honest 0–100 ProofScore across 11 evidence-based dimensions. See every score and two complete fixes with no account required.',
  alternates: { canonical: '/proofscore' },
  openGraph: {
    title: 'Find out what your resume actually proves',
    description: 'A free 11-dimension resume audit with real scores, specific evidence, and no invented wins.',
    url: '/proofscore',
  },
}

const CATEGORY_DESCRIPTIONS: Record<ProofScoreCategoryKey, string> = {
  role_positioning: 'Whether your headline or current role clearly points toward the work you want.',
  first_impression: 'Whether your summary gives a reviewer enough useful context at a glance.',
  target_role_alignment: 'How much of the target role’s language is supported by your actual experience.',
  evidence_strength: 'The share of experience bullets that show specific action rather than vague responsibility.',
  quantified_impact: 'The share of bullets with a real number, percentage, scope, or measurable outcome.',
  project_depth: 'Whether projects document a substantive contribution and a clear outcome.',
  case_study_quality: 'Whether problem, process, outcome, and supporting proof are present.',
  credibility_signals: 'Education, certifications, and links that make important claims checkable.',
  contact_readiness: 'Whether a reviewer can reach you and inspect at least one professional profile or work sample.',
  keyword_support: 'Whether you have enough relevant, supported skills for people and screening software to recognize.',
  presentation_clarity: 'Whether dates and bullet counts make your progression easy to scan.',
}

const CATEGORIES = CATEGORY_DEFINITIONS.map((category) => ({
  name: category.name,
  desc: CATEGORY_DESCRIPTIONS[category.key],
}))

interface PageProps {
  searchParams: Promise<{ reservation?: string | string[] }>
}

export default async function ProofScorePage({ searchParams }: PageProps) {
  const params = await searchParams
  const reservationToken = typeof params.reservation === 'string' ? params.reservation : undefined

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="px-4 pb-28 pt-24 sm:px-6 sm:pt-28">
        <div className="mx-auto max-w-5xl">
          <header className="mx-auto mb-9 max-w-3xl text-center sm:mb-12">
            <Badge variant="outline" className="mb-4 border-brand-500/30 bg-brand-500/[0.06] text-brand-300">
              Free · no account needed
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Find out what your resume <span className="text-gradient">actually proves.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Paste your resume. Get an honest 0–100 ProofScore across 11 dimensions—what is strong, what is weak, and exactly what to fix first. We never inflate, and we never invent.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> All 11 scores visible</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Two complete fixes</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> No card</span>
            </div>
          </header>

          <PublicProofScoreTool reservationToken={reservationToken} />

          <section className="mt-20 sm:mt-28" aria-labelledby="methodology-heading">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <Badge variant="outline" className="mb-3">Methodology</Badge>
              <h2 id="methodology-heading" className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                An audit, not a vanity score
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                AI extracts the structure of your resume. A fixed, deterministic engine then scores countable facts in that structure, so the model never gets to decide that you “feel like” a 74.
              </p>
            </div>

            <div className="mb-8 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5 sm:p-7">
              <div className="flex items-start gap-3.5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-foreground">How the number is calculated</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    Each category uses concrete signals such as target-role term overlap, strong versus vague bullets, documented metrics, project completeness, contact details, and timeline clarity. The 11 fixed weights sum to 100. A missing resume-only case study scores zero because no case study was supplied—we name the gap instead of guessing.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {CATEGORIES.map(({ name, desc }, index) => (
                <div key={name} className="glass-card flex items-start gap-3.5 p-4 sm:p-5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-300">{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 glass-card p-5 sm:p-7">
              <h3 className="text-lg font-bold text-foreground">What ProofScore will not do</h3>
              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                <li>It will not invent a metric, employer, project, skill, or certification to raise your score.</li>
                <li>It will not predict or guarantee an interview, an offer, or a hiring outcome.</li>
                <li>It will not hide the other nine numbers behind blur; only their deeper diagnoses and fixes continue after signup.</li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
