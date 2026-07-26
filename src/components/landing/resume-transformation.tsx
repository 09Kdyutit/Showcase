import { ArrowRight, CheckCircle2, FileText, LayoutTemplate, Lock } from 'lucide-react'
import { SectionLabel } from '@/components/shared/section-label'

export function ResumeTransformation() {
  return (
    <section id="example" className="scroll-mt-24 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <SectionLabel number="02" className="mb-6">Example</SectionLabel>
          <h2
            className="text-balance font-bold tracking-tight"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 3.75rem)', letterSpacing: '-0.035em' }}
          >
            A résumé bullet becomes a story people can scan.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Showcase keeps the facts. It gives them a clearer structure and a portfolio-ready format.
          </p>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-[0.78fr_auto_1.22fr]">
          <article className="glass-card p-6 sm:p-8">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                <FileText className="h-4 w-4" />
                Before · résumé
              </div>
              <span className="rounded-full border border-border bg-surface-200 px-2.5 py-1 text-[10px] text-muted-foreground">
                Demo content
              </span>
            </div>
            <p className="text-lg leading-relaxed text-foreground/80">
              Internal tooling used by 40 people weekly. Improved the CI pipeline and cut deploy time 30%.
            </p>
            <div className="mt-8 space-y-2" aria-hidden="true">
              <div className="h-1.5 w-full rounded-full bg-white/10" />
              <div className="h-1.5 w-5/6 rounded-full bg-white/10" />
              <div className="h-1.5 w-2/3 rounded-full bg-white/10" />
            </div>
          </article>

          <div className="flex items-center justify-center py-1 text-brand-300">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-500/30 bg-brand-500/10">
              <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" />
            </span>
          </div>

          <article className="overflow-hidden rounded-3xl border border-brand-500/30 bg-card shadow-[0_24px_80px_oklch(0%_0_0/0.35)]">
            <div className="border-b border-brand-500/20 bg-gradient-to-r from-brand-500/20 to-violet-500/10 px-6 py-5 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand-200">
                  <LayoutTemplate className="h-4 w-4" />
                  After · editable portfolio case study
                </div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Private draft
                </span>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-300">Jordan Chen · Software Engineer</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Faster releases for an internal team
              </h3>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  ['Project', 'Internal tooling'],
                  ['Reach', 'Used by 40 people weekly'],
                  ['Result', 'Deploy time cut 30%'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-surface-100 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-2 text-sm font-medium leading-snug text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                The facts stay the same. You can edit the title, structure, copy, and design before anything is published.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
