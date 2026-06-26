import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReadinessBandBadge } from '@/components/interviews/shared/readiness-band'
import { DimensionReadoutView } from '@/components/interviews/shared/dimension-readout'
import type { ReadinessGroup } from '@/lib/interviews/readiness'

const TREND_CONFIG = {
  up: { icon: TrendingUp, label: 'Improving', className: 'text-emerald-400' },
  down: { icon: TrendingDown, label: 'Declining', className: 'text-amber-400' },
  flat: { icon: Minus, label: 'Steady', className: 'text-muted-foreground' },
  insufficient_data: { icon: Minus, label: 'Not enough data for a trend yet', className: 'text-muted-foreground' },
} as const

export function ReadinessOverview({ groups, primary }: { groups: ReadinessGroup[]; primary: ReadinessGroup | null }) {
  if (!primary) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Interview Readiness</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Not measured yet. Complete one baseline session to create your first readiness estimate.
          </p>
          <p className="text-xs text-muted-foreground mt-4 border-t border-border/60 pt-3">
            Interview Readiness is a structured practice diagnostic  -  not a hiring prediction.
          </p>
        </CardContent>
      </Card>
    )
  }

  const trend = TREND_CONFIG[primary.trend]
  const otherGroups = groups.filter((g) => g !== primary)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base capitalize">{primary.sessionType.replace(/_/g, ' ')} Readiness  -  {primary.targetRole}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-4xl font-bold text-foreground tabular-nums">{primary.score}</div>
          <div>
            <ReadinessBandBadge band={primary.band} />
            <p className="text-xs text-muted-foreground mt-1">{primary.sampleLabel}</p>
          </div>
          <div className={`flex items-center gap-1.5 text-sm ${trend.className}`}>
            <trend.icon className="h-4 w-4" /> {trend.label}
          </div>
        </div>

        <div className="mt-6">
          <DimensionReadoutView dimensions={primary.dimensions} />
        </div>

        <details className="mt-4 border-t border-border/60 pt-3">
          <summary className="text-xs text-brand-400 cursor-pointer hover:underline">How this score was calculated</summary>
          <div className="mt-3 text-xs text-muted-foreground space-y-1.5">
            <p>Rubric: <span className="text-foreground">{primary.rubricVersion}</span> for {primary.sessionType.replace(/_/g, ' ')}</p>
            <p>Coaching mode: <span className="text-foreground capitalize">{primary.coachingMode}</span> sessions only  -  other modes are tracked separately, never blended in.</p>
            <p>Sessions used: <span className="text-foreground">{primary.comparableSessionCount}</span> most recent, current-rubric, matching-mode sessions for this role and interview type.</p>
            {primary.excludedStaleRubricCount > 0 && <p>{primary.excludedStaleRubricCount} session(s) excluded  -  scored under a previous rubric version.</p>}
            {primary.excludedModeMismatchCount > 0 && <p>{primary.excludedModeMismatchCount} session(s) excluded  -  different coaching mode.</p>}
          </div>
        </details>

        {otherGroups.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              {otherGroups.length} other readiness {otherGroups.length === 1 ? 'estimate' : 'estimates'} (other roles/interview types)
            </summary>
            <div className="mt-2 space-y-1.5">
              {otherGroups.map((g) => (
                <div key={`${g.targetRole}-${g.sessionType}`} className="flex items-center justify-between text-sm p-2 rounded-lg bg-surface-100">
                  <span className="text-foreground capitalize">{g.sessionType.replace(/_/g, ' ')}  -  {g.targetRole}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums font-medium">{g.score}</span>
                    <ReadinessBandBadge band={g.band} />
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        <p className="text-xs text-muted-foreground mt-4 border-t border-border/60 pt-3">
          Interview Readiness is a structured practice diagnostic  -  not a hiring prediction.
        </p>
      </CardContent>
    </Card>
  )
}
