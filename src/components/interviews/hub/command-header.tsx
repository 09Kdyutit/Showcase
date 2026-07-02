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
    <div className="rounded-2xl border border-border/60 bg-card p-6 lg:p-8">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">Welcome back, {firstName}</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight mt-1 break-words">
            {targetRole ? `Preparing for ${targetRole}` : 'Interview Lab'}
          </h1>
          {primaryReadiness ? (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="text-3xl font-bold text-foreground tabular-nums">{primaryReadiness.score}</span>
              <ReadinessBandBadge band={primaryReadiness.band} />
              <span className="text-sm text-muted-foreground min-w-0 break-words">{primaryReadiness.sampleLabel}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-3">Readiness: <span className="text-foreground font-medium">Not measured yet</span></p>
          )}
        </div>

        <div className="flex flex-col gap-2 w-full lg:w-auto lg:max-w-xs shrink-0">
          {topAction && (
            <Button asChild size="lg" className="gap-2 h-auto py-3 whitespace-normal text-left min-w-0">
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
        <p className="text-xs text-muted-foreground mt-4 border-t border-border/60 pt-3 break-words">{topAction.reason}</p>
      )}
    </div>
  )
}
