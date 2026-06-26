'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn, apiErrorMessage } from '@/lib/utils'
import { CANONICAL_COMPETENCIES } from '@/lib/interviews/competencies'

interface Story {
  id: string
  title: string
  competencies: string[]
  situation: string | null
  task: string | null
  actions: string[]
  outcome: string | null
  reflection: string | null
  verified_metrics: string[]
  evidence_status: 'unverified' | 'partially_verified' | 'verified'
  last_practiced_at: string | null
}

const EVIDENCE_LABELS: Record<Story['evidence_status'], { label: string; variant: 'outline' | 'info' | 'success' }> = {
  unverified: { label: 'Unverified', variant: 'outline' },
  partially_verified: { label: 'Partially verified', variant: 'info' },
  verified: { label: 'Verified', variant: 'success' },
}

const emptyForm = {
  title: '', competenciesText: '', situation: '', task: '', actionsText: '', outcome: '', reflection: '', verifiedMetricsText: '',
}

export default function StoryBankPage() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const res = await fetch('/api/interviews/story-bank')
    const json = await res.json()
    if (res.ok) setStories(json.data ?? [])
    setLoading(false)
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(story: Story) {
    setEditingId(story.id)
    setForm({
      title: story.title,
      competenciesText: story.competencies.join(', '),
      situation: story.situation ?? '',
      task: story.task ?? '',
      actionsText: story.actions.join('\n'),
      outcome: story.outcome ?? '',
      reflection: story.reflection ?? '',
      verifiedMetricsText: story.verified_metrics.join(', '),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    const competencies = form.competenciesText.split(',').map((c) => c.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean)
    if (!form.title.trim()) {
      toast.error('Give this story a title.')
      return
    }
    if (competencies.length === 0) {
      toast.error('Add at least one competency (comma-separated).')
      return
    }
    setSaving(true)
    const body = {
      title: form.title.trim(),
      competencies,
      situation: form.situation.trim() || null,
      task: form.task.trim() || null,
      actions: form.actionsText.split('\n').map((a) => a.trim()).filter(Boolean),
      outcome: form.outcome.trim() || null,
      reflection: form.reflection.trim() || null,
      verifiedMetrics: form.verifiedMetricsText.split(',').map((m) => m.trim()).filter(Boolean),
    }
    const res = await fetch(editingId ? `/api/interviews/story-bank/${editingId}` : '/api/interviews/story-bank', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(apiErrorMessage(json.error, 'Could not save story.'))
      setSaving(false)
      return
    }
    toast.success(editingId ? 'Story updated.' : 'Story saved.')
    setDialogOpen(false)
    setSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this story? This cannot be undone.')) return
    const res = await fetch(`/api/interviews/story-bank/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete story.')
      return
    }
    toast.success('Story deleted.')
    setStories((prev) => prev.filter((s) => s.id !== id))
  }

  const coveredCompetencies = new Set(stories.flatMap((s) => s.competencies))

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <Link href="/interviews" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Interview Lab
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Story Bank</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Your personal library of career stories. Interviewers constantly ask &ldquo;Tell me about a time you…&rdquo;  -  having
              your best moments pre-structured in STAR format (Situation, Task, Action, Result) means you answer faster,
              with more detail, and under less pressure. Save strong answers from your interviews here, or write new ones
              from your resume and portfolio.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Story</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Competency Coverage</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {CANONICAL_COMPETENCIES.map((c) => {
            const covered = coveredCompetencies.has(c)
            return (
              <span
                key={c}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border capitalize',
                  covered ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-border/60 text-muted-foreground'
                )}
              >
                {c.replace(/_/g, ' ')}
              </span>
            )
          })}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : stories.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No stories saved yet. Add one from a strong interview answer, a resume bullet, or a portfolio project.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {stories.map((s) => {
            const evidence = EVIDENCE_LABELS[s.evidence_status]
            return (
              <Card key={s.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{s.title}</p>
                        <Badge variant={evidence.variant}>{evidence.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.competencies.map((c) => (
                          <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-200 text-muted-foreground capitalize">{c.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                      {s.outcome && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.outcome}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-surface-100 p-4 text-xs text-muted-foreground flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <p>Stories are private to you. Showcase never invents facts to complete a story  -  only what you write here, or evidence you&apos;ve verified from your resume or portfolio, is ever used.</p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Story' : 'New Story'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="story-title">Title</Label>
              <Input id="story-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Leading the migration off the legacy API" className="mt-1.5" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="story-competencies">Competencies (comma-separated)</Label>
              <Input id="story-competencies" value={form.competenciesText} onChange={(e) => setForm({ ...form, competenciesText: e.target.value })} placeholder="ownership, conflict" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="story-situation">Situation</Label>
              <Textarea id="story-situation" value={form.situation} onChange={(e) => setForm({ ...form, situation: e.target.value })} placeholder="What was the context?" className="mt-1.5" maxLength={1000} />
            </div>
            <div>
              <Label htmlFor="story-task">Task</Label>
              <Textarea id="story-task" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} placeholder="What needed to happen?" className="mt-1.5" maxLength={1000} />
            </div>
            <div>
              <Label htmlFor="story-actions">Actions (one per line)</Label>
              <Textarea id="story-actions" value={form.actionsText} onChange={(e) => setForm({ ...form, actionsText: e.target.value })} placeholder="What did you personally do?" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="story-outcome">Outcome</Label>
              <Textarea id="story-outcome" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} placeholder="What was the result?" className="mt-1.5" maxLength={1000} />
            </div>
            <div>
              <Label htmlFor="story-reflection">Reflection</Label>
              <Textarea id="story-reflection" value={form.reflection} onChange={(e) => setForm({ ...form, reflection: e.target.value })} placeholder="What would you do differently?" className="mt-1.5" maxLength={1000} />
            </div>
            <div>
              <Label htmlFor="story-metrics">Verified metrics (comma-separated, optional)</Label>
              <Input id="story-metrics" value={form.verifiedMetricsText} onChange={(e) => setForm({ ...form, verifiedMetricsText: e.target.value })} placeholder="e.g. cut load time 40%" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Story'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
