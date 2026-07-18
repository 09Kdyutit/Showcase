'use client'

import { ArrowRight, FileText, Info, Lightbulb } from 'lucide-react'
import { ProofScoreRing } from '@/components/ui/proof-score-ring'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ParsedResumeOutput } from '@/lib/ai/schemas'
import { computeProofScore, FALLBACK_FIXES } from '@/lib/proofscore/engine'
import { cn } from '@/lib/utils'

// This route is a static product demonstration. Every score and observation below
// is computed from this visible sample resume, not from a real person or a claimed
// customer outcome.
const SAMPLE_RESUME: ParsedResumeOutput = {
  name: 'Sample candidate',
  email: 'sample@example.invalid',
  phone: null,
  location: null,
  summary: 'Product design student seeking an entry-level product designer role, with documented experience in Figma, user research, and accessible interaction design.',
  skills: ['Figma', 'User research', 'Wireframing', 'Prototyping', 'Accessibility'],
  experience: [
    {
      company: 'Campus accessibility club',
      role: 'Volunteer product designer',
      period: '2025',
      bullets: [
        'Interviewed students about navigation barriers and organized recurring themes.',
        'Helped improve the club event-registration experience.',
      ],
      metrics: [],
      has_metrics: false,
    },
  ],
  education: [
    {
      institution: 'Sample college',
      degree: 'Design student',
      year: '2026',
    },
  ],
  projects: [
    {
      title: 'Course project: event registration flow',
      description: 'Mapped an event-registration flow and created wireframes.',
      technologies: ['Figma'],
      links: [],
      has_outcome: false,
    },
  ],
  certifications: [],
  links: {
    linkedin: null,
    github: null,
    website: null,
    portfolio: null,
  },
  weak_bullets: ['Helped improve the club event-registration experience.'],
  missing_proof: ['The sample does not state an outcome for the event-registration project.'],
  possible_case_studies: ['Course project: event registration flow'],
  overall_resume_quality: 'average',
  years_of_experience: 0,
  seniority_level: 'student',
}

const SAMPLE_TARGET_ROLE = 'Entry-level product designer'
const sampleAudit = computeProofScore(SAMPLE_RESUME, null, SAMPLE_TARGET_ROLE, 'Technology')
const samplePriorities = sampleAudit.categories
  .filter((category) => category.score !== null)
  .slice()
  .sort((a, b) => b.weight * (100 - (b.score ?? 100)) - a.weight * (100 - (a.score ?? 100)))
  .slice(0, 3)

function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-orange-400'
}

function supportLabel(score: number | null): string {
  if (score === null) return 'Needs portfolio context'
  if (score >= 80) return 'Well supported'
  if (score >= 60) return 'Some support'
  return 'Needs strengthening'
}

export default function DemoAuditPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="space-y-3">
        <Badge variant="outline">Illustrative sample</Badge>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Evidence Audit demo</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
            This static demo evaluates only the clearly labeled sample resume below. It is not a real person&apos;s
            Audit, and it does not predict hiring decisions or interview outcomes.
          </p>
        </div>
      </header>

      <section className="glass-card p-6" aria-labelledby="sample-source-heading">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-brand-400" />
          </div>
          <div>
            <h2 id="sample-source-heading" className="font-semibold text-foreground">Sample resume source</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Fictional teaching example. This demo computes only from the visible sample fields; no new facts are supplied.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-surface-200/60 border border-border/40 p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target role</p>
              <p className="text-foreground mt-1">{SAMPLE_TARGET_ROLE}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
              <p className="text-foreground/80 mt-1 leading-relaxed">{SAMPLE_RESUME.summary}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skills</p>
              <p className="text-foreground/80 mt-1">{SAMPLE_RESUME.skills.join(', ')}</p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-200/60 border border-border/40 p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sample experience</p>
              <p className="text-foreground mt-1">Volunteer product designer · Campus accessibility club · 2025</p>
            </div>
            <ul className="space-y-2 text-foreground/80 list-disc pl-5">
              {SAMPLE_RESUME.experience[0].bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sample project</p>
              <p className="text-foreground/80 mt-1">{SAMPLE_RESUME.projects[0].description}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card p-6 sm:p-8 relative overflow-hidden" aria-labelledby="sample-score-heading">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-8">
          <div className="flex flex-col items-center gap-3">
            <ProofScoreRing score={sampleAudit.overall_score} size="xl" animate />
            <Badge variant="outline">Sample score</Badge>
          </div>

          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <h2 id="sample-score-heading" className="text-xl font-bold text-foreground">Sample evidence-clarity review</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {sampleAudit.overall_score} / 100 across exactly {sampleAudit.categories.length} dimensions
              </p>
            </div>
            <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/15 flex items-start gap-2 text-left">
              <Info className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                The score describes how clearly this sample supports its own statements. It is not a candidate
                ranking, hiring verdict, or promise of an interview.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="dimensions-heading">
        <div className="mb-4">
          <h2 id="dimensions-heading" className="text-sm font-semibold text-foreground">11 evidence-clarity dimensions</h2>
          <p className="text-xs text-muted-foreground mt-1">
            These are the same complete dimensions used in the authenticated Evidence Audit.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {sampleAudit.categories.map((category, index) => (
            <article key={category.key} className="glass-card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground/50">#{index + 1}</span>
                  <h3 className="font-semibold text-sm text-foreground">{category.name}</h3>
                </div>
                <span className={cn('text-lg font-bold shrink-0', scoreColor(category.score))}>
                  {category.score === null ? '—' : category.score}
                </span>
              </div>

              <Badge variant="outline" className="mb-3">{supportLabel(category.score)}</Badge>
              <p className="text-xs text-foreground/80 leading-relaxed">{category.evidence.join(' ')}</p>
              <div className="mt-4 p-3 rounded-xl bg-surface-300/60">
                <p className="text-xs font-semibold text-foreground mb-1">Source-safe next step</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{FALLBACK_FIXES[category.key]}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-card p-6" aria-labelledby="sample-actions-heading">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-brand-400" />
          </div>
          <div>
            <h2 id="sample-actions-heading" className="font-semibold text-foreground">Sample next steps</h2>
            <p className="text-xs text-muted-foreground">Prioritized from gaps in the sample source above</p>
          </div>
        </div>
        <div className="space-y-3">
          {samplePriorities.map((category, index) => (
            <div key={category.key} className="flex items-start gap-3 p-4 rounded-xl bg-surface-200/60 border border-border/40">
              <div className="w-6 h-6 rounded-full bg-brand-500/15 flex items-center justify-center shrink-0 text-xs font-bold text-brand-400">
                {index + 1}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{category.name}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{FALLBACK_FIXES[category.key]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild variant="gradient" className="gap-1.5">
          <a href="/demo/resume">
            See the resume workspace
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <a href="/demo/builder">
            See the portfolio editor
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
