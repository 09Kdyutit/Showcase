import Link from 'next/link'
import { ArrowRight, Mic, Keyboard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HubSessionSummary } from '@/lib/interviews/hub-data'

const STATUS_LABELS: Record<string, string> = {
  planned: 'Not started', in_progress: 'In progress', completed: 'Completed',
  abandoned: 'Abandoned', expired: 'Expired',
}

function sessionHref(s: HubSessionSummary): string {
  if (s.status === 'completed') return `/interviews/${s.id}/results`
  return `/interviews/${s.id}/lobby`
}

export function RecentSessions({ sessions }: { sessions: HubSessionSummary[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent Sessions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          sessions.map((s) => (
            <Link
              key={s.id}
              href={sessionHref(s)}
              className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-200 transition-colors border border-border/60"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {s.deliveryMode === 'voice' ? <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <Keyboard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <p className="text-sm font-medium text-foreground capitalize truncate">{s.sessionType.replace(/_/g, ' ')} · {s.targetRole}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(s.createdAt).toLocaleDateString()} · {STATUS_LABELS[s.status] ?? s.status}
                  {s.overallScore !== null && <> · scored {s.overallScore}</>}
                  {s.priorityDimensionLabel && <> · focus: {s.priorityDimensionLabel}</>}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}
