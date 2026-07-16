import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Plus, ExternalLink, BarChart3, Globe, Lock, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageShell, PageHeader } from '@/components/shared/page-header'
import { Tilt3D } from '@/components/ui/tilt-3d'
import { generateSlug, scoreColor } from '@/lib/utils'
import type { Portfolio } from '@/types/database'

type ViewStats = Record<string, { total: number; last7: number; topRef: string | null }>

// Extracted so the "now"-dependent timestamp math (Date.now / new Date) lives here, not in
// the component render body. Reads portfolio_view events via the service client but scoped
// strictly to the caller's own published slugs, so only their own aggregate counts surface.
async function getPortfolioViews(publishedSlugs: string[]): Promise<ViewStats> {
  const stats: ViewStats = {}
  for (const slug of publishedSlugs) stats[slug] = { total: 0, last7: 0, topRef: null }
  if (publishedSlugs.length === 0) return stats
  try {
    const svc = await createServiceClient()
    const now = Date.now()
    const thirtyAgo = new Date(now - 30 * 86400_000).toISOString()
    const sevenAgo = now - 7 * 86400_000
    const { data: events } = await svc
      .from('marketing_events')
      .select('metadata, created_at')
      .eq('event_name', 'portfolio_view')
      .gte('created_at', thirtyAgo)
      .limit(5000)
    const refTally: Record<string, Record<string, number>> = {}
    for (const ev of events ?? []) {
      const md = (ev.metadata ?? {}) as { slug?: string; ref?: string }
      if (!md.slug || !stats[md.slug]) continue
      stats[md.slug].total++
      if (new Date(ev.created_at).getTime() >= sevenAgo) stats[md.slug].last7++
      const ref = md.ref && md.ref !== 'direct' ? md.ref : null
      if (ref) { (refTally[md.slug] ??= {})[ref] = (refTally[md.slug]?.[ref] ?? 0) + 1 }
    }
    for (const slug of publishedSlugs) {
      const tally = refTally[slug]
      if (tally) stats[slug].topRef = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    }
  } catch { /* analytics best-effort */ }
  return stats
}

