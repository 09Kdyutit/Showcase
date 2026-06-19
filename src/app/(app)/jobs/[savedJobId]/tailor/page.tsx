'use client'

import { useState, useEffect, useCallback, use } from 'react'
import {
  Zap, ChevronRight, AlertCircle, AlertTriangle,
  Check, X, FileText, Loader2, ArrowLeft,
  ShieldCheck, BookOpen, MessageSquare, Target, Info,
  Sparkles, ChevronDown, ChevronUp, Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { TailoredResumeOutput } from '@/lib/ai/schemas'
import type { JobListing, TruthEntry, TailoredBullet, SavedJob } from '@/types/database'
import { FIXTURE_JOBS } from '@/lib/jobs/providers/fixture'

// ── Truth Entry Card ──────────────────────────────────────────────────────────
function TruthCard({ entry, onConfirm }: { entry: TruthEntry; onConfirm: (confirmed: boolean) => void }) {
  const riskColor =
    entry.change_type === 'fabrication_risk' ? 'border-red-500/30 bg-red-500/5' :
    entry.requires_confirmation ? 'border-amber-500/30 bg-amber-500/5' :
    'border-border bg-surface-100'

  const icon =
    entry.change_type === 'fabrication_risk' ? <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> :
    entry.evidence_present ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> :
    <AlertCircle className="h-3.5 w-3.5 text-amber-400" />

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', riskColor)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {icon}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground/90 leading-relaxed">{entry.statement}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn('text-[10px] shrink-0', {
          'text-emerald-400 border-emerald-500/20': entry.change_type === 'rewritten',
          'text-blue-400 border-blue-500/20': entry.change_type === 'reordered',
          'text-brand-300 border-brand-500/20': entry.change_type === 'new_from_source',
          'text-red-400 border-red-500/20': entry.change_type === 'fabrication_risk',
        })}>
          {entry.change_type.replace(/_/g, ' ')}
        </Badge>
      </div>

      {entry.source_text && (
        <div className="border-l-2 border-border pl-3">
          <p className="text-[11px] text-muted-foreground/60 mb-0.5">Source</p>
          <p className="text-[11px] text-muted-foreground italic">&ldquo;{entry.source_text}&rdquo;</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">{entry.source_location}</p>
        </div>
      )}

      {entry.requires_confirmation && entry.user_confirmed === null && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onConfirm(true)}
            className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Check className="h-3 w-3" />
            This is accurate
          </button>
          <span className="text-muted-foreground/30">·</span>
          <button
            onClick={() => onConfirm(false)}
            className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            <X className="h-3 w-3" />
            Not accurate
          </button>
        </div>
      )}
      {entry.user_confirmed === true && (
        <p className="text-[11px] text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Confirmed accurate</p>
      )}
      {entry.user_confirmed === false && (
        <p className="text-[11px] text-red-400 flex items-center gap-1"><X className="h-3 w-3" /> Flagged — needs revision</p>
      )}
    </div>
  )
}

// ── Diff Bullet ───────────────────────────────────────────────────────────────
function DiffBullet({ bullet, onAccept, onReject }: {
  bullet: TailoredBullet
  onAccept: () => void
  onReject: () => void
}) {
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
      {/* Original */}
      {bullet.original && !isNew && (
        <div className="line-through text-muted-foreground/50 leading-relaxed">
          {bullet.original}
        </div>
      )}

      {/* Tailored */}
      <div className={cn(
        'leading-relaxed font-medium',
        bullet.needs_user_input ? 'text-amber-300' :
        bullet.accepted ? 'text-emerald-400' :
        'text-foreground'
      )}>
        {bullet.tailored}
        {bullet.placeholder && (
          <span className="ml-1 text-amber-400/80 font-normal">{bullet.placeholder}</span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-[10px]', {
            'text-brand-300 border-brand-500/20': bullet.change_type === 'rewritten',
            'text-blue-400 border-blue-500/20': bullet.change_type === 'reordered',
            'text-violet-400 border-violet-500/20': bullet.change_type === 'new',
          })}>
            {bullet.change_type}
          </Badge>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-0.5"
          >
            {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            Why
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {bullet.accepted ? (
            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
              <Check className="h-2.5 w-2.5" /> Accepted
            </span>
          ) : (
            <>
              <button
                onClick={onAccept}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 transition-colors"
              >
                <Check className="h-2.5 w-2.5" /> Accept
              </button>
              <span className="text-muted-foreground/30">·</span>
              <button
                onClick={onReject}
                className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5 transition-colors"
              >
                <X className="h-2.5 w-2.5" /> Revert
              </button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <p className="text-[11px] text-muted-foreground/60 border-t border-border pt-2">{bullet.reason}</p>
      )}
    </div>
  )
}

