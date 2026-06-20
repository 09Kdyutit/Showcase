'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Zap, Globe, Lock, Eye, ExternalLink, ArrowLeft, BarChart3, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PaywallCard } from '@/components/ui/paywall'
import type { Portfolio, PortfolioContent, ParsedResume } from '@/types/database'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { portfolioGoalLabel } from '@/lib/constants'

interface BuilderPageProps {
  params: Promise<{ portfolioId: string }>
}

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'

export default function BuilderEditorPage({ params }: BuilderPageProps) {
  const { portfolioId } = use(params)
  const router = useRouter()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [content, setContent] = useState<Partial<PortfolioContent>>({})
  const [title, setTitle] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [resumeText, setResumeText] = useState('')
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null)
  const [profileMeta, setProfileMeta] = useState<{
    industry: string | null
    portfolio_goal: string | null
    linkedin_url: string | null
    github_url: string | null
    website_url: string | null
  } | null>(null)
  const [genMsg, setGenMsg] = useState('')
  const [activeProject, setActiveProject] = useState<number | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef({ title: '', targetRole: '', content: {} as Partial<PortfolioContent> })

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const [portfolioRes, subRes, resumeRes, profileRes] = await Promise.all([
      supabase.from('portfolios').select('*').eq('id', portfolioId).single(),
      supabase.from('subscriptions').select('status').maybeSingle(),
      supabase.from('resumes').select('raw_text, parsed_json').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      user
        ? supabase.from('profiles').select('industry, portfolio_goal, linkedin_url, github_url, website_url').eq('id', user.id).single()
        : Promise.resolve({ data: null }),
    ])
    if (!portfolioRes.data) { router.push('/builder'); return }
    setPortfolio(portfolioRes.data)
    setTitle(portfolioRes.data.title)
    setTargetRole(portfolioRes.data.target_role ?? '')
    const c = portfolioRes.data.content as unknown as Partial<PortfolioContent> ?? {}
    setContent(c)
    lastSavedRef.current = { title: portfolioRes.data.title, targetRole: portfolioRes.data.target_role ?? '', content: c }
    setIsPro(subRes.data?.status === 'active' || subRes.data?.status === 'trialing')
    setResumeText(resumeRes.data?.raw_text ?? '')
    setParsedResume((resumeRes.data?.parsed_json as unknown as ParsedResume) ?? null)
    setProfileMeta(profileRes.data ?? null)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load() }, [portfolioId])

  const save = useCallback(async (showToast = true) => {
    setSaveState('saving')
    try {
      const res = await fetch('/api/portfolio/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId, title, targetRole, content }),
      })
      if (!res.ok) throw new Error('Save failed')
      lastSavedRef.current = { title, targetRole, content }
      setSaveState('saved')
      if (showToast) toast.success('Saved')
    } catch {
      setSaveState('error')
      if (showToast) toast.error('Save failed — check your connection')
    }
  }, [title, targetRole, content, portfolioId])

  const scheduleAutosave = useCallback(() => {
    setSaveState('unsaved')
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => save(false), 2500)
  }, [save])

  function updateContent(updater: (prev: Partial<PortfolioContent>) => Partial<PortfolioContent>) {
    setContent(prev => { const next = updater(prev); scheduleAutosave(); return next })
  }

  function updateTitle(v: string) { setTitle(v); scheduleAutosave() }
  function updateRole(v: string) { setTargetRole(v); scheduleAutosave() }

  async function generatePortfolio() {
    if (!isPro) { toast.error('Pro required for AI generation'); return }
    if (!resumeText && !parsedResume) { toast.error('Upload a resume first on the Resume page'); return }

    setGenerating(true)
    const MSGS = [
      'Parsing your experience…',
      'Identifying your strongest proof points…',
      'Building case studies…',
      'Writing your hero section…',
      'Crafting positioning copy…',
      'Finalizing your portfolio…',
    ]
    let mi = 0
    setGenMsg(MSGS[0])
    const iv = setInterval(() => { mi = (mi + 1) % MSGS.length; setGenMsg(MSGS[mi]) }, 3000)

    try {
      // Reuse the resume's already-parsed structured data (from onboarding or the Resume
      // page) instead of re-parsing from scratch on every generation — faster, and avoids
      // paying for the same AI call twice. Only fall back to a fresh parse for legacy
      // resumes that predate parsed_json being stored.
      let resolvedParsedResume = parsedResume
      if (!resolvedParsedResume) {
        const analyzeRes = await fetch('/api/ai/analyze-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeText }),
        })
        const { data, error: analyzeErr } = await analyzeRes.json()
        if (!analyzeRes.ok) throw new Error(analyzeErr?.message ?? analyzeErr ?? 'Resume analysis failed')
        resolvedParsedResume = data
      }

      const links: Record<string, string> = {}
      if (profileMeta?.linkedin_url) links.linkedin = profileMeta.linkedin_url
      if (profileMeta?.github_url) links.github = profileMeta.github_url
      if (profileMeta?.website_url) links.website = profileMeta.website_url

      const genRes = await fetch('/api/ai/generate-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsedResume: resolvedParsedResume,
          targetRole: targetRole || 'Professional',
          industry: profileMeta?.industry || 'Technology',
          portfolioGoal: portfolioGoalLabel(profileMeta?.portfolio_goal),
          links,
          portfolioId,
        }),
      })
      const { data, error: genErr } = await genRes.json()
      if (!genRes.ok) throw new Error(genErr?.message ?? genErr ?? 'Generation failed')
      updateContent(() => data)
      toast.success('Portfolio generated! Review and edit the content below.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed. Please try again.')
    } finally {
      clearInterval(iv)
      setGenerating(false)
    }
  }

  async function togglePublish() {
    setPublishing(true)
    const action = portfolio?.status === 'published' ? 'unpublish' : 'publish'
    try {
      const res = await fetch('/api/portfolio/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'PRO_REQUIRED') {
          toast.error('Upgrade to Pro to publish your portfolio publicly')
        } else {
          throw new Error(data.error ?? 'Failed to update')
        }
        return
      }
      setPortfolio(prev => prev ? { ...prev, status: data.status } : prev)
      toast.success(data.status === 'published' ? 'Portfolio is now live!' : 'Portfolio unpublished')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update portfolio status')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-24" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    )
  }

  const hero = content?.hero
  const about = content?.about
  const skills = content?.skills ?? []
  const projects = content?.projects ?? []
  const proof = content?.proof ?? []
  const experience = content?.experience ?? []

  // Portfolio quality checklist
  const qualityChecks = [
    { label: 'Headline names your target role', done: !!(hero?.headline && targetRole && hero.headline.toLowerCase().includes(targetRole.toLowerCase().split(' ')[0]?.toLowerCase() ?? '')) || !!(hero?.headline && hero.headline.length > 15) },
    { label: 'Positioning statement written', done: !!(hero?.subheadline && hero.subheadline.length > 30) },
    { label: 'At least 2 proof metrics', done: proof.filter((p) => p.value && p.label).length >= 2 },
    { label: 'About section complete', done: !!(about?.bio && about.bio.length > 80) },
    { label: 'At least 2 case studies', done: projects.filter((p) => p.title && (p.problem || p.process || p.outcome)).length >= 2 },
    { label: 'Skills added', done: skills.length >= 3 },
    { label: 'Contact links added', done: !!(content?.contact?.email || content?.contact?.linkedin) },
  ]
  const qualityScore = Math.round((qualityChecks.filter((c) => c.done).length / qualityChecks.length) * 100)

  const saveIndicator = (
    <div className={cn(
      'flex items-center gap-1.5 text-xs transition-colors duration-200',
      saveState === 'saved' && 'text-emerald-400/70',
      saveState === 'saving' && 'text-muted-foreground/60',
      saveState === 'unsaved' && 'text-muted-foreground/50',
      saveState === 'error' && 'text-red-400',
    )}>
      {saveState === 'saved' && <CheckCircle2 className="h-3 w-3" />}
      {saveState === 'saving' && <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
      {saveState === 'unsaved' && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
      {saveState === 'error' && <div className="w-3 h-3 rounded-full bg-current" />}
      <span className="hidden sm:inline">
        {saveState === 'saved' && 'Saved'}
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'unsaved' && 'Unsaved changes'}
        {saveState === 'error' && 'Save failed'}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-surface-50/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href="/builder"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate max-w-[160px] sm:max-w-xs">{title}</p>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${portfolio?.status === 'published' ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
              <span className="text-xs text-muted-foreground">{portfolio?.status}</span>
              <span className="text-muted-foreground/30">·</span>
              {saveIndicator}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {portfolio?.status === 'published' && portfolio?.slug && (
            <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs hidden sm:flex">
              <Link href={`/p/${portfolio.slug}`} target="_blank">
                <ExternalLink className="h-3 w-3" />
                View live
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs hidden sm:flex">
            <Link href="/audit">
              <BarChart3 className="h-3 w-3" />
              Audit
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => save(true)}
            loading={saveState === 'saving'}
            className="gap-1.5 text-xs"
          >
            <Save className="h-3 w-3" />
            Save
          </Button>
          <Button
            variant={portfolio?.status === 'published' ? 'outline' : 'gradient'}
            size="sm"
            onClick={togglePublish}
            loading={publishing}
            className="gap-1.5 text-xs"
          >
            {portfolio?.status === 'published' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {portfolio?.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <Tabs defaultValue="content">
            <TabsList className="mb-6">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="projects">
                Projects
                {projects.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded-full font-medium">
                    {projects.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Editor column */}
                <div className="space-y-5">
                  {/* AI Generate */}
                  {!isPro ? (
                    <PaywallCard
                      feature="AI Portfolio Generation"
                      description="Let AI build your full portfolio from your resume in seconds. Upgrade to Pro to unlock."
                    />
                  ) : (
                    <div className="glass-card p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">AI Portfolio Generator</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {resumeText
                              ? `Resume loaded (${Math.round(resumeText.length / 5)} words). AI will generate your full portfolio.`
                              : 'No resume found. Upload one on the Resume page first.'}
                          </p>
                        </div>
                        {resumeText && <Badge variant="success" className="shrink-0">Ready</Badge>}
                      </div>
                      <Button
                        variant="gradient"
                        size="sm"
                        onClick={generatePortfolio}
                        loading={generating}
                        disabled={!resumeText}
                        className="gap-1.5 w-full"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {generating ? genMsg : 'Generate portfolio with AI'}
                      </Button>
                      {generating && (
                        <p className="text-xs text-muted-foreground/60 text-center mt-2">This takes 30–60 seconds. Don&apos;t close this tab.</p>
                      )}
                    </div>
                  )}

                  {/* Hero */}
                  <div className="glass-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">Hero section</h3>
                      <Badge variant="default" className="text-xs">Required</Badge>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Headline <span className="text-muted-foreground/50">(8–15 words, role-specific)</span></Label>
                        <Input
                          value={hero?.headline ?? ''}
                          onChange={(e) => updateContent(c => ({ ...c, hero: { ...c.hero!, headline: e.target.value } }))}
                          placeholder="e.g. Product Designer who ships conversion-focused B2B interfaces"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Subheadline <span className="text-muted-foreground/50">(positioning in one sentence)</span></Label>
                        <Input
                          value={hero?.subheadline ?? ''}
                          onChange={(e) => updateContent(c => ({ ...c, hero: { ...c.hero!, subheadline: e.target.value } }))}
                          placeholder="e.g. I help growth-stage SaaS teams ship features their users actually adopt"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tagline <span className="text-muted-foreground/50">(3–5 words max)</span></Label>
                        <Input
                          value={hero?.tagline ?? ''}
                          onChange={(e) => updateContent(c => ({ ...c, hero: { ...c.hero!, tagline: e.target.value } }))}
                          placeholder="e.g. Product Designer · 5 years"
                        />
                      </div>
                    </div>
                  </div>

                  {/* About */}
                  <div className="glass-card p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">About / Bio</h3>
                    <Textarea
                      value={about?.bio ?? ''}
                      onChange={(e) => updateContent(c => ({ ...c, about: { ...c.about!, bio: e.target.value } }))}
                      placeholder="Write a 2-3 paragraph professional bio aimed at hiring managers for your target role. Lead with your specialty, follow with your approach, end with your value proposition."
                      className="min-h-[160px] text-xs leading-relaxed"
                    />
                    <div className="space-y-1">
                      <Label className="text-xs">Working principles / values <span className="text-muted-foreground/50">(comma-separated)</span></Label>
                      <Input
                        value={about?.values?.join(', ') ?? ''}
                        onChange={(e) => updateContent(c => ({ ...c, about: { ...c.about!, values: e.target.value.split(',').map(v => v.trim()).filter(Boolean) } }))}
                        placeholder="e.g. Evidence-based decisions, Ship fast and learn, Cross-functional clarity"
                      />
                    </div>
                  </div>

                  {/* Proof metrics */}
                  <div className="glass-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">Proof metrics</h3>
                      <span className="text-xs text-muted-foreground/50">Only real numbers</span>
                    </div>
                    {proof.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={p.value}
                          onChange={(e) => {
                            const updated = [...proof]
                            updated[i] = { ...updated[i], value: e.target.value }
                            updateContent(c => ({ ...c, proof: updated }))
                          }}
                          placeholder="e.g. +24%"
                          className="text-xs w-24 shrink-0"
                        />
                        <Input
                          value={p.label}
                          onChange={(e) => {
                            const updated = [...proof]
                            updated[i] = { ...updated[i], label: e.target.value }
                            updateContent(c => ({ ...c, proof: updated }))
                          }}
                          placeholder="e.g. Checkout conversion lift"
                          className="text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = proof.filter((_, idx) => idx !== i)
                            updateContent(c => ({ ...c, proof: updated }))
                          }}
                          className="text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateContent(c => ({ ...c, proof: [...(c.proof ?? []), { label: '', value: '' }] }))}
                      className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add metric
                    </button>
                    <p className="text-xs text-muted-foreground/40">Only add metrics you can substantiate. AI will flag invented ones in your audit.</p>
                  </div>

                  {/* Skills */}
                  <div className="glass-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">Skills</h3>
                      <span className="text-xs text-muted-foreground/50">{skills.length} added</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((s, i) => (
                        <div key={i} className="flex items-center gap-1 bg-surface-300 rounded-lg px-2 py-1 group">
                          <span className="text-xs text-foreground/80">{s.name}</span>
                          {s.level === 'Expert' && <span className="text-xs text-brand-400/70">·E</span>}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = skills.filter((_, idx) => idx !== i)
                              updateContent(c => ({ ...c, skills: updated }))
                            }}
                            className="text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors ml-0.5"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add skill…"
                        className="text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim()
                            if (val) {
                              updateContent(c => ({ ...c, skills: [...(c.skills ?? []), { name: val, level: 'Proficient', category: 'Other' }] }));
                              (e.target as HTMLInputElement).value = ''
                            }
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground/40">Press Enter to add. AI generation will populate this automatically.</p>
                  </div>
                </div>

                {/* Live preview + Quality checklist */}
                <div className="lg:sticky lg:top-20 h-fit space-y-4">

                {/* Portfolio quality checklist */}
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Portfolio quality</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{qualityChecks.filter(c => c.done).length}/{qualityChecks.length} complete</p>
                    </div>
                    <div className="relative w-10 h-10">
                      <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                        <circle
                          cx="20" cy="20" r="16" fill="none"
                          stroke={qualityScore >= 80 ? '#10b981' : qualityScore >= 50 ? '#f59e0b' : '#6346c8'}
                          strokeWidth="4" strokeLinecap="round"
                          strokeDasharray="100.53"
                          strokeDashoffset={100.53 - (qualityScore / 100) * 100.53}
                          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-foreground">{qualityScore}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {qualityChecks.map(({ label, done }) => (
                      <div key={label} className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500/20' : 'bg-surface-300'}`}>
                          {done
                            ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                            : <div className="w-1 h-1 rounded-full bg-surface-400" />
                          }
                        </div>
                        <span className={`text-xs ${done ? 'text-muted-foreground/60 line-through decoration-muted-foreground/30' : 'text-foreground/80'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live preview */}
                <div>
                  <div className="glass-card overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-200/50">
                      <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                      </div>
                      <span className="text-xs text-muted-foreground/50 flex-1 text-center font-mono">
                        showcase.app/p/{portfolio?.slug}
                      </span>
                      {portfolio?.status === 'published'
                        ? <Badge variant="success" className="text-xs shrink-0">Live</Badge>
                        : <Badge variant="default" className="text-xs shrink-0">Draft</Badge>
                      }
                    </div>
                    <div className="p-6 space-y-6 max-h-[620px] overflow-y-auto thin-scrollbar">
                      {hero?.headline ? (
                        <>
                          <div>
                            {hero.tagline && <p className="text-xs text-brand-400 font-medium mb-2 uppercase tracking-wider">{hero.tagline}</p>}
                            <h1 className="text-xl font-bold text-foreground mb-2 leading-tight">{hero.headline}</h1>
                            {hero.subheadline && <p className="text-sm text-muted-foreground leading-relaxed">{hero.subheadline}</p>}
                          </div>
                          {about?.bio && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</p>
                              <p className="text-sm text-foreground/80 leading-relaxed">{about.bio.slice(0, 180)}{about.bio.length > 180 ? '…' : ''}</p>
                            </div>
                          )}
                          {proof.filter(p => p.value && p.label).length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {proof.filter(p => p.value && p.label).slice(0, 4).map((p, i) => (
                                <div key={i} className="bg-surface-300/80 rounded-xl p-3 text-center">
                                  <p className="text-base font-bold gradient-text">{p.value}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{p.label}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {skills.slice(0, 12).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skills</p>
                              <div className="flex flex-wrap gap-1.5">
                                {skills.slice(0, 12).map((s) => (
                                  <span key={s.name} className="px-2 py-0.5 bg-surface-300 rounded-lg text-xs text-foreground/70">{s.name}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {projects.slice(0, 2).map((proj, i) => (
                            <div key={i} className="bg-surface-200 rounded-xl p-4 border border-border">
                              <p className="text-sm font-semibold text-foreground mb-1">{proj.title}</p>
                              {proj.summary && <p className="text-xs text-muted-foreground leading-relaxed">{proj.summary}</p>}
                              {proj.metrics?.length > 0 && (
                                <div className="flex gap-2 mt-2">
                                  {proj.metrics.slice(0, 2).map((m, mi) => (
                                    <span key={mi} className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{m}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-surface-300 flex items-center justify-center">
                            <Eye className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground mb-1">Preview will appear here</p>
                            <p className="text-xs text-muted-foreground/60">Fill in the hero section or use AI generation to get started</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="projects">
              <div className="grid lg:grid-cols-[220px_1fr] gap-6">
                {/* Project list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projects</p>
                    <button
                      type="button"
                      onClick={() => {
                        const newProj = { title: 'New project', role: '', summary: '', problem: '', process: '', outcome: '', metrics: [], links: [], tags: [] }
                        updateContent(c => ({ ...c, projects: [...(c.projects ?? []), newProj] }))
                        setActiveProject((projects.length))
                      }}
                      className="text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {projects.length === 0 ? (
                    <div className="glass-card p-4 text-center">
                      <p className="text-xs text-muted-foreground">No projects yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Use AI generation or add manually</p>
                    </div>
                  ) : (
                    projects.map((proj, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveProject(i)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150',
                          activeProject === i
                            ? 'border-brand-500/40 bg-brand-500/5 text-foreground'
                            : 'border-border bg-surface-100 text-muted-foreground hover:text-foreground hover:border-border/80'
                        )}
                      >
                        <p className="text-xs font-medium truncate">{proj.title || `Project ${i + 1}`}</p>
                        {proj.metrics?.length > 0 && (
                          <p className="text-xs text-emerald-400/70 mt-0.5 truncate">{proj.metrics[0]}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>

                {/* Project editor */}
                <div>
                  {activeProject === null || !projects[activeProject] ? (
                    <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-3">
                      <p className="text-sm text-muted-foreground">Select a project to edit, or</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          const newProj = { title: 'New project', role: '', summary: '', problem: '', process: '', outcome: '', metrics: [], links: [], tags: [] }
                          updateContent(c => ({ ...c, projects: [...(c.projects ?? []), newProj] }))
                          setActiveProject(projects.length)
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add new project
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Project delete */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Editing: {projects[activeProject].title}</p>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = projects.filter((_, idx) => idx !== activeProject)
                            updateContent(c => ({ ...c, projects: updated }))
                            setActiveProject(null)
                          }}
                          className="text-xs text-red-400/60 hover:text-red-400 transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove project
                        </button>
                      </div>
                      {[
                        { key: 'title', label: 'Project title', placeholder: 'e.g. Checkout Redesign', multi: false },
                        { key: 'role', label: 'Your role', placeholder: 'e.g. Lead Product Designer', multi: false },
                        { key: 'summary', label: 'One-line summary', placeholder: 'e.g. Redesigned the payment flow to reduce drop-off', multi: false },
                        { key: 'problem', label: 'Problem', placeholder: 'What specific problem did you solve? (no invention — use real context)', multi: true },
                        { key: 'process', label: 'Process', placeholder: 'What did you do and how did you make decisions?', multi: true },
                        { key: 'outcome', label: 'Outcome', placeholder: 'What was the measurable result? If no metrics exist, write "[Add: X% improvement]"', multi: true },
                      ].map(({ key, label, placeholder, multi }) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          {multi ? (
                            <Textarea
                              value={projects[activeProject][key as keyof typeof projects[0]] as string ?? ''}
                              onChange={(e) => {
                                const updated = [...projects]
                                updated[activeProject] = { ...updated[activeProject], [key]: e.target.value }
                                updateContent(c => ({ ...c, projects: updated }))
                              }}
                              placeholder={placeholder}
                              className="min-h-[80px] text-xs leading-relaxed"
                            />
                          ) : (
                            <Input
                              value={projects[activeProject][key as keyof typeof projects[0]] as string ?? ''}
                              onChange={(e) => {
                                const updated = [...projects]
                                updated[activeProject] = { ...updated[activeProject], [key]: e.target.value }
                                updateContent(c => ({ ...c, projects: updated }))
                              }}
                              placeholder={placeholder}
                              className="text-xs"
                            />
                          )}
                        </div>
                      ))}
                      <div className="space-y-1">
                        <Label className="text-xs">Metrics <span className="text-muted-foreground/50">(only real, stated numbers)</span></Label>
                        <Input
                          value={projects[activeProject].metrics?.join(', ') ?? ''}
                          onChange={(e) => {
                            const updated = [...projects]
                            updated[activeProject] = { ...updated[activeProject], metrics: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }
                            updateContent(c => ({ ...c, projects: updated }))
                          }}
                          placeholder="e.g. +24% conversion, 18% cart abandonment reduction"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tags / Technologies</Label>
                        <Input
                          value={projects[activeProject].tags?.join(', ') ?? ''}
                          onChange={(e) => {
                            const updated = [...projects]
                            updated[activeProject] = { ...updated[activeProject], tags: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }
                            updateContent(c => ({ ...c, projects: updated }))
                          }}
                          placeholder="e.g. React, Figma, A/B Testing"
                          className="text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="experience">
              <div className="space-y-4">
                {experience.length === 0 ? (
                  <div className="glass-card p-10 flex flex-col items-center justify-center text-center gap-3">
                    <p className="text-sm text-muted-foreground">No experience entries yet.</p>
                    <p className="text-xs text-muted-foreground/60">Use AI generation to populate from your resume, or add manually.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        const newExp = { company: '', role: '', period: '', bullets: [''], metrics: [] }
                        updateContent(c => ({ ...c, experience: [...(c.experience ?? []), newExp] }))
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add experience
                    </Button>
                  </div>
                ) : (
                  experience.map((exp, i) => (
                    <div key={i} className="glass-card p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-foreground">
                          {exp.role && exp.company ? `${exp.role} at ${exp.company}` : `Experience ${i + 1}`}
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = experience.filter((_, idx) => idx !== i)
                            updateContent(c => ({ ...c, experience: updated }))
                          }}
                          className="text-muted-foreground/40 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-3">
                        {[
                          { key: 'role', placeholder: 'e.g. Senior Product Designer' },
                          { key: 'company', placeholder: 'e.g. Stripe' },
                          { key: 'period', placeholder: 'e.g. 2022–2024' },
                        ].map(({ key, placeholder }) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs capitalize">{key}</Label>
                            <Input
                              value={exp[key as keyof typeof exp] as string ?? ''}
                              onChange={(e) => {
                                const updated = [...experience]
                                updated[i] = { ...updated[i], [key]: e.target.value }
                                updateContent(c => ({ ...c, experience: updated }))
                              }}
                              placeholder={placeholder}
                              className="text-xs"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Bullets <span className="text-muted-foreground/50">(one per line)</span></Label>
                        <Textarea
                          value={exp.bullets?.join('\n') ?? ''}
                          onChange={(e) => {
                            const updated = [...experience]
                            updated[i] = { ...updated[i], bullets: e.target.value.split('\n').filter(Boolean) }
                            updateContent(c => ({ ...c, experience: updated }))
                          }}
                          placeholder="• Led redesign of checkout flow that improved conversion 24%&#10;• Built design system adopted by 3 product teams"
                          className="min-h-[100px] text-xs leading-relaxed font-mono"
                        />
                      </div>
                    </div>
                  ))
                )}
                {experience.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      const newExp = { company: '', role: '', period: '', bullets: [''], metrics: [] }
                      updateContent(c => ({ ...c, experience: [...(c.experience ?? []), newExp] }))
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add experience
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="max-w-lg space-y-5">
                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Portfolio settings</h3>
                  <div className="space-y-1.5">
                    <Label>Portfolio title</Label>
                    <Input value={title} onChange={(e) => updateTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Target role <span className="text-muted-foreground/60 text-xs">(shapes AI generation)</span></Label>
                    <Input value={targetRole} onChange={(e) => updateRole(e.target.value)} placeholder="e.g. Senior Product Designer" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Public URL</Label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-100 border border-border rounded-xl text-sm">
                      <span className="text-muted-foreground/60 text-xs font-mono">showcase.app/p/</span>
                      <span className="text-foreground text-xs font-mono">{portfolio?.slug}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/50">Slug cannot be changed after creation.</p>
                  </div>
                </div>

                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Publishing</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">
                        Status: <span className={portfolio?.status === 'published' ? 'text-emerald-400' : 'text-muted-foreground'}>
                          {portfolio?.status === 'published' ? 'Published (live)' : 'Draft (private)'}
                        </span>
                      </p>
                      {!isPro && (
                        <p className="text-xs text-muted-foreground mt-1">Publishing requires a Pro subscription.</p>
                      )}
                    </div>
                    <Button
                      variant={portfolio?.status === 'published' ? 'outline' : 'gradient'}
                      size="sm"
                      onClick={togglePublish}
                      loading={publishing}
                      className="gap-1.5"
                    >
                      {portfolio?.status === 'published' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                      {portfolio?.status === 'published' ? 'Unpublish' : 'Publish'}
                    </Button>
                  </div>
                  {portfolio?.status === 'published' && portfolio?.slug && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-emerald-400">Your portfolio is live</p>
                        <Link href={`/p/${portfolio.slug}`} target="_blank" className="text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors flex items-center gap-1 mt-0.5">
                          showcase.app/p/{portfolio.slug}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
