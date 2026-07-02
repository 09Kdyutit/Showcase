'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, RefreshCw, ChevronDown, ChevronUp, Copy, Check,
  FolderGit2, Clock, ArrowLeft, Zap, Lock, Bookmark, BookmarkCheck, CalendarClock, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'

type Difficulty = 'Beginner' | 'Intermediate' | 'Master'

interface ProjectSuggestion {
  title: string
  tagline: string
  why: string
  techStack: string[]
  difficulty: Difficulty
  timeEstimate: string
  impact: string
  steps: string[]
  timeline?: { phase: string; when: string; detail: string }[]
  repoIdea: string
}

interface ResumeOption {
  id: string
  title: string
}

const TIERS: Difficulty[] = ['Beginner', 'Intermediate', 'Master']
const DIFF_COLOR: Record<string, string> = {
  'Beginner': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Intermediate': 'bg-brand-500/10 text-brand-300 border-brand-500/20',
  'Master': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}
const TIER_DESC: Record<Difficulty, string> = {
  'Beginner': 'Approachable quick wins you can finish and show off soon.',
  'Intermediate': 'Substantial projects that stretch you and level up your portfolio.',
  'Master': 'Ambitious, impressive builds that make a strong candidate stand out.',
}

// ── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, index, saved, onToggleSave, savingBusy }: {
  project: ProjectSuggestion; index: number
  saved?: boolean; onToggleSave?: () => void; savingBusy?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copySteps() {
    const text = [
      `# ${project.title}`,
      `${project.tagline}`,
      '',
      `Tech: ${project.techStack.join(', ')}`,
      `Difficulty: ${project.difficulty} · ${project.timeEstimate}`,
      '',
      'Steps:',
      ...project.steps.map((s, i) => `${i + 1}. ${s}`),
      '',
      `Repo: ${project.repoIdea}`,
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden card-3d">
      <div className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full border', DIFF_COLOR[project.difficulty])}>
                {project.difficulty}
              </span>
              {project.timeEstimate && (
                <span className="inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                  <Clock className="h-2.5 w-2.5 mr-1" />
                  {project.timeEstimate}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-foreground mt-1.5">{project.title}</h3>
            <p className="text-xs text-muted-foreground/60 mt-0.5">{project.tagline}</p>
          </div>
          {onToggleSave && (
            <button
              onClick={onToggleSave}
              disabled={savingBusy}
              title={saved ? 'Remove from saved' : 'Save this project'}
              className={cn(
                'shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors border',
                saved ? 'bg-brand-500/15 border-brand-500/30 text-brand-300' : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface-200'
              )}
            >
              {savingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Why */}
        <div className="rounded-xl bg-brand-500/5 border border-brand-500/10 p-3">
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">Why you need this</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{project.why}</p>
        </div>

        {/* Tech stack */}
        <div className="flex flex-wrap gap-1.5">
          {project.techStack.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-lg bg-secondary border border-border text-muted-foreground/70">
              {t}
            </span>
          ))}
        </div>

        {/* Impact */}
        <p className="text-xs text-muted-foreground/60 leading-relaxed">
          <span className="text-emerald-400 font-semibold">Portfolio impact: </span>
          {project.impact}
        </p>

        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors pt-1 border-t border-border"
        >
          <span>How to build it</span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Steps (expanded) */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-4">
          <ol className="space-y-2.5">
            {project.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {/* Build timeline — what to do and when */}
          {project.timeline && project.timeline.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-surface-100 p-3.5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-brand-400" /> Build timeline
              </p>
              <div className="space-y-0">
                {project.timeline.map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="w-2 h-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                      {i !== project.timeline!.length - 1 && <span className="w-px flex-1 bg-border my-0.5" />}
                    </div>
                    <div className="pb-3 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{t.phase}</span>
                        <span className="text-xs font-mono text-brand-300">{t.when}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{t.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-secondary border border-border p-3">
            <p className="text-xs text-muted-foreground/40 mb-0.5">Suggested repo</p>
            <p className="text-xs text-foreground/70 font-mono">{project.repoIdea}</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={copySteps} variant="outline" size="sm" className="gap-1.5 flex-1">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy Steps'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Skeleton Loading ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="h-3 w-16 bg-secondary rounded-full" />
      <div className="h-5 w-2/3 bg-secondary rounded-lg" />
      <div className="h-3 w-1/2 bg-secondary rounded-lg" />
      <div className="h-16 bg-secondary rounded-xl border border-border" />
      <div className="flex gap-1.5">
        {[1,2,3].map((i) => <div key={i} className="h-5 w-16 bg-secondary rounded-lg" />)}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectSuggestionsPage() {
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [useTextInput, setUseTextInput] = useState(false)
  const { isPro } = useUser()
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([])
  const [activeTier, setActiveTier] = useState<Difficulty>('Beginner')
  const [loading, setLoading] = useState(false)
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [savedItems, setSavedItems] = useState<{ id: string; project: ProjectSuggestion }[]>([])
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('resumes')
      .select('id, title')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && Array.isArray(data)) {
          const opts = data.map((r: { id: string; title?: string | null }) => ({
            id: r.id,
            title: r.title ?? 'Untitled Resume',
          }))
          setResumes(opts)
          if (opts.length > 0) setSelectedResumeId(opts[0].id)
        }
        setLoadingResumes(false)
      })
    // Load the user's saved projects — these persist across refreshes.
    fetch('/api/projects/saved').then((r) => (r.ok ? r.json() : { data: [] })).then((j) => setSavedItems(j.data ?? [])).catch(() => {})
  }, [])

  const isSaved = (p: ProjectSuggestion) => savedItems.some((s) => s.project.title === p.title)

  async function toggleSave(p: ProjectSuggestion) {
    const existing = savedItems.find((s) => s.project.title === p.title)
    setSavingKey(p.title)
    try {
      if (existing) {
        const res = await fetch(`/api/projects/saved?id=${existing.id}`, { method: 'DELETE' })
        if (res.ok) setSavedItems((prev) => prev.filter((s) => s.id !== existing.id))
        else toast.error('Could not remove.')
      } else {
        const res = await fetch('/api/projects/saved', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: p }),
        })
        const j = await res.json()
        if (res.ok) { setSavedItems((prev) => [j.data, ...prev]); toast.success('Project saved') }
        else toast.error(j.error ?? 'Could not save.')
      }
    } finally { setSavingKey(null) }
  }

  async function analyze() {
    if (!useTextInput && !selectedResumeId) {
      toast.error('Select a resume first')
      return
    }
    if (useTextInput && resumeText.trim().length < 100) {
      toast.error('Paste at least a paragraph of your resume')
      return
    }
    setLoading(true)
    setSuggestions([])
    try {
      const body = useTextInput
        ? { resumeText: resumeText.trim() }
        : { resumeId: selectedResumeId }

      const res = await fetch('/api/ai/suggest-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Analysis failed -- try again')
        return
      }
      setSuggestions(json.data?.suggestions ?? [])
    } catch {
      toast.error('Connection error')
    } finally {
      setLoading(false)
    }
  }

  const noResumes = !loadingResumes && resumes.length === 0 && !useTextInput

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 min-h-screen space-y-6">
      {/* Header */}
      <div>
        <Link href="/audit" className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground mb-4 transition-colors">
          <ArrowLeft className="h-3 w-3" />
          ProofScore
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FolderGit2 className="h-5 w-5 text-brand-400" />
              <h1 className="text-xl font-bold">Project Roadmap</h1>
            </div>
            <p className="text-sm text-muted-foreground/60">
              AI analyzes your resume and suggests projects that will genuinely make it stand out.
            </p>
          </div>
          {suggestions.length > 0 && (
            <Button onClick={analyze} disabled={loading} variant="outline" size="sm" className="gap-1.5 shrink-0">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {/* Saved projects — persist across refreshes, always visible when you have any */}
      {savedItems.length > 0 && (
        <div className="space-y-3 mb-2">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold text-foreground">Saved projects</h2>
            <span className="text-xs text-muted-foreground">({savedItems.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedItems.map((s) => (
              <ProjectCard key={s.id} project={s.project} index={0} saved onToggleSave={() => toggleSave(s.project)} savingBusy={savingKey === s.project.title} />
            ))}
          </div>
        </div>
      )}

      {/* Input section (only show when no results or loading) */}
      {suggestions.length === 0 && !loading && (
        <div className="glass-card rounded-2xl p-6 space-y-5">
          {noResumes ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground/60">No resume found -- add one to get personalized project suggestions.</p>
              <Button asChild variant="gradient" size="sm" className="gap-1.5">
                <Link href="/resume">
                  <Zap className="h-3.5 w-3.5" />
                  Add a Resume
                </Link>
              </Button>
              <button
                onClick={() => setUseTextInput(true)}
                className="block w-full text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-2"
              >
                Or paste resume text instead
              </button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium mb-3">Which resume should we analyze?</p>
                {!useTextInput ? (
                  <div className="space-y-2">
                    {loadingResumes ? (
                      <div className="h-10 bg-secondary rounded-xl animate-pulse" />
                    ) : (
                      <select
                        value={selectedResumeId}
                        onChange={(e) => setSelectedResumeId(e.target.value)}
                        className="w-full bg-surface-100 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
                      >
                        {resumes.map((r) => (
                          <option key={r.id} value={r.id}>{r.title}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => setUseTextInput(true)}
                      className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      Or paste text instead
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Paste your resume text here..."
                      className="min-h-[140px] text-sm resize-none bg-secondary border-border"
                    />
                    {resumes.length > 0 && (
                      <button
                        onClick={() => setUseTextInput(false)}
                        className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      >
                        Use saved resume instead
                      </button>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={analyze}
                variant="gradient"
                className="w-full gap-2"
                disabled={loading}
              >
                <Sparkles className="h-4 w-4" />
                Analyze My Resume
              </Button>
            </>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-400 animate-pulse" />
              <span className="text-sm text-muted-foreground">Analyzing your resume for portfolio gaps...</span>
            </div>
            <p className="text-xs text-muted-foreground/40">This takes about 10 seconds</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {/* Results — grouped into Beginner / Intermediate / Master tabs */}
      {suggestions.length > 0 && !loading && (
        <div className="space-y-5">
          {/* Tabs — free users get Beginner; Intermediate & Master are Pro */}
          <div className="flex items-center gap-1 bg-surface-200 rounded-xl p-1 w-full sm:w-fit">
            {TIERS.map((tier) => {
              const count = suggestions.filter((s) => s.difficulty === tier).length
              const tierLocked = !isPro && tier !== 'Beginner'
              return (
                <button
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className={cn(
                    'flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5',
                    activeTier === tier ? 'bg-surface-400 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tierLocked && <Lock className="h-3 w-3 text-brand-400" />}
                  {tier}
                  {!tierLocked && <span className="ml-0.5 text-xs opacity-60">{count}</span>}
                </button>
              )
            })}
          </div>
          <p className="text-sm text-muted-foreground">{TIER_DESC[activeTier]}</p>

          {(() => {
            const locked = !isPro && activeTier !== 'Beginner'
            // Free users: Intermediate/Master are NOT generated (no wasted AI cost) — the
            // blur is over empty placeholders, not real hidden content. Upgrading generates
            // them fresh.
            if (locked) {
              return (
                <div className="relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 blur-[6px] pointer-events-none select-none" aria-hidden>
                    {[0, 1].map((i) => <SkeletonCard key={i} />)}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div className="max-w-sm w-full text-center rounded-2xl border border-brand-500/30 bg-surface-100/95 backdrop-blur p-6 shadow-xl">
                      <div className="mx-auto mb-3 w-11 h-11 rounded-xl bg-brand-500/15 flex items-center justify-center">
                        <Lock className="h-5 w-5 text-brand-400" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{activeTier} projects are a Pro feature</p>
                      <p className="text-xs text-muted-foreground mt-1.5">Free includes the 3 <span className="text-foreground font-medium">Beginner</span> ideas. Upgrade to unlock <span className="text-foreground font-medium">Intermediate</span> and <span className="text-foreground font-medium">Master</span> projects — generated fresh for you.</p>
                      <Link href="/billing?plan=annual" className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:opacity-95 transition-opacity">
                        <Zap className="h-4 w-4" /> Upgrade to Pro
                      </Link>
                    </div>
                  </div>
                </div>
              )
            }
            const inTier = suggestions.filter((s) => s.difficulty === activeTier)
            if (inTier.length === 0) return <p className="text-sm text-muted-foreground/60">No {activeTier.toLowerCase()} projects in this batch. Try regenerating.</p>
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inTier.map((s, i) => (
                  <ProjectCard key={`${activeTier}-${i}`} project={s} index={i} saved={isSaved(s)} onToggleSave={() => toggleSave(s)} savingBusy={savingKey === s.title} />
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
