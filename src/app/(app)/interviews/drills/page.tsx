'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { apiErrorMessage } from '@/lib/utils'

interface DrillRecord {
  id: string
  attempt_count: number
  best_score: number | null
  status: string
}

interface Drill {
  id: string
  label: string
  competency: string
  objective: string
  instructions: string
  prompt: string
  timeLimitSeconds: number
  minWords: number
  maxWords: number
  record: DrillRecord | null
}

interface CheckItem { label: string; passed: boolean }
interface AttemptResult { passed: boolean; score: number; checks: CheckItem[] }

export default function DrillsPage() {
  const [drills, setDrills] = useState<Drill[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Drill | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AttemptResult | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const res = await fetch('/api/interviews/drills')
    const json = await res.json()
    if (res.ok) setDrills(json.data ?? [])
    setLoading(false)
  }

  function openDrill(drill: Drill) {
    setActive(drill)
    setAnswerText('')
    setResult(null)
  }

  async function handleSubmit() {
    if (!active) return
    if (!answerText.trim()) {
      toast.error('Write an answer before submitting.')
      return
    }
    setSubmitting(true)
    const res = await fetch(`/api/interviews/drills/${active.id}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerText: answerText.trim() }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(apiErrorMessage(json.error, 'Could not submit attempt.'))
      setSubmitting(false)
      return
    }
    setResult(json.data.result)
    setSubmitting(false)
    load()
  }

  const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <Link href="/interviews" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Interview Lab
        </Link>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Drills</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Short, focused exercises on one skill at a time. Checks here are simple and mechanical — length, structure, specific words — not an AI judgment of quality.
        </p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          <Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {drills.map((d) => (
            <button key={d.id} type="button" onClick={() => openDrill(d)} className="text-left">
              <Card className="h-full hover:bg-surface-200 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{d.label}</p>
                    {d.record?.best_score != null && <Badge variant="info">{d.record.best_score}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{d.objective}</p>
                  <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> ~{d.timeLimitSeconds}s</span>
                    {d.record && <span>{d.record.attempt_count} attempt{d.record.attempt_count === 1 ? '' : 's'}</span>}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.label}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">{active.instructions}</p>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Prompt</CardTitle></CardHeader><CardContent className="text-sm text-foreground">{active.prompt}</CardContent></Card>

                {!result ? (
                  <>
                    <Textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="Type your answer..."
                      className="min-h-[160px]"
                      maxLength={5000}
                    />
                    <p className="text-xs text-muted-foreground">{wordCount} words · target {active.minWords}-{active.maxWords}</p>
                  </>
                ) : (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Result: {result.score}/100</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {result.checks.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          {c.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />}
                          <span className={c.passed ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
              <DialogFooter>
                {result ? (
                  <>
                    <Button variant="ghost" onClick={() => setActive(null)}>Done</Button>
                    <Button onClick={() => { setResult(null); setAnswerText('') }}>Try Again</Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setActive(null)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Checking…' : 'Submit'}</Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
