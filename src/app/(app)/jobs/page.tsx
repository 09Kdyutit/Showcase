'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, MapPin, Briefcase, X, ChevronRight,
  Bookmark, BookmarkCheck, Zap, Building2, Clock, DollarSign,
  Wifi, Users, Target, AlertCircle, CheckCircle2, ArrowRight,
  Star, TrendingUp, Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, apiErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import * as SelectPrimitive from '@radix-ui/react-select'
import { daysAgo, salaryDisplay } from '@/lib/jobs/match'
import type { JobListing, SavedJob, WorkMode, Seniority, MatchBreakdown } from '@/types/database'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'browse' | 'for-you' | 'pipeline'

interface SearchFilters {
  query: string
  location: string
  work_mode: WorkMode | ''
  seniority: Seniority | ''
  salary_min: string
  date_posted_days: string
}

const PIPELINE_STAGES = [
  { id: 'saved', label: 'Saved', color: 'text-muted-foreground' },
  { id: 'tailoring', label: 'Tailoring', color: 'text-brand-400' },
  { id: 'ready', label: 'Ready', color: 'text-violet-400' },
  { id: 'applied', label: 'Applied', color: 'text-blue-400' },
  { id: 'interview', label: 'Interview', color: 'text-amber-400' },
  { id: 'offer', label: 'Offer', color: 'text-emerald-400' },
  { id: 'rejected', label: 'Rejected', color: 'text-red-400/70' },
  { id: 'withdrawn', label: 'Withdrawn', color: 'text-muted-foreground/50' },
]

// ── Score Badge ────────────────────────────────────────────────────────────────
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

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({
  job,
  isSelected,
  matchScore,
  isAdjacent,
  isSaved,
  onSelect,
  onSave,
}: {
  job: JobListing
  isSelected: boolean
  matchScore?: number
  isAdjacent?: boolean
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
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-semibold leading-snug truncate',
            isSelected ? 'text-foreground' : 'text-foreground/90'
          )}>
            {job.title}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{job.company}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onSave() }}
          className={cn(
            'shrink-0 p-1 rounded-md transition-colors',
            isSaved ? 'text-brand-400' : 'text-muted-foreground/40 hover:text-muted-foreground'
          )}
        >
          {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
        {job.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />
            {job.location}
          </span>
        )}
        {job.work_mode && (
          <span className="capitalize">{job.work_mode}</span>
        )}
        {job.seniority && (
          <span className="capitalize">{job.seniority}</span>
        )}
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-2.5 gap-2">
        <div className="flex items-center gap-2">
          {salary && (
            <span className="text-[11px] text-muted-foreground/60 font-medium">{salary}</span>
          )}
          <span className="text-[11px] text-muted-foreground/40">{posted}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isAdjacent && (
            <Badge variant="outline" className="text-[10px] text-violet-400/80 border-violet-500/20 bg-violet-500/5">
              Adjacent opportunity
            </Badge>
          )}
          {matchScore !== undefined && <MatchScoreBadge score={matchScore} />}
        </div>
      </div>
    </div>
  )
}

