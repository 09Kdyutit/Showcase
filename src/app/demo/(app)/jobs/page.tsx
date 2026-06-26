'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search, MapPin, Briefcase, ChevronRight,
  Bookmark, BookmarkCheck, Zap, Building2, Clock, DollarSign,
  Wifi, Users, Target, AlertCircle, CheckCircle2,
  TrendingUp, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { computeMatchScore, salaryDisplay, daysAgo } from '@/lib/jobs/match'
import { FIXTURE_JOBS } from '@/lib/jobs/providers/fixture'
import type { JobListing, MatchBreakdown, ParsedResume } from '@/types/database'

// ── Tab + demo persona data ──────────────────────────────────────────────────
type Tab = 'browse' | 'for-you' | 'pipeline'

// Alex Chen  -  same persona used across /demo/resume and /demo/dashboard
const DEMO_RESUME: ParsedResume = {
  name: 'Alex Chen',
  email: 'alex@example.com',
  phone: '',
  location: 'New York, NY',
  summary: 'Product Designer with 5 years experience in B2B SaaS, specializing in complex checkout flows and design systems.',
  skills: ['Figma', 'Design Systems', 'User Research', 'Prototyping', 'A/B Testing', 'Stakeholder Management'],
  experience: [
    { company: 'Figma', role: 'Lead Product Designer', period: '2022  -  Present', bullets: ['Led design for core editor and collaboration features.', "Owned and maintained Figma's internal design system."], metrics: [] },
    { company: 'Stripe', role: 'Product Designer', period: '2020  -  2022', bullets: ['Redesigned Stripe Checkout, increasing completion rate by 24%.', "Built Stripe's first internal design system from scratch."], metrics: [] },
    { company: 'Adobe', role: 'UX Designer', period: '2019  -  2020', bullets: ['Designed mobile experiences for Adobe Creative Cloud apps.'], metrics: [] },
  ],
  education: [],
  projects: [
    { title: 'Checkout Redesign', description: 'Led design for the Stripe checkout payments flow, increasing completion rate by 24%.', technologies: ['Figma', 'Prototyping'], links: [] },
    { title: 'Design System v2', description: 'Built design system v2 used across the Figma editor and collaboration tools.', technologies: ['Figma', 'Design Systems'], links: [] },
  ],
  certifications: [],
  links: { linkedin: 'linkedin.com/in/alex-chen' },
  weak_bullets: [],
  missing_proof: [],
  possible_case_studies: [],
  years_of_experience: 5,
  seniority_level: 'senior',
}

const PIPELINE_STAGES = [
  { id: 'saved', label: 'Saved', color: 'text-muted-foreground' },
  { id: 'tailoring', label: 'Tailoring', color: 'text-brand-400' },
  { id: 'ready', label: 'Ready', color: 'text-violet-400' },
  { id: 'applied', label: 'Applied', color: 'text-blue-400' },
  { id: 'interview', label: 'Interview', color: 'text-amber-400' },
  { id: 'offer', label: 'Offer', color: 'text-emerald-400' },
]

const DEMO_PIPELINE = [
  { id: 'sj-1', job: FIXTURE_JOBS[1], status: 'interview', match_score: 78 },
  { id: 'sj-2', job: FIXTURE_JOBS[7], status: 'applied', match_score: 64 },
  { id: 'sj-3', job: FIXTURE_JOBS[0], status: 'tailoring', match_score: 71 },
  { id: 'sj-4', job: FIXTURE_JOBS[3], status: 'saved', match_score: 52 },
]

// ── Score badge ───────────────────────────────────────────────────────────────
function MatchScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' :
    score >= 65 ? 'bg-brand-500/15 text-brand-300 border-brand-500/20' :
    score >= 45 ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
    'bg-red-500/10 text-red-400/80 border-red-500/20'

  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border', color)}>
      <Target className="h-2.5 w-2.5" />
      {score}%
    </span>
  )
}

// ── Job card ──────────────────────────────────────────────────────────────────
function JobCard({
  job, isSelected, matchScore, isSaved, onSelect, onSave,
}: {
  job: JobListing
  isSelected: boolean
  matchScore?: number
  isSaved: boolean
  onSelect: () => void
  onSave: () => void
}) {
  const salary = salaryDisplay(job)
  const posted = daysAgo(job.posted_at)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all duration-150 group cursor-pointer',
        isSelected
          ? 'bg-brand-500/8 border-brand-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
          : 'bg-surface-100 border-border hover:border-border/80 hover:bg-surface-200'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold leading-snug truncate', isSelected ? 'text-foreground' : 'text-foreground/90')}>
            {job.title}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{job.company}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onSave() }}
          className={cn('shrink-0 p-1 rounded-md transition-colors', isSaved ? 'text-brand-400' : 'text-muted-foreground/40 hover:text-muted-foreground')}
        >
          {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
        {job.location && <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{job.location}</span>}
        {job.work_mode && <span className="capitalize">{job.work_mode}</span>}
        {job.seniority && <span className="capitalize">{job.seniority}</span>}
      </div>

      <div className="flex items-center justify-between mt-2.5 gap-2">
        <div className="flex items-center gap-2">
          {salary && <span className="text-[11px] text-muted-foreground/60 font-medium">{salary}</span>}
          <span className="text-[11px] text-muted-foreground/40">{posted}</span>
        </div>
        {matchScore !== undefined && <MatchScoreBadge score={matchScore} />}
      </div>
    </div>
  )
}

