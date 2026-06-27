'use client'

import { useMemo, useState } from 'react'
import {
  Zap, ChevronRight, AlertCircle, AlertTriangle,
  Check, X, FileText, ArrowLeft,
  ShieldCheck, BookOpen, MessageSquare, Target, Info,
  Sparkles, ChevronDown, ChevronUp, Copy, Download, Lock,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getUnconfirmedFabricationRisks } from '@/lib/jobs/truth-ledger'
import type { TruthEntry, TailoredBullet, TailoredExperience, InterviewBrief } from '@/types/database'

// ── Static demo output - mirrors the shape returned by /api/jobs/[id]/tailor ──
const JOB_TITLE = 'Product Designer - Checkout & Payments'
const JOB_COMPANY = 'Volta Financial'

const DEMO_EXPERIENCE: TailoredExperience[] = [
  {
    company: 'Stripe',
    role: 'Product Designer',
    period: '2020 - 2022',
    original_bullets: [
      'Redesigned Stripe Checkout, increasing completion rate by 24%.',
      "Built Stripe's first internal design system from scratch.",
    ],
    tailored_bullets: [
      {
        original: 'Redesigned Stripe Checkout, increasing completion rate by 24%.',
        tailored: 'Led end-to-end redesign of Stripe Checkout - the exact surface this role owns - increasing completion rate by 24% and directly informing this application.',
        change_type: 'rewritten',
        reason: 'Moved to the top and rewritten to mirror the language in the job description ("own design for our checkout and payments product surface").',
        source_evidence: 'Resume bullet, Stripe Product Designer role',
        needs_user_input: false,
        accepted: true,
      },
      {
        original: "Built Stripe's first internal design system from scratch.",
        tailored: "Built Stripe's first internal design system from scratch, establishing patterns later adopted company-wide.",
        change_type: 'rewritten',
        reason: 'Strengthened with outcome language since the role mentions "contribute to and evolve our design system."',
        source_evidence: 'Resume bullet, Stripe Product Designer role',
        needs_user_input: false,
        accepted: true,
      },
    ],
  },
  {
    company: 'Figma',
    role: 'Lead Product Designer',
    period: '2022 - Present',
    original_bullets: [
      'Led design for core editor and collaboration features.',
      "Owned and maintained Figma's internal design system.",
    ],
    tailored_bullets: [
      {
        original: 'Led design for core editor and collaboration features.',
        tailored: 'Led design for core editor and collaboration features used by [PLACEHOLDER: add user count if known].',
        change_type: 'rewritten',
        reason: 'Flagged for a metric - your resume doesn\'t state a user count for this feature area, so a placeholder was inserted instead of inventing one.',
        source_evidence: 'Resume bullet, Figma Lead Product Designer role',
        needs_user_input: true,
        placeholder: '[PLACEHOLDER: add user count if known]',
        accepted: false,
      },
      {
        original: "Owned and maintained Figma's internal design system.",
        tailored: "Owned and maintained Figma's internal design system.",
        change_type: 'unchanged',
        reason: 'Already relevant - kept as-is.',
        source_evidence: 'Resume bullet, Figma Lead Product Designer role',
        needs_user_input: false,
        accepted: true,
      },
    ],
  },
]

const DEMO_TRUTH_MAP: TruthEntry[] = [
  {
    statement: 'Led end-to-end redesign of Stripe Checkout - the exact surface this role owns - increasing completion rate by 24%.',
    source_text: 'Redesigned Stripe Checkout, increasing completion rate by 24%.',
    source_location: 'Resume → Experience → Stripe → Product Designer',
    change_type: 'rewritten',
    evidence_present: true,
    requires_confirmation: false,
    user_confirmed: null,
  },
  {
    statement: "Built Stripe's first internal design system from scratch, establishing patterns later adopted company-wide.",
    source_text: "Built Stripe's first internal design system from scratch.",
    source_location: 'Resume → Experience → Stripe → Product Designer',
    change_type: 'rewritten',
    evidence_present: true,
    requires_confirmation: true,
    user_confirmed: null,
  },
  {
    statement: 'Designed the checkout flow for a fintech product processing over $1B in annual volume.',
    source_text: 'No matching statement found in resume.',
    source_location: 'Not found in source resume',
    change_type: 'fabrication_risk',
    evidence_present: false,
    requires_confirmation: true,
    user_confirmed: null,
  },
]

