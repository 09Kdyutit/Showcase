'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, ArrowLeft, ChevronDown, ChevronUp, Mic, ChevronRight, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { COMPANIES, type CompanyData, type CompanyQuestion, type CompanyCategory } from '@/lib/interviews/companies'

interface ScoreResult {
  clarity: number; action: number; impact: number; structure: number
  total: number; label: string; strengths: string[]; improvements: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<CompanyCategory, string> = {
  FAANG: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Growth: 'bg-brand-500/10 text-brand-300 border-brand-500/20',
  Enterprise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

function companyInitialColor(name: string) {
  const hues = [210, 180, 145, 30, 270, 320]
  const idx = name.charCodeAt(0) % hues.length
  return `oklch(55% 0.2 ${hues[idx]})`
}

// ── Practice Dialog ─────────────────────────────────────────────────────────

function PracticeDialog({
  company,
  question,
  mode,
  open,
  onClose,
}: {
  company: CompanyData | null
  question: CompanyQuestion | null
  mode: 'written' | 'spoken'
  open: boolean
  onClose: () => void
}) {
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)

  useEffect(() => { if (!open) { setAnswer(''); setResult(null) } }, [open])

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0

  async function handleSubmit() {
    if (!question) return
    if (wordCount < 20) { toast.error('Write at least 20 words.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/interviews/questions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: question.text, answerText: answer }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Scoring failed.'); return }
      setResult(json.data)
    } catch { toast.error('Connection error.') }
    finally { setSubmitting(false) }
  }

