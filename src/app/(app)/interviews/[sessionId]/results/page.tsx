'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Trash2, Info, Share2, Copy, X, RotateCcw, CheckCircle2, MinusCircle, BookmarkPlus, Dumbbell, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/utils'
import { recommendDrillsForDimensions } from '@/lib/interviews/drills'

interface RetryComparison {
  originalWordCount: number
  retryWordCount: number
  wordCountDelta: number
  observations: { label: string; changed: boolean }[]
}
interface RetryResult { retryAnswer: { answer_text: string }; previousAnswer: { answer_text: string }; comparison: RetryComparison }

interface Share {
  id: string
  scope: 'completion_only' | 'full_summary'
  expires_at: string
  revoked_at: string | null
  access_count: number
  created_at: string
}

interface TranscriptSegment { id: string; speaker: string; content: string; question_id: string | null }
interface Question { id: string; question_text: string; order_index: number; competency: string }
type Evaluation = { overall_score: number; readiness_band: string; result: { topFixes: string[]; strengths: string[] } } | null

interface SessionDetail {
  session: { id: string; status: string; target_role: string; session_type: string; analysis_status: string }
  questions: Question[]
  transcript: TranscriptSegment[]
  latestEvaluation: Evaluation
}

const BAND_LABELS: Record<string, string> = {
  starting: 'Starting', building: 'Building', practicing: 'Practicing',
  interview_ready: 'Interview Ready', strong: 'Strong',
}