const DEMO_INTERVIEW_BRIEF: InterviewBrief = {
  role_themes: ['Checkout funnel optimization', 'Payments UX', 'Design systems at scale', 'Embedded fintech infrastructure'],
  behavioral_questions: [
    'Tell me about a time you redesigned a high-stakes flow like checkout. How did you measure success?',
    'Describe how you built or scaled a design system from zero.',
    'How do you balance speed with rigor when working with a small (2 PM, 8 engineer) team?',
  ],
  project_questions: [
    'Walk me through your Stripe Checkout redesign - what was broken, and how did you find it?',
  ],
  star_evidence: [
    {
      question_theme: 'Redesigning a high-stakes conversion flow',
      situation: 'Stripe Checkout had a completion rate below industry benchmarks.',
      task: 'Lead the end-to-end redesign of the checkout experience.',
      action: 'Audited the funnel, ran usability tests, and shipped an iterative redesign.',
      result: 'Completion rate increased by 24%.',
      source_project: 'Checkout Redesign',
    },
  ],
  skill_gaps_to_address: ['No documented accessibility (WCAG) audit experience - be ready to discuss your general approach.'],
  questions_to_ask: [
    'What does the checkout funnel look like today, and where is the biggest drop-off?',
    'How is the design team structured relative to the 2 PMs and 8 engineers on this surface?',
  ],
  company_research_placeholders: ['[Research Volta\'s recent funding round and merchant base before the interview]'],
}

const DEMO_TAILORED = {
  professional_summary: 'Product Designer with 5 years of experience shipping high-stakes checkout and payments flows. Led the Stripe Checkout redesign that increased completion rate by 24%, and built design systems used by entire product orgs.',
  skills: ['Figma', 'Prototyping', 'Design Systems', 'User Research', 'A/B Testing', 'Stakeholder Management'],
  experience: DEMO_EXPERIENCE,
  recommended_projects: ['Checkout Redesign', 'Design System v2'],
  portfolio_headline: 'I redesigned Stripe Checkout and increased completion by 24% - now I want to do it for Volta.',
  recruiter_summary: 'Alex is a Product Designer with direct checkout/payments redesign experience (Stripe, +24% completion) and a track record building design systems from scratch - a strong fit for Volta\'s Checkout & Payments role.',
  cover_letter: "I'm excited about the Product Designer role on Volta's Checkout & Payments team. At Stripe, I led a checkout redesign that increased completion rate by 24% - the exact kind of high-stakes, high-leverage work this role is built around. I'd love to bring that experience to Volta's $4B-volume merchant base.",
  recruiter_note: "Hi - I saw the Product Designer opening on the Checkout & Payments team. I led Stripe's checkout redesign (+24% completion) and would love to chat about how that experience maps to Volta's merchant flows.",
  truth_map: DEMO_TRUTH_MAP,
  interview_brief: DEMO_INTERVIEW_BRIEF,
}

// ── Truth entry card ──────────────────────────────────────────────────────────
function TruthCard({ entry, onConfirm }: { entry: TruthEntry; onConfirm: (confirmed: boolean) => void }) {
  const riskColor =
    entry.change_type === 'fabrication_risk' ? 'border-red-500/30 bg-red-500/5' :
    entry.requires_confirmation ? 'border-amber-500/30 bg-amber-500/5' :
    'border-border bg-surface-100'

  const icon =
    entry.change_type === 'fabrication_risk' ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> :
    entry.evidence_present ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> :
    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', riskColor)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {icon}
          <p className="text-xs font-medium text-foreground/90 leading-relaxed flex-1 min-w-0">{entry.statement}</p>
        </div>
        <Badge variant="outline" className={cn('text-[10px] shrink-0', {
          'text-emerald-600 border-emerald-500/20': entry.change_type === 'rewritten',
          'text-blue-600 border-blue-500/20': entry.change_type === 'reordered',
          'text-brand-700 border-brand-500/20': entry.change_type === 'new_from_source',
          'text-red-600 border-red-500/20': entry.change_type === 'fabrication_risk',
        })}>
          {entry.change_type.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="border-l-2 border-border pl-3">
        <p className="text-[11px] text-muted-foreground/60 mb-0.5">Source</p>
        <p className="text-[11px] text-muted-foreground italic">&ldquo;{entry.source_text}&rdquo;</p>
        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{entry.source_location}</p>
      </div>

      {entry.requires_confirmation && entry.user_confirmed === null && (
        <div className="flex items-center gap-2 pt-1">
          <button onClick={() => onConfirm(true)} className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
            <Check className="h-3 w-3" /> This is accurate
          </button>
          <span className="text-muted-foreground/30">·</span>
          <button onClick={() => onConfirm(false)} className="flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 transition-colors">
            <X className="h-3 w-3" /> Not accurate
          </button>
        </div>
      )}
      {entry.user_confirmed === true && (
        <p className="text-[11px] text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> Confirmed accurate</p>
      )}
      {entry.user_confirmed === false && (
        <p className="text-[11px] text-red-600 flex items-center gap-1"><X className="h-3 w-3" /> Flagged - needs revision</p>
      )}
    </div>
  )
}

