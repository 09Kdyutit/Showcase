'use client'

import { useRef, useState, useEffect } from 'react'
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

// LinkedIn "in" glyph — lucide's Linkedin export isn't available in this version.
function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  )
}

const INDUSTRIES = [
  'Technology', 'Product', 'Design', 'Engineering', 'Marketing', 'Data / Analytics',
  'Finance', 'Healthcare', 'Education', 'Consulting', 'Startups', 'Other',
]

/** Industry can usually be read off the target role itself - asking for it separately
 *  when it's this derivable is exactly the kind of redundant input this flow exists to cut. */
/** profiles.experience_level uses a slightly different vocabulary than the resume parser's
 *  seniority_level - map rather than leave the field permanently null for everyone who goes
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

  // Claim a pending completion referral. Keep it retryable on transient failure; on
  // success refresh the JWT so proxy sees the admission metadata written by the DB RPC.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('invite')) {
      // Admission paths are mutually exclusive. Prefer the email-bound waitlist token and
      // never spend a member's referral slot on the same account.
      localStorage.removeItem('showcase_ref')
      return
    }
    const fromUrl = params.get('ref')?.trim().toUpperCase()
    const ref = fromUrl || localStorage.getItem('showcase_ref')
    if (!ref) return
    if (!/^[A-F0-9]{32}$/.test(ref)) {
      localStorage.removeItem('showcase_ref')
      router.replace('/waitlist')
      return
    }
    void (async () => {
      try {
        const response = await fetch('/api/referral/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: ref }),
        })
        const result = await response.json().catch(() => ({})) as { data?: { claimed?: boolean } }
        if (response.ok && result.data?.claimed === true) {
          localStorage.removeItem('showcase_ref')
          await createClient().auth.refreshSession()
          router.replace('/onboarding')
          router.refresh()
          return
        }
        if (response.ok || response.status === 400 || response.status === 403 || response.status === 409) {
          localStorage.removeItem('showcase_ref')
          toast.error('This referral invite is no longer available. Join the waitlist for access.')
          router.replace('/waitlist')
        }
      } catch {
        // Keep the code in local storage for a later retry.
      }
    })()
  }, [router])

  // OAuth and email-confirmation callbacks cannot redeem admission until a real auth session
  // exists. Carry the single-use token through the callback, redeem it here, then immediately
  // remove it from both the URL and local storage. Transient failures keep the token retryable.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('invite')?.trim().toLowerCase()
    const token = fromUrl || localStorage.getItem('showcase_invite')
    if (!token || !/^[a-f0-9]{48}$/.test(token)) return

    void fetch('/api/waitlist/admission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      if (response.ok) {
        localStorage.removeItem('showcase_invite')
        await createClient().auth.refreshSession()
        router.replace('/onboarding')
        router.refresh()
        return
      }
      if (response.status === 400 || response.status === 403) {
        localStorage.removeItem('showcase_invite')
        toast.error('This invite is expired, already used, or belongs to another email address.')
      }
    }).catch(() => {
      // Keep the token for a later retry; admission must never be lost to a network blip.
    })
  }, [router])

  const [parsed, setParsed] = useState<ParsedResume | null>(null)

  // If the user ran the free ProofScore tool before signing up, their resume was already
  // parsed there and stashed server-side; claim it by token and land them straight on the
  // review step — no re-upload, no second parse (no AI call at all on this path). Clear the
  // stash key up front so a failed claim can never loop; failure just falls back to upload.
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('showcase_parse_token') : null
    if (!token) return
    localStorage.removeItem('showcase_parse_token')
    void (async () => {
      setPhase('analyzing')
      setBusyMsg('Picking up the resume from your ProofScore…')
      try {
        const res = await fetch('/api/proofscore/claim-parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const { data } = await res.json()
        if (res.ok && data?.claimed && data.parsed) {
          applyParsedResume(data.parsed as ParsedResume)
          setPhase('review')
          return
        }
      } catch {
        // fall through to upload
      }
      setPhase('upload')
    })()
  }, [])

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

  function applyParsedResume(result: ParsedResume) {
    setParsed(result)
    const inferredRole = result.experience?.[0]?.role ?? ''
    setTargetRole(inferredRole)
    setIndustry(guessIndustry(inferredRole))
    setExperienceLevel(mapSeniority(result.seniority_level))
    if (result.links?.linkedin) setLinkedin(result.links.linkedin)
    if (result.links?.github) setGithub(result.links.github)
    if (result.links?.website ?? result.links?.portfolio) setWebsite((result.links.website || result.links.portfolio) ?? '')
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

      applyParsedResume(data as ParsedResume)
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
    if (!targetRole.trim()) { toast.error('Add a target role first - this shapes your whole portfolio.'); setEditOpen(true); return }
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
        // Pro-gated or generation failed - the portfolio still exists as a draft, so land
        // the user there either way rather than stranding them on the onboarding screen.
        toast.error(genBody.code === 'PRO_REQUIRED'
          ? 'Your portfolio draft is ready - upgrade to Pro to generate full AI content.'
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
      <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 aurora-mesh opacity-40" />
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-[0.07]" />
        <div className="relative flex flex-col items-center text-center">
          <div className="relative mb-7">
            <span className="orbit-ring" aria-hidden="true" />
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center breathe-glow">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-display text-xl font-semibold text-foreground mb-1.5">{busyMsg}</p>
          <p className="text-sm text-muted-foreground/70">
            {phase === 'analyzing' ? 'Reading your résumé and structuring the evidence…' : "Building your full portfolio. This takes 30–60 seconds — don't close this tab."}
          </p>
        </div>
      </div>
    )
  }

  // ── Upload screen ───────────────────────────────────────────────────────
  if (phase === 'upload') {
    return (
      <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-6 overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-[440px] aurora-mesh opacity-40" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(oklch(97% 0.004 255 / 0.03) 1px, transparent 1px)', backgroundSize: '46px 46px', maskImage: 'radial-gradient(ellipse 70% 50% at 50% 0%, black, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse 70% 50% at 50% 0%, black, transparent 75%)' }}
        />
        <div className="w-full max-w-xl relative">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Logo size="lg" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'oklch(63% 0.20 255)' }}>Step 1 of 2 · Your résumé</p>
            <h1 className="text-display text-3xl sm:text-[2.6rem] font-semibold text-foreground mb-3 leading-[1.05]">
              Start with what you{' '}
              <em style={{ fontStyle: 'italic', color: 'oklch(70% 0.17 255)' }}>already have.</em>
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">Drop in your résumé — we extract the role, skills, experience, projects and links, and turn them into structured evidence. No forms to fill out.</p>
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

          {/* Import from LinkedIn — no résumé file needed, just export the profile you already have */}
          <details className="group mt-4 rounded-xl overflow-hidden" style={{ background: 'var(--color-surface-50)', border: '1px solid var(--color-border)' }}>
            <summary className="flex items-center gap-2.5 px-4 py-3 cursor-pointer list-none select-none">
              <LinkedInMark className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium text-foreground flex-1">No résumé handy? Import from LinkedIn</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground/60 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground space-y-2.5">
              <p className="text-xs">Export your profile as a PDF, then drop it into the upload box above — we parse it just like a résumé.</p>
              <ol className="space-y-1.5 text-xs">
                <li className="flex gap-2"><span className="font-bold text-brand-300 shrink-0">1.</span> Open your <span className="text-foreground font-medium">LinkedIn profile</span>, click the <span className="text-foreground font-medium">More</span> button under your headline.</li>
                <li className="flex gap-2"><span className="font-bold text-brand-300 shrink-0">2.</span> Choose <span className="text-foreground font-medium">Save to PDF</span> — LinkedIn downloads your full profile.</li>
                <li className="flex gap-2"><span className="font-bold text-brand-300 shrink-0">3.</span> Drop that PDF into the box above. Done.</li>
              </ol>
            </div>
          </details>

          <button onClick={skipResume} className="w-full text-center text-xs text-muted-foreground/50 hover:text-muted-foreground mt-6 transition-colors">
            Skip - I&apos;ll set this up manually
          </button>
        </div>
      </div>
    )
  }

  // ── Review screen ───────────────────────────────────────────────────────
  const metricsFound = parsed?.experience?.reduce((n, e) => n + (e.metrics?.length ?? 0), 0) ?? 0
  const needsConfirmation = [...(parsed?.missing_proof ?? []), ...(parsed?.weak_bullets ?? [])]

  return (
    <div className="relative min-h-screen bg-background p-6 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[440px] aurora-mesh opacity-40" />
      <div className="w-full max-w-2xl mx-auto relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-4">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Résumé parsed · Step 2 of 2
          </div>
          <h1 className="text-display text-3xl sm:text-[2.6rem] font-semibold text-foreground mb-3 leading-[1.05]">
            Here&apos;s your experience,{' '}
            <em style={{ fontStyle: 'italic', color: 'oklch(70% 0.17 255)' }}>structured.</em>
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">Nothing here is published yet. Review it, then one click builds your full portfolio from this evidence.</p>
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
                <p className="text-xs text-muted-foreground/60 mt-0.5">{parsed?.skills?.slice(0, 4).join(', ') || ' - '}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Link2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">{[linkedin, github, website].filter(Boolean).length} links found</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{[linkedin && 'LinkedIn', github && 'GitHub', website && 'Website'].filter(Boolean).join(', ') || 'None - add later if you have them'}</p>
              </div>
            </div>
          </div>

          {/* Missing evidence */}
          {needsConfirmation.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-400">{needsConfirmation.length} item{needsConfirmation.length === 1 ? '' : 's'} need real numbers or context</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">We won&apos;t invent these - you can add them after your portfolio is built. Nothing blocks you from generating now.</p>
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
