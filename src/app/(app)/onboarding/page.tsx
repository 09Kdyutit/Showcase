'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, CheckCircle2, ChevronDown, Mail, Phone, MapPin, Sparkles,
  Briefcase, FolderKanban, Link2, AlertTriangle, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FileUploadZone } from '@/components/shared/file-upload-zone'
import { Logo } from '@/components/shared/logo'
import { generateSlug } from '@/lib/utils'
import { PORTFOLIO_GOALS } from '@/lib/constants'
import { THEME_LIST, DEFAULT_THEME_ID, type ThemeId } from '@/lib/portfolio/themes'
import type { ParsedResume } from '@/types/database'

const INDUSTRIES = [
  'Technology', 'Product', 'Design', 'Engineering', 'Marketing', 'Data / Analytics',
  'Finance', 'Healthcare', 'Education', 'Consulting', 'Startups', 'Other',
]

/** Industry can usually be read off the target role itself — asking for it separately
 *  when it's this derivable is exactly the kind of redundant input this flow exists to cut. */
/** profiles.experience_level uses a slightly different vocabulary than the resume parser's
 *  seniority_level — map rather than leave the field permanently null for everyone who goes
 *  through this flow (job recommendations and settings both read it). */
function mapSeniority(level: ParsedResume['seniority_level']): string | null {
  switch (level) {
    case 'student': return 'student'
    case 'junior': return 'early'
    case 'mid': return 'mid'
    case 'senior': return 'senior'
    case 'lead': return 'lead'
    case 'executive': return 'lead'
    default: return null
  }
}

function guessIndustry(role: string): string {
  const r = role.toLowerCase()
  if (/design|ux|ui/.test(r)) return 'Design'
  if (/engineer|developer|swe|software/.test(r)) return 'Engineering'
  if (/market/.test(r)) return 'Marketing'
  if (/product/.test(r)) return 'Product'
  if (/data|analyst|scientist/.test(r)) return 'Data / Analytics'
  if (/financ|account/.test(r)) return 'Finance'
  if (/consult/.test(r)) return 'Consulting'
  if (/teach|educat/.test(r)) return 'Education'
  if (/health|clinical|nurse|medical/.test(r)) return 'Healthcare'
  return 'Technology'
}

type Phase = 'upload' | 'analyzing' | 'review' | 'generating'

