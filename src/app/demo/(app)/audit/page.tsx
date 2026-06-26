'use client'

import { useState } from 'react'
import {
  BarChart3, AlertCircle, CheckCircle2, ArrowRight, Info, Copy, Check,
  Lightbulb, TrendingUp, Zap, Target, Clock
} from 'lucide-react'
import { ProofScoreRing } from '@/components/ui/proof-score-ring'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Severity = 'critical' | 'major' | 'minor' | null

interface Category {
  name: string
  score: number
  severity: Severity
  explanation: string
}

const CATEGORIES: Category[] = [
  { name: 'First Impression Clarity', score: 78, severity: 'major', explanation: 'Your headline is too generic. Specify your exact target role and value proposition.' },
  { name: 'Target Role Alignment', score: 91, severity: 'minor', explanation: "Strong. Add 'design systems' and 'cross-functional' to push above 95." },
  { name: 'Proof Strength', score: 41, severity: 'critical', explanation: 'Only 2 of 8 bullets have measurable outcomes. Add metrics to at least 4 more.' },
  { name: 'Project Depth', score: 64, severity: 'major', explanation: 'Projects show WHAT not WHY. Add a clear problem statement and outcome to each case study.' },
  { name: 'Resume Quality', score: 76, severity: 'minor', explanation: 'Formatting is clean. Bullet length is inconsistent  -  some are too long.' },
  { name: 'Case Study Quality', score: 82, severity: 'minor', explanation: 'Good structure overall. Add more process detail to Checkout Redesign.' },
  { name: 'Credibility Signals', score: 88, severity: 'minor', explanation: 'Strong company names (Figma, Stripe). Add 1-2 external links (Figma community, etc).' },
  { name: 'Visual Polish', score: 95, severity: null, explanation: 'Excellent. Portfolio design is clean and highly professional.' },
  { name: 'Contact Readiness', score: 100, severity: null, explanation: 'Perfect. All contact methods are present and working.' },
  { name: 'Keyword Relevance', score: 79, severity: 'minor', explanation: "Missing high-value keywords: 'design systems', 'cross-functional', 'Figma', 'stakeholder management'." },
  { name: 'Hiring Risk Gaps', score: 58, severity: 'major', explanation: 'No cover letter template present. No reference to async or remote work experience.' },
]

const GAPS = [
  {
    severity: 'critical' as const,
    title: 'Proof Strength',
    description: '6 of 8 bullets have no measurable outcome. Recruiters skip unproven claims  -  numbers make you credible.',
  },
  {
    severity: 'major' as const,
    title: 'Project Depth',
    description: 'Case studies show what you did, not the problem you solved or the business impact you created.',
  },
  {
    severity: 'major' as const,
    title: 'Hiring Risk',
    description: 'No visible async or remote collaboration experience in a remote-first market.',
  },
]

