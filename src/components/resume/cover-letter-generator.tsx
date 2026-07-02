'use client'

import { useState, useEffect } from 'react'
import { Mail, Copy, Check, Sparkles, Loader2, Briefcase, ClipboardPaste } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/utils'

interface SavedJobOpt { id: string; title: string; company: string }
type Tone = 'professional' | 'warm' | 'direct'
const TONES: { id: Tone; label: string }[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'warm', label: 'Warm' },
  { id: 'direct', label: 'Direct' },
]

export function CoverLetterGenerator() {
  const [source, setSource] = useState<'paste' | 'saved'>('paste')
  const [savedJobs, setSavedJobs] = useState<SavedJobOpt[]>([])
  const [savedJobId, setSavedJobId] = useState<string>('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [loading, setLoading] = useState(false)
  const [letter, setLetter] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('saved_jobs')
      .select('id, imported_title, imported_company')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const opts = (data ?? [])
          .filter((j) => j.imported_title)
          .map((j) => ({ id: j.id as string, title: j.imported_title as string, company: (j.imported_company as string) ?? '' }))
        setSavedJobs(opts)
      })
  }, [])

  async function generate() {
    if (source === 'saved' && !savedJobId) { toast.error('Pick a saved job, or switch to Paste.'); return }
    if (source === 'paste' && !role.trim()) { toast.error('Enter the role you\'re applying for.'); return }

    setLoading(true)
    setLetter(null)
    try {
      const selected = savedJobs.find((j) => j.id === savedJobId)
      const res = await fetch('/api/ai/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role.trim() || selected?.title || 'the role',
          company: company.trim() || selected?.company || '',
          jobDescription: source === 'paste' ? jobDescription.trim() : '',
          savedJobId: source === 'saved' ? savedJobId : undefined,
          tone,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(apiErrorMessage(json.error, 'Could not generate the cover letter.'))
        return
      }
      setLetter(json.data.coverLetter)
      setHighlights(json.data.fitHighlights ?? [])
      toast.success('Cover letter ready')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copyLetter() {
    if (!letter) return
    await navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="space-y-5">
        <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5 w-fit">
          {([['paste', 'Paste a job', ClipboardPaste], ['saved', 'Saved job', Briefcase]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setSource(id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${source === id ? 'bg-surface-400 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {source === 'saved' ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Saved job</Label>
            {savedJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-border rounded-xl p-3">No saved jobs yet. Save a job in the Jobs section, or switch to “Paste a job”.</p>
            ) : (
              <select
                value={savedJobId}
                onChange={(e) => setSavedJobId(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-100 px-3 py-2.5 text-sm text-foreground"
              >
                <option value="">Select a job…</option>
                {savedJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}{j.company ? ` · ${j.company}` : ''}</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Role <span className="text-muted-foreground/50">(required)</span></Label>
                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Product Designer" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Anthropic" maxLength={200} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Job description <span className="text-muted-foreground/50">(paste for the most tailored letter)</span></Label>
              <Textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job posting here…" className="min-h-[160px]" maxLength={8000} />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Tone</Label>
          <div className="flex gap-1.5">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${tone === t.id ? 'border-brand-400/50 bg-brand-500/10 text-brand-300' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={generate} loading={loading} variant="gradient" className="w-full gap-2">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing…</> : <><Sparkles className="h-4 w-4" /> Generate cover letter</>}
        </Button>
        <p className="text-xs text-muted-foreground/60 text-center">Grounded strictly in your real resume — no invented experience.</p>
      </div>

      {/* Output */}
      <div className="rounded-2xl border border-border bg-surface-100 p-5 min-h-[300px] flex flex-col">
        {!letter && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
            <Mail className="h-8 w-8 opacity-40" />
            <p className="text-sm">Your personalized cover letter appears here.</p>
          </div>
        )}
        {loading && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Writing your letter…
          </div>
        )}
        {letter && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Your cover letter</p>
              <Button size="sm" variant="ghost" onClick={copyLetter} className="gap-1.5 h-7 text-xs">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{letter}</p>
            {highlights.length > 0 && (
              <div className="border-t border-border/60 pt-3 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Why you fit</p>
                {highlights.map((h, i) => (
                  <div key={i} className="flex gap-2 text-xs text-muted-foreground"><span className="text-brand-400">▹</span>{h}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
