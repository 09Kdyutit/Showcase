'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Upload, FileText, Zap, Copy, Check, AlertCircle, X, Lock, File } from 'lucide-react'
import { toast } from 'sonner'
import { createClient, tryCreateClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Resume, ParsedResume } from '@/types/database'

type UploadStatus = 'idle' | 'uploading' | 'done' | 'paste-needed' | 'error'

function FileUploadZone({ onText }: { onText: (text: string) => void }) {
  const [drag, setDrag] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    const isTxt = file.type === 'text/plain' || file.name.endsWith('.txt')
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
    const isDocx =
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.docx')

    if (!isTxt && !isPdf && !isDocx) {
      toast.error('Only PDF, DOCX, or TXT files are supported')
      return
    }

    setFileName(file.name)

    if (isTxt) {
      const text = await file.text()
      onText(text)
      setStatus('done')
      toast.success('Resume text extracted — ready to analyze')
      return
    }

    // PDF / DOCX — upload to Supabase Storage, then ask user to paste text
    setStatus('uploading')
    try {
      const supabase = tryCreateClient()
      if (supabase) {
        const { data: userData } = await supabase.auth.getUser()
        if (userData.user) {
          const ext = file.name.split('.').pop() ?? 'pdf'
          const path = `${userData.user.id}/${Date.now()}.${ext}`
          await supabase.storage.from('resumes').upload(path, file, {
            contentType: file.type,
            upsert: false,
          })
        }
      }
    } catch {
      // upload failure is non-fatal; paste is the fallback
    }
    setStatus('paste-needed')
  }, [onText])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
        <File className="h-4 w-4 text-emerald-400 shrink-0" />
        <p className="text-xs text-emerald-400 flex-1 truncate">{fileName}</p>
        <Badge variant="success">Text extracted</Badge>
        <button onClick={() => { setStatus('idle'); setFileName(null) }} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (status === 'paste-needed') {
    return (
      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs font-medium text-amber-400">{fileName} uploaded</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          PDF/DOCX text extraction requires a copy-paste step. Open your file, select all text (Cmd+A), and paste it
          in the box below.
        </p>
        <button onClick={() => { setStatus('idle'); setFileName(null) }} className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline">
          Try a different file
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-xl border-2 border-dashed p-6 transition-all duration-200 text-center cursor-pointer',
        drag
          ? 'border-brand-500/60 bg-brand-500/5'
          : 'border-border hover:border-brand-500/30 hover:bg-surface-200/40',
        status === 'uploading' && 'opacity-60 pointer-events-none',
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="flex flex-col items-center gap-2">
        {status === 'uploading' ? (
          <>
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Upload className="h-4 w-4 text-brand-400 animate-bounce" />
            </div>
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-surface-300 flex items-center justify-center">
              <Upload className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Upload your resume</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">PDF, DOCX, or TXT · max 10MB</p>
            </div>
          </>
        )}
      </div>
    </button>
  )
}

export default function ResumePage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [activeResume, setActiveResume] = useState<Resume | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [parsed, setParsed] = useState<ParsedResume | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  async function loadResumes() {
    const supabase = createClient()
    const { data } = await supabase
      .from('resumes')
      .select('*')
      .order('created_at', { ascending: false })
    setResumes(data ?? [])
    if (data?.[0]) {
      setActiveResume(data[0])
      setText(data[0].raw_text ?? '')
      setParsed((data[0].parsed_json as unknown as ParsedResume) ?? null)
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
      const { data } = await supabase
        .from('resumes')
        .insert({ title: 'My Resume', raw_text: text })
        .select()
        .single()
      if (data) { setActiveResume(data); setResumes([data, ...resumes]) }
      toast.success('Resume saved')
    }
    setSaving(false)
  }

  async function analyzeResume() {
    if (!text.trim()) { toast.error('Add your resume text first'); return }
    setAnalyzing(true)
    try {
      const res = await fetch('/api/ai/analyze-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text, resumeId: activeResume?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setParsed(data.data)
      toast.success('Resume analyzed!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
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
            Upload or paste your resume. AI extracts everything from it.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
            <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/60 leading-relaxed">
              Your resume is processed by Anthropic&apos;s Claude API to generate your portfolio. It is never
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

              <Button asChild variant="gradient" size="sm" className="w-full gap-1.5">
                <Link href="/builder">
                  <Upload className="h-3.5 w-3.5" />
                  Build portfolio from this resume
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
