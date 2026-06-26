'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, ArrowLeft, ChevronDown, ChevronUp, Mic, ChevronRight, Building2, Sparkles, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { COMPANIES, type CompanyCategory } from '@/lib/interviews/companies'

// ── Types ───────────────────────────────────────────────────────────────────

interface CompanyQuestion {
  id: string
  text: string
  category: string
  tip: string
}

interface CompanyPrep {
  name: string
  category: string
  interviewStyle: string
  keyFocus: string[]
  uniqueTips: string[]
  questions: CompanyQuestion[]
  curated?: boolean
  generated?: boolean
}

interface ScoreResult {
  clarity: number; action: number; impact: number; structure: number
  total: number; label: string; strengths: string[]; improvements: string[]
}

// ── Suggestion list (for search autocomplete) ────────────────────────────────
// A broad list of well-known companies people commonly apply to
const KNOWN_COMPANIES = [
  // FAANG+
  'Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Netflix',
  // High-growth tech
  'Stripe', 'Airbnb', 'Uber', 'Lyft', 'Figma', 'Notion', 'Anthropic', 'OpenAI',
  'Salesforce', 'Shopify', 'Atlassian', 'Dropbox', 'Box', 'Slack',
  // Finance / Fintech
  'Goldman Sachs', 'JPMorgan Chase', 'Morgan Stanley', 'Visa', 'Mastercard',
  'PayPal', 'Robinhood', 'Coinbase', 'Block', 'Plaid', 'Chime', 'Brex', 'Ramp',
  // Enterprise Software
  'Workday', 'ServiceNow', 'Okta', 'HubSpot', 'Zendesk', 'Twilio', 'Segment',
  'Datadog', 'PagerDuty', 'Splunk', 'New Relic', 'HashiCorp', 'CrowdStrike',
  'Palantir', 'Snowflake', 'Databricks', 'MongoDB', 'Confluent', 'Elastic',
  // Social / Consumer
  'Twitter / X', 'LinkedIn', 'Pinterest', 'Snap', 'TikTok / ByteDance',
  'Reddit', 'Discord', 'Spotify', 'DoorDash', 'Instacart', 'Grubhub',
  // Cloud / Infra
  'Cloudflare', 'Vercel', 'Netlify', 'Heroku', 'DigitalOcean', 'Fastly',
  'Akamai', 'Rackspace', 'VMware',
  // Hardware / Devices
  'Intel', 'AMD', 'NVIDIA', 'Qualcomm', 'Samsung', 'Sony', 'Dell', 'HP', 'Lenovo',
  // Automotive / Mobility
  'Tesla', 'Waymo', 'Rivian', 'Lucid Motors', 'Cruise', 'Aurora', 'Zoox',
  // Healthcare / Bio
  'Epic Systems', 'Veeva Systems', 'Moderna', 'Pfizer', 'Johnson & Johnson',
  'UnitedHealth Group', 'CVS Health', 'Athenahealth',
  // Consulting / Advisory
  'McKinsey', 'Boston Consulting Group', 'Bain', 'Deloitte', 'Accenture', 'KPMG', 'PwC', 'EY',
  // E-commerce / Retail
  'Walmart', 'Target', 'Best Buy', 'eBay', 'Etsy', 'Wayfair', 'Chewy',
  // Media / Entertainment
  'Disney', 'Warner Bros Discovery', 'NBCUniversal', 'Hulu', 'Twitch', 'YouTube',
  // Other tech
  'Zoom', 'Docusign', 'Adobe', 'Autodesk', 'Intuit', 'Asana', 'Monday.com',
  'Airtable', 'Miro', 'Canva', 'GitHub', 'GitLab', 'JetBrains', 'Sentry',
  'Linear', 'Vercel', 'Railway', 'Supabase', 'PlanetScale',
  // Unicorns / late-stage
  'Rippling', 'Gusto', 'Lattice', 'Carta', 'Greenhouse', 'Lever', 'Gem',
  'Scale AI', 'Cohere', 'Mistral', 'Perplexity', 'Stability AI', 'Hugging Face',
  'Replit', 'Cursor', 'Codeium',
]

// ── Color helpers ─────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  FAANG: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Growth: 'bg-brand-500/10 text-brand-300 border-brand-500/20',
  Enterprise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Finance: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Startup: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Healthcare: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Other: 'bg-white/5 text-muted-foreground border-white/10',
}

