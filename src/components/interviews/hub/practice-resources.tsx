import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DrillDefinition } from '@/lib/interviews/drills'

export function PracticeResources({ drills }: { drills: DrillDefinition[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Dumbbell className="h-4 w-4" /> Recommended Drills</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {drills.map((d) => (
          <Link key={d.id} href="/interviews/drills" className="block p-3 rounded-xl border border-border/60 hover:bg-surface-200 transition-colors">
            <p className="text-sm font-medium text-foreground">{d.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.objective}</p>
          </Link>
        ))}
        <Link href="/interviews/drills" className="text-xs text-brand-400 hover:underline inline-block mt-1">Browse all drills</Link>
      </CardContent>
    </Card>
  )
}
