import { Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CANONICAL_COMPETENCY_LABELS } from '@/lib/interviews/competencies'
import type { EvidenceCoverageSummary } from '@/lib/interviews/evidence-coverage'

export function EvidenceCoverage({ coverage }: { coverage: EvidenceCoverageSummary }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Evidence Coverage</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Competencies you have strong evidence for - based on your resume and portfolio.
        </p>

        <ul className="grid sm:grid-cols-2 gap-2" aria-label="Competency coverage">
          {coverage.covered.map((c) => (
            <li
              key={c.competency}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${c.covered ? 'border-emerald-500/20 bg-emerald-500/5 text-foreground' : 'border-border/60 bg-surface-100 text-muted-foreground'}`}
            >
              {c.covered ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <span className="truncate">{CANONICAL_COMPETENCY_LABELS[c.competency]}</span>
              {c.covered && !c.hasOutcome && <span className="text-[10px] text-amber-600 ml-auto shrink-0">needs outcome</span>}
            </li>
          ))}
        </ul>

        {(coverage.strongestStory || coverage.verifiedMetricCount > 0) && (
          <div className="text-xs text-muted-foreground space-y-0.5 mt-4 pt-4 border-t border-border/60">
            {coverage.strongestStory && <p>Strongest example: <span className="text-foreground">{coverage.strongestStory.title}</span></p>}
            {coverage.verifiedMetricCount > 0 && <p>{coverage.verifiedMetricCount} verified metric{coverage.verifiedMetricCount === 1 ? '' : 's'} available</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
