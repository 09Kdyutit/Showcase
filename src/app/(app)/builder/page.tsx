import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus, ExternalLink, BarChart3, Globe, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageShell, PageHeader } from '@/components/shared/page-header'
import { Tilt3D } from '@/components/ui/tilt-3d'
import { generateSlug, scoreColor } from '@/lib/utils'
import type { Portfolio } from '@/types/database'

export default async function BuilderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const portfoliosRes = await supabase.from('portfolios').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
  const subRes = await supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle()

  const portfolios = (portfoliosRes.data ?? []) as Portfolio[]
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

                {p.proof_score !== null && (
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/40" />
                    <span className={`text-xs font-medium ${scoreColor(p.proof_score)}`}>
                      ProofScore {p.proof_score}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button asChild variant="secondary" size="sm" className="flex-1 text-xs">
                    <Link href={`/builder/${p.id}`}>Edit</Link>
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
