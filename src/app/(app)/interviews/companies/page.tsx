'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Search, ArrowLeft, ChevronDown, ChevronUp, Mic, ChevronRight, Building2, Sparkles, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { COMPANIES, type CompanyCategory } from '@/lib/interviews/companies'
import { CompanyLogo } from '@/components/interviews/shared/company-logo'

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
  Healthcare: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  Other: 'bg-white/5 text-muted-foreground border-white/10',
}

// ── Company Detail ───────────────────────────────────────────────────────────

function CompanyDetail({ prep, onBack }: { prep: CompanyPrep; onBack: () => void }) {
  const router = useRouter()
  const [expandedQ, setExpandedQ] = useState<string | null>(null)

  // Launch a real, AI-graded voice interview framed around this company. Reuses the
  // standard create -> lobby -> live flow; the live interviewer is company-aware.
  function startVoiceInterview() {
    const params = new URLSearchParams({ targetCompany: prep.name })
    router.push(`/interviews/new?${params.toString()}`)
  }

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
          <CompanyLogo name={prep.name} className="w-14 h-14 rounded-2xl" textClass="text-lg" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{prep.name}</h1>
              {prep.generated && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full border bg-brand-500/10 border-brand-500/20 text-brand-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI Generated
                </span>
              )}
            </div>
            <span className={cn('inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border mt-1', catColor)}>
              {prep.category}
            </span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <p className="text-sm text-muted-foreground leading-relaxed">{prep.interviewStyle}</p>
        </div>
      </div>

      {/* Primary CTA: AI voice interview as this company */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, oklch(54% 0.23 255 / 0.14), oklch(54% 0.23 255 / 0.04))', border: '1px solid oklch(54% 0.23 255 / 0.28)' }}>
        <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, oklch(54% 0.23 255 / 0.18), transparent 70%)', filter: 'blur(20px)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Mic className="h-4 w-4 text-brand-300" />
              Practice a live voice interview with {prep.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-xl">
              Talk to an AI interviewer that runs it like {prep.name} does — it adapts to your answers,
              asks real follow-ups, and afterwards grades you like a real interviewer. Pick your length (5–30 min) on the next screen.
            </p>
          </div>
          <Button onClick={startVoiceInterview} variant="gradient" size="lg" className="gap-2 shrink-0">
            Start interview <ChevronRight className="h-4 w-4" />
          </Button>
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

      {/* Questions — preview of what they tend to ask (you'll practice these live) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Questions {prep.name} tends to ask</h3>
          <span className="text-xs text-muted-foreground/60">{prep.questions.length} examples</span>
        </div>
        <div className="space-y-2">
          {prep.questions.map((q) => (
            <div key={q.id} className="glass-card rounded-2xl overflow-hidden">
              <button
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-secondary transition-colors"
                onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
              >
                <span className={cn('shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded border mt-0.5 whitespace-nowrap', CATEGORY_COLORS[q.category] ?? CATEGORY_COLORS.Other)}>
                  {q.category}
                </span>
                <p className="text-sm text-foreground/90 flex-1 leading-relaxed">{q.text}</p>
                {expandedQ === q.id
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
              </button>

              {expandedQ === q.id && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground/60 italic leading-relaxed">How to nail it: {q.tip}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={startVoiceInterview}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-brand-200 transition-colors hover:bg-brand-500/10"
          style={{ border: '1px solid oklch(54% 0.23 255 / 0.25)' }}
        >
          <Mic className="h-4 w-4" />
          Practice these live with the {prep.name} interviewer
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyPrepPage() {
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedPrep, setSelectedPrep] = useState<CompanyPrep | null>(null)
  const [loading, setLoading] = useState(false)
  const [catFilter, setCatFilter] = useState<CompanyCategory | 'all'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  // Autocomplete — derived from the query, no effect needed
  const suggestions = useMemo(() => {
    if (query.length < 1) return []
    const q = query.toLowerCase()
    return KNOWN_COMPANIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8)
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
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true) }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Type any company name -- Google, McKinsey, your local startup..."
              className="w-full bg-secondary border border-border rounded-xl pl-10 pr-24 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-brand-500/50 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
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
                border: '1px solid var(--color-border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={() => loadCompany(s)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-secondary transition-colors"
                >
                  <CompanyLogo name={s} className="w-6 h-6 rounded-md" textClass="text-[9px]" />
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
                    : 'text-muted-foreground border-border hover:border-border hover:text-foreground'
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
              <CompanyLogo name={company.name} className="w-9 h-9 rounded-xl" textClass="text-xs" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-brand-200 transition-colors">{company.name}</p>
                <span className={cn('inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full border mt-1', CATEGORY_COLORS[company.category])}>
                  {company.category}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* "Try any company" examples */}
      <div className="rounded-2xl border border-dashed border-border p-5">
        <p className="text-xs text-muted-foreground/40 mb-3">You can search for any company, including:</p>
        <div className="flex flex-wrap gap-2">
          {['Palantir', 'Rippling', 'Scale AI', 'McKinsey', 'Goldman Sachs', 'Tesla', 'Coinbase', 'Datadog', 'Snowflake', 'Your local startup'].map((name) => (
            <button
              key={name}
              onClick={() => loadCompany(name)}
              className="text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground/50 hover:text-muted-foreground hover:border-border transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
