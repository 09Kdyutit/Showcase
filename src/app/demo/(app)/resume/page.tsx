'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileText, CheckCircle2, AlertCircle, Lock, ArrowRight,
  Mail, Briefcase, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'skills' | 'experience' | 'weak-bullets'

const SKILLS = [
  { name: 'Figma', level: 'Expert' },
  { name: 'Design Systems', level: 'Expert' },
  { name: 'User Research', level: 'Advanced' },
  { name: 'Prototyping', level: 'Advanced' },
  { name: 'A/B Testing', level: 'Intermediate' },
  { name: 'Stakeholder Management', level: 'Intermediate' },
]

const EXPERIENCE = [
  {
    company: 'Figma',
    role: 'Lead Product Designer',
    period: '2022  -  Present',
    bullets: [
      'Led design for core editor and collaboration features.',
      'Owned and maintained Figma\'s internal design system.',
      'Managed a team of 4 designers across 2 product areas.',
    ],
  },
  {
    company: 'Stripe',
    role: 'Product Designer',
    period: '2020  -  2022',
    bullets: [
      'Redesigned Stripe Checkout, increasing completion rate by 24%.',
      'Built Stripe\'s first internal design system from scratch.',
    ],
  },
  {
    company: 'Adobe',
    role: 'UX Designer',
    period: '2019  -  2020',
    bullets: [
      'Designed mobile experiences for Adobe Creative Cloud apps.',
    ],
  },
]

const PROJECTS = [
  { name: 'Checkout Redesign', role: 'Lead Designer', year: '2021' },
  { name: 'Design System v2', role: 'Design Lead', year: '2023' },
]

const WEAK_BULLETS = [
  {
    original: '• Helped improve checkout flow',
    severity: 'critical' as const,
    fix: 'Add specific metric: "Redesigned checkout flow, increasing completion rate by 24% and reducing abandonment by 18%"',
  },
  {
    original: '• Worked with design team',
    severity: 'major' as const,
    fix: 'Specify your role: "Led cross-functional team of 4 designers, delivering system that reduced handoff time from 2 weeks to 3 days"',
  },
  {
    original: '• Improved user experience',
    severity: 'major' as const,
    fix: 'Quantify: "Improved user satisfaction score (CSAT) from 3.2 to 4.6 through targeted UX research and 3 A/B test cycles"',
  },
]

function getLevelDot(level: string) {
  if (level === 'Expert') return 'bg-brand-400'
  if (level === 'Advanced') return 'bg-violet-400'
  return 'bg-surface-400'
}

function getLevelColor(level: string) {
  if (level === 'Expert') return 'text-brand-600'
  if (level === 'Advanced') return 'text-violet-600'
  return 'text-muted-foreground'
}