  const labelColor = result
    ? result.label === 'Excellent' ? 'text-emerald-400'
    : result.label === 'Good' ? 'text-brand-300'
    : result.label === 'Fair' ? 'text-amber-400'
    : 'text-red-400' : ''

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{company?.name} -- Practice</DialogTitle>
        </DialogHeader>
        {question && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4 space-y-2">
              <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">{question.category}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{question.text}</p>
              <p className="text-xs text-muted-foreground/40 italic">Tip: {question.tip}</p>
            </div>

            {result ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold stat-number">{result.total}<span className="text-lg text-muted-foreground font-normal">/100</span></p>
                    <p className={cn('text-sm font-semibold', labelColor)}>{result.label}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Clarity & Context', v: result.clarity },
                    { label: 'Action Specificity', v: result.action },
                    { label: 'Measurable Impact', v: result.impact },
                    { label: 'STAR Structure', v: result.structure },
                  ].map((d) => (
                    <div key={d.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="text-foreground font-medium">{d.v}/25</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${(d.v / 25) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {result.improvements.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Strengthen</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {result.improvements.map((s, i) => <li key={i} className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">--</span>{s}</li>)}
                    </ul>
                  </div>
                )}
                <Button onClick={() => { setAnswer(''); setResult(null) }} variant="outline" size="sm" className="w-full">Try Again</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Use the STAR method: Situation, Task, Action, Result..."
                  className="min-h-[160px] text-sm resize-none bg-white/[0.03] border-white/[0.08] focus:border-brand-500/40"
                />
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs', wordCount < 20 ? 'text-muted-foreground/40' : 'text-emerald-400')}>
                    {wordCount} words
                  </span>
                  <Button onClick={handleSubmit} disabled={submitting || wordCount < 20} variant="gradient" size="sm" className="gap-1.5">
                    {submitting ? 'Scoring...' : 'Get Feedback'}
                    {!submitting && <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Company Detail View ────────────────────────────────────────────────────

function CompanyDetail({ company, onBack }: { company: CompanyData; onBack: () => void }) {
  const [expandedQ, setExpandedQ] = useState<string | null>(null)
  const [practiceQ, setPracticeQ] = useState<CompanyQuestion | null>(null)
  const [practiceMode, setPracticeMode] = useState<'written' | 'spoken'>('written')

  function openPractice(q: CompanyQuestion, mode: 'written' | 'spoken') {
    setPracticeQ(q)
    setPracticeMode(mode)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground mb-5 transition-colors">
          <ArrowLeft className="h-3 w-3" />
          All Companies
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
            style={{
              background: `linear-gradient(135deg, ${companyInitialColor(company.name)}, ${companyInitialColor(company.name + '1')})`,
              boxShadow: `0 0 20px ${companyInitialColor(company.name)}40`,
            }}
          >
            {company.initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <span className={cn('inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-1', CATEGORY_COLORS[company.category])}>
              {company.category}
            </span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <p className="text-sm text-muted-foreground leading-relaxed">{company.interviewStyle}</p>
        </div>
      </div>

      {/* Focus + Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl space-y-3">
          <h3 className="text-sm font-semibold text-foreground">What they look for</h3>
          <ul className="space-y-2">
            {company.keyFocus.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-brand-400 mt-0.5 shrink-0">+</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Insider tips</h3>
          <ul className="space-y-2">
            {company.uniqueTips.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-amber-400 mt-0.5 shrink-0">*</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Questions */}
      <div>
        <h3 className="text-sm font-semibold mb-3">
          {company.questions.length} Company-Specific Questions
        </h3>
        <div className="space-y-2">
          {company.questions.map((q) => (
            <div key={q.id} className="glass-card rounded-2xl overflow-hidden">
              <button
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
              >
                <span className={cn('shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-0.5', CATEGORY_COLORS[company.category])}>
                  {q.category}
                </span>
                <p className="text-sm text-foreground/90 flex-1 leading-relaxed">{q.text}</p>
                {expandedQ === q.id
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
              </button>

              {expandedQ === q.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
                  <p className="text-xs text-muted-foreground/60 italic leading-relaxed">
                    Tip: {q.tip}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="gradient" className="h-8 text-xs gap-1.5 flex-1" onClick={() => openPractice(q, 'written')}>
                      Practice Written <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 flex-1" onClick={() => openPractice(q, 'spoken')}>
                      <Mic className="h-3 w-3" />
                      Speak Answer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <PracticeDialog
        company={company}
        question={practiceQ}
        mode={practiceMode}
        open={!!practiceQ}
        onClose={() => setPracticeQ(null)}
      />
    </div>
  )
}

// ── Company Grid ────────────────────────────────────────────────────────────

function CompanyGrid({ onSelect }: { onSelect: (c: CompanyData) => void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CompanyCategory | 'all'>('all')

  const filtered = COMPANIES.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.category === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/interviews" className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground mb-4 transition-colors">
          <ArrowLeft className="h-3 w-3" />
          Interview Lab
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-brand-400" />
          <h1 className="text-xl font-bold">Company Prep</h1>
        </div>
        <p className="text-sm text-muted-foreground/60">
          Targeted questions and insider tips for your target company.
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-brand-500/40"
          />
        </div>
        {(['all', 'FAANG', 'Growth', 'Enterprise'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-2 rounded-xl text-xs font-medium transition-colors border',
              filter === f
                ? 'bg-brand-500/15 text-brand-300 border-brand-500/20'
                : 'text-muted-foreground border-white/[0.06] hover:border-white/[0.12] hover:text-foreground'
            )}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((company) => (
          <button
            key={company.id}
            onClick={() => onSelect(company)}
            className="glass-card rounded-2xl p-4 flex flex-col items-start gap-3 text-left hover:border-brand-500/20 hover:shadow-glow-sm transition-all duration-200 group card-3d"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${companyInitialColor(company.name)}, ${companyInitialColor(company.name + '1')})`,
              }}
            >
              {company.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
              <span className={cn('inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mt-1', CATEGORY_COLORS[company.category])}>
                {company.category}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/40">{company.questions.length} questions</p>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground/40 text-sm">
          No companies match "{search}"
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CompanyPrepPage() {
  const [selected, setSelected] = useState<CompanyData | null>(null)

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8 min-h-screen">
      {selected
        ? <CompanyDetail company={selected} onBack={() => setSelected(null)} />
        : <CompanyGrid onSelect={setSelected} />
      }
    </div>
  )
}
