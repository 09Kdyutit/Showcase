import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { UsageSnapshot } from '@/lib/interviews/entitlements'

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function UsageSummary({ usage }: { usage: UsageSnapshot }) {
  const resetDate = new Date(usage.periodResetsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Usage This Period</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-foreground">Interviews</span>
            <span className="text-muted-foreground tabular-nums">{usage.sessions.used} of {usage.sessions.limit} used</span>
          </div>
          <UsageBar used={usage.sessions.used} limit={usage.sessions.limit} />
        </div>

        {usage.audioSessions.limit > 0 && (
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-foreground">Voice / Recorded</span>
              <span className="text-muted-foreground tabular-nums">{usage.audioSessions.used} of {usage.audioSessions.limit} used</span>
            </div>
            <UsageBar used={usage.audioSessions.used} limit={usage.audioSessions.limit} />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Resets {resetDate}. {usage.tier === 'free' ? 'A session counts once you start answering — abandoned setups are never charged.' : `Plan: Pro (${usage.periodLabel})`}
        </p>

        {usage.tier === 'free' && usage.sessions.remaining === 0 && (
          <div className="rounded-lg border border-border/60 bg-surface-100 p-3">
            <p className="text-sm text-foreground font-medium">You&apos;ve used your {usage.sessions.limit} free interviews this month.</p>
            <p className="text-xs text-muted-foreground mt-1">Resets {resetDate}. Your existing sessions, transcripts, and Story Bank stay fully available.</p>
            <Button asChild size="sm" className="mt-3"><Link href="/billing">Upgrade to Pro — $15/mo or $150/yr</Link></Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