function avatarGradient(name: string) {
  const hues = [210, 185, 145, 35, 270, 320, 60, 195]
  const h1 = hues[name.charCodeAt(0) % hues.length]
  const h2 = hues[(name.charCodeAt(1) ?? 3) % hues.length]
  return `linear-gradient(135deg, oklch(55% 0.2 ${h1}), oklch(50% 0.18 ${h2}))`
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

// ── Practice Dialog ───────────────────────────────────────────────────────────

function PracticeDialog({
  companyName, question, open, onClose,
}: {
  companyName: string; question: CompanyQuestion | null; open: boolean; onClose: () => void
}) {
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)

  useEffect(() => { if (!open) { setAnswer(''); setResult(null) } }, [open])

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0

  async function handleSubmit() {
    if (!question || wordCount < 20) { toast.error('Write at least 20 words.'); return }
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
          <DialogTitle className="text-base">{companyName} -- Practice</DialogTitle>
        </DialogHeader>
        {question && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4 space-y-2">
              <span className={cn('inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', CATEGORY_COLORS[question.category] ?? CATEGORY_COLORS.Other)}>
                {question.category}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{question.text}</p>
              <p className="text-xs text-muted-foreground/40 italic">Tip: {question.tip}</p>
            </div>

            {result ? (
              <div className="space-y-4">
                <div>
                  <p className="text-3xl font-bold stat-number">{result.total}<span className="text-lg text-muted-foreground font-normal">/100</span></p>
                  <p className={cn('text-sm font-semibold', labelColor)}>{result.label}</p>
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
                        <span className="font-medium">{d.v}/25</span>
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
                      {result.improvements.map((s, i) => <li key={i} className="flex gap-2"><span className="text-amber-500 shrink-0">--</span>{s}</li>)}
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
                  <span className={cn('text-xs', wordCount < 20 ? 'text-muted-foreground/40' : 'text-emerald-400')}>{wordCount} words</span>
                  <Button onClick={handleSubmit} disabled={submitting || wordCount < 20} variant="gradient" size="sm" className="gap-1.5">
                    {submitting ? 'Scoring...' : 'Get Feedback'}<ChevronRight className="h-3.5 w-3.5" />
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

// ── Company Detail ───────────────────────────────────────────────────────────

function CompanyDetail({ prep, onBack }: { prep: CompanyPrep; onBack: () => void }) {
  const [expandedQ, setExpandedQ] = useState<string | null>(null)
  const [practiceQ, setPracticeQ] = useState<CompanyQuestion | null>(null)

  const catColor = CATEGORY_COLORS[prep.category] ?? CATEGORY_COLORS.Other

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
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0"
            style={{ background: avatarGradient(prep.name), boxShadow: `0 0 20px ${avatarGradient(prep.name).includes('210') ? 'var(--color-brand-500)' : 'rgba(0,0,0,0)'}40` }}
          >
            {initials(prep.name)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{prep.name}</h1>
              {prep.generated && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-brand-500/10 border-brand-500/20 text-brand-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI Generated
                </span>
              )}
            </div>
            <span className={cn('inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-1', catColor)}>
              {prep.category}
            </span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <p className="text-sm text-muted-foreground leading-relaxed">{prep.interviewStyle}</p>
        </div>
      </div>

      {/* Focus + Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl space-y-3">
          <h3 className="text-sm font-semibold">What they look for</h3>
          <ul className="space-y-2">
            {prep.keyFocus.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-brand-400 mt-0.5 shrink-0">+</span>{f}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-3">
          <h3 className="text-sm font-semibold">Insider tips</h3>
          <ul className="space-y-2">
            {prep.uniqueTips.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-amber-400 mt-0.5 shrink-0">*</span>{t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Questions */}
      <div>
        <h3 className="text-sm font-semibold mb-3">{prep.questions.length} Interview Questions</h3>
        <div className="space-y-2">
          {prep.questions.map((q) => (
            <div key={q.id} className="glass-card rounded-2xl overflow-hidden">
              <button
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
              >
                <span className={cn('shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-0.5 whitespace-nowrap', CATEGORY_COLORS[q.category] ?? CATEGORY_COLORS.Other)}>
                  {q.category}
                </span>
                <p className="text-sm text-foreground/90 flex-1 leading-relaxed">{q.text}</p>
                {expandedQ === q.id
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
              </button>

              {expandedQ === q.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
                  <p className="text-xs text-muted-foreground/60 italic leading-relaxed">Tip: {q.tip}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="gradient" className="h-8 text-xs gap-1.5 flex-1" onClick={() => setPracticeQ(q)}>
                      Practice Written <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 flex-1" onClick={() => setPracticeQ(q)}>
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
        companyName={prep.name}
        question={practiceQ}
        open={!!practiceQ}
        onClose={() => setPracticeQ(null)}
      />
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyPrepPage() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedPrep, setSelectedPrep] = useState<CompanyPrep | null>(null)
  const [loading, setLoading] = useState(false)
  const [catFilter, setCatFilter] = useState<CompanyCategory | 'all'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  // Autocomplete
  useEffect(() => {
    if (query.length < 1) { setSuggestions([]); return }
    const q = query.toLowerCase()
    const matches = KNOWN_COMPANIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }, [query])

  async function loadCompany(name: string) {
    setQuery(name)
    setShowSuggestions(false)
    setLoading(true)
    setSelectedPrep(null)
    try {
      const res = await fetch('/api/interviews/companies/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: name }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to load company prep'); return }
      setSelectedPrep(json.data)
    } catch { toast.error('Connection error') }
    finally { setLoading(false) }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) loadCompany(query.trim())
  }

  // Featured companies (curated list)
  const featured = COMPANIES.filter((c) => catFilter === 'all' || c.category === catFilter)

  if (selectedPrep) {
    return (
      <div className="max-w-5xl mx-auto p-4 lg:p-8 min-h-screen">
        <CompanyDetail prep={selectedPrep} onBack={() => { setSelectedPrep(null); setQuery('') }} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8 min-h-screen space-y-8">
      {/* Header */}
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
          Search any company -- get tailored questions, insider tips, and AI practice.
        </p>
      </div>

      {/* Search -- primary CTA */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold">Which company are you interviewing at?</p>
        <form onSubmit={handleSearch} className="relative">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Type any company name -- Google, McKinsey, your local startup..."
              className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl pl-10 pr-24 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-brand-500/50 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setSuggestions([]) }}
                className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/30 hover:text-muted-foreground/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Button
              type="submit"
              variant="gradient"
              size="sm"
              disabled={!query.trim() || loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 gap-1.5 h-8 px-3 text-xs"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {loading ? 'Loading...' : 'Get Prep'}
            </Button>
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
              style={{
                background: 'var(--color-surface-100)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={() => loadCompany(s)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-white/[0.05] transition-colors"
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ background: avatarGradient(s) }}
                  >
                    {initials(s)}
                  </div>
                  <span className="text-foreground/80">{s}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        <p className="text-xs text-muted-foreground/40">
          Curated for 15+ top companies, AI-generated for everything else. Covers startups, enterprise, finance, consulting, and more.
        </p>
      </div>

      {/* Featured companies */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Featured Companies</p>
          <div className="flex gap-1.5">
            {(['all', 'FAANG', 'Growth', 'Enterprise'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCatFilter(f)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                  catFilter === f
                    ? 'bg-brand-500/15 text-brand-300 border-brand-500/20'
                    : 'text-muted-foreground border-white/[0.06] hover:border-white/[0.12] hover:text-foreground'
                )}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {featured.map((company) => (
            <button
              key={company.id}
              onClick={() => loadCompany(company.name)}
              className="glass-card rounded-2xl p-4 flex flex-col items-start gap-2.5 text-left hover:border-brand-500/20 hover:shadow-glow-sm transition-all duration-200 group card-3d"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                style={{ background: avatarGradient(company.name) }}
              >
                {company.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-brand-200 transition-colors">{company.name}</p>
                <span className={cn('inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mt-1', CATEGORY_COLORS[company.category])}>
                  {company.category}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* "Try any company" examples */}
      <div className="rounded-2xl border border-dashed border-white/[0.08] p-5">
        <p className="text-xs text-muted-foreground/40 mb-3">You can search for any company, including:</p>
        <div className="flex flex-wrap gap-2">
          {['Palantir', 'Rippling', 'Scale AI', 'McKinsey', 'Goldman Sachs', 'Tesla', 'Coinbase', 'Datadog', 'Snowflake', 'Your local startup'].map((name) => (
            <button
              key={name}
              onClick={() => loadCompany(name)}
              className="text-xs px-2.5 py-1 rounded-lg border border-white/[0.07] text-muted-foreground/50 hover:text-muted-foreground hover:border-white/[0.15] transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