// ── Diff bullet ───────────────────────────────────────────────────────────────
function DiffBullet({ bullet, onAccept, onReject }: { bullet: TailoredBullet; onAccept: () => void; onReject: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const isNew = bullet.change_type === 'new'
  const isUnchanged = bullet.change_type === 'unchanged'

  if (isUnchanged) {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground/60 py-1">
        <span className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0 mt-1.5" />
        {bullet.original ?? bullet.tailored}
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2 text-xs',
      bullet.needs_user_input ? 'border-amber-500/30 bg-amber-500/5' :
      bullet.accepted ? 'border-emerald-500/20 bg-emerald-500/5' :
      'border-border bg-surface-100'
    )}>
      {bullet.original && !isNew && (
        <div className="line-through text-muted-foreground/50 leading-relaxed">{bullet.original}</div>
      )}
      <div className={cn('leading-relaxed font-medium', bullet.needs_user_input ? 'text-amber-700' : bullet.accepted ? 'text-emerald-600' : 'text-foreground')}>
        {bullet.tailored}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-[10px]', {
            'text-brand-700 border-brand-500/20': bullet.change_type === 'rewritten',
            'text-blue-600 border-blue-500/20': bullet.change_type === 'reordered',
            'text-violet-600 border-violet-500/20': bullet.change_type === 'new',
          })}>
            {bullet.change_type}
          </Badge>
          <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-0.5">
            {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            Why
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {bullet.accepted ? (
            <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> Accepted</span>
          ) : (
            <>
              <button onClick={onAccept} className="text-[10px] text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 transition-colors">
                <Check className="h-2.5 w-2.5" /> Accept
              </button>
              <span className="text-muted-foreground/30">·</span>
              <button onClick={onReject} className="text-[10px] text-red-600 hover:text-red-700 flex items-center gap-0.5 transition-colors">
                <X className="h-2.5 w-2.5" /> Revert
              </button>
            </>
          )}
        </div>
      </div>
      {expanded && <p className="text-[11px] text-muted-foreground/60 border-t border-border pt-2">{bullet.reason}</p>}
    </div>
  )
}