// ── Job detail panel ─────────────────────────────────────────────────────────
function JobDetailPanel({
  job, matchScore, matchBreakdown, isSaved, onSave,
}: {
  job: JobListing | null
  matchScore?: number
  matchBreakdown?: MatchBreakdown
  isSaved: boolean
  onSave: () => void
}) {
  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-12">
        <div>
          <div className="w-12 h-12 rounded-xl bg-surface-200 border border-border flex items-center justify-center mx-auto mb-4">
            <Briefcase className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">Select a role to see details</p>
        </div>
      </div>
    )
  }

  const salary = salaryDisplay(job)
  const sd = job.structured_data

  return (
    <div className="flex-1 overflow-y-auto thin-scrollbar">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground leading-tight">{job.title}</h2>
              <p className="text-base text-muted-foreground mt-1 flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0" />
                {job.company}
              </p>
            </div>
            {matchScore !== undefined && (
              <div className="shrink-0 text-center">
                <div className={cn(
                  'w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold border',
                  matchScore >= 80 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  matchScore >= 65 ? 'bg-brand-500/10 border-brand-500/20 text-brand-300' :
                  matchScore >= 45 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  'bg-red-500/10 border-red-500/20 text-red-400'
                )}>
                  {matchScore}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1 leading-tight">role-content<br />match</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {job.location && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface-200 border border-border rounded-lg px-2.5 py-1">
                <MapPin className="h-3 w-3" />{job.location}
              </span>
            )}
            {job.work_mode && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface-200 border border-border rounded-lg px-2.5 py-1 capitalize">
                <Wifi className="h-3 w-3" />{job.work_mode}
              </span>
            )}
            {job.seniority && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface-200 border border-border rounded-lg px-2.5 py-1 capitalize">
                <Users className="h-3 w-3" />{job.seniority}
              </span>
            )}
            {salary && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-2.5 py-1">
                <DollarSign className="h-3 w-3" />{salary}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="gradient" className="gap-2">
              <Link href="/demo/jobs/tailor">
                <Zap className="h-4 w-4" />
                Tailor for this role
              </Link>
            </Button>
            <Button variant="outline" className="gap-2" onClick={onSave}>
              {isSaved ? <BookmarkCheck className="h-4 w-4 text-brand-400" /> : <Bookmark className="h-4 w-4" />}
              {isSaved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>

        {matchBreakdown && (
          <div className="rounded-xl border border-border bg-surface-100 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-400" />
              Role-content match
            </h3>
            <p className="text-xs text-muted-foreground/60 -mt-2">
              This score reflects how closely your documented experience matches this job description.
              It does not predict hiring decisions, which depend on many factors beyond your resume.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> Matched
                </p>
                <ul className="space-y-1">
                  {matchBreakdown.matched_skills.slice(0, 5).map(s => (
                    <li key={s} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500/60 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" /> Gaps
                </p>
                <ul className="space-y-1">
                  {matchBreakdown.missing_skills.slice(0, 5).map(s => (
                    <li key={s} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-500/60 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {matchBreakdown.opportunities.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-brand-300 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" /> Opportunities
                </p>
                <ul className="space-y-1.5">
                  {matchBreakdown.opportunities.map((opp, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {opp.description}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {job.description && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">About this role</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{job.description}</p>
          </div>
        )}

        {sd?.responsibilities && sd.responsibilities.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Responsibilities</h3>
            <ul className="space-y-2">
              {sd.responsibilities.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ChevronRight className="h-4 w-4 text-brand-400/50 shrink-0 mt-0.5" />{r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {sd?.required_skills && sd.required_skills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Required skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {sd.required_skills.map(s => (
                <span key={s} className="text-xs bg-surface-200 border border-border rounded-md px-2 py-0.5 text-muted-foreground">{s}</span>
              ))}
            </div>
          </div>
        )}

        {sd?.company_info && (
          <div className="rounded-xl border border-border bg-surface-100 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">About the company</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{sd.company_info}</p>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground/40 pb-4">
          <Clock className="h-3 w-3" />
          Posted {daysAgo(job.posted_at)}
          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20 text-[10px]">
            Demo listing
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Pipeline view ─────────────────────────────────────────────────────────────
function PipelineView() {
  const byStage = PIPELINE_STAGES.map(s => ({ ...s, jobs: DEMO_PIPELINE.filter(j => j.status === s.id) }))
  const interviews = DEMO_PIPELINE.filter(j => j.status === 'interview').length
  const applied = DEMO_PIPELINE.filter(j => ['applied', 'interview', 'offer'].includes(j.status)).length
  const offers = DEMO_PIPELINE.filter(j => j.status === 'offer').length

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Applications', value: applied, color: 'text-blue-400' },
          { label: 'Interviews', value: interviews, color: 'text-amber-400' },
          { label: 'Offers', value: offers, color: 'text-emerald-400' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface-100 p-4 text-center">
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {byStage.map(stage => (
          <div key={stage.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-xs font-semibold uppercase tracking-wide', stage.color)}>{stage.label}</span>
              {stage.jobs.length > 0 && <span className="text-xs text-muted-foreground/50">({stage.jobs.length})</span>}
            </div>
            {stage.jobs.length === 0 ? (
              <div className="h-12 rounded-xl border border-dashed border-border/40 flex items-center justify-center">
                <span className="text-xs text-muted-foreground/30">None</span>
              </div>
            ) : (
              <div className="space-y-2">
                {stage.jobs.map(j => (
                  <div key={j.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-100 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{j.job.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{j.job.company}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <MatchScoreBadge score={j.match_score} />
                      <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        <Link href="/demo/jobs/tailor">
                          <Zap className="h-3 w-3" />
                          Tailor
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DemoJobsPage() {
  const [tab, setTab] = useState<Tab>('browse')
  const [query, setQuery] = useState('')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMobileDetail, setShowMobileDetail] = useState(false)

  const recommendations = useMemo(
    () => FIXTURE_JOBS
      .map(job => ({ job, ...computeMatchScore(job, DEMO_RESUME) }))
      .sort((a, b) => b.score - a.score),
    []
  )

  const browseJobs = useMemo(() => {
    if (!query.trim()) return FIXTURE_JOBS
    const q = query.toLowerCase()
    return FIXTURE_JOBS.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      (j.structured_data?.required_skills ?? []).some(s => s.toLowerCase().includes(q))
    )
  }, [query])

  const displayJobs = tab === 'for-you' ? recommendations.map(r => r.job) : browseJobs
  const selectedJob = displayJobs.find(j => j.id === selectedId) ?? null
  const selectedRec = tab === 'for-you' ? recommendations.find(r => r.job.id === selectedId) : undefined

  function handleSelect(id: string) {
    setSelectedId(id)
    setShowMobileDetail(true)
  }

  function handleSave(jobId: string) {
    setSavedIds(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-surface-50 px-4 lg:px-6 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(['browse', 'for-you', 'pipeline'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
                  tab === t ? 'bg-surface-300 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-200'
                )}
              >
                {t === 'for-you' ? 'For You' : t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'pipeline' && DEMO_PIPELINE.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-brand-500/20 text-brand-300 rounded-full px-1.5 py-0.5">
                    {DEMO_PIPELINE.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Badge variant="outline" className="text-[10px] text-amber-400/70 border-amber-500/20 bg-amber-500/5">
            Demo listings
          </Badge>
        </div>

        {tab === 'browse' && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Role, skill, or company"
              className="pl-9 h-9 text-sm"
            />
          </div>
        )}
      </div>

      {tab === 'pipeline' ? (
        <div className="flex-1 overflow-y-auto thin-scrollbar">
          <PipelineView />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className={cn('w-full lg:w-[380px] xl:w-[420px] shrink-0 border-r border-border flex flex-col overflow-hidden', showMobileDetail && 'hidden lg:flex')}>
            <div className="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-2">
              {displayJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <p className="text-sm text-muted-foreground">No roles match your filters</p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground/50 px-1">
                    {tab === 'browse' ? `${browseJobs.length} roles` : `${recommendations.length} matches`}
                  </p>
                  {tab === 'browse'
                    ? browseJobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          isSelected={selectedId === job.id}
                          isSaved={savedIds.has(job.id)}
                          onSelect={() => handleSelect(job.id)}
                          onSave={() => handleSave(job.id)}
                        />
                      ))
                    : recommendations.map(({ job, score }) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          isSelected={selectedId === job.id}
                          matchScore={score}
                          isSaved={savedIds.has(job.id)}
                          onSelect={() => handleSelect(job.id)}
                          onSave={() => handleSave(job.id)}
                        />
                      ))
                  }
                </>
              )}
            </div>
          </div>

          <div className={cn('flex-1 flex flex-col overflow-hidden', !showMobileDetail && 'hidden lg:flex')}>
            {showMobileDetail && (
              <div className="lg:hidden px-4 py-2 border-b border-border">
                <button onClick={() => setShowMobileDetail(false)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                  Back to jobs
                </button>
              </div>
            )}
            <JobDetailPanel
              job={selectedJob}
              matchScore={selectedRec?.score}
              matchBreakdown={selectedRec?.breakdown}
              isSaved={selectedJob ? savedIds.has(selectedJob.id) : false}
              onSave={() => selectedJob && handleSave(selectedJob.id)}
            />
          </div>
        </div>
      )}

      {/* Empty pipeline fallback hint */}
      {tab === 'pipeline' && DEMO_PIPELINE.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Send className="h-5 w-5 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-foreground mb-1">No applications yet</p>
        </div>
      )}
    </div>
  )
}
