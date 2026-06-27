import Link from 'next/link'
import { Clock, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RecommendedAction } from '@/lib/interviews/recommendations'

const SOURCE_LABELS: Record<RecommendedAction['source'], string> = {
  real_weakness: 'From your last session',
  incomplete_work: 'Unfinished',
  evidence_gap: 'Story Bank',
  baseline: 'Getting started',
  job_requirement: 'Job-specific',
  sample_size: 'Build confidence',
}

export function NextActions({ actions }: { actions: RecommendedAction[] }) {
  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Your Next Moves</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">You&apos;re all caught up  -  no urgent next steps right now.</p></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Your Next Moves</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => (
          <Link
            key={action.id}
            href={action.destination}
            className="block p-4 rounded-xl border border-border/60 hover:border-brand-500/50 hover:bg-surface-200/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-brand-600">{SOURCE_LABELS[action.source]}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{action.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{action.reason}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              <Clock className="h-3 w-3" /> ~{action.estimatedMinutes} min
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
