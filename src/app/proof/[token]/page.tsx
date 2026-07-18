import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import { ProofScoreRing } from '@/components/ui/proof-score-ring'
import { scoreLabel } from '@/lib/utils'
import { configuredAppUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ token: string }> }

type Category = { name: string; score: number }

// Fetches ONLY the safe, shareable fields via the service client (findings, recommendations,
// resume_id and any private content are never selected here). Filtering by a random opaque
// token is the authorization — no user session needed to view a shared score.
async function loadShared(token: string): Promise<{ score: number; categories: Category[]; role: string | null } | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  const supabase = await createServiceClient()
  const { data: audit } = await supabase
    .from('audits')
    .select('overall_score, category_scores, user_id')
    .eq('share_token', token)
    .is('share_token_revoked_at', null)
    .gt('share_token_expires_at', new Date().toISOString())
    .maybeSingle()
  if (!audit || typeof audit.overall_score !== 'number') return null

  const rawCats = Array.isArray(audit.category_scores)
    ? (audit.category_scores as { name?: string; score?: number }[])
    : []
  const categories: Category[] = rawCats
    .filter((c) => c && typeof c.score === 'number' && c.name)
    .map((c) => ({ name: String(c.name), score: Number(c.score) }))
    .slice(0, 6)

  let role: string | null = null
  const { data: profile } = await supabase.from('profiles').select('target_role').eq('id', audit.user_id).maybeSingle()
  role = profile?.target_role ?? null

  return { score: audit.overall_score, categories, role }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const shared = await loadShared(token)
  if (!shared) return { title: 'Evidence audit', robots: { index: false } }
  return {
    title: `Evidence score: ${shared.score}/100 · Showcase`,
    description: `An evidence clarity and coverage review${shared.role ? ` for ${shared.role}` : ''}, created with Showcase.`,
    robots: { index: false },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function SharedProofScorePage({ params }: Props) {
  const { token } = await params
  const shared = await loadShared(token)
  if (!shared) notFound()

  const appUrl = configuredAppUrl()

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-6 overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[440px] aurora-mesh opacity-30" />
      <div className="relative w-full max-w-lg">
        <div className="glass-card p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: 'oklch(63% 0.20 255)' }}>
            Evidence score{shared.role ? ` · ${shared.role}` : ''}
          </p>
          <div className="flex justify-center mb-2">
            <ProofScoreRing score={shared.score} size="lg" animate showLabel={false} />
          </div>
          <p className="text-display text-2xl font-semibold text-foreground mt-4">
            {scoreLabel(shared.score)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Evidence clarity and coverage review</p>

          {shared.categories.length > 0 && (
            <div className="mt-7 space-y-2.5 text-left">
              {shared.categories.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">{c.name}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-300)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${c.score}%`,
                        background: c.score >= 80 ? 'var(--color-verified)' : c.score >= 60 ? 'var(--color-missing)' : 'var(--color-destructive)',
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-6 text-right stat-number text-muted-foreground">{Math.round(c.score)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground mb-3">Turn your own résumé into evidence.</p>
          <Link
            href={appUrl}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-semibold text-sm text-white btn-sheen"
            style={{ background: 'oklch(54% 0.230 255)', boxShadow: '0 0 28px oklch(54% 0.230 255 / 0.3)' }}
          >
            Visit Showcase →
          </Link>
        </div>
      </div>
    </div>
  )
}
