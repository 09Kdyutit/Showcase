import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReadinessBandBadge } from '@/components/interviews/shared/readiness-band'
import type { RecommendedAction } from '@/lib/interviews/recommendations'
import type { ReadinessGroup } from '@/lib/interviews/readiness'

interface CommandHeaderProps {
  displayName: string
  targetRole: string | null
  primaryReadiness: ReadinessGroup | null
  topAction: RecommendedAction | null
}

export function CommandHeader({ displayName, targetRole, primaryReadiness, topAction }: CommandHeaderProps) {
  const firstName = displayName.split(' ')[0] || displayName

  return (
    <div className="entrance glass-card holo-border relative overflow-hidden p-6 lg:p-8">
      {/* Ambient brand light + dot texture — same voice as the dashboard hero cards */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: 'radial-gradient(ellipse 70% 90% at 12% -10%, color-mix(in oklch, var(--color-brand-500) 14%, transparent), transparent)' }}
      />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-15" />
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, oklch(54% 0.230 255 / 0.55), transparent)' }} />

      <div className="relative flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'oklch(63% 0.20 255)' }}>
            Interview Lab · Welcome back, {firstName}
          </p>
          <h1 className="text-display text-[1.75rem] lg:text-4xl font-semibold text-foreground mt-1 break-words text-balance">
            {targetRole ? (
              <>
                Preparing for{' '}
                <em style={{ fontStyle: 'italic', color: 'oklch(70% 0.17 255)' }}>{targetRole}</em>
              </>
            ) : (
              <>
                Practice until it&apos;s{' '}
                <em style={{ fontStyle: 'italic', color: 'oklch(70% 0.17 255)' }}>effortless.</em>
              </>
            )}
          </h1>
          {primaryReadiness ? (
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <span className="text-4xl font-bold text-foreground stat-number">{primaryReadiness.score}</span>
              <ReadinessBandBadge band={primaryReadiness.band} />
              <span className="text-sm text-muted-foreground min-w-0 break-words">{primaryReadiness.sampleLabel}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-3">Readiness: <span className="text-foreground font-medium">Not measured yet</span></p>
          )}
        </div>

        <div className="flex flex-col gap-2 w-full lg:w-auto lg:max-w-xs shrink-0">
          {topAction && (
            <Button
              asChild
              variant="gradient"
              size="lg"
              className="gap-2 h-auto py-3 whitespace-normal text-left min-w-0 btn-sheen"
              style={{ boxShadow: '0 0 22px color-mix(in oklch, var(--color-brand-500) 30%, transparent)' }}
            >
              <Link href={topAction.destination}>
                <span className="line-clamp-2 min-w-0">{topAction.title}</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className="whitespace-nowrap">
            <Link href="/interviews/new">Choose another practice mode</Link>
          </Button>
        </div>
      </div>

      {topAction && (
        <p className="relative text-xs text-muted-foreground mt-4 border-t border-border/60 pt-3 break-words">{topAction.reason}</p>
      )}
    </div>
  )
}
