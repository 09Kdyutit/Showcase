import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, Plus, Zap, FileText, BarChart3, AlertCircle, CheckCircle2, TrendingUp, Briefcase } from 'lucide-react'
import { ProofScoreRing } from '@/components/ui/proof-score-ring'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { scoreLabel } from '@/lib/utils'
import type { Profile, Subscription, Portfolio, Audit, Resume } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, subRes, portfoliosRes, auditsRes, resumesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('portfolios').select('id, title, slug, status, proof_score, updated_at, target_role').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(3),
    supabase.from('audits').select('overall_score, category_scores, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('resumes').select('id, title, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
  ])

  const profile = profileRes.data as Profile | null
  const subscription = subRes.data as Subscription | null
  const portfolios = (portfoliosRes.data ?? []) as Pick<Portfolio, 'id' | 'title' | 'slug' | 'status' | 'proof_score' | 'updated_at' | 'target_role'>[]
  const latestAudit = (auditsRes.data?.[0] ?? null) as Pick<Audit, 'overall_score' | 'category_scores' | 'created_at'> | null
  const latestResume = (resumesRes.data?.[0] ?? null) as Pick<Resume, 'id' | 'title' | 'created_at'> | null
  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing'
  const latestPortfolio = portfolios[0] ?? null
  const proofScore = latestAudit?.overall_score ?? latestPortfolio?.proof_score ?? null

  if (profile && !profile.onboarding_completed) {
    redirect('/onboarding')
  }

  const nextAction = !latestResume
    ? { href: '/resume', label: 'Upload your resume', icon: FileText, desc: 'Start by adding your resume to get a ProofScore.' }
    : !latestPortfolio
    ? { href: '/builder', label: 'Create your portfolio', icon: Plus, desc: 'Build your first portfolio from your resume.' }
    : !latestAudit
    ? { href: '/audit', label: 'Run your ProofScore', icon: BarChart3, desc: 'See exactly how ready you are.' }
    : { href: '/builder', label: 'Improve your portfolio', icon: TrendingUp, desc: 'Apply your ProofScore recommendations.' }

  const categories = latestAudit?.category_scores
    ? (Array.isArray(latestAudit.category_scores) ? latestAudit.category_scores : Object.values(latestAudit.category_scores)) as Array<{ name: string; score: number; severity: string }>
    : []

  const setupSteps = [
    { label: 'Upload your resume', done: !!latestResume, href: '/resume' },
    { label: 'Build your portfolio', done: !!latestPortfolio, href: '/builder' },
    { label: 'Run your ProofScore', done: !!latestAudit, href: '/audit' },
    { label: 'Publish your portfolio', done: portfolios.some((p) => p.status === 'published'), href: '/builder' },
  ]
  const setupDone = setupSteps.filter((s) => s.done).length
  const isNewUser = setupDone < 3

  return (
    <div className="relative min-h-full">
      {/* Ambient background — top-left purple blob */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-96 opacity-40"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 20% 0%, color-mix(in oklch, var(--color-brand-500) 15%, transparent), transparent)' }}
      />
      <div className="relative p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1.5">Dashboard</p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            {profile?.full_name ? `Hey, ${profile.full_name.split(' ')[0]}.` : 'Welcome back.'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {proofScore
              ? `Your ProofScore is ${proofScore} - ${scoreLabel(proofScore).toLowerCase()}.`
              : 'Build your portfolio and get your ProofScore.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isPro && (
            <Button asChild variant="gradient" size="sm" className="gap-1.5">
              <Link href="/billing">
                <Zap className="h-3.5 w-3.5" />
                Upgrade to Pro
              </Link>
            </Button>
          )}
          <Button asChild variant="secondary" size="sm" className="gap-1.5">
            <Link href="/builder">
              <Plus className="h-3.5 w-3.5" />
              New portfolio
            </Link>
          </Button>
        </div>
      </div>

      {/* Setup checklist - shown until user has resume + portfolio + audit */}
      {isNewUser && (
        <div className="glass-card p-6 relative overflow-hidden" style={{ borderColor: 'color-mix(in oklch, var(--color-brand-500) 15%, transparent)' }}>
          <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" />
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-foreground">Getting started</p>
              <p className="text-xs text-muted-foreground mt-0.5">{setupDone} of {setupSteps.length} steps complete</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-700"
                  style={{ width: `${(setupDone / setupSteps.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{Math.round((setupDone / setupSteps.length) * 100)}%</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {setupSteps.map(({ label, done, href }, i) => (
              <Link
                key={label}
                href={done ? '#' : href}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
                  done
                    ? 'border-emerald-500/20 bg-emerald-500/5 cursor-default'
                    : 'border-border hover:border-brand-500/25 hover:bg-brand-500/5'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  done
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-surface-300 text-muted-foreground/60'
                }`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${done ? 'text-emerald-400/80 line-through decoration-emerald-500/30' : 'text-foreground/80'}`}>
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ProofScore */}
        <div className="col-span-2 lg:col-span-1 glass-card p-6 flex flex-col items-center gap-2 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, color-mix(in oklch, var(--color-surface-100) 90%, transparent), color-mix(in oklch, var(--color-brand-700) 6%, transparent))' }}>
          <div className="pointer-events-none absolute inset-0 opacity-20 dot-grid" />
          {proofScore !== null ? (
            <ProofScoreRing score={proofScore} size="md" animate />
          ) : (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-24 h-24 rounded-full border-2 border-surface-300 flex items-center justify-center"
                style={{ background: 'color-mix(in oklch, var(--color-brand-500) 4%, transparent)' }}>
                <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground text-center">Run your first audit</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/audit">Get ProofScore</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Portfolios */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground/70 font-medium uppercase tracking-widest">Portfolios</p>
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          <p className="text-4xl font-bold stat-number text-foreground">{portfolios.length}</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            <span className="text-emerald-400">{portfolios.filter(p => p.status === 'published').length}</span> published
          </p>
        </div>

        {/* Resume */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground/70 font-medium uppercase tracking-widest">Resume</p>
            <FileText className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          {latestResume ? (
            <>
              <p className="text-sm font-semibold text-foreground truncate leading-snug">{latestResume.title}</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {new Date(latestResume.created_at).toLocaleDateString()}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold stat-number text-muted-foreground/30">0</p>
              <Button asChild variant="link" size="sm" className="px-0 mt-1 h-auto text-xs text-brand-400">
                <Link href="/resume">Upload one →</Link>
              </Button>
            </>
          )}
        </div>

        {/* Subscription */}
        <div className="glass-card p-6 relative overflow-hidden"
          style={isPro ? { borderColor: 'color-mix(in oklch, var(--color-brand-500) 25%, transparent)' } : {}}>
          {isPro && (
            <div className="pointer-events-none absolute inset-0 opacity-30"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in oklch, var(--color-brand-500) 20%, transparent), transparent)' }} />
          )}
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground/70 font-medium uppercase tracking-widest">Plan</p>
            <Zap className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          {isPro ? (
            <>
              <Badge variant="pro" className="mb-2" style={{ boxShadow: '0 0 10px color-mix(in oklch, var(--color-brand-500) 35%, transparent)' }}>Pro</Badge>
              <p className="text-xs text-muted-foreground">
                {subscription?.current_period_end
                  ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : 'Active'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Free</p>
              <Button asChild variant="link" size="sm" className="px-0 mt-1 h-auto text-xs text-brand-400">
                <Link href="/billing">Upgrade →</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Next action */}
        <div className="lg:col-span-1 glass-card overflow-hidden relative" style={{ borderColor: 'color-mix(in oklch, var(--color-brand-500) 20%, transparent)' }}>
          <div className="h-px bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
          <div className="p-6">
            <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-widest mb-4">Next best action</p>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in oklch, var(--color-brand-500) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-brand-500) 20%, transparent)' }}>
                <nextAction.icon className="h-5 w-5 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground mb-1">{nextAction.label}</p>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{nextAction.desc}</p>
                <Button asChild variant="gradient" size="sm" className="gap-1.5"
                  style={{ boxShadow: '0 0 16px color-mix(in oklch, var(--color-brand-500) 30%, transparent)' }}>
                  <Link href={nextAction.href}>
                    Start
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ProofScore breakdown or missing evidence */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              {latestAudit ? 'ProofScore breakdown' : 'What ProofScore measures'}
            </p>
            {latestAudit && (
              <Button asChild variant="ghost" size="sm" className="text-xs text-brand-400 hover:text-brand-300">
                <Link href="/audit">View full audit →</Link>
              </Button>
            )}
          </div>
          <div className="px-6 pb-6">
            {latestAudit && categories.length > 0 ? (
              <div className="space-y-3">
                {categories.slice(0, 6).map((cat) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">{cat.name}</span>
                    <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${cat.score >= 80 ? 'bg-emerald-500' : cat.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium w-6 text-right ${cat.score >= 80 ? 'text-emerald-400' : cat.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {Math.round(cat.score)}
                    </span>
                    {cat.severity === 'critical' && <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                    {cat.severity === 'minor' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {['First Impression', 'Proof Strength', 'Project Depth', 'Role Alignment', 'Keywords', 'Credibility'].map((cat) => (
                  <div key={cat} className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-400" />
                    {cat}
                  </div>
                ))}
                <div className="col-span-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                    <Link href="/audit">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Run your ProofScore
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portfolios */}
      {portfolios.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Your portfolios</p>
            <Button asChild variant="ghost" size="sm" className="text-xs text-brand-400 hover:text-brand-300">
              <Link href="/builder">View all →</Link>
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolios.map((p) => (
              <Link key={p.id} href={`/builder/${p.id}`} className="block group">
                <div className="glass-card p-5 transition-all duration-200 group-hover:shadow-glow-sm"
                  style={{ '--hover-border': 'color-mix(in oklch, var(--color-brand-500) 25%, transparent)' } as React.CSSProperties}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate group-hover:text-brand-200 transition-colors">{p.title}</p>
                      {p.target_role && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.target_role}</p>
                      )}
                    </div>
                    <Badge variant={p.status === 'published' ? 'success' : 'default'} className="ml-2 shrink-0 text-[10px]">
                      {p.status}
                    </Badge>
                  </div>
                  {p.proof_score !== null && (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${p.proof_score >= 80 ? 'bg-emerald-500' : p.proof_score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${p.proof_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold stat-number text-muted-foreground">{Math.round(p.proof_score)}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/40 mt-3">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
