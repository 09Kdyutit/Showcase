'use client'

// Opportunities discovery (hackathons, scholarships, internships, grants, fellowships,
// competitions, and more). Extracted from the Jobs page into its own top-level section.
// Self-contained: fetches from /api/opportunities/* and renders browse + "for you" views.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Award, Banknote, BookOpen, Briefcase, Calendar, CalendarClock, ExternalLink,
  FlaskConical, Globe, GraduationCap, Handshake, Heart, MapPin, RefreshCw,
  Search, Shield, Sparkles, Trophy, X, Lock, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/hooks/use-user'
import type { Opportunity, OpportunityCategory } from '@/app/api/opportunities/search/route'

// ── Opportunity helpers ───────────────────────────────────────────────────────

const CATEGORY_META: Record<OpportunityCategory, { label: string; icon: React.ElementType; color: string; chipColor: string }> = {
  hackathon:    { label: 'Hackathon',   icon: Trophy,        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',   chipColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  ctf:          { label: 'CTF',         icon: Shield,        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', chipColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  competition:  { label: 'Competition', icon: Trophy,        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       chipColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  scholarship:  { label: 'Scholarship', icon: GraduationCap, color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',             chipColor: 'bg-sky-500/10 text-sky-700 border-sky-500/20' },
  fellowship:   { label: 'Fellowship',  icon: Award,         color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',    chipColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  internship:   { label: 'Internship',  icon: Briefcase,     color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',          chipColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  volunteering: { label: 'Volunteering',icon: Heart,         color: 'text-rose-600 bg-rose-500/10 border-rose-500/20',          chipColor: 'bg-rose-500/10 text-rose-700 border-rose-500/20' },
  event:        { label: 'Event',       icon: Calendar,      color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',    chipColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  workshop:     { label: 'Workshop',    icon: BookOpen,      color: 'text-teal-600 bg-teal-500/10 border-teal-500/20',          chipColor: 'bg-teal-500/10 text-teal-700 border-teal-500/20' },
  grant:        { label: 'Grant',       icon: Banknote,      color: 'text-green-600 bg-green-500/10 border-green-500/20',       chipColor: 'bg-green-500/10 text-green-700 border-green-500/20' },
  programme:    { label: 'Programme',   icon: Handshake,     color: 'text-fuchsia-600 bg-fuchsia-500/10 border-fuchsia-500/20', chipColor: 'bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/20' },
  research:     { label: 'Research',    icon: FlaskConical,  color: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20',          chipColor: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20' },
  job:          { label: 'Job',         icon: Briefcase,     color: 'text-muted-foreground bg-secondary border-border',         chipColor: 'bg-secondary text-muted-foreground border-border' },
}

const ALL_CATEGORIES: OpportunityCategory[] = [
  'hackathon','competition','ctf','scholarship','fellowship','internship',
  'volunteering','event','workshop','grant','programme','research',
]

function DeadlineBadge({ days, label }: { days: number | null; label: string | null }) {
  if (!label) return null
  const urgent = days !== null && days <= 3
  const soon   = days !== null && days <= 7
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap',
      urgent ? 'text-red-400 bg-red-500/10 border-red-500/20' :
      soon   ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
               'text-muted-foreground bg-surface-200 border-border'
    )}>
      <CalendarClock className="h-2.5 w-2.5 shrink-0" />
      {label}
    </span>
  )
}

function OpportunityCard({ opp, matchScore }: { opp: Opportunity; matchScore?: number }) {
  const meta = CATEGORY_META[opp.category] ?? CATEGORY_META.hackathon
  const Icon = meta.icon
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-surface-50 hover:border-brand-400/40 hover:bg-surface-100 hover:shadow-sm transition-all duration-150 overflow-hidden">
      <div className="p-4 flex flex-col flex-1">
        {/* Top row: category badge + deadline */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg border', meta.color)}>
            <Icon className="h-2.5 w-2.5 shrink-0" />
            {meta.label}
          </span>
          <DeadlineBadge days={opp.days_left} label={opp.time_left_label} />
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-foreground leading-snug mb-1 line-clamp-2 group-hover:text-brand-300 transition-colors">
          {opp.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-2 truncate">{opp.organizer}</p>

        {/* Description snippet */}
        {opp.description && (
          <p className="text-xs text-muted-foreground/70 line-clamp-2 mb-2 leading-relaxed">
            {opp.description}
          </p>
        )}

        {/* Location */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground/60 mb-3">
          {opp.is_online
            ? <><Globe className="h-2.5 w-2.5 shrink-0" /><span>Online / Remote</span></>
            : opp.location
              ? <><MapPin className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{opp.location}</span></>
              : null
          }
        </div>

        {/* Tags */}
        {opp.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {opp.tags.slice(0, 4).map(t => (
              <span key={t} className="text-xs px-1.5 py-0.5 rounded-md bg-secondary border border-border text-muted-foreground/70">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom row */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border mt-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              Free
            </span>
            {opp.prize && (
              <span className="text-xs text-amber-400 font-medium truncate">{opp.prize}</span>
            )}
            {matchScore !== undefined && (
              <span className="text-xs text-brand-400 font-semibold">
                {matchScore}% match
              </span>
            )}
            {opp.participants != null && !opp.prize && (
              <span className="text-xs text-muted-foreground/50 truncate">
                {opp.participants.toLocaleString()} joined
              </span>
            )}
          </div>
          <a
            href={opp.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
          >
            Apply <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

type OppCategoryFilter = '' | OpportunityCategory

export function OpportunitiesView({ region }: { region: string }) {
  const { isPro } = useUser()
  const [view, setView] = useState<'browse' | 'for-you'>('browse')
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [forYouOpps, setForYouOpps] = useState<Array<Opportunity & { match_score: number }>>([])
  const [forYouProfile, setForYouProfile] = useState<{ location: string | null; skills: string[]; education_level: string; experience_level: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingForYou, setLoadingForYou] = useState(false)
  const forYouLoadedRef = useRef(false)
  const forYouInFlightRef = useRef(false)
  const [counts, setCounts] = useState<Partial<Record<OppCategoryFilter, number>>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<OppCategoryFilter>('')
  const [detectedRegion, setDetectedRegion] = useState(region)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchOpps = useCallback(async (q: string, cat: OppCategoryFilter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('query', q)
      if (cat) params.set('category', cat)
      if (detectedRegion) params.set('region', detectedRegion)
      const res = await fetch(`/api/opportunities/search?${params}`)
      if (res.ok) {
        const json = await res.json() as { data: Opportunity[]; region: string; counts: Partial<Record<OppCategoryFilter, number>> }
        setOpps(json.data ?? [])
        if (json.region && !region) setDetectedRegion(json.region)
        if (json.counts && !q && !cat) setCounts(json.counts)
      }
    } catch { /* non-fatal */ }
    setLoading(false)
  }, [detectedRegion, region])

  const fetchForYou = useCallback(async (force = false) => {
    if (forYouInFlightRef.current || (!force && forYouLoadedRef.current)) return
    forYouInFlightRef.current = true
    setLoadingForYou(true)
    try {
      const res = await fetch('/api/opportunities/for-you')
      if (res.ok) {
        const json = await res.json() as { data: Array<Opportunity & { match_score: number }>; profile: typeof forYouProfile }
        setForYouOpps(json.data ?? [])
        setForYouProfile(json.profile ?? null)
        forYouLoadedRef.current = true
      }
    } catch { /* non-fatal */ }
    forYouInFlightRef.current = false
    setLoadingForYou(false)
  }, [])

  // One debounced fetch effect covers both the initial load (0ms) and searches (350ms).
  const didInitialFetch = useRef(false)
  useEffect(() => {
    const delay = didInitialFetch.current ? 350 : 0
    didInitialFetch.current = true
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchOpps(query, category), delay)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query, category, fetchOpps])

  const visibleForYou = forYouOpps.filter(o => !category || o.category === category)
  const totalCount = (counts as Record<string, number>)['all'] ?? opps.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-surface-50 px-4 lg:px-6 pt-4 pb-3 space-y-3">

        {/* Browse / For You toggle + region */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5">
            <button
              onClick={() => setView('browse')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                view === 'browse' ? 'bg-surface-400 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Browse
            </button>
            <button
              onClick={() => { setView('for-you'); if (isPro) void fetchForYou() }}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1',
                view === 'for-you' ? 'bg-surface-400 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isPro ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3 text-brand-400" />}
              For You
            </button>
          </div>

          <div className="flex items-center gap-2">
            {detectedRegion && (
              <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" />
                <span className="font-medium text-foreground">{detectedRegion}</span>
              </p>
            )}
            <button
              onClick={() => {
                void fetchOpps(query, category)
                if (view === 'for-you' && isPro) void fetchForYou(true)
                else forYouLoadedRef.current = false
              }}
              className="p-1.5 rounded-lg border border-border bg-surface-100 hover:bg-surface-200 transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Category chip scroll */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => setCategory('')}
            className={cn(
              'shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all',
              category === ''
                ? 'bg-foreground text-background border-foreground'
                : 'bg-surface-100 text-muted-foreground border-border hover:text-foreground'
            )}
          >
            All {totalCount > 0 && <span className="opacity-60 ml-0.5">{totalCount}</span>}
          </button>
          {ALL_CATEGORIES.map(cat => {
            const m = CATEGORY_META[cat]
            const Icon = m.icon
            const count = (counts as Record<string, number>)[cat]
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                  category === cat ? m.chipColor + ' shadow-sm' : 'bg-surface-100 text-muted-foreground border-border hover:text-foreground'
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                {m.label}
                {count != null && count > 0 && (
                  <span className="opacity-60">{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search (browse mode only) */}
        {view === 'browse' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by title, skill, or organizer..."
              className="pl-9 h-9 text-sm"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-4 lg:p-6">
        {view === 'for-you' ? (
          // ─ For You view (Pro) ──────────────────────────────────────────────
          !isPro ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center mb-4">
                <Lock className="h-5 w-5 text-brand-400" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Personalised matching is a Pro feature</p>
              <p className="text-xs text-muted-foreground max-w-[300px] mb-5">
                Upgrade to unlock <span className="text-foreground font-medium">For You</span> — opportunities matched to your skills, location, and background. Browsing everything stays free.
              </p>
              <Link href="/billing?plan=annual" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:opacity-95 transition-opacity">
                <Zap className="h-4 w-4" /> Upgrade to Pro
              </Link>
            </div>
          ) : loadingForYou ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : visibleForYou.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-surface-200 border border-border flex items-center justify-center mb-4">
                <Sparkles className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Upload your resume to get personalised opportunities</p>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                We&apos;ll match scholarships, hackathons, internships, and more to your skills, location, and background.
              </p>
            </div>
          ) : (
            <>
              {forYouProfile && (
                <div className="mb-4 p-3 rounded-xl bg-brand-950 border border-brand-700/30 flex flex-wrap gap-2 items-center text-xs text-brand-300">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Matched to</span>
                  {forYouProfile.location && <span className="font-semibold">{forYouProfile.location}</span>}
                  {forYouProfile.skills.length > 0 && (
                    <>
                      <span>and skills:</span>
                      {forYouProfile.skills.slice(0, 5).map(s => (
                        <span key={s} className="bg-brand-900 border border-brand-700/50 px-1.5 py-0.5 rounded-md font-medium capitalize">{s}</span>
                      ))}
                    </>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground/60 mb-4">
                {visibleForYou.length} personalised opportunities
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleForYou.map(o => (
                  <OpportunityCard key={o.id} opp={o} matchScore={Math.min(100, Math.round(o.match_score * 2))} />
                ))}
              </div>
            </>
          )
        ) : (
          // ─ Browse view ─────────────────────────────────────────────────────
          loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : opps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-surface-200 border border-border flex items-center justify-center mb-4">
                <Sparkles className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No opportunities found</p>
              <p className="text-xs text-muted-foreground">Try a different filter or search term</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground/60 mb-4">
                {opps.length} {category ? CATEGORY_META[category]?.label.toLowerCase() + ' opportunities' : 'opportunities'}
                {detectedRegion ? ` near ${detectedRegion} or online` : ' worldwide'}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {opps.map(opp => <OpportunityCard key={opp.id} opp={opp} />)}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}

