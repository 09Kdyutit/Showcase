import type { DimensionReadout } from '@/lib/interviews/readiness'

// Deliberately not a radar/radial chart: those need color-only differentiation to read
// and fail "always provide accessible text and table alternatives" by default. This
// groups dimensions into Strong / Developing / Focus Here - the three things a user
// actually needs to know - backed by a real <table> for screen readers and zoom.
function groupDimensions(dimensions: DimensionReadout[]) {
  const strong = dimensions.filter((d) => d.score >= 80)
  const developing = dimensions.filter((d) => d.score >= 60 && d.score < 80)
  const focus = dimensions.filter((d) => d.score < 60)
  return { strong, developing, focus }
}

function DimensionPill({ d }: { d: DimensionReadout }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface-100 border border-border/40">
      <span className="text-sm text-foreground">{d.label}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">{d.score}</span>
    </div>
  )
}

export function DimensionReadoutView({ dimensions }: { dimensions: DimensionReadout[] }) {
  if (dimensions.length === 0) {
    return <p className="text-sm text-muted-foreground">No dimension-level data yet for this session type.</p>
  }
  const { strong, developing, focus } = groupDimensions(dimensions)

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 mb-2">Strong ({strong.length})</p>
          <div className="space-y-1.5">
            {strong.length > 0 ? strong.map((d) => <DimensionPill key={d.id} d={d} />) : <p className="text-xs text-muted-foreground">None yet</p>}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600 mb-2">Developing ({developing.length})</p>
          <div className="space-y-1.5">
            {developing.length > 0 ? developing.map((d) => <DimensionPill key={d.id} d={d} />) : <p className="text-xs text-muted-foreground">None yet</p>}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600 mb-2">Focus Here ({focus.length})</p>
          <div className="space-y-1.5">
            {focus.length > 0 ? focus.map((d) => <DimensionPill key={d.id} d={d} />) : <p className="text-xs text-muted-foreground">None yet</p>}
          </div>
        </div>
      </div>

      <details className="mt-4">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View as a table</summary>
        <table className="w-full mt-2 text-sm">
          <caption className="sr-only">Dimension scores and rubric weights</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
              <th scope="col" className="py-1.5 pr-2">Dimension</th>
              <th scope="col" className="py-1.5 pr-2">Score</th>
              <th scope="col" className="py-1.5">Rubric weight</th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map((d) => (
              <tr key={d.id} className="border-b border-border/30">
                <td className="py-1.5 pr-2 text-foreground">{d.label}</td>
                <td className="py-1.5 pr-2 tabular-nums">{d.score}</td>
                <td className="py-1.5 tabular-nums text-muted-foreground">{Math.round(d.weight * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