const FIXES = [
  {
    title: 'Add metrics to 3 resume bullets',
    description: 'Pick your 3 best bullets. Add a number: %, $, time, users. Even rough estimates work  -  "~40%" is better than nothing.',
    icon: TrendingUp,
  },
  {
    title: 'Add problem statement to Checkout Redesign',
    description: '1-2 sentences: what was broken, who it hurt, what it was costing the business before you fixed it.',
    icon: Target,
  },
  {
    title: "Add 'design systems' to headline",
    description: "Change 'Product Designer' to 'Product Designer, Design Systems & B2B SaaS' to match recruiter searches.",
    icon: Lightbulb,
  },
]

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function CategoryCard({ cat, index }: { cat: Category; index: number }) {
  const [copied, setCopied] = useState(false)

  async function copyFix() {
    await navigator.clipboard.writeText(cat.explanation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          {cat.severity && (
            <Badge variant={cat.severity === 'critical' ? 'danger' : cat.severity === 'major' ? 'warning' : 'success'}>
              {cat.severity}
            </Badge>
          )}
          <span className={cn('text-lg font-bold', scoreColor(cat.score))}>{cat.score}</span>
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

      <div className="bg-surface-300/60 rounded-xl p-3 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/80 flex-1 leading-relaxed">{cat.explanation}</p>
        <button onClick={copyFix} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

export default function DemoAuditPage() {
  const [afterCopied, setAfterCopied] = useState(false)

  const afterText = 'Redesigned 4-step checkout into 2-step flow, increasing completion 24% and recovering ~$180k/month in abandoned orders.'

  async function copyAfter() {
    await navigator.clipboard.writeText(afterText)
    setAfterCopied(true)
    setTimeout(() => setAfterCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ProofScore Audit</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last run: 2 hours ago
            </div>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-xs text-muted-foreground">Senior Product Designer · Technology</span>
          </div>
        </div>
        <Button variant="gradient" size="sm" className="gap-1.5 shrink-0">
          <Zap className="h-3.5 w-3.5" />
          Run new audit
        </Button>
      </div>

      {/* Hero panel */}
      <div className="glass-card p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,70,200,0.06),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-8">
          {/* Score ring */}
          <div className="flex flex-col items-center gap-3">
            <ProofScoreRing score={84} size="xl" animate={true} />
            <Badge variant="success" className="text-xs">Ready to apply</Badge>
          </div>

          {/* Score details */}
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Strong  -  Ready to apply</h2>
              <p className="text-muted-foreground text-sm">84 / 100 overall score · 11 categories evaluated</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Role Fit</p>
                <p className="text-xl font-bold text-emerald-400">91%</p>
              </div>
              <div className="p-3 rounded-xl bg-brand-500/5 border border-brand-500/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Confidence</p>
                <p className="text-xl font-bold text-brand-400">High</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 col-span-2 sm:col-span-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Gaps Found</p>
                <p className="text-xl font-bold text-amber-400">3 <span className="text-sm font-medium text-muted-foreground">(1 critical, 2 major)</span></p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              You are competitive for Senior IC roles. Fix the 3 critical/major gaps to push above 90 and reach{' '}
              <span className="text-brand-400 font-medium">&ldquo;Elite&rdquo; territory</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Category cards */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-4">11 Categories</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {CATEGORIES.map((cat, i) => (
            <CategoryCard key={cat.name} cat={cat} index={i} />
          ))}
        </div>
      </div>

      {/* Evidence gap finder */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="h-4 w-4 text-red-400" />
          </div>
          <h2 className="font-semibold text-foreground">3 Gaps Costing You Interviews</h2>
        </div>
        <div className="space-y-4">
          {GAPS.map((gap, i) => (
            <div
              key={gap.title}
              className={cn(
                'flex items-start gap-4 p-4 rounded-xl border',
                gap.severity === 'critical'
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-amber-500/5 border-amber-500/20',
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                gap.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400',
              )}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm text-foreground">{gap.title}</p>
                  <Badge variant={gap.severity === 'critical' ? 'danger' : 'warning'}>{gap.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{gap.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next 3 fixes */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-brand-400" />
          </div>
          <h2 className="font-semibold text-foreground">Your Next 3 Fixes</h2>
        </div>
        <div className="space-y-4">
          {FIXES.map((fix, i) => (
            <div key={fix.title} className="flex items-start gap-4 p-4 rounded-xl bg-surface-200/60 border border-border/40">
              <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                <fix.icon className="h-3.5 w-3.5 text-brand-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Fix {i + 1}</span>
                </div>
                <p className="font-semibold text-sm text-foreground mb-1">{fix.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{fix.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Before / After bullet rewrite */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
          </div>
          <h2 className="font-semibold text-foreground">Bullet Rewrite Example</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Before */}
          <div>
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Before</p>
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
              <p className="text-sm text-foreground/70 italic leading-relaxed">
                &ldquo;Helped improve checkout flow conversion&rdquo;
              </p>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-red-400" />
              <p className="text-xs text-red-400">No metric, no ownership, no impact</p>
            </div>
          </div>

          {/* After */}
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">After</p>
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                &ldquo;Redesigned 4-step checkout into 2-step flow, increasing completion 24% and recovering ~$180k/month in abandoned orders.&rdquo;
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <p className="text-xs text-emerald-400">Specific, owned, measured</p>
              </div>
              <button
                onClick={copyAfter}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {afterCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {afterCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild variant="gradient" className="gap-1.5">
          <a href="/demo/resume">
            Fix resume bullets
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <a href="/demo/builder">
            Update portfolio
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