export default function InterviewResultsPage() {
  const params = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [shares, setShares] = useState<Share[]>([])
  const [creatingShare, setCreatingShare] = useState(false)
  const [newShareLink, setNewShareLink] = useState<string | null>(null)
  const [retryingQuestionId, setRetryingQuestionId] = useState<string | null>(null)
  const [retryText, setRetryText] = useState('')
  const [submittingRetry, setSubmittingRetry] = useState(false)
  const [retryResults, setRetryResults] = useState<Record<string, RetryResult>>({})
  const [savedStoryQuestionIds, setSavedStoryQuestionIds] = useState<Set<string>>(new Set())

  async function loadShares() {
    const res = await fetch(`/api/interviews/sessions/${params.sessionId}/share`)
    const json = await res.json()
    if (res.ok) setShares(json.data ?? [])
  }

  async function handleCreateShare(scope: Share['scope']) {
    setCreatingShare(true)
    const res = await fetch(`/api/interviews/sessions/${params.sessionId}/share`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, expiresInDays: 30 }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(apiErrorMessage(json.error, 'Could not create share link.'))
      setCreatingShare(false)
      return
    }
    setNewShareLink(`${window.location.origin}/shared/${json.data.token}`)
    setCreatingShare(false)
    loadShares()
  }

  async function handleSubmitRetry(questionId: string) {
    if (!retryText.trim()) {
      toast.error('Write a retry answer before submitting.')
      return
    }
    setSubmittingRetry(true)
    const res = await fetch(`/api/interviews/sessions/${params.sessionId}/answers/${questionId}/retry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerText: retryText.trim() }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(apiErrorMessage(json.error, 'Could not submit retry.'))
      setSubmittingRetry(false)
      return
    }
    setRetryResults((prev) => ({ ...prev, [questionId]: json.data }))
    setRetryingQuestionId(null)
    setRetryText('')
    setSubmittingRetry(false)
  }

  async function handleSaveAsStory(question: Question, answerText: string) {
    const res = await fetch('/api/interviews/story-bank', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: question.question_text.slice(0, 200),
        competencies: [question.competency],
        outcome: answerText,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(apiErrorMessage(json.error, 'Could not save story.'))
      return
    }
    toast.success('Saved to your Story Bank.')
    setSavedStoryQuestionIds((prev) => new Set(prev).add(question.id))
  }

  async function handleRevokeShare(shareId: string) {
    const res = await fetch(`/api/interviews/shares/${shareId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not revoke link.')
      return
    }
    toast.success('Link revoked.')
    loadShares()
  }

  useEffect(() => {
    async function loadAndAnalyze() {
      const res = await fetch(`/api/interviews/sessions/${params.sessionId}`)
      const json = await res.json()
      if (!res.ok) {
        toast.error(apiErrorMessage(json.error, 'Could not load results.'))
        router.push('/interviews')
        return
      }
      setDetail(json.data)
      setLoading(false)
      if (json.data.session.status === 'completed') {
        const sharesRes = await fetch(`/api/interviews/sessions/${params.sessionId}/share`)
        const sharesJson = await sharesRes.json()
        if (sharesRes.ok) setShares(sharesJson.data ?? [])
      }

      if (json.data.session.analysis_status === 'pending') {
        setAnalyzing(true)
        const analyzeRes = await fetch(`/api/interviews/sessions/${params.sessionId}/analyze`, { method: 'POST' })
        const analyzeJson = await analyzeRes.json()
        if (analyzeRes.ok) {
          if (analyzeJson.message) setAnalysisMessage(analyzeJson.message)
          const refreshed = await fetch(`/api/interviews/sessions/${params.sessionId}`)
          const refreshedJson = await refreshed.json()
          if (refreshed.ok) setDetail(refreshedJson.data)
        }
        setAnalyzing(false)
      }
    }
    loadAndAnalyze()
  }, [params.sessionId, router])

  async function handleDeleteSession() {
    if (!confirm('Delete this session, its transcript, and all answers permanently?')) return
    setDeleting(true)
    const res = await fetch(`/api/interviews/sessions/${params.sessionId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      toast.error(apiErrorMessage(json.error, 'Could not delete session.'))
      setDeleting(false)
      return
    }
    toast.success('Session deleted.')
    router.push('/interviews')
  }

  if (loading || !detail) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const { session, questions, transcript, latestEvaluation } = detail

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight capitalize">{session.session_type.replace(/_/g, ' ')} Results</h1>
          <p className="text-sm text-muted-foreground mt-1">{session.target_role}</p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDeleteSession} disabled={deleting} className="gap-2">
          <Trash2 className="h-3.5 w-3.5" /> Delete session
        </Button>
      </div>

      {/* Readiness / analysis state */}
      <Card>
        <CardHeader><CardTitle className="text-base">Interview Readiness</CardTitle></CardHeader>
        <CardContent>
          {analyzing ? (
            <p className="text-sm text-muted-foreground">Analyzing your session…</p>
          ) : latestEvaluation ? (
            <>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-4xl font-bold text-foreground">{latestEvaluation.overall_score}</div>
                <Badge variant="info">{BAND_LABELS[latestEvaluation.readiness_band] ?? latestEvaluation.readiness_band}</Badge>
              </div>
              {latestEvaluation.result?.topFixes?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-foreground mb-2">Top fixes</p>
                  <ul className="space-y-1.5">
                    {latestEvaluation.result.topFixes.map((fix, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-brand-400">•</span>{fix}</li>
                    ))}
                  </ul>
                </div>
              )}
              {latestEvaluation.result?.strengths?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-foreground mb-2">What was strong</p>
                  <ul className="space-y-1.5">
                    {latestEvaluation.result.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-emerald-400">•</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{analysisMessage ?? 'AI-powered evidence analysis is not yet enabled for Showcase Interview Lab. Your transcript and answers below are saved and reviewable, but a scored evaluation is not available yet.'}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground/70 mt-4 border-t border-border/60 pt-3">
            Interview Readiness is a structured practice diagnostic based on your answers in Showcase. It is not a hiring prediction.
          </p>
        </CardContent>
      </Card>

      {/* Question-by-question transcript */}
      <Card>
        <CardHeader><CardTitle className="text-base">Transcript</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {questions.map((q) => {
            const answer = transcript.find((t) => t.question_id === q.id && t.speaker === 'candidate')
            const retryResult = retryResults[q.id]
            return (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                <p className="text-sm text-muted-foreground bg-surface-100 rounded-xl p-3">{answer?.content ?? '(not answered)'}</p>

                {session.status === 'completed' && answer && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {!retryResult && retryingQuestionId !== q.id && (
                      <Button size="sm" variant="ghost" onClick={() => { setRetryingQuestionId(q.id); setRetryText('') }} className="gap-1.5 h-7 text-xs">
                        <RotateCcw className="h-3 w-3" /> Retry this answer
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost" disabled={savedStoryQuestionIds.has(q.id)}
                      onClick={() => handleSaveAsStory(q, answer.content)}
                      className="gap-1.5 h-7 text-xs"
                    >
                      <BookmarkPlus className="h-3 w-3" /> {savedStoryQuestionIds.has(q.id) ? 'Saved to Story Bank' : 'Save as Story'}
                    </Button>
                  </div>
                )}

                {retryingQuestionId === q.id && (
                  <div className="space-y-2 pl-3 border-l-2 border-brand-500/30">
                    <Textarea value={retryText} onChange={(e) => setRetryText(e.target.value)} placeholder="Try answering again..." className="min-h-[100px]" maxLength={10000} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setRetryingQuestionId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => handleSubmitRetry(q.id)} disabled={submittingRetry}>{submittingRetry ? 'Comparing…' : 'Submit Retry'}</Button>
                    </div>
                  </div>
                )}

                {retryResult && (
                  <div className="rounded-xl border border-border/60 bg-surface-100 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">Retry comparison</p>
                    <p className="text-sm text-foreground">{retryResult.retryAnswer.answer_text}</p>
                    <div className="space-y-1 pt-2 border-t border-border/60">
                      {retryResult.comparison.observations.map((o, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {o.changed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" /> : <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />}
                          <span className={o.changed ? 'text-foreground' : 'text-muted-foreground'}>{o.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground/70 pt-1">These are objective text comparisons, not an AI quality judgment. Both attempts are saved — your original answer was never overwritten.</p>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Recommended practice */}
      {session.status === 'completed' && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Dumbbell className="h-4 w-4" /> Practice Next</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {latestEvaluation
                ? 'Drills targeted at your weakest scored dimensions from this session.'
                : 'General practice recommendations — these aren\'t personalized to this session yet, since AI-powered scoring isn\'t enabled.'}
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {recommendDrillsForDimensions([]).map((d) => (
                <Link key={d.id} href="/interviews/drills" className="rounded-xl border border-border/60 p-3 hover:bg-surface-200 transition-colors">
                  <p className="text-sm font-medium text-foreground">{d.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.objective}</p>
                </Link>
              ))}
            </div>
            <Link href="/interviews/drills" className="text-xs text-brand-400 hover:underline inline-flex items-center gap-1">
              See all drills <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Private, revocable sharing */}
      {session.status === 'completed' && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Share2 className="h-4 w-4" /> Share This Report</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Private by default. A share link never includes your transcript or audio. You control what level of detail is shared, and you can revoke any link at any time.
            </p>
            {newShareLink && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <p className="text-xs text-foreground font-medium">Link created — copy it now, it won&apos;t be shown again:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground bg-surface-100 rounded-lg px-2 py-1.5 flex-1 truncate">{newShareLink}</code>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(newShareLink); toast.success('Copied.') }}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" disabled={creatingShare} onClick={() => handleCreateShare('completion_only')}>Share completion only</Button>
              <Button size="sm" variant="outline" disabled={creatingShare} onClick={() => handleCreateShare('full_summary')}>Share full summary</Button>
            </div>
            {shares.filter((s) => !s.revoked_at).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-xs font-medium text-foreground">Active links</p>
                {shares.filter((s) => !s.revoked_at).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{s.scope === 'full_summary' ? 'Full summary' : 'Completion only'} · expires {new Date(s.expires_at).toLocaleDateString()} · viewed {s.access_count}x</span>
                    <Button size="sm" variant="ghost" onClick={() => handleRevokeShare(s.id)} className="gap-1 h-7"><X className="h-3 w-3" /> Revoke</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
