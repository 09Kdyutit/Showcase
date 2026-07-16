'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Globe, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LivePreviewFrame } from '@/components/portfolio/live-preview-frame'
import type { PortfolioContent } from '@/types/database'
import type { ThemeId } from '@/lib/portfolio/themes'
import { configuredAppHost } from '@/lib/app-url'

const APP_HOST = configuredAppHost()

interface PublishPaywallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolioId: string
  title: string
  slug: string
  targetRole: string
  theme: ThemeId
  content: Partial<PortfolioContent>
}

interface FoundingAvailability {
  configured: boolean
  available: boolean
  remaining: number | null
  limit?: number
}

export function PublishPaywallDialog({
  open,
  onOpenChange,
  portfolioId,
  title,
  slug,
  targetRole,
  theme,
  content,
}: PublishPaywallDialogProps) {
  const router = useRouter()
  const [founding, setFounding] = useState<FoundingAvailability | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/stripe/founding-availability', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled) setFounding(data) })
      .catch(() => { if (!cancelled) setFounding(null) })
    return () => { cancelled = true }
  }, [open])

  function choosePlan(plan: 'monthly' | 'annual' | 'founding') {
    const params = new URLSearchParams({ plan, source: 'publish', portfolio_id: portfolioId })
    router.push(`/billing?${params.toString()}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
        <div className="grid lg:grid-cols-[1.12fr_0.88fr]">
          <div className="order-2 border-t border-border bg-surface-50 p-5 lg:order-1 lg:border-t-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5 text-brand-400" />
                {APP_HOST}/p/{slug}
              </div>
              <span className="rounded-full border border-border bg-surface-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your preview
              </span>
            </div>
            <LivePreviewFrame
              themeId={theme}
              portfolio={{ title, slug, target_role: targetRole, status: 'draft' }}
              content={content}
              height={570}
            />
          </div>

          <div className="order-1 space-y-6 p-6 sm:p-8 lg:order-2">
            <DialogHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10">
                <Sparkles className="h-5 w-5 text-brand-400" />
              </div>
              <DialogTitle className="text-2xl">Unlock a live link for this portfolio.</DialogTitle>
              <DialogDescription className="leading-relaxed">
                Showcase Pro gives this portfolio a live URL and preview card for applications, LinkedIn, and direct outreach.
                Your draft stays private until you return and choose Publish.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm font-semibold text-foreground">What remains available on Free</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Your saved draft, daily evidence audit, previewing, and editing remain available while your account exists. Publishing the live page is the Pro feature.
              </p>
            </div>

            {founding?.configured && founding.available && typeof founding.remaining === 'number' && (
              <button
                type="button"
                onClick={() => choosePlan('founding')}
                className="w-full rounded-xl border border-brand-500/35 bg-brand-500/10 p-4 text-left transition-colors hover:bg-brand-500/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Founding member · $99/year</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Everything in Pro at $99/year while continuously subscribed. The live counter is limited to ten active members or checkout holds.
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-brand-300">
                    {founding.remaining} of {founding.limit ?? 10} left
                  </span>
                </div>
                <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand-300">
                  Claim a founding spot <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            )}

            <div className="grid gap-3">
              <Button type="button" variant="gradient" size="lg" onClick={() => choosePlan('monthly')} className="h-auto min-h-12 w-full justify-between gap-3 px-5 py-3">
                <span>Monthly Pro</span>
                <span className="ml-auto flex items-center gap-1.5 text-white/90">
                  $15/month <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={() => choosePlan('annual')} className="h-auto min-h-12 w-full justify-between gap-3 px-5 py-3">
                <span className="flex items-center gap-2">
                  Annual Pro
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Save $30</span>
                </span>
                <span className="ml-auto text-muted-foreground">$150/year</span>
              </Button>
            </div>

            <p className="rounded-lg border border-border bg-surface-100 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Checkout upgrades your account; it does not publish this draft. After payment, return to this portfolio and choose Publish.
            </p>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> Live shareable URL and social preview card</p>
              <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> Higher AI limits and portfolio regeneration</p>
              <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> Cancel anytime; when Pro access ends, the page unpublishes and remains a private draft</p>
            </div>

            <Button type="button" variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
              Keep it private for now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
