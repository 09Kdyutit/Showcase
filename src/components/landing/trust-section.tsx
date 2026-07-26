import { CheckCircle2, FileText, PencilLine, ShieldCheck } from 'lucide-react'

const REASONS = [
  {
    icon: FileText,
    title: 'Your real experience comes first',
    description: 'Every portfolio starts with the résumé and career details you provide.',
  },
  {
    icon: PencilLine,
    title: 'Every output stays editable',
    description: 'Review, rewrite, or remove AI-assisted suggestions before you use them.',
  },
  {
    icon: ShieldCheck,
    title: 'You control what is public',
    description: 'Build and preview privately. Publishing only happens when you choose it with Pro.',
  },
] as const

export function TrustSection() {
  return (
    <section className="border-y border-dashed border-border bg-surface-100/45 px-6 py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">Why Showcase?</p>
          <h2
            className="mt-5 text-balance font-bold tracking-tight"
            style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.6rem)', letterSpacing: '-0.035em' }}
          >
            One résumé powers the whole workflow.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            Your portfolio, application materials, and interview practice stay connected to the experience you already reviewed.
          </p>
          <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-foreground/70">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
            Showcase helps you present and prepare. It does not promise interviews, offers, or jobs.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {REASONS.map(({ icon: Icon, title, description }) => (
            <article key={title} className="glass-card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/10 text-brand-300">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <h3 className="mt-5 text-base font-semibold leading-snug text-foreground">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
