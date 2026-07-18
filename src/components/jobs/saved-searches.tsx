'use client'

import { useEffect, useState } from 'react'
import { Bookmark, BookmarkCheck, X, Plus } from 'lucide-react'
import { toast } from 'sonner'

// Saved job searches — re-run a filter set in one click. Alerts (email me on new Strong
// matches) ride the existing weekly digest. Backend fails soft until
// 20260710033033_saved_searches.sql applies,
// so this simply shows nothing until then rather than erroring.
interface SavedSearch { id: string; label: string; filters: Record<string, unknown>; alerts_enabled: boolean }

export function SavedSearches<T>({
  filters,
  onApply,
  hasActiveFilters,
}: {
  filters: T
  onApply: (f: T) => void
  hasActiveFilters: boolean
}) {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/jobs/saved-searches')
      .then((r) => r.json())
      .then((j) => setSearches(j.data ?? []))
      .catch(() => {})
  }, [])

  async function save() {
    const label = window.prompt('Name this search (e.g. "Remote Senior PM"):')?.trim()
    if (!label) return
    setSaving(true)
    try {
      const res = await fetch('/api/jobs/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, filters, alertsEnabled: true }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error ?? 'Could not save search'); return }
      setSearches((s) => [j.data, ...s])
      toast.success('Search saved — new matches will show in your weekly digest.')
    } catch { toast.error('Could not save search') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    // Optimistic removal — but a swallowed failure would leave the search alive
    // server-side and resurrected on refresh, so roll back visibly instead.
    const previous = searches
    setSearches((s) => s.filter((x) => x.id !== id))
    try {
      const res = await fetch(`/api/jobs/saved-searches?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setSearches(previous)
      toast.error('Could not remove saved search')
    }
  }

  if (searches.length === 0 && !hasActiveFilters) return null

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 lg:px-6 py-2">
      {searches.map((s) => (
        <span key={s.id} className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium border border-border bg-surface-100 text-muted-foreground hover:text-foreground transition-colors">
          <button onClick={() => onApply(s.filters as T)} className="inline-flex items-center gap-1.5">
            <BookmarkCheck className="h-3 w-3 text-brand-400" />
            {s.label}
          </button>
          <button onClick={() => remove(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {hasActiveFilters && (
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-brand-500/40 transition-colors"
        >
          {saving ? <Bookmark className="h-3 w-3 animate-pulse" /> : <Plus className="h-3 w-3" />}
          Save this search
        </button>
      )}
    </div>
  )
}
