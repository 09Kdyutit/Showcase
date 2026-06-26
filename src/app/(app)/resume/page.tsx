'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Upload, FileText, Zap, Copy, Check, AlertCircle, Lock, BarChart3, Download, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FileUploadZone } from '@/components/shared/file-upload-zone'
import type { Resume, ParsedResume } from '@/types/database'

export default function ResumePage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [activeResume, setActiveResume] = useState<Resume | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [parsed, setParsed] = useState<ParsedResume | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [portfolios, setPortfolios] = useState<Array<{ id: string; title: string }>>([])

  async function loadResumes() {
    const supabase = createClient()
    const [resumeRes, portfolioRes] = await Promise.all([
      supabase.from('resumes').select('*').order('created_at', { ascending: false }),
      supabase.from('portfolios').select('id, title').order('created_at', { ascending: false }).limit(10),
    ])
    setResumes(resumeRes.data ?? [])
    setPortfolios(portfolioRes.data ?? [])
    if (resumeRes.data?.[0]) {
      setActiveResume(resumeRes.data[0])
      setText(resumeRes.data[0].raw_text ?? '')
      setParsed((resumeRes.data[0].parsed_json as unknown as ParsedResume) ?? null)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadResumes() }, [])

  async function saveResume() {
    if (!text.trim()) return
    setSaving(true)
    const supabase = createClient()
    if (activeResume) {
      await supabase
        .from('resumes')
        .update({ raw_text: text, updated_at: new Date().toISOString() })
        .eq('id', activeResume.id)
      toast.success('Resume saved')
    } else {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { setSaving(false); return }
      const { data, error } = await supabase
        .from('resumes')
        .insert({ title: 'My Resume', raw_text: text, user_id: userData.user.id })
        .select()
        .single()
      if (error) {
        toast.error('Could not save resume')
        setSaving(false)
        return
      }
      if (data) { setActiveResume(data); setResumes([data, ...resumes]) }
      toast.success('Resume saved')
    }
    setSaving(false)
  }

  async function analyzeResume() {
    if (!text.trim()) { toast.error('Add your resume text first'); return }
    setAnalyzing(true)
    try {
      // Analyzing always persists — a resume row must exist (and stay in sync with the
      // current text) before /api/ai/analyze-resume can attach parsed_json to it. Without
      // this, a user who clicks Analyze without first clicking Save loses their result on
      // refresh and ProofScore has nothing to audit.
      let resume = activeResume
      const supabase = createClient()
      if (!resume) {
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) throw new Error('Not signed in')
        const { data, error } = await supabase
          .from('resumes')
          .insert({ title: 'My Resume', raw_text: text, user_id: userData.user.id })
          .select()
          .single()
        if (error) throw new Error('Could not save resume')
        if (data) {
          resume = data
          setActiveResume(data)
          setResumes((prev) => [data, ...prev])
        }
      } else if (resume.raw_text !== text) {
        await supabase.from('resumes').update({ raw_text: text, updated_at: new Date().toISOString() }).eq('id', resume.id)
      }

      const res = await fetch('/api/ai/analyze-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text, resumeId: resume?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setParsed(data.data)
      if (resume) {
        setActiveResume({ ...resume, parsed_json: data.data as unknown as Resume['parsed_json'] })
      }
      toast.success('Resume analyzed!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function exportDocx() {
    if (!activeResume) { toast.error('Save your resume first'); return }
    setExporting(true)
    try {
      const res = await fetch('/api/resume/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: activeResume.id, format: 'docx' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.message ?? 'Export failed. Please try again.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(activeResume.title || 'showcase-resume').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      const coverage = res.headers.get('X-ATS-Coverage')
      toast.success(coverage ? `Exported — ATS coverage ${coverage}%` : 'Exported')
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  async function generateFromPortfolio(portfolioId: string) {
    setGenerating(true)
    try {
      const res = await fetch('/api/resume/generate-from-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      toast.success('Resume generated from your portfolio!')
      await loadResumes()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function exportPdf() {
    if (!activeResume) { toast.error('Save or generate your resume first'); return }
    setExportingPdf(true)
    try {
      const res = await fetch('/api/resume/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: activeResume.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.message ?? 'PDF export failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(activeResume.title || 'resume').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('PDF exported')
    } catch {
      toast.error('PDF export failed')
    } finally {
      setExportingPdf(false)
    }
  }

  async function copyText(value: string, field: string) {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resume</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload, paste, or generate from your portfolio. AI extracts and formats everything.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {portfolios.length > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => generateFromPortfolio(portfolios[0].id)}
                loading={generating}
                className="gap-1.5"
                title={portfolios.length > 1 ? `Generate from: ${portfolios[0].title}` : undefined}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generating ? 'Generating…' : 'Generate from Portfolio'}
              </Button>
              {portfolios.length > 1 && (
                <select
                  className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-100 text-foreground h-8"
                  onChange={(e) => e.target.value && generateFromPortfolio(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>Pick portfolio…</option>
                  {portfolios.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={saveResume} loading={saving}>
            Save
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={analyzeResume}
            loading={analyzing}
            className="gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            Analyze
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-3">
          {/* File upload */}
          <FileUploadZone onText={(t) => setText(t)} />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground/50">or paste text</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-1.5">
            <Label>Resume text</Label>
            <Textarea
              placeholder="Paste your resume here. Include your summary, experience, projects, skills, and education..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[380px] font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground/60">{text.length} characters</p>
          </div>

          {/* Privacy note */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-200/60 border border-border/60">
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your resume is processed by OpenAI&apos;s API to generate your portfolio. It is never
              shared, sold, or used to train AI models. You control your data.
            </p>
          </div>
        </div>

        {/* Parsed output */}
        <div className="space-y-4">
          {analyzing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                Analyzing your resume...
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {!parsed && !analyzing && (
            <div className="glass-card p-8 flex flex-col items-center justify-center text-center h-full min-h-[480px] gap-4">
              <div className="w-14 h-14 rounded-xl bg-surface-300 flex items-center justify-center">
                <FileText className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">No analysis yet</p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                  Upload or paste your resume on the left, then click Analyze to extract skills, experience, and
                  identify weak spots.
                </p>
              </div>
              <Button
                variant="gradient"
                size="sm"
                onClick={analyzeResume}
                disabled={!text.trim()}
                className="gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" />
                Analyze resume
              </Button>
            </div>
          )}

          {parsed && !analyzing && (
            <div className="space-y-4 max-h-[600px] overflow-y-auto thin-scrollbar pr-1">
              {/* Identity */}
              {parsed.name && (
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Identity
                    </h3>
                    <Badge variant="success">Parsed</Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{parsed.name}</p>
                  {parsed.email && <p className="text-xs text-muted-foreground">{parsed.email}</p>}
                  {parsed.location && <p className="text-xs text-muted-foreground">{parsed.location}</p>}
                </div>
              )}

              {/* Skills */}
              {parsed.skills?.length > 0 && (
                <div className="glass-card p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Skills ({parsed.skills.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.skills.slice(0, 20).map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-surface-300 rounded-md text-xs text-foreground/70">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak bullets */}
              {parsed.weak_bullets?.length > 0 && (
                <div className="glass-card p-4 border-amber-500/15">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      Weak bullets ({parsed.weak_bullets.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {parsed.weak_bullets.slice(0, 4).map((b, i) => (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <p className="text-xs text-muted-foreground leading-relaxed flex-1">&ldquo;{b}&rdquo;</p>
                        <button
                          onClick={() => copyText(b, `weak-${i}`)}
                          className="text-muted-foreground/40 hover:text-muted-foreground shrink-0"
                        >
                          {copiedField === `weak-${i}` ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing proof */}
              {parsed.missing_proof?.length > 0 && (
                <div className="glass-card p-4 border-red-500/15">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider">Missing proof</h3>
                  </div>
                  <div className="space-y-1">
                    {parsed.missing_proof.slice(0, 4).map((p, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Possible case studies */}
              {parsed.possible_case_studies?.length > 0 && (
                <div className="glass-card p-4 border-brand-500/15">
                  <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-3">
                    Possible case studies
                  </h3>
                  <div className="space-y-1">
                    {parsed.possible_case_studies.map((cs, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                        <span className="text-brand-400">→</span>
                        {cs}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="gradient" size="sm" className="gap-1.5">
                  <Link href="/builder">
                    <Upload className="h-3.5 w-3.5" />
                    Build portfolio
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href="/audit">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Run ProofScore
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={exportDocx}
                  disabled={exporting}
                >
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Export DOCX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={exportPdf}
                  disabled={exportingPdf}
                >
                  {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Export PDF
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