export default function DemoResumePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'skills', label: 'Skills' },
    { id: 'experience', label: 'Experience' },
    { id: 'weak-bullets', label: 'Weak Bullets' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resume Intelligence</h1>
        <p className="text-muted-foreground text-sm mt-1">Your resume, structured as career evidence.</p>
      </div>

      {/* Upload area  -  already uploaded state */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <p className="font-semibold text-sm text-foreground">alex-chen-resume-2026.pdf</p>
                  <Badge variant="success">Parsed</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  142 KB · Uploaded Jun 1, 2026
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <Button variant="secondary" size="sm">Replace resume</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy note */}
        <div className="mt-4 pt-4 border-t border-border/60 flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            Your resume is stored privately in Supabase Storage. It is never indexed, shared, or sold.
          </p>
        </div>
      </div>

      {/* Parsed resume panel */}
      <div className="glass-card overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-border/60 px-1">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                  tab.id === 'weak-bullets' && 'text-amber-600',
                )}
              >
                {tab.label}
                {tab.id === 'weak-bullets' && (
                  <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded-full">3</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Identity */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">AC</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Alex Chen</h2>
                <p className="text-sm text-muted-foreground">Product Designer · 5 years experience</p>
                <div className="flex flex-wrap gap-3 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    alex@example.com
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    linkedin.com/in/alex-chen
                  </span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                Product Designer with 5 years experience in B2B SaaS, specializing in complex checkout flows
                and design systems. Led design at Figma and Stripe, shipping products used by millions.
              </p>
            </div>

            {/* Skills quick view */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Skills extracted</p>
              <div className="flex flex-wrap gap-2">
                {SKILLS.map((skill) => (
                  <span
                    key={skill.name}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border',
                      skill.level === 'Expert' && 'bg-brand-500/10 border-brand-500/20 text-brand-700',
                      skill.level === 'Advanced' && 'bg-violet-500/10 border-violet-500/20 text-violet-700',
                      skill.level === 'Intermediate' && 'bg-surface-300 border-border text-muted-foreground',
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getLevelDot(skill.level))} />
                    {skill.name}
                    <span className={cn('text-[10px] font-medium', getLevelColor(skill.level))}>{skill.level}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Experience quick view */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Experience</p>
              <div className="space-y-3">
                {EXPERIENCE.map((exp) => (
                  <div key={exp.company} className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-border/40">
                    <div className="w-8 h-8 rounded-lg bg-surface-300 flex items-center justify-center shrink-0">
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{exp.company}</p>
                      <p className="text-xs text-muted-foreground">{exp.role}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/60 shrink-0">{exp.period}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Projects */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Projects</p>
              <div className="flex gap-3">
                {PROJECTS.map((proj) => (
                  <div key={proj.name} className="flex-1 p-3 rounded-xl bg-surface-200/60 border border-border/40">
                    <p className="text-sm font-medium text-foreground">{proj.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{proj.role} · {proj.year}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Skills tab */}
        {activeTab === 'skills' && (
          <div className="p-6">
            <div className="grid sm:grid-cols-2 gap-4">
              {SKILLS.map((skill) => (
                <div key={skill.name} className="flex items-center justify-between p-4 rounded-xl bg-surface-200/60 border border-border/40">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', getLevelDot(skill.level))} />
                    <span className="text-sm font-medium text-foreground">{skill.name}</span>
                  </div>
                  <span className={cn('text-xs font-medium', getLevelColor(skill.level))}>{skill.level}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Experience tab */}
        {activeTab === 'experience' && (
          <div className="p-6 space-y-0">
            {EXPERIENCE.map((exp, i) => (
              <div key={exp.company} className="flex gap-6">
                <div className="hidden sm:flex flex-col items-center gap-0 pt-1">
                  <div className="w-2 h-2 rounded-full bg-brand-500/60 border border-brand-500/40 shrink-0" />
                  {i < EXPERIENCE.length - 1 && (
                    <div className="w-px flex-1 bg-gradient-to-b from-brand-500/20 to-transparent min-h-[48px]" />
                  )}
                </div>
                <div className={cn('flex-1', i < EXPERIENCE.length - 1 ? 'pb-8' : 'pb-0')}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{exp.role}</h3>
                      <p className="text-sm text-muted-foreground">{exp.company}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/60 shrink-0">{exp.period}</span>
                  </div>
                  <ul className="space-y-2">
                    {exp.bullets.map((b, bi) => (
                      <li key={bi} className="flex items-start gap-2.5 text-sm text-foreground/75">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0 mt-2" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Weak bullets tab */}
        {activeTab === 'weak-bullets' && (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-600/90">
                3 bullets flagged for missing metrics. Fixing these could push your ProofScore from 84 → 91.
              </p>
            </div>
            {WEAK_BULLETS.map((bullet, i) => (
              <div
                key={i}
                className={cn(
                  'glass-card p-5',
                  bullet.severity === 'critical' ? 'border-red-500/20' : 'border-amber-500/15',
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={bullet.severity === 'critical' ? 'danger' : 'warning'}>
                    {bullet.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Bullet #{i + 1}</span>
                </div>
                <p className="text-sm font-mono text-foreground/60 mb-3 p-3 bg-surface-300/60 rounded-lg">
                  {bullet.original}
                </p>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <ChevronRight className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Suggested Fix</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{bullet.fix}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="glass-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-violet-500/5 pointer-events-none" />
        <div className="relative">
          <p className="font-semibold text-foreground mb-1">Build your portfolio from this resume</p>
          <p className="text-sm text-muted-foreground">AI will generate a complete portfolio from your parsed resume in seconds.</p>
        </div>
        <Button asChild variant="gradient" className="gap-1.5 shrink-0 relative">
          <Link href="/demo/builder">
            Build portfolio
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