// ── Main demo Tailor Studio ────────────────────────────────────────────────────
export default function DemoTailorStudioPage() {
  const [experience, setExperience] = useState(DEMO_TAILORED.experience)
  const [truthMap, setTruthMap] = useState(DEMO_TAILORED.truth_map)
  const [activeSection, setActiveSection] = useState<'summary' | 'experience' | 'truth' | 'interview'>('summary')

  const unconfirmed = useMemo(() => getUnconfirmedFabricationRisks(truthMap), [truthMap])
  const fabricationRisks = truthMap.filter(e => e.change_type === 'fabrication_risk').length
  const pendingConfirmations = truthMap.filter(e => e.requires_confirmation && e.user_confirmed === null).length

  function handleBulletAccept(expIdx: number, bulletIdx: number) {
    setExperience(prev => {
      const next = [...prev]
      const bullets = [...next[expIdx].tailored_bullets]
      bullets[bulletIdx] = { ...bullets[bulletIdx], accepted: true }
      next[expIdx] = { ...next[expIdx], tailored_bullets: bullets }
      return next
    })
  }

  function handleBulletReject(expIdx: number, bulletIdx: number) {
    setExperience(prev => {
      const next = [...prev]
      const bullets = [...next[expIdx].tailored_bullets]
      const original = bullets[bulletIdx].original ?? bullets[bulletIdx].tailored
      bullets[bulletIdx] = { ...bullets[bulletIdx], tailored: original, change_type: 'unchanged', accepted: false }
      next[expIdx] = { ...next[expIdx], tailored_bullets: bullets }
      return next
    })
  }

  function handleTruthConfirm(idx: number, confirmed: boolean) {
    setTruthMap(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], user_confirmed: confirmed }
      return next
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-border bg-surface-50 px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/demo/jobs" className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">{JOB_TITLE} · {JOB_COMPANY}</h1>
            <p className="text-xs text-muted-foreground">Tailor Studio</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingConfirmations > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-500/20 text-[10px]">{pendingConfirmations} to review</Badge>
          )}
          {fabricationRisks > 0 && (
            <Badge variant="outline" className="text-red-600 border-red-500/20 text-[10px]">{fabricationRisks} to fix</Badge>
          )}
          <Button variant="gradient" size="sm" className="gap-1.5" disabled>
            <Sparkles className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex flex-col w-48 border-r border-border bg-surface-50 p-3 gap-1 shrink-0">
          {[
            { id: 'summary', icon: FileText, label: 'Summary & Skills' },
            { id: 'experience', icon: Zap, label: 'Experience' },
            { id: 'truth', icon: ShieldCheck, label: 'Truth Ledger' },
            { id: 'interview', icon: BookOpen, label: 'Interview Brief' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id as typeof activeSection)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left',
                activeSection === id ? 'bg-brand-500/10 text-brand-700 border border-brand-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-surface-200'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
              {id === 'truth' && pendingConfirmations > 0 && (
                <span className="ml-auto text-[9px] bg-amber-500/20 text-amber-600 rounded-full px-1">{pendingConfirmations}</span>
              )}
            </button>
          ))}

          <div className="mt-auto pt-3 border-t border-border space-y-2">
            <div className="rounded-lg bg-surface-200 p-3 text-[11px] text-muted-foreground leading-relaxed">
              <ShieldCheck className="h-3 w-3 text-brand-600 mb-1.5" />
              Every change is traced to your actual resume. The Truth Ledger shows the source for each statement.
            </div>
            {unconfirmed.length > 0 ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-600 leading-relaxed flex items-start gap-1.5">
                <Lock className="h-3 w-3 shrink-0 mt-0.5" />
                Export blocked - {unconfirmed.length} statement{unconfirmed.length > 1 ? 's' : ''} need confirmation in the Truth Ledger.
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                <Download className="h-3 w-3" />
                Export .docx
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar">
          <div className="p-6 max-w-3xl mx-auto space-y-8">

            {activeSection === 'summary' && (
              <div className="space-y-6">
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-600" />
                    Professional Summary
                  </h2>
                  <div className="rounded-xl border border-border bg-surface-100 p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{DEMO_TAILORED.professional_summary}</p>
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-3">Skills (reordered for this role)</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {DEMO_TAILORED.skills.map((s, i) => (
                      <span key={s + i} className={cn('text-xs px-2.5 py-1 rounded-lg border', i < 3 ? 'bg-brand-500/10 border-brand-500/20 text-brand-700' : 'bg-surface-200 border-border text-muted-foreground')}>
                        {s}
                      </span>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-brand-600" />
                    Recommended Projects to Highlight
                  </h2>
                  <div className="space-y-2">
                    {DEMO_TAILORED.recommended_projects.map(p => (
                      <div key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="h-4 w-4 text-brand-600/50" />{p}
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-3">Portfolio Headline</h2>
                  <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
                    <p className="text-base font-semibold text-brand-700">{DEMO_TAILORED.portfolio_headline}</p>
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-3">Recruiter Summary</h2>
                  <div className="rounded-xl border border-border bg-surface-100 p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{DEMO_TAILORED.recruiter_summary}</p>
                    <button className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground mt-2 transition-colors">
                      <Copy className="h-2.5 w-2.5" /> Copy
                    </button>
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-brand-600" />
                    Cover Letter
                  </h2>
                  <div className="rounded-xl border border-border bg-surface-100 p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{DEMO_TAILORED.cover_letter}</p>
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-3">Recruiter Outreach Note</h2>
                  <div className="rounded-xl border border-border bg-surface-100 p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{DEMO_TAILORED.recruiter_note}</p>
                  </div>
                </section>
              </div>
            )}

            {activeSection === 'experience' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Tailored Experience</h2>
                  <p className="text-xs text-muted-foreground/60">Review each change, then accept or revert</p>
                </div>
                {experience.map((exp, expIdx) => (
                  <div key={expIdx} className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{exp.role}</h3>
                      <span className="text-xs text-muted-foreground">at {exp.company}</span>
                      <span className="text-xs text-muted-foreground/50">{exp.period}</span>
                    </div>
                    <div className="space-y-2 pl-3 border-l border-border">
                      {exp.tailored_bullets.map((bullet, bulletIdx) => (
                        <DiffBullet
                          key={bulletIdx}
                          bullet={bullet}
                          onAccept={() => handleBulletAccept(expIdx, bulletIdx)}
                          onReject={() => handleBulletReject(expIdx, bulletIdx)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'truth' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand-600" />
                    Truth Ledger
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    {pendingConfirmations > 0 && <span className="text-amber-600">{pendingConfirmations} need review</span>}
                    {fabricationRisks > 0 && <span className="text-red-600">{fabricationRisks} fabrication risks</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface-100 p-4 text-xs text-muted-foreground/70 leading-relaxed">
                  <Info className="h-3.5 w-3.5 text-brand-600 inline mr-1.5" />
                  Every statement below is traced to a specific part of your resume. Confirm anything marked as needing review.
                  If a statement doesn&apos;t accurately represent your experience, click &ldquo;Not accurate&rdquo; to flag it. Export is blocked until every flagged statement is resolved.
                </div>
                <div className="space-y-2">
                  {truthMap.map((entry, i) => (
                    <TruthCard key={i} entry={entry} onConfirm={(confirmed) => handleTruthConfirm(i, confirmed)} />
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'interview' && DEMO_TAILORED.interview_brief && (
              <div className="space-y-6">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-brand-600" />
                  Interview Brief
                </h2>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-600/80">
                  Based on your documented experience. STAR stories use only facts from your resume.
                  Research the company independently - do not rely solely on this brief.
                </div>
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Role Themes</h3>
                  <div className="flex flex-wrap gap-2">
                    {DEMO_TAILORED.interview_brief.role_themes.map(t => (
                      <span key={t} className="text-xs bg-brand-500/10 border border-brand-500/20 text-brand-700 rounded-lg px-2.5 py-1">{t}</span>
                    ))}
                  </div>
                </section>
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Likely Behavioral Questions</h3>
                  <ol className="space-y-2">
                    {DEMO_TAILORED.interview_brief.behavioral_questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-[11px] text-muted-foreground/40 shrink-0 mt-0.5 w-4">{i + 1}.</span>{q}
                      </li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">STAR Evidence (from your resume)</h3>
                  <div className="space-y-4">
                    {DEMO_TAILORED.interview_brief.star_evidence.map((star, i) => (
                      <div key={i} className="rounded-xl border border-border bg-surface-100 p-4 space-y-2">
                        <p className="text-xs font-semibold text-foreground">{star.question_theme}</p>
                        <p className="text-[11px] text-muted-foreground/50">Source: {star.source_project}</p>
                        {[['Situation', star.situation], ['Task', star.task], ['Action', star.action], ['Result', star.result]].map(([label, content]) => (
                          <div key={label}>
                            <p className="text-[10px] font-semibold text-brand-600/70 uppercase tracking-wide">{label}</p>
                            <p className="text-xs text-muted-foreground">{content}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Questions to Ask</h3>
                  <ul className="space-y-2">
                    {DEMO_TAILORED.interview_brief.questions_to_ask.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="h-4 w-4 text-brand-600/50 shrink-0 mt-0.5" />{q}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="text-xs font-semibold text-red-600/70 uppercase tracking-wide mb-3">Gaps the Interviewer May Probe</h3>
                  <ul className="space-y-2">
                    {DEMO_TAILORED.interview_brief.skill_gaps_to_address.map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600/60 shrink-0 mt-0.5" />{g}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