// ── Import Job Dialog ─────────────────────────────────────────────────────────
function ImportJobDialog({ onConfirm }: { onConfirm: (job: Partial<JobListing>) => void }) {
  const [description, setDescription] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [parsing, setParsing] = useState(false)

  async function handleImport() {
    if (!description.trim()) return
    setParsing(true)
    try {
      const res = await fetch('/api/jobs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, title: title || undefined, company: company || undefined }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        toast.error(error ?? 'Import failed')
        return
      }
      const { data } = await res.json()
      onConfirm(data)
    } catch {
      toast.error('Import failed')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Job title (optional)</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Senior Product Manager"
            className="w-full h-9 px-3 rounded-xl border border-border bg-surface-100 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Company (optional)</label>
          <input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Acme Corp"
            className="w-full h-9 px-3 rounded-xl border border-border bg-surface-100 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand-500/50"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Paste the job description *</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Paste the full job description here..."
          rows={8}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface-100 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand-500/50 resize-none"
        />
      </div>
      <Button
        onClick={handleImport}
        variant="gradient"
        disabled={!description.trim() || parsing}
        className="w-full gap-2"
      >
        {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {parsing ? 'Parsing job...' : 'Parse & continue'}
      </Button>
    </div>
  )
}

// ── Main Tailor Studio ────────────────────────────────────────────────────────
export default function TailorStudioPage({ params }: { params: Promise<{ savedJobId: string }> }) {
  const { savedJobId } = use(params)

  const [savedJob, setSavedJob] = useState<SavedJob | null>(null)
  const [job, setJob] = useState<JobListing | null>(null)
  const [parsedResume, setParsedResume] = useState<Record<string, unknown> | null>(null)
  const [resumeId, setResumeId] = useState<string | null>(null)
  const [tailored, setTailored] = useState<TailoredResumeOutput | null>(null)
  const [truthMap, setTruthMap] = useState<TruthEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [coverLetter, setCoverLetter] = useState(false)
  const [recruiterNote, setRecruiterNote] = useState(false)
  const [activeSection, setActiveSection] = useState<'summary' | 'experience' | 'truth' | 'interview'>('summary')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      // Load saved job
      const { data: savedJobData } = await supabase
        .from('saved_jobs')
        .select('*')
        .eq('id', savedJobId)
        .single()

      if (savedJobData) {
        setSavedJob(savedJobData as SavedJob)

        // Resolve the job listing
        if (savedJobData.job_listing_id) {
          const fixture = FIXTURE_JOBS.find(j => j.id === savedJobData.job_listing_id)
          if (fixture) setJob(fixture)
        } else if (savedJobData.imported_title) {
          setJob({
            id: savedJobData.id,
            provider: 'import',
            provider_job_id: null,
            source_url: savedJobData.imported_url,
            title: savedJobData.imported_title,
            company: savedJobData.imported_company ?? 'Unknown',
            location: null,
            work_mode: null,
            employment_type: 'full-time',
            seniority: null,
            salary_min: null,
            salary_max: null,
            salary_currency: 'USD',
            description: savedJobData.imported_description,
            structured_data: null,
            posted_at: null,
            fetched_at: new Date().toISOString(),
            expires_at: null,
          })
        }
      }

      // Load resume
      const { data: resumes } = await supabase
        .from('resumes')
        .select('id, parsed_json')
        .order('created_at', { ascending: false })
        .limit(1)

      if (resumes?.[0]) {
        setResumeId(resumes[0].id)
        setParsedResume(resumes[0].parsed_json as Record<string, unknown> | null)
      }
    } catch { /* non-fatal */ }
    setLoading(false)
  }, [savedJobId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadData() }, [loadData])

  async function handleGenerate() {
    if (!parsedResume) {
      toast.error('Upload your resume first')
      return
    }
    if (!job) {
      toast.error('No job to tailor for')
      return
    }

    setGenerating(true)
    try {
      const jobId = savedJob?.job_listing_id ?? savedJobId
      const res = await fetch(`/api/jobs/${jobId}/tailor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed_resume: parsedResume,
          resume_id: resumeId,
          generate_cover_letter: coverLetter,
          generate_recruiter_note: recruiterNote,
          saved_job_id: savedJobId,
        }),
      })

      if (!res.ok) {
        const { error, code } = await res.json()
        if (code === 'PRO_REQUIRED') {
          toast.error('Tailor Studio requires Pro')
          return
        }
        toast.error(error ?? 'Generation failed')
        return
      }

      const { data } = await res.json()
      setTailored(data)
      setTruthMap(data.truth_map ?? [])
      toast.success('Application kit generated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function handleBulletAccept(expIdx: number, bulletIdx: number) {
    if (!tailored) return
    setTailored(prev => {
      if (!prev) return prev
      const experience = [...prev.experience]
      const bullets = [...experience[expIdx].tailored_bullets]
      bullets[bulletIdx] = { ...bullets[bulletIdx], accepted: true }
      experience[expIdx] = { ...experience[expIdx], tailored_bullets: bullets }
      return { ...prev, experience }
    })
  }

  function handleBulletReject(expIdx: number, bulletIdx: number) {
    if (!tailored) return
    setTailored(prev => {
      if (!prev) return prev
      const experience = [...prev.experience]
      const bullets = [...experience[expIdx].tailored_bullets]
      const original = bullets[bulletIdx].original ?? bullets[bulletIdx].tailored
      bullets[bulletIdx] = { ...bullets[bulletIdx], tailored: original, change_type: 'unchanged', accepted: false }
      experience[expIdx] = { ...experience[expIdx], tailored_bullets: bullets }
      return { ...prev, experience }
    })
  }

  function handleTruthConfirm(idx: number, confirmed: boolean) {
    setTruthMap(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], user_confirmed: confirmed }
      return updated
    })
  }

  const pendingConfirmations = truthMap.filter(e => e.requires_confirmation && e.user_confirmed === null).length
  const fabricationRisks = truthMap.filter(e => e.change_type === 'fabrication_risk').length

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  if (!savedJob && !job) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/jobs" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Jobs
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-surface-100 p-6">
          <h2 className="text-lg font-semibold mb-2">Tailor for a pasted role</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Paste the job description below and Showcase will parse it and prepare a tailored application kit from your resume.
          </p>
          <ImportJobDialog onConfirm={(j) => setJob(j as JobListing)} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-surface-50 px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/jobs" className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">
              {job?.title ?? 'Role'} · {job?.company ?? ''}
            </h1>
            <p className="text-xs text-muted-foreground">Tailor Studio</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tailored && (
            <>
              {pendingConfirmations > 0 && (
                <Badge variant="outline" className="text-amber-400 border-amber-500/20 text-[10px]">
                  {pendingConfirmations} to review
                </Badge>
              )}
              {fabricationRisks > 0 && (
                <Badge variant="outline" className="text-red-400 border-red-500/20 text-[10px]">
                  {fabricationRisks} to fix
                </Badge>
              )}
            </>
          )}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={coverLetter} onChange={e => setCoverLetter(e.target.checked)} className="accent-brand-500" />
              Cover letter
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={recruiterNote} onChange={e => setRecruiterNote(e.target.checked)} className="accent-brand-500" />
              Recruiter note
            </label>
          </div>
          <Button
            onClick={handleGenerate}
            variant="gradient"
            size="sm"
            disabled={generating || !parsedResume}
            className="gap-1.5"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {tailored ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>

      {!parsedResume && (
        <div className="mx-4 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            Upload your resume first. <Link href="/resume" className="underline">Go to Resume →</Link>
          </p>
        </div>
      )}

      {!tailored && !generating && (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-5">
              <Zap className="h-7 w-7 text-brand-400" />
            </div>
            <h2 className="text-xl font-bold mb-3">Tailor for {job?.title ?? 'this role'}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Showcase will rewrite your resume to foreground the experience most relevant to this role — using only your existing evidence, never fabricating facts.
            </p>
            <p className="text-xs text-muted-foreground/60 mb-6">
              Every change will be shown in the Truth Ledger for your review before use.
            </p>
            <div className="grid grid-cols-2 gap-3 text-left mb-6">
              {[
                ['Role-specific summary', 'Opens with your strongest credential for this exact role'],
                ['Reordered bullets', 'Your most relevant experience moved to the top'],
                ['Truth Ledger', 'Every change traced to its source — accept or reject each one'],
                ['Interview brief', 'Likely questions, STAR evidence, what to ask'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl border border-border bg-surface-100 p-3">
                  <p className="text-xs font-semibold text-foreground mb-1">{title}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
            <Button
              onClick={handleGenerate}
              variant="gradient"
              size="lg"
              disabled={!parsedResume}
              className="gap-2 w-full"
            >
              <Sparkles className="h-4 w-4" />
              Generate application kit
            </Button>
          </div>
        </div>
      )}

      {generating && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground mb-1">Generating your application kit</p>
            <p className="text-xs text-muted-foreground">Tailoring your resume · Building Truth Ledger · Preparing interview brief</p>
          </div>
        </div>
      )}

      {tailored && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar nav */}
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
                  activeSection === id
                    ? 'bg-brand-500/10 text-brand-300 border border-brand-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-200'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
                {id === 'truth' && pendingConfirmations > 0 && (
                  <span className="ml-auto text-[9px] bg-amber-500/20 text-amber-400 rounded-full px-1">
                    {pendingConfirmations}
                  </span>
                )}
              </button>
            ))}

            {tailored.cover_letter && (
              <button
                onClick={() => setActiveSection('summary')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-200 transition-all text-left"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                Cover Letter
              </button>
            )}

            <div className="mt-auto pt-3 border-t border-border">
              <div className="rounded-lg bg-surface-200 p-3 text-[11px] text-muted-foreground leading-relaxed">
                <ShieldCheck className="h-3 w-3 text-brand-400 mb-1.5" />
                Every change is traced to your actual resume. The Truth Ledger shows the source for each statement.
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto thin-scrollbar">
            <div className="p-6 max-w-3xl mx-auto space-y-8">

              {activeSection === 'summary' && (
                <div className="space-y-6">
                  {/* Professional summary */}
                  <section>
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-brand-400" />
                      Professional Summary
                    </h2>
                    <div className="rounded-xl border border-border bg-surface-100 p-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">{tailored.professional_summary}</p>
                    </div>
                  </section>

                  {/* Skills */}
                  <section>
                    <h2 className="text-sm font-semibold text-foreground mb-3">Skills (reordered for this role)</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {tailored.skills.map((s, i) => (
                        <span key={s + i} className={cn(
                          'text-xs px-2.5 py-1 rounded-lg border',
                          i < 6
                            ? 'bg-brand-500/10 border-brand-500/20 text-brand-300'
                            : 'bg-surface-200 border-border text-muted-foreground'
                        )}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </section>

                  {/* Recommended projects */}
                  {tailored.recommended_projects.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-brand-400" />
                        Recommended Projects to Highlight
                      </h2>
                      <div className="space-y-2">
                        {tailored.recommended_projects.map(p => (
                          <div key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ChevronRight className="h-4 w-4 text-brand-400/50" />
                            {p}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Portfolio headline */}
                  {tailored.portfolio_headline && (
                    <section>
                      <h2 className="text-sm font-semibold text-foreground mb-3">Portfolio Headline</h2>
                      <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
                        <p className="text-base font-semibold text-brand-300">{tailored.portfolio_headline}</p>
                      </div>
                    </section>
                  )}

                  {/* Recruiter summary */}
                  {tailored.recruiter_summary && (
                    <section>
                      <h2 className="text-sm font-semibold text-foreground mb-3">Recruiter Summary</h2>
                      <div className="rounded-xl border border-border bg-surface-100 p-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">{tailored.recruiter_summary}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(tailored.recruiter_summary ?? ''); toast.success('Copied') }}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground mt-2 transition-colors"
                        >
                          <Copy className="h-2.5 w-2.5" /> Copy
                        </button>
                      </div>
                    </section>
                  )}

                  {/* Cover letter */}
                  {tailored.cover_letter && (
                    <section>
                      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-brand-400" />
                        Cover Letter
                      </h2>
                      <div className="rounded-xl border border-border bg-surface-100 p-4">
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{tailored.cover_letter}</p>
                      </div>
                    </section>
                  )}

                  {/* Recruiter note */}
                  {tailored.recruiter_note && (
                    <section>
                      <h2 className="text-sm font-semibold text-foreground mb-3">Recruiter Outreach Note</h2>
                      <div className="rounded-xl border border-border bg-surface-100 p-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">{tailored.recruiter_note}</p>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {activeSection === 'experience' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">Tailored Experience</h2>
                    <p className="text-xs text-muted-foreground/60">Review each change, then accept or revert</p>
                  </div>
                  {tailored.experience.map((exp, expIdx) => (
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
                      <ShieldCheck className="h-4 w-4 text-brand-400" />
                      Truth Ledger
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                      {pendingConfirmations > 0 && <span className="text-amber-400">{pendingConfirmations} need review</span>}
                      {fabricationRisks > 0 && <span className="text-red-400">{fabricationRisks} fabrication risks</span>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-100 p-4 text-xs text-muted-foreground/70 leading-relaxed">
                    <Info className="h-3.5 w-3.5 text-brand-400 inline mr-1.5" />
                    Every statement below is traced to a specific part of your resume. Review and confirm any entry marked as requiring confirmation.
                    If a statement doesn&apos;t accurately represent your experience, click &ldquo;Not accurate&rdquo; to flag it.
                  </div>
                  <div className="space-y-2">
                    {truthMap.map((entry, i) => (
                      <TruthCard
                        key={i}
                        entry={entry}
                        onConfirm={(confirmed) => handleTruthConfirm(i, confirmed)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'interview' && tailored.interview_brief && (
                <div className="space-y-6">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-brand-400" />
                    Interview Brief
                  </h2>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-400/80">
                    Based on your documented experience. STAR stories use only facts from your resume.
                    Research the company independently — do not rely solely on this brief.
                  </div>

                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Role Themes</h3>
                    <div className="flex flex-wrap gap-2">
                      {tailored.interview_brief.role_themes.map(t => (
                        <span key={t} className="text-xs bg-brand-500/10 border border-brand-500/20 text-brand-300 rounded-lg px-2.5 py-1">{t}</span>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Likely Behavioral Questions</h3>
                    <ol className="space-y-2">
                      {tailored.interview_brief.behavioral_questions.map((q, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-[11px] text-muted-foreground/40 shrink-0 mt-0.5 w-4">{i + 1}.</span>
                          {q}
                        </li>
                      ))}
                    </ol>
                  </section>

                  {tailored.interview_brief.star_evidence.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">STAR Evidence (from your resume)</h3>
                      <div className="space-y-4">
                        {tailored.interview_brief.star_evidence.map((star, i) => (
                          <div key={i} className="rounded-xl border border-border bg-surface-100 p-4 space-y-2">
                            <p className="text-xs font-semibold text-foreground">{star.question_theme}</p>
                            <p className="text-[11px] text-muted-foreground/50">Source: {star.source_project}</p>
                            {[
                              ['Situation', star.situation],
                              ['Task', star.task],
                              ['Action', star.action],
                              ['Result', star.result],
                            ].map(([label, content]) => (
                              <div key={label}>
                                <p className="text-[10px] font-semibold text-brand-400/70 uppercase tracking-wide">{label}</p>
                                <p className="text-xs text-muted-foreground">{content}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Questions to Ask</h3>
                    <ul className="space-y-2">
                      {tailored.interview_brief.questions_to_ask.map((q, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <ChevronRight className="h-4 w-4 text-brand-400/50 shrink-0 mt-0.5" />
                          {q}
                        </li>
                      ))}
                    </ul>
                  </section>

                  {tailored.interview_brief.skill_gaps_to_address.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-red-400/70 uppercase tracking-wide mb-3">Gaps the Interviewer May Probe</h3>
                      <ul className="space-y-2">
                        {tailored.interview_brief.skill_gaps_to_address.map((g, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-400/60 shrink-0 mt-0.5" />
                            {g}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Research Before the Interview</h3>
                    <ul className="space-y-2">
                      {tailored.interview_brief.company_research_placeholders.map((p, i) => (
                        <li key={i} className="text-xs text-muted-foreground/70">{p}</li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
