'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, X, Plus } from 'lucide-react'
import { toast } from 'sonner'

// "Practice reminder" — schedule a session; upcoming reminders show here, and the weekly
// digest nudges you when one is due. Fails soft until
// 20260710033034_interview_reminders.sql applies (shows the
// scheduler but persistence is a no-op until then).
interface Reminder { id: string; remind_at: string; note: string | null }

export function PracticeReminder() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/interviews/reminders').then((r) => r.json()).then((j) => setReminders(j.data ?? [])).catch(() => {})
  }, [])

  async function save() {
    if (!date) { toast.error('Pick a date'); return }
    setSaving(true)
    try {
      const remindAt = new Date(date + 'T09:00:00').toISOString()
      const res = await fetch('/api/interviews/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remindAt, note: note.trim() || undefined }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error ?? 'Could not set reminder'); return }
      setReminders((r) => [...r, j.data].sort((a, b) => a.remind_at.localeCompare(b.remind_at)))
      setAdding(false); setDate(''); setNote('')
      toast.success('Practice reminder set.')
    } catch { toast.error('Could not set reminder') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    setReminders((r) => r.filter((x) => x.id !== id))
    await fetch(`/api/interviews/reminders?id=${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Practice reminders</h3>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-xs text-brand-400 hover:text-brand-300 inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      {reminders.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Schedule practice before a real interview — we&apos;ll remind you.</p>
      )}

      <div className="space-y-1.5">
        {reminders.map((r) => (
          <div key={r.id} className="group flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground/85">
              {new Date(r.remind_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              {r.note && <span className="text-muted-foreground"> · {r.note}</span>}
            </span>
            <button onClick={() => remove(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-foreground transition-opacity" aria-label="Remove">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-3 space-y-2">
          <input type="date" min={todayStr} value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-100 px-3 py-2 text-sm text-foreground" />
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
            placeholder="Note (e.g. before my Acme interview)"
            className="w-full rounded-lg border border-border bg-surface-100 px-3 py-2 text-sm text-foreground" />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-brand-500 text-white text-sm font-semibold py-2 disabled:opacity-60">
              {saving ? 'Setting…' : 'Set reminder'}
            </button>
            <button onClick={() => { setAdding(false); setDate(''); setNote('') }} className="px-3 rounded-lg border border-border text-sm text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
