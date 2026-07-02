import Link from 'next/link'
import { Dumbbell, BookOpen, Building2 } from 'lucide-react'
import type { DrillDefinition } from '@/lib/interviews/drills'

export function PracticeResources({ drills }: { drills: DrillDefinition[] }) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <p className="text-sm font-semibold text-foreground">Practice Resources</p>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-2">
        <Link
          href="/interviews/questions"
          className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-brand-500/20 hover:bg-brand-500/5 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-3.5 w-3.5 text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground group-hover:text-brand-200 transition-colors">Question Library</p>
            <p className="text-xs text-muted-foreground/60">72 behavioral questions, AI-scored</p>
          </div>
        </Link>

        <Link
          href="/interviews/companies"
          className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Building2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground group-hover:text-emerald-200 transition-colors">Company Prep</p>
            <p className="text-xs text-muted-foreground/60">Google, Amazon, Stripe + 12 more</p>
          </div>
        </Link>

        <Link
          href="/interviews/drills"
          className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-amber-500/20 hover:bg-amber-500/5 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Dumbbell className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground group-hover:text-amber-200 transition-colors">Communication Drills</p>
            <p className="text-xs text-muted-foreground/60">{drills.length} structural practice exercises</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
