'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, RefreshCw, ChevronDown, ChevronUp, Copy, Check,
  FolderGit2, Clock, ArrowLeft, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ProjectSuggestion {
  title: string
  tagline: string
  why: string
  techStack: string[]
  difficulty: 'Weekend' | '1-2 Weeks' | '1 Month'
  impact: string
  steps: string[]
  repoIdea: string
}

interface ResumeOption {
  id: string
  title: string
}

const DIFF_COLOR: Record<string, string> = {
  'Weekend': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  '1-2 Weeks': 'bg-brand-500/10 text-brand-700 border-brand-500/20',
  '1 Month': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
}

// ── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, index }: { project: ProjectSuggestion; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copySteps() {
    const text = [
      `# ${project.title}`,
      `${project.tagline}`,
      '',
      `Tech: ${project.techStack.join(', ')}`,
      `Estimated effort: ${project.difficulty}`,
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
              <span className={cn('inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', DIFF_COLOR[project.difficulty])}>
                <Clock className="h-2.5 w-2.5 mr-1" />
                {project.difficulty}
              </span>
            </div>
            <h3 className="text-base font-semibold text-foreground mt-1.5">{project.title}</h3>
            <p className="text-xs text-muted-foreground/60 mt-0.5">{project.tagline}</p>
          </div>
          <div className="text-2xl font-bold text-white/5 font-mono shrink-0">
            {String(index + 1).padStart(2, '0')}
          </div>
        </div>

        {/* Why */}
        <div className="rounded-xl bg-brand-500/5 border border-brand-500/10 p-3">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">Why you need this</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{project.why}</p>
        </div>

        {/* Tech stack */}
        <div className="flex flex-wrap gap-1.5">
          {project.techStack.map((t) => (
            <span key={t} className="text-[11px] px-2 py-0.5 rounded-lg bg-secondary border border-border text-muted-foreground/70">
              {t}
            </span>
          ))}
        </div>

        {/* Impact */}
        <p className="text-xs text-muted-foreground/60 leading-relaxed">
          <span className="text-emerald-600 font-semibold">Portfolio impact: </span>
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
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-[10px] font-bold text-brand-600 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="rounded-xl bg-secondary border border-border p-3">
            <p className="text-xs text-muted-foreground/40 mb-0.5">Suggested repo</p>
            <p className="text-xs text-foreground/70 font-mono">{project.repoIdea}</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={copySteps} variant="outline" size="sm" className="gap-1.5 flex-1">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
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
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingResumes, setLoadingResumes] = useState(true)

  useEffect(() => {
    loadResumes()
  }, [])

  async function loadResumes() {
    try {
      const res = await fetch('/api/resume')
      const json = await res.json()
      if (res.ok && Array.isArray(json.data)) {
        const opts = json.data.map((r: { id: string; title?: string; target_role?: string }) => ({
          id: r.id,
          title: r.title ?? r.target_role ?? 'Untitled Resume',
        }))
        setResumes(opts)
        if (opts.length > 0) setSelectedResumeId(opts[0].id)
      }
    } catch {
      // ignore
    } finally {
      setLoadingResumes(false)
    }
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
              <FolderGit2 className="h-5 w-5 text-brand-600" />
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
              <Sparkles className="h-4 w-4 text-brand-600 animate-pulse" />
              <span className="text-sm text-muted-foreground">Analyzing your resume for portfolio gaps...</span>
            </div>
            <p className="text-xs text-muted-foreground/40">This takes about 10 seconds</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {/* Results */}
      {suggestions.length > 0 && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground/60">
              {suggestions.length} personalized project suggestions based on your resume
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map((s, i) => (
              <ProjectCard key={i} project={s} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