export default async function BuilderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const portfoliosRes = await supabase.from('portfolios').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
  const subRes = await supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle()

  const portfolios = (portfoliosRes.data ?? []) as Portfolio[]

  const publishedSlugs = portfolios.filter((p) => p.status === 'published').map((p) => p.slug)
  const viewsBySlug = await getPortfolioViews(publishedSlugs)
  const totalViews = Object.values(viewsBySlug).reduce((n, v) => n + v.total, 0)
  const last7Views = Object.values(viewsBySlug).reduce((n, v) => n + v.last7, 0)
  const isPro = (subRes.data as { status: string } | null)?.status === 'active' || (subRes.data as { status: string } | null)?.status === 'trialing'

  async function createPortfolio() {
    'use server'
    const supabase2 = await createClient()
    const { data: { user: u } } = await supabase2.auth.getUser()
    if (!u) return
    const { data: p } = await supabase2.from('profiles').select('target_role').eq('id', u.id).single()
    const slug = generateSlug((p as { target_role?: string } | null)?.target_role ?? 'portfolio')
    const { data } = await supabase2.from('portfolios').insert({
      user_id: u.id,
      slug,
      title: 'New Portfolio',
      status: 'draft',
    }).select().single()
    if (data) redirect(`/builder/${(data as { id: string }).id}`)
  }

  return (
    <PageShell>
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <PageHeader
        eyebrow="Portfolio Builder"
        title="Your work, made"
        titleAccent="undeniable."
        description="Create and manage your professional portfolios."
        actions={
          <form action={createPortfolio}>
            <Button type="submit" variant="gradient" size="sm" className="gap-1.5 btn-sheen">
              <Plus className="h-3.5 w-3.5" />
              New portfolio
            </Button>
          </form>
        }
      />

      {/* Portfolio views — the "did it work?" dopamine + a Pro-worthy signal */}
      {publishedSlugs.length > 0 && (
        <div className="entrance entrance-delay-1 glass-card p-5 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse 50% 90% at 100% 0%, color-mix(in oklch, var(--color-brand-500) 12%, transparent), transparent)' }} />
          <div className="relative flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklch, var(--color-brand-500) 14%, transparent)', border: '1px solid color-mix(in oklch, var(--color-brand-500) 26%, transparent)' }}>
                <Eye className="h-4 w-4 text-brand-300" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Portfolio views</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Last 30 days</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground stat-number">{totalViews}</span>
              <span className="text-xs text-muted-foreground">total</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold stat-number" style={{ color: last7Views > 0 ? 'oklch(72% 0.17 160)' : undefined }}>{last7Views}</span>
              <span className="text-xs text-muted-foreground">this week</span>
            </div>
            {totalViews === 0 && (
              <p className="text-xs text-muted-foreground/60">Share your portfolio link to start seeing views here.</p>
            )}
          </div>
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="entrance entrance-delay-2 glass-card p-12 flex flex-col items-center justify-center text-center gap-5 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 dot-grid opacity-20" />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'color-mix(in oklch, var(--color-brand-500) 12%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-brand-500) 24%, transparent)',
              boxShadow: '0 0 30px color-mix(in oklch, var(--color-brand-500) 20%, transparent)',
            }}
          >
            <Plus className="h-8 w-8 text-brand-400" />
          </div>
          <div className="relative">
            <h2 className="text-display text-xl font-semibold text-foreground mb-2">No portfolios yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create your first portfolio. Upload your resume and AI will build it for you.
            </p>
          </div>
          <form action={createPortfolio} className="relative">
            <Button type="submit" variant="gradient" size="lg" className="gap-2 btn-sheen shadow-glow">
              <Plus className="h-4 w-4" />
              Create your first portfolio
            </Button>
          </form>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((p, i) => (
            <div key={p.id} className="entrance" style={{ animationDelay: `${i * 60 + 120}ms` }}>
            <Tilt3D max={4} innerClassName="glass-card overflow-hidden group h-full">
            <div>
              {/* Mini preview */}
              <div className="h-32 bg-gradient-to-br from-surface-300 to-surface-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-violet-500/5" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-white/10 rounded-full w-2/3" />
                  <div className="h-2 bg-white/5 rounded-full w-1/2" />
                  <div className="h-2 bg-white/5 rounded-full w-3/4" />
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <Badge variant={p.status === 'published' ? 'success' : 'default'}>
                    {p.status === 'published' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {p.status}
                  </Badge>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate">{p.title}</h3>
                    {p.target_role && (
                      <p className="text-xs text-muted-foreground truncate">{p.target_role}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  {p.proof_score !== null && (
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${scoreColor(p.proof_score)}`}>
                      <BarChart3 className="h-3.5 w-3.5 opacity-60" />
                      Evidence score {p.proof_score}
                    </span>
                  )}
                  {p.status === 'published' && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Eye className="h-3.5 w-3.5 opacity-60" />
                      {viewsBySlug[p.slug]?.total ?? 0} view{(viewsBySlug[p.slug]?.total ?? 0) === 1 ? '' : 's'}
                      {viewsBySlug[p.slug]?.topRef && <span className="text-muted-foreground/50">· via {viewsBySlug[p.slug].topRef}</span>}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild variant={p.ai_generated_at && p.status !== 'published' ? 'gradient' : 'secondary'} size="sm" className="flex-1 gap-1.5 text-xs">
                    <Link href={`/builder/${p.id}`}>
                      {p.ai_generated_at && p.status !== 'published' && <Globe className="h-3.5 w-3.5" />}
                      {p.ai_generated_at && p.status !== 'published' ? 'Review & publish' : 'Edit'}
                    </Link>
                  </Button>
                  {p.status === 'published' && isPro && (
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                      <Link href={`/p/${p.slug}`} target="_blank">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
            </Tilt3D>
            </div>
          ))}
        </div>
      )}
    </div>
    </PageShell>
  )
}
