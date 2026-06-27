import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'How ProofScore Works',
  description:
    'ProofScore audits your résumé and portfolio across 11 categories and tells you exactly what is weak, what evidence is missing, and what to fix first  -  not a vague AI confidence score.',
  alternates: { canonical: '/proofscore' },
  openGraph: {
    title: 'How ProofScore Works  -  Showcase',
    description: 'An honest audit, not a vanity score. See exactly what is strong, what is weak, and what to fix.',
    url: '/proofscore',
  },
}

// Mirrors src/lib/proofscore/engine.ts's CATEGORY_DEFINITIONS exactly  -  this page
// must never describe a category, weight, or behavior the real engine doesn't have.
const CATEGORIES = [
  { name: 'Role positioning', desc: 'Does your headline or current role title share any language with the role you are targeting?' },
  { name: 'First-impression clarity', desc: 'Is there a summary or subheadline, and is it long enough to actually say something  -  not blank, not one line?' },
  { name: 'Target-role alignment', desc: 'How many of your target role and industry’s terms actually appear in your résumé content?' },
  { name: 'Evidence strength', desc: 'What share of your experience bullets read as specific evidence rather than a vague claim?' },
  { name: 'Quantified impact', desc: 'What share of your bullets include a number, percentage, or measurable outcome?' },
  { name: 'Project depth', desc: 'Do your projects have a substantive description or a stated outcome, or just a title?' },
  { name: 'Case-study quality', desc: 'For published portfolio projects: how many of problem, process, outcome, and supporting proof are present?' },
  { name: 'Credibility signals', desc: 'Education, certifications, and professional links that make your claims checkable.' },
  { name: 'Contact readiness', desc: 'Can a recruiter actually reach you  -  is there an email and at least one professional link?' },
  { name: 'Keyword support', desc: 'How many distinct skills are listed, relative to what ATS keyword matching typically needs?' },
  { name: 'Presentation clarity', desc: 'Do your roles have dates, and is the bullet count per role in a reasonable range?' },
]

export default function ProofScorePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-4xl mx-auto">
        <Badge variant="outline" className="mb-4">Methodology</Badge>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-balance">
          ProofScore is an audit, not a vanity score
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-12 max-w-2xl">
          Most feedback on a résumé or portfolio is vague  -  &ldquo;looks good&rdquo; or &ldquo;needs work.&rdquo;
          ProofScore breaks your materials into 11 specific categories, scores each one 0-100, and
          tells you exactly what to fix and why it matters to a recruiter.
        </p>

        <div className="glass-card p-6 sm:p-8 mb-12 border-emerald-500/10 bg-emerald-500/[0.02]">
          <div className="flex items-start gap-4">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">How the score is calculated</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Each category is scored against your actual résumé and portfolio content  -  not a generic
                rubric applied blindly. A low score means a real, specific gap (e.g. &ldquo;3 of 8 bullets have
                no measurable outcome&rdquo;), not an arbitrary number. ProofScore never raises a score by
                inventing evidence that is not in your source material  -  if proof is missing, the category
                stays low and the gap is named so you can go fix it.
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight mb-6">The 11 categories</h2>
        <div className="space-y-3 mb-16">
          {CATEGORIES.map(({ name, desc }) => (
            <div key={name} className="glass-card p-5 flex items-start gap-4">
              <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">{name}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card p-6 sm:p-8 mb-16">
          <h2 className="text-xl font-bold text-foreground mb-4">What ProofScore will not do</h2>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>It will not invent a metric, employer, project, or certification to raise your score.</li>
            <li>It will not guarantee an interview, an offer, or any specific hiring outcome.</li>
            <li>It will not silently fix a gap  -  missing evidence is flagged for you to address, not filled in.</li>
          </ul>
        </div>

        <div className="text-center">
          <Button asChild variant="gradient" size="xl" className="gap-2 shadow-glow">
            <Link href="/waitlist">
              Join the private beta
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
