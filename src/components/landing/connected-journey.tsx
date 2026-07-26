import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  Send,
} from 'lucide-react'
import { SectionLabel } from '@/components/shared/section-label'

const STEPS = [
  {
    number: '01',
    icon: FileText,
    title: 'Upload your résumé',
    description: 'Upload a PDF or DOCX, paste your résumé, or import your experience.',
    note: 'Start with the document you already have.',
  },
  {
    number: '02',
    icon: FileCheck2,
    title: 'Review your portfolio',
    description: 'Showcase organizes your experience into an editable portfolio. You approve and improve every AI-assisted draft.',
    note: 'Your draft stays private.',
  },
  {
    number: '03',
    icon: Send,
    title: 'Prepare your applications',
    description: 'Use the same verified experience to tailor applications, check your résumé, and practice interviews.',
    note: 'You review and send every application.',
  },
] as const

export function ConnectedJourney() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-y border-dashed border-border bg-surface-100/55 px-6 py-24 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <SectionLabel number="01" className="mb-6 justify-center">How it works</SectionLabel>
          <h2
            className="text-balance font-bold tracking-tight"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 3.75rem)', letterSpacing: '-0.035em' }}
          >
            From résumé to ready-to-review portfolio.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            One clear starting point. Three steps. Your real experience stays at the center.
          </p>
        </div>

        <ol className="grid gap-4 lg:grid-cols-3">
          {STEPS.map(({ number, icon: Icon, title, description, note }, index) => (
            <li key={number} className="relative">
              <div className="glass-card h-full p-6 sm:p-7">
                <div className="mb-7 flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-brand-300">STEP {number}</span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/10 text-brand-300">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
                <div className="mt-6 flex items-center gap-2 border-t border-dashed border-border pt-4 text-xs text-foreground/65">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-300" />
                  {note}
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <span className="absolute -right-3 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground lg:flex">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