// ── Job Detail Panel ──────────────────────────────────────────────────────────
function JobDetailPanel({
  job,
  matchScore,
  matchBreakdown,
  isSaved,
  savedJobId,
  onSave,
}: {
  job: JobListing | null
  matchScore?: number
  matchBreakdown?: MatchBreakdown
  isSaved: boolean
  savedJobId?: string
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
        {/* Header */}
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
                <p className="text-[10px] text-muted-foreground/60 mt-1 leading-tight">role-content<br/>match</p>
              </div>
            )}
          </div>

          {/* Job meta */}
          <div className="flex flex-wrap gap-2 mb-4">
            {job.location && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface-200 border border-border rounded-lg px-2.5 py-1">
                <MapPin className="h-3 w-3" />
                {job.location}
              </span>
            )}
            {job.work_mode && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface-200 border border-border rounded-lg px-2.5 py-1 capitalize">
                <Wifi className="h-3 w-3" />
                {job.work_mode}
              </span>
            )}
            {job.seniority && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface-200 border border-border rounded-lg px-2.5 py-1 capitalize">
                <Users className="h-3 w-3" />
                {job.seniority}
              </span>
            )}
            {job.employment_type && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface-200 border border-border rounded-lg px-2.5 py-1 capitalize">
                <Clock className="h-3 w-3" />
                {job.employment_type}
              </span>
            )}
            {salary && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-2.5 py-1">
                <DollarSign className="h-3 w-3" />
                {salary}
              </span>
            )}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            {savedJobId ? (
              <Button asChild variant="gradient" className="gap-2">
                <Link href={`/jobs/${savedJobId}/tailor`}>
                  <Zap className="h-4 w-4" />
                  Tailor for this role
                </Link>
              </Button>
            ) : (
              <Button
                variant="gradient"
                className="gap-2"
                onClick={onSave}
              >
                <Zap className="h-4 w-4" />
                Save &amp; Tailor
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={onSave}>
              {isSaved ? <BookmarkCheck className="h-4 w-4 text-brand-400" /> : <Bookmark className="h-4 w-4" />}
              {isSaved ? 'Saved' : 'Save'}
            </Button>
            {job.source_url && (
              <Button variant="ghost" size="icon" asChild>
                <a href={job.source_url} target="_blank" rel="noopener noreferrer">
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Match breakdown */}
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
                      <span className="w-1 h-1 rounded-full bg-emerald-500/60 shrink-0" />
                      {s}
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
                      <span className="w-1 h-1 rounded-full bg-amber-500/60 shrink-0" />
                      {s}
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
            {matchBreakdown.ai_explanation && (
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-line">
                  {matchBreakdown.ai_explanation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {job.description && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">About this role</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </div>
        )}

        {/* Structured responsibilities */}
        {sd?.responsibilities && sd.responsibilities.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Responsibilities</h3>
            <ul className="space-y-2">
              {sd.responsibilities.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ChevronRight className="h-4 w-4 text-brand-400/50 shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Required skills */}
        {sd?.required_skills && sd.required_skills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Required skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {sd.required_skills.map(s => (
                <span key={s} className="text-xs bg-surface-200 border border-border rounded-md px-2 py-0.5 text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Preferred skills */}
        {sd?.preferred_skills && sd.preferred_skills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Preferred skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {sd.preferred_skills.map(s => (
                <span key={s} className="text-xs bg-surface-200 border border-border/60 rounded-md px-2 py-0.5 text-muted-foreground/70">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Company info */}
        {sd?.company_info && (
          <div className="rounded-xl border border-border bg-surface-100 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">About the company</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{sd.company_info}</p>
          </div>
        )}

        {/* Posted info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground/40 pb-4">
          <Clock className="h-3 w-3" />
          Posted {daysAgo(job.posted_at)}
          {job.provider === 'fixture' && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20 text-[10px]">
              Demo listing
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pipeline View ─────────────────────────────────────────────────────────────
function PipelineView({ savedJobs, isPro }: { savedJobs: SavedJob[]; isPro: boolean }) {
  const byStage = PIPELINE_STAGES.map(s => ({
    ...s,
    jobs: savedJobs.filter(j => j.status === s.id),
  }))

  const totalApplied = savedJobs.filter(j => ['applied', 'interview', 'offer'].includes(j.status)).length
  const interviews = savedJobs.filter(j => j.status === 'interview').length
  const offers = savedJobs.filter(j => j.status === 'offer').length
  const activeSaved = savedJobs.filter(j => !j.is_dismissed).length

  return (
    <div className="p-6 space-y-6">
      {!isPro && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-surface-200/60 border border-border/60 text-xs">
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">{activeSaved} / 5</span> saved jobs on the free plan
          </span>
          <Link href="/billing" className="text-brand-400 hover:text-brand-300 font-medium">Upgrade for unlimited</Link>
        </div>
      )}
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Applications', value: totalApplied, color: 'text-blue-400' },
          { label: 'Interviews', value: interviews, color: 'text-amber-400' },
          { label: 'Offers', value: offers, color: 'text-emerald-400' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface-100 p-4 text-center">
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {savedJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-200 border border-border flex items-center justify-center mb-4">
            <Send className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No applications yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Save a job from Browse or For You, then tailor and track your application here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {byStage.filter(s => s.jobs.length > 0 || ['saved', 'applied', 'interview'].includes(s.id)).map(stage => (
            <div key={stage.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-xs font-semibold uppercase tracking-wide', stage.color)}>
                  {stage.label}
                </span>
                {stage.jobs.length > 0 && (
                  <span className="text-xs text-muted-foreground/50">({stage.jobs.length})</span>
                )}
              </div>
              {stage.jobs.length === 0 ? (
                <div className="h-12 rounded-xl border border-dashed border-border/40 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground/30">None</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {stage.jobs.map(j => {
                    const title = j.job_listings_cache?.title ?? j.imported_title ?? 'Saved role'
                    const company = j.job_listings_cache?.company ?? j.imported_company ?? 'Unknown company'
                    return (
                      <div key={j.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-100 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{title}</p>
                          <p className="text-xs text-muted-foreground truncate">{company}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {j.match_score !== null && <MatchScoreBadge score={j.match_score} />}
                          <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            <Link href={`/jobs/${j.id}/tailor`}>
                              <Zap className="h-3 w-3" />
                              Tailor
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Filters Panel ─────────────────────────────────────────────────────────────
function FiltersBar({
  filters,
  onChange,
  onReset,
}: {
  filters: SearchFilters
  onChange: (f: Partial<SearchFilters>) => void
  onReset: () => void
}) {
  const hasFilters = !!(filters.work_mode || filters.seniority || filters.salary_min || filters.date_posted_days || filters.location)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
        <Input
          value={filters.query}
          onChange={e => onChange({ query: e.target.value })}
          placeholder="Role, skill, or company"
          className="pl-9 h-9 text-sm"
        />
      </div>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none z-10" />
        <Input
          value={filters.location}
          onChange={e => onChange({ location: e.target.value })}
          placeholder="Location"
          className="pl-9 h-9 text-sm w-36"
        />
      </div>

      <SelectPrimitive.Root value={filters.work_mode} onValueChange={v => onChange({ work_mode: v as WorkMode | '' })}>
        <SelectPrimitive.Trigger className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-surface-100 text-sm text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors min-w-[100px]">
          <SelectPrimitive.Value placeholder="Work mode" />
          <SelectPrimitive.Icon><ChevronRight className="h-3 w-3 rotate-90" /></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="z-50 bg-surface-100 border border-border rounded-xl shadow-xl p-1 min-w-[130px]">
            <SelectPrimitive.Viewport>
              {[['', 'Any mode'], ['remote', 'Remote'], ['hybrid', 'Hybrid'], ['on-site', 'On-site']].map(([v, l]) => (
                <SelectPrimitive.Item key={v} value={v} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-200 rounded-lg cursor-pointer outline-none">
                  <SelectPrimitive.ItemText>{l}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      <SelectPrimitive.Root value={filters.seniority} onValueChange={v => onChange({ seniority: v as Seniority | '' })}>
        <SelectPrimitive.Trigger className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-surface-100 text-sm text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors min-w-[100px]">
          <SelectPrimitive.Value placeholder="Seniority" />
          <SelectPrimitive.Icon><ChevronRight className="h-3 w-3 rotate-90" /></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="z-50 bg-surface-100 border border-border rounded-xl shadow-xl p-1 min-w-[110px]">
            <SelectPrimitive.Viewport>
              {[['', 'Any level'], ['entry', 'Entry'], ['mid', 'Mid'], ['senior', 'Senior'], ['staff', 'Staff'], ['principal', 'Principal']].map(([v, l]) => (
                <SelectPrimitive.Item key={v} value={v} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-200 rounded-lg cursor-pointer outline-none">
                  <SelectPrimitive.ItemText>{l}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      <SelectPrimitive.Root value={filters.date_posted_days} onValueChange={v => onChange({ date_posted_days: v })}>
        <SelectPrimitive.Trigger className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-surface-100 text-sm text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors min-w-[100px]">
          <SelectPrimitive.Value placeholder="Date posted" />
          <SelectPrimitive.Icon><ChevronRight className="h-3 w-3 rotate-90" /></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="z-50 bg-surface-100 border border-border rounded-xl shadow-xl p-1 min-w-[140px]">
            <SelectPrimitive.Viewport>
              {[['', 'Any time'], ['1', 'Past 24h'], ['7', 'Past week'], ['30', 'Past month']].map(([v, l]) => (
                <SelectPrimitive.Item key={v} value={v} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-200 rounded-lg cursor-pointer outline-none">
                  <SelectPrimitive.ItemText>{l}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {hasFilters && (
        <button onClick={onReset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const INITIAL_FILTERS: SearchFilters = {
  query: '',
  location: '',
  work_mode: '',
  seniority: '',
  salary_min: '',
  date_posted_days: '',
}

export default function JobsPage() {
  const [tab, setTab] = useState<Tab>('browse')
  const [filters, setFilters] = useState<SearchFilters>(INITIAL_FILTERS)
  const [jobs, setJobs] = useState<JobListing[]>([])
  const [recommendations, setRecommendations] = useState<Array<{ job: JobListing; match_score: number; match_breakdown: MatchBreakdown; is_adjacent?: boolean }>>([])
  const [includeAdjacent, setIncludeAdjacent] = useState(false)
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedJobMap, setSavedJobMap] = useState<Map<string, string>>(new Map())
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<{ score: number; breakdown: MatchBreakdown } | undefined>()
  const [loading, setLoading] = useState(false)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [isDemo, setIsDemo] = useState(true)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('subscriptions').select('status').eq('user_id', data.user.id).maybeSingle().then(({ data: sub }) => {
        setIsPro(sub?.status === 'active' || sub?.status === 'trialing')
      })
    })
  }, [])

  const fetchJobs = useCallback(async (f: SearchFilters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f.query) params.set('query', f.query)
      if (f.location) params.set('location', f.location)
      if (f.work_mode) params.set('work_mode', f.work_mode)
      if (f.seniority) params.set('seniority', f.seniority)
      if (f.salary_min) params.set('salary_min', f.salary_min)
      if (f.date_posted_days) params.set('date_posted_days', f.date_posted_days)
      const res = await fetch(`/api/jobs/search?${params}`)
      if (res.ok) {
        const { data } = await res.json()
        setJobs(data.jobs ?? [])
        setIsDemo(Boolean(data.is_demo))
      }
    } catch {
      toast.error('Could not load job listings')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSavedJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs/save')
      if (res.ok) {
        const { data } = await res.json()
        setSavedJobs(data ?? [])
        const ids = new Set<string>()
        const map = new Map<string, string>()
        for (const sj of (data ?? [])) {
          if (sj.job_listing_id) {
            ids.add(sj.job_listing_id)
            map.set(sj.job_listing_id, sj.id)
          }
        }
        setSavedIds(ids)
        setSavedJobMap(map)
      }
    } catch { /* non-fatal */ }
  }, [])

  const fetchRecommendations = useCallback(async () => {
    setLoadingRecs(true)
    try {
      // Get parsed resume from the user's most recent resume
      const supabase = createClient()
      const { data: resumes } = await supabase
        .from('resumes')
        .select('parsed_json')
        .order('created_at', { ascending: false })
        .limit(1)

      const parsedResume = resumes?.[0]?.parsed_json
      if (!parsedResume) {
        setLoadingRecs(false)
        return
      }

      const res = await fetch('/api/jobs/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed_resume: parsedResume, include_adjacent: includeAdjacent }),
      })
      if (res.ok) {
        const { data, is_demo } = await res.json()
        setRecommendations(data ?? [])
        setIsDemo(Boolean(is_demo))
      }
    } catch { /* non-fatal */ }
    setLoadingRecs(false)
  }, [includeAdjacent])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchJobs(INITIAL_FILTERS); void fetchSavedJobs() }, [fetchJobs, fetchSavedJobs])

  // Refetch whenever the tab is active or the adjacent-roles toggle changes
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tab === 'for-you') void fetchRecommendations() }, [tab, includeAdjacent, fetchRecommendations])

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      if (tab === 'browse') fetchJobs(filters)
    }, 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [filters, tab, fetchJobs])

  function handleFilterChange(f: Partial<SearchFilters>) {
    setFilters(prev => ({ ...prev, ...f }))
  }

  function handleFilterReset() {
    setFilters(INITIAL_FILTERS)
  }

  async function handleSave(job: JobListing) {
    const alreadySaved = savedIds.has(job.id)
    if (alreadySaved) {
      toast.info('Already saved')
      return
    }
    try {
      const res = await fetch('/api/jobs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // job.id is provider-local (fixture/external), not a job_listings_cache UUID — send
        // the full snapshot so the server can find-or-create the cache row and FK to it.
        body: JSON.stringify({
          job: {
            provider: job.provider,
            provider_job_id: job.provider_job_id,
            source_url: job.source_url,
            title: job.title,
            company: job.company,
            location: job.location,
            work_mode: job.work_mode,
            employment_type: job.employment_type,
            seniority: job.seniority,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            salary_currency: job.salary_currency,
            description: job.description,
            structured_data: job.structured_data,
            posted_at: job.posted_at,
          },
        }),
      })
      if (!res.ok) {
        const { error, code } = await res.json()
        if (error === 'You have already saved this job') {
          toast.info('Already saved')
          return
        }
        if (code === 'PRO_REQUIRED') {
          toast.error(apiErrorMessage(error, 'Upgrade to Pro to save more jobs'), {
            action: { label: 'Upgrade', onClick: () => { window.location.href = '/billing' } },
          })
          return
        }
        toast.error(apiErrorMessage(error, 'Could not save job'))
        return
      }
      const { data } = await res.json()
      setSavedIds(prev => new Set([...prev, job.id]))
      setSavedJobMap(prev => new Map([...prev, [job.id, data.id]]))
      setSavedJobs(prev => [data, ...prev])
      toast.success(`Saved "${job.title}"`)
    } catch {
      toast.error('Could not save job')
    }
  }

  function handleSelectJob(job: JobListing, match?: { score: number; breakdown: MatchBreakdown }) {
    setSelectedJob(job)
    setSelectedMatch(match)
    setShowMobileDetail(true)
  }

  const displayJobs = tab === 'for-you' ? recommendations.map(r => r.job) : jobs

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-surface-50 px-4 lg:px-6 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(['browse', 'for-you', 'pipeline'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
                  tab === t
                    ? 'bg-surface-300 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-200'
                )}
              >
                {t === 'for-you' ? 'For You' : t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'pipeline' && savedJobs.filter(j => !['archived', 'rejected', 'withdrawn'].includes(j.status)).length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-brand-500/20 text-brand-300 rounded-full px-1.5 py-0.5">
                    {savedJobs.filter(j => !['archived', 'rejected', 'withdrawn'].includes(j.status)).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {tab === 'for-you' && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={includeAdjacent}
                onChange={(e) => setIncludeAdjacent(e.target.checked)}
                className="accent-brand-500"
              />
              Include adjacent roles
            </label>
          )}
          {isDemo && (
            <Badge variant="outline" className="text-[10px] text-amber-400/70 border-amber-500/20 bg-amber-500/5">
              Demo listings
            </Badge>
          )}
        </div>

        {tab !== 'pipeline' && (
          <FiltersBar
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
          />
        )}
      </div>

      {/* Main layout */}
      {tab === 'pipeline' ? (
        <div className="flex-1 overflow-y-auto thin-scrollbar">
          <PipelineView savedJobs={savedJobs} isPro={isPro} />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: job list */}
          <div className={cn(
            'w-full lg:w-[380px] xl:w-[420px] shrink-0 border-r border-border flex flex-col overflow-hidden',
            showMobileDetail && 'hidden lg:flex'
          )}>
            <div className="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-2">
              {tab === 'for-you' && loadingRecs ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))
              ) : tab === 'for-you' && recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-200 border border-border flex items-center justify-center mb-4">
                    <Star className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Personalized feed requires Pro</p>
                  <p className="text-xs text-muted-foreground max-w-[220px] mb-4">
                    Upload your resume first, then upgrade to Pro to see roles matched to your experience.
                  </p>
                  <Button asChild variant="gradient" size="sm">
                    <Link href="/billing">Upgrade to Pro</Link>
                  </Button>
                </div>
              ) : loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))
              ) : displayJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <p className="text-sm text-muted-foreground">No roles match your filters</p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground/50 px-1">
                    {tab === 'browse' ? `${jobs.length} roles` : `${recommendations.length} matches`}
                  </p>
                  {tab === 'browse'
                    ? jobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          isSelected={selectedJob?.id === job.id}
                          isSaved={savedIds.has(job.id)}
                          onSelect={() => handleSelectJob(job)}
                          onSave={() => handleSave(job)}
                        />
                      ))
                    : recommendations.map(({ job, match_score, match_breakdown, is_adjacent }) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          isSelected={selectedJob?.id === job.id}
                          matchScore={match_score}
                          isAdjacent={is_adjacent}
                          isSaved={savedIds.has(job.id)}
                          onSelect={() => handleSelectJob(job, { score: match_score, breakdown: match_breakdown })}
                          onSave={() => handleSave(job)}
                        />
                      ))
                  }
                </>
              )}
            </div>
          </div>

          {/* Right: job detail */}
          <div className={cn(
            'flex-1 flex flex-col overflow-hidden',
            !showMobileDetail && 'hidden lg:flex'
          )}>
            {/* Mobile back button */}
            {showMobileDetail && (
              <div className="lg:hidden px-4 py-2 border-b border-border">
                <button
                  onClick={() => setShowMobileDetail(false)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                  Back to jobs
                </button>
              </div>
            )}
            <JobDetailPanel
              job={selectedJob}
              matchScore={selectedMatch?.score}
              matchBreakdown={selectedMatch?.breakdown}
              isSaved={selectedJob ? savedIds.has(selectedJob.id) : false}
              savedJobId={selectedJob ? savedJobMap.get(selectedJob.id) : undefined}
              onSave={() => selectedJob && handleSave(selectedJob)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
