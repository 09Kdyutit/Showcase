'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart3, AlertCircle, CheckCircle2, ArrowRight, Info, Copy, Check,
  Search, Lightbulb, TrendingUp, Zap, Target, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ProofScoreRing } from '@/components/ui/proof-score-ring'
import { createClient } from '@/lib/supabase/client'
import { cn, scoreColor } from '@/lib/utils'
import type { AuditResult, AuditCategory, Resume } from '@/types/database'

function CategoryCard({ cat, index }: { cat: AuditCategory; index: number }) {
  const [copied, setCopied] = useState(false)

  async function copyFix() {
    await navigator.clipboard.writeText(cat.fix)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (cat.gated) {
    return (
      <div className="glass-card p-5 opacity-60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground/40">#{index + 1}</span>
            <h3 className="font-semibold text-sm text-foreground">{cat.name}</h3>
          </div>
          <Badge variant="outline" className="text-xs">Pro</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Upgrade to Pro to score this category.</p>
      </div>
    )
  }

  if (cat.score === null) {
    return (
      <div className="glass-card p-5 opacity-60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground/40">#{index + 1}</span>
            <h3 className="font-semibold text-sm text-foreground">{cat.name}</h3>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{cat.explanation || 'No data available for this category yet.'}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'glass-card p-5 transition-all duration-200',
        cat.severity === 'critical' && 'border-red-500/20',
        cat.severity === 'major' && 'border-amber-500/15',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground/40">#{index + 1}</span>
          <h3 className="font-semibold text-sm text-foreground">{cat.name}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={cat.severity === 'critical' ? 'danger' : cat.severity === 'major' ? 'warning' : 'success'}>
            {cat.severity}
          </Badge>
          <span className={cn('text-lg font-bold', scoreColor(cat.score))}>{Math.round(cat.score)}</span>
        </div>
      </div>

      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden mb-4">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            cat.score >= 80 ? 'bg-emerald-500' : cat.score >= 60 ? 'bg-amber-500' : 'bg-red-500',
          )}
          style={{ width: `${cat.score}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{cat.explanation}</p>

      {cat.issues?.length > 0 && (
        <div className="mb-3 space-y-1">
          {cat.issues.slice(0, 2).map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-400/80">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              {issue}
            </div>
          ))}
        </div>
      )}

      {cat.fix && (
        <div className="bg-surface-300/60 rounded-xl p-3 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/80 flex-1 leading-relaxed">{cat.fix}</p>
          <button onClick={copyFix} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {cat.example && (
        <div className="mt-3 bg-brand-500/5 border border-brand-500/10 rounded-xl p-3">
          <p className="text-xs text-brand-300 font-medium mb-1">Example</p>
          <p className="text-xs text-foreground/70 italic leading-relaxed">&ldquo;{cat.example}&rdquo;</p>
        </div>
      )}
    </div>
  )
}


function RoleFitBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge variant="success">Strong match</Badge>
  if (score >= 60) return <Badge variant="warning">Needs work</Badge>
  return <Badge variant="danger">Significant gaps</Badge>
}

function Next3Fixes({ priorities }: { priorities: string[] }) {
  const top = priorities.slice(0, 3)
  if (top.length === 0) return null

  const ICONS = [Zap, TrendingUp, Target]
  const COLORS = [
    'text-red-400 bg-red-500/10 border-red-500/20',
    'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'text-brand-400 bg-brand-500/10 border-brand-500/20',
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-950/60 to-surface-100/40 p-6 shadow-glow-sm">
      {/* Header accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />

      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center">
          <Lightbulb className="h-4 w-4 text-brand-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Your Next 3 Fixes</h3>
          <p className="text-xs text-muted-foreground">Highest-impact actions to raise your score</p>
        </div>
      </div>

      <div className="space-y-3">
        {top.map((fix, i) => {
          const Icon = ICONS[i]
          return (
            <div key={i} className={cn('flex items-start gap-3 rounded-xl border p-4', COLORS[i])}>
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', COLORS[i])}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground mb-0.5">Fix #{i + 1}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{fix}</p>
              </div>
            </div>
          )
        })}
      </div>

      <Button
        variant="gradient"
        size="sm"
        className="w-full mt-4 gap-1.5"
        onClick={() => { window.location.href = '/builder' }}
      >
        Apply these fixes in your portfolio
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function EvidenceGapFinder({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) return null

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Search className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Evidence Gap Finder</h3>
          <p className="text-xs text-muted-foreground">
            {gaps.length} specific proof gap{gaps.length !== 1 ? 's' : ''} found in your materials
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        {gaps.map((gap, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/25 transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-amber-400">{i + 1}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{gap}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-xl bg-surface-300/50 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          Showcase will never fabricate evidence. These are areas where you have real experience to add - we&apos;ll
          help you surface and frame it.
        </p>
      </div>
    </div>
  )
}

const AUDIT_SCAN_STEPS = [
  { label: 'Parsing resume structure', detail: 'extracting experience, skills, and projects' },
  { label: 'Analyzing first impression', detail: 'evaluating opening clarity and role positioning' },
  { label: 'Scoring proof strength', detail: 'checking how many claims have supporting evidence' },
  { label: 'Evaluating project depth', detail: 'assessing Problem → Process → Outcome framework' },
  { label: 'Checking keyword relevance', detail: 'matching against target role vocabulary' },
  { label: 'Identifying hiring risk gaps', detail: 'looking for vague dates, gaps, unsupported claims' },
  { label: 'Calculating ProofScore', detail: 'weighting all 11 categories' },
]

function AuditLoadingPanel({ step }: { step: number }) {
  return (
    <div className="glass-card p-8 space-y-6">
      <div className="flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-surface-300" />
          <div
            className="absolute inset-0 rounded-full border-4 border-brand-500/60 border-t-transparent animate-spin"
            style={{ animationDuration: '1.2s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-brand-400">{Math.min(step + 1, 7)}</span>
            <span className="text-xs text-muted-foreground/60">/7</span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {AUDIT_SCAN_STEPS.map(({ label, detail }, i) => {
          const isDone = i < step
          const isActive = i === step
          return (
            <div key={label} className={cn(
              'flex items-start gap-3 p-3 rounded-xl transition-all duration-300',
              isDone && 'opacity-40',
              isActive && 'bg-brand-500/5 border border-brand-500/20',
            )}>
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                isDone ? 'bg-emerald-500/20' : isActive ? 'bg-brand-500/20' : 'bg-surface-300',
              )}>
                {isDone ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                ) : isActive ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-surface-400" />
                )}
              </div>
              <div>
                <p className={cn(
                  'text-xs font-medium',
                  isDone ? 'text-muted-foreground/50' : isActive ? 'text-foreground' : 'text-muted-foreground/40',
                )}>
                  {label}
                </p>
                {isActive && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{detail}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground/50">
        Reviewing your materials honestly - this takes 10-20 seconds
      </p>
    </div>
  )
}

export default function AuditPage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null)
  const [targetRole, setTargetRole] = useState('')
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [scanStep, setScanStep] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('resumes')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setResumes(data ?? [])
        setSelectedResumeId(data?.[0]?.id ?? null)
        setLoadingResumes(false)
      })
  }, [])

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) ?? null

  async function runAudit() {
    if (!selectedResumeId) { toast.error('Select a resume to audit'); return }
    if (!targetRole.trim()) { toast.error('Enter your target role'); return }

    setLoading(true)
    setResult(null)
    setScanStep(0)

    let step = 0
    const interval = setInterval(() => {
      step = Math.min(step + 1, AUDIT_SCAN_STEPS.length - 1)
      setScanStep(step)
    }, 2500)

    try {
      const res = await fetch('/api/ai/audit-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: selectedResumeId, targetRole, industry: industry || 'Technology' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Audit failed')
      setResult(data.data)
      toast.success('ProofScore complete!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Audit failed. Please try again.')
    } finally {
      clearInterval(interval)
      setLoading(false)
    }
  }

  const criticalItems = result?.categories.filter((c) => c.severity === 'critical') ?? []
  const sortedCategories = result?.categories.slice().sort((a, b) => (a.score ?? 100) - (b.score ?? 100)) ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">ProofScore Audit</h1>
        <p className="text-muted-foreground text-sm">
          ProofScore audits the resume you already uploaded against a specific target role - an honest score
          across 11 hiring-readiness categories. (Resume parsing extracts your experience; ProofScore judges
          how well it lands for the role you pick below.)
        </p>
      </div>

      {/* Input */}
      {!result && (
        <div className="glass-card p-6 space-y-5">
          {loadingResumes ? (
            <Skeleton className="h-16 w-full" />
          ) : resumes.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-400 flex-1">
                Upload your resume first - ProofScore audits it for a target role.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/resume">Go to Resume</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="resume-select">Resume to audit *</Label>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-border/60">
                <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                {resumes.length > 1 ? (
                  <select
                    id="resume-select"
                    value={selectedResumeId ?? ''}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground outline-none"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id} className="bg-surface-100">
                        {r.title} {r.parsed_json ? '· Parsed' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="flex-1 text-sm text-foreground">{selectedResume?.title}</span>
                )}
                {selectedResume?.parsed_json && <Badge variant="success">Parsed</Badge>}
                <Link href="/resume" className="text-xs text-muted-foreground hover:text-foreground underline shrink-0">
                  Manage
                </Link>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="role">Target role *</Label>
              <Input
                id="role"
                placeholder="e.g. Senior Product Designer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="e.g. Technology, Healthcare"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
          </div>

          <Button
            variant="gradient"
            size="lg"
            onClick={runAudit}
            loading={loading}
            disabled={!selectedResumeId || !targetRole.trim()}
            className="w-full gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Run ProofScore Audit
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && <AuditLoadingPanel step={scanStep} />}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Score header */}
          <div className="glass-card p-8 flex flex-col sm:flex-row items-center gap-8">
            <ProofScoreRing score={result.overall_score} size="lg" animate showLabel />
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                <h2 className="text-xl font-bold text-foreground">
                  ProofScore: {result.overall_score}/100
                </h2>
                <RoleFitBadge score={result.overall_score} />
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">{result.summary}</p>
              {criticalItems.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/15 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400/80">
                    {criticalItems.length} critical issue{criticalItems.length > 1 ? 's' : ''} found:{' '}
                    {criticalItems.map((c) => c.name).join(', ')}
                  </p>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setResult(null)} className="shrink-0">
              Re-audit
            </Button>
          </div>

          {/* Next 3 Fixes - prominent callout */}
          {result.top_priorities?.length > 0 && (
            <Next3Fixes priorities={result.top_priorities} />
          )}

          {/* Evidence Gap Finder */}
          {result.missing_evidence?.length > 0 && (
            <EvidenceGapFinder gaps={result.missing_evidence} />
          )}

          {/* Category breakdown */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Full category breakdown</h3>
              <span className="text-xs text-muted-foreground">{sortedCategories.length} categories scored</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {sortedCategories.map((cat, i) => (
                <CategoryCard key={cat.name} cat={cat} index={i} />
              ))}
            </div>
          </div>

          {/* What's strong */}
          {result.categories.filter((c) => c.score !== null && c.score >= 80).length > 0 && (
            <div className="glass-card p-5 border-emerald-500/15 bg-emerald-500/[0.02]">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                What is already strong
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.categories
                  .filter((c) => c.score !== null && c.score >= 80)
                  .map((c) => (
                    <Badge key={c.name} variant="success" className="text-xs">
                      {c.name} · {Math.round(c.score!)}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="gradient"
              size="lg"
              className="gap-2 flex-1"
              onClick={() => { window.location.href = '/builder' }}
            >
              Apply fixes to portfolio
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setResult(null)}>
              Re-run with new text
            </Button>
          </div>

          {/* Project Roadmap CTA */}
          <Link
            href="/projects"
            className="flex items-center justify-between p-4 rounded-2xl border border-brand-500/15 bg-brand-500/5 hover:bg-brand-500/10 hover:border-brand-500/25 transition-all group"
          >
            <div>
              <p className="text-sm font-semibold text-brand-200 group-hover:text-brand-100 transition-colors">
                Want project ideas to close these gaps?
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                AI suggests real projects tailored to your resume -- with step-by-step build guides.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-brand-400 shrink-0 group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground/50 text-center leading-relaxed">
            ProofScore is an AI-powered analysis tool. Results are designed to be helpful, not guaranteed to
            reflect recruiter decisions. Showcase does not guarantee employment or interview outcomes.
          </p>
        </div>
      )}
    </div>
  )
}
