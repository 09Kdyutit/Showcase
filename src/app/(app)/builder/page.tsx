import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus, ExternalLink, BarChart3, Globe, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio Builder</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage your professional portfolios.</p>
        </div>
        <form action={createPortfolio}>
          <Button type="submit" variant="gradient" size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New portfolio
          </Button>
        </form>
      </div>

      {portfolios.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
            <Plus className="h-8 w-8 text-brand-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No portfolios yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create your first portfolio. Upload your resume and AI will build it for you.
            </p>
          </div>
          <form action={createPortfolio}>
            <Button type="submit" variant="gradient" size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first portfolio
            </Button>
          </form>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((p) => (
            <div key={p.id} className="glass-card overflow-hidden hover:border-brand-500/20 transition-all duration-200 hover:shadow-glow-sm group">
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
          ))}
        </div>
      )}
    </div>
  )
}