const ANALYZE_MSGS = ['Reading your resume…', 'Finding your strongest achievements…', 'Structuring your experience…']
const GENERATE_MSGS = [
  'Identifying your strongest proof points…', 'Building your first case study…',
  'Writing your hero section…', 'Crafting positioning copy…', 'Finalizing your portfolio…',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('upload')
  const [pasteText, setPasteText] = useState('')
  const [busyMsg, setBusyMsg] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const generatingRef = useRef(false)

  const [parsed, setParsed] = useState<ParsedResume | null>(null)

  const [targetRole, setTargetRole] = useState('')
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null)
  const [industry, setIndustry] = useState('Technology')
  const [portfolioGoal, setPortfolioGoal] = useState<string>(PORTFOLIO_GOALS[0].value)
  const [linkedin, setLinkedin] = useState('')
  const [github, setGithub] = useState('')
  const [website, setWebsite] = useState('')
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME_ID)

  function rotateMessages(msgs: string[]) {
    let i = 0
    setBusyMsg(msgs[0])
    const iv = setInterval(() => { i = (i + 1) % msgs.length; setBusyMsg(msgs[i]) }, 2200)
    return () => clearInterval(iv)
  }

  async function handleResumeText(text: string) {
    if (text.trim().length < 50) { toast.error('That resume looks too short to analyze.'); return }
    setPhase('analyzing')
    const stop = rotateMessages(ANALYZE_MSGS)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: resume } = await supabase
        .from('resumes')
        .insert({ user_id: user.id, title: 'My Resume', raw_text: text })
        .select()
        .single()

      const res = await fetch('/api/ai/analyze-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text, resumeId: resume?.id }),
      })
      const { data, error } = await res.json()
      if (!res.ok) throw new Error(error?.message ?? error ?? 'Could not analyze that resume')

      const result = data as ParsedResume
      setParsed(result)

      const inferredRole = result.experience?.[0]?.role ?? ''
      setTargetRole(inferredRole)
      setIndustry(guessIndustry(inferredRole))
      setExperienceLevel(mapSeniority(result.seniority_level))
      if (result.links?.linkedin) setLinkedin(result.links.linkedin)
      if (result.links?.github) setGithub(result.links.github)
      if (result.links?.website ?? result.links?.portfolio) setWebsite((result.links.website || result.links.portfolio) ?? '')

      setPhase('review')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not analyze that resume. You can try again or skip for now.')
      setPhase('upload')
    } finally {
      stop()
    }
  }

  async function skipResume() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    try {
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
      toast.success('Welcome to Showcase! Upload a resume anytime from the Resume page.')
      router.push('/dashboard')
    } catch {
      toast.error('Something went wrong. Please try again.')
    }
  }

  async function createPortfolio() {
    if (!targetRole.trim()) { toast.error('Add a target role first — this shapes your whole portfolio.'); setEditOpen(true); return }
    if (generatingRef.current) return
    generatingRef.current = true
    setPhase('generating')
    const stop = rotateMessages(GENERATE_MSGS)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      await supabase.from('profiles').update({
        target_role: targetRole,
        experience_level: experienceLevel,
        industry,
        portfolio_goal: portfolioGoal,
        linkedin_url: linkedin || null,
        github_url: github || null,
        website_url: website || null,
        onboarding_completed: true,
      }).eq('id', user.id)

      const slug = generateSlug(targetRole || 'portfolio')
      const { data: portfolio, error: createErr } = await supabase
        .from('portfolios')
        .insert({ user_id: user.id, slug, title: `${targetRole} Portfolio`, target_role: targetRole, theme, status: 'draft' })
        .select()
        .single()
      if (createErr || !portfolio) throw new Error('Could not create your portfolio')

      const links: Record<string, string> = {}
      if (linkedin) links.linkedin = linkedin
      if (github) links.github = github
      if (website) links.website = website

      const genRes = await fetch('/api/ai/generate-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsedResume: parsed ?? { name: '', email: '', phone: '', location: '', summary: '', skills: [], experience: [], education: [], projects: [], certifications: [], links: {}, weak_bullets: [], missing_proof: [], possible_case_studies: [] },
          targetRole,
          industry,
          portfolioGoal: PORTFOLIO_GOALS.find((g) => g.value === portfolioGoal)?.label ?? 'Active job search',
          links,
          portfolioId: portfolio.id,
        }),
      })
      const genBody = await genRes.json()
      if (!genRes.ok) {
        // Pro-gated or generation failed — the portfolio still exists as a draft, so land
        // the user there either way rather than stranding them on the onboarding screen.
        toast.error(genBody.code === 'PRO_REQUIRED'
          ? 'Your portfolio draft is ready — upgrade to Pro to generate full AI content.'
          : 'Portfolio created, but AI generation failed. You can retry from the builder.')
      } else {
        toast.success('Your portfolio is ready! Review and refine it below.')
      }

      router.push(`/builder/${portfolio.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong creating your portfolio.')
      setPhase('review')
    } finally {
      stop()
      generatingRef.current = false
    }
  }

  // ── Busy screens (analyzing / generating) ──────────────────────────────
  if (phase === 'analyzing' || phase === 'generating') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center mb-6 animate-pulse">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <p className="text-foreground font-medium mb-1">{busyMsg}</p>
        <p className="text-xs text-muted-foreground/60">
          {phase === 'analyzing' ? "This takes a few seconds." : "This takes 30–60 seconds. Don't close this tab."}
        </p>
      </div>
    )
  }

  // ── Upload screen ───────────────────────────────────────────────────────
  if (phase === 'upload') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Upload your resume</h1>
            <p className="text-muted-foreground text-sm">We extract everything — role, skills, experience, projects, links — and use it to build your portfolio. No forms to fill out.</p>
          </div>

          <div className="glass-card p-8 space-y-4">
            <FileUploadZone onText={handleResumeText} />
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground/50">or paste text</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <Textarea
              placeholder="Paste your resume text here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="min-h-[140px] font-mono text-xs leading-relaxed"
            />
            {pasteText.trim().length >= 50 && (
              <Button variant="gradient" size="md" className="w-full gap-2" onClick={() => handleResumeText(pasteText)}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          <button onClick={skipResume} className="w-full text-center text-xs text-muted-foreground/50 hover:text-muted-foreground mt-6 transition-colors">
            Skip — I&apos;ll set this up manually
          </button>
        </div>
      </div>
    )
  }

  // ── Review screen ───────────────────────────────────────────────────────
  const metricsFound = parsed?.experience?.reduce((n, e) => n + (e.metrics?.length ?? 0), 0) ?? 0
  const needsConfirmation = [...(parsed?.missing_proof ?? []), ...(parsed?.weak_bullets ?? [])]

  return (
    <div className="min-h-screen bg-background p-6 py-12">
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-4">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resume parsed
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Here&apos;s what we found</h1>
          <p className="text-muted-foreground text-sm">Quick review — nothing here is published yet. One click builds your full portfolio from this.</p>
        </div>

        <div className="glass-card p-6 space-y-6">
          {/* Identity */}
          {parsed && (
            <div className="flex flex-wrap items-center gap-4 pb-5 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">{(parsed.name || targetRole || 'P').slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{parsed.name || targetRole || 'Your portfolio'}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground/70 mt-0.5">
                  {parsed.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{parsed.email}</span>}
                  {parsed.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{parsed.phone}</span>}
                  {parsed.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{parsed.location}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Extracted summary grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Briefcase className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">{parsed?.experience?.length ?? 0} experience entries</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{metricsFound} quantified achievements found</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FolderKanban className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">{parsed?.projects?.length ?? 0} projects detected</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {parsed?.projects?.length ? 'Will become case studies' : "We'll build one from your strongest experience"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">{parsed?.skills?.length ?? 0} skills</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{parsed?.skills?.slice(0, 4).join(', ') || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Link2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">{[linkedin, github, website].filter(Boolean).length} links found</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{[linkedin && 'LinkedIn', github && 'GitHub', website && 'Website'].filter(Boolean).join(', ') || 'None — add later if you have them'}</p>
              </div>
            </div>
          </div>

          {/* Missing evidence */}
          {needsConfirmation.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-400">{needsConfirmation.length} item{needsConfirmation.length === 1 ? '' : 's'} need real numbers or context</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">We won&apos;t invent these — you can add them after your portfolio is built. Nothing blocks you from generating now.</p>
              </div>
            </div>
          )}

          {/* Collapsed summary / edit toggle */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setEditOpen((v) => !v)}
              className="flex items-center justify-between w-full text-left py-2 group"
            >
              <div className="text-xs text-muted-foreground">
                Targeting <span className="text-foreground font-medium">{targetRole || 'no role set'}</span> · {industry} · {PORTFOLIO_GOALS.find((g) => g.value === portfolioGoal)?.label}
              </div>
              <span className="flex items-center gap-1 text-xs text-brand-400 group-hover:text-brand-300 shrink-0">
                <Pencil className="h-3 w-3" />
                Edit extracted details
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${editOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {editOpen && (
              <div className="space-y-5 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Target role</Label>
                  <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Senior Product Designer" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Industry</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => setIndustry(ind)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${industry === ind ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-border bg-surface-100 text-muted-foreground hover:text-foreground'}`}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Career goal <span className="text-muted-foreground/50">(optional)</span></Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PORTFOLIO_GOALS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setPortfolioGoal(g.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${portfolioGoal === g.value ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-border bg-surface-100 text-muted-foreground hover:text-foreground'}`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  {[
                    { label: 'LinkedIn', value: linkedin, set: setLinkedin, placeholder: 'linkedin.com/in/you' },
                    { label: 'GitHub', value: github, set: setGithub, placeholder: 'github.com/you' },
                    { label: 'Website', value: website, set: setWebsite, placeholder: 'yoursite.com' },
                  ].map(({ label, value, set, placeholder }) => (
                    <div key={label} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} className="text-xs" />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Portfolio theme <span className="text-muted-foreground/50">(optional, change anytime)</span></Label>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {THEME_LIST.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`text-left p-2.5 rounded-xl border transition-all ${theme === t.id ? 'border-brand-500/50 bg-brand-500/5' : 'border-border bg-surface-100 hover:border-border/80'}`}
                      >
                        <div className="h-2 w-1/2 rounded-full mb-2" style={{ background: t.swatch.accent }} />
                        <p className="text-xs font-semibold text-foreground">{t.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dominant primary CTA */}
        <Button variant="gradient" size="xl" className="w-full gap-2 mt-6" onClick={createPortfolio}>
          <Sparkles className="h-4 w-4" />
          Create my portfolio
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-xs text-muted-foreground/50 mt-3">
          Builds your full portfolio from what&apos;s above. You can edit anything after.
        </p>
      </div>
    </div>
  )
}
