'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Trash2, Info, Share2, Copy, X, RotateCcw, CheckCircle2, MinusCircle,
  BookmarkPlus, Dumbbell, ArrowRight, ChevronDown, ChevronUp, Sparkles, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/utils'
import { recommendDrillsForDimensions } from '@/lib/interviews/drills'
import { DIMENSION_REGISTRY } from '@/lib/interviews/rubrics'

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

interface AnswerAssessment {
  questionId: string
  strongMoments: { segmentId: string; note: string }[]
  weakMoments: { segmentId: string | null; note: string }[]
  missingEvidence: string[]
  suggestedStructure: string | null
}

type Evaluation = {
  overall_score: number
  readiness_band: string
  result: {
    topFixes: string[]
    strengths: string[]
    answerAssessments?: AnswerAssessment[]
  }
} | null

interface DimensionScore {
  dimension_id: string
  score: number
  weight: number
  explanation: string | null
  confidence: 'low' | 'medium' | 'high' | null
}

interface SessionDetail {
  session: { id: string; status: string; target_role: string; session_type: string; analysis_status: string }
  questions: Question[]
  transcript: TranscriptSegment[]
  latestEvaluation: Evaluation
  dimensionScores: DimensionScore[]
}

const BAND_LABELS: Record<string, string> = {
  starting: 'Starting', building: 'Building', practicing: 'Practicing',
  interview_ready: 'Interview Ready', strong: 'Strong',
}
const BAND_COLORS: Record<string, string> = {
  starting: 'text-red-400', building: 'text-orange-400', practicing: 'text-yellow-400',
  interview_ready: 'text-emerald-400', strong: 'text-emerald-400',
}
const CONFIDENCE_LABELS: Record<string, string> = { low: 'Low data', medium: 'Medium data', high: 'High data' }

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score))
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 55 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-foreground w-7 text-right">{score}</span>
    </div>
  )
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
  const [expandedCoaching, setExpandedCoaching] = useState<Set<string>>(new Set())

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
    if (!res.ok) { toast.error(apiErrorMessage(json.error, 'Could not create share link.')); setCreatingShare(false); return }
    setNewShareLink(`${window.location.origin}/shared/${json.data.token}`)
    setCreatingShare(false)
    loadShares()
  }

  async function handleSubmitRetry(questionId: string) {
    if (!retryText.trim()) { toast.error('Write a retry answer before submitting.'); return }
    setSubmittingRetry(true)
    const res = await fetch(`/api/interviews/sessions/${params.sessionId}/answers/${questionId}/retry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerText: retryText.trim() }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(apiErrorMessage(json.error, 'Could not submit retry.')); setSubmittingRetry(false); return }
    setRetryResults((prev) => ({ ...prev, [questionId]: json.data }))
    setRetryingQuestionId(null); setRetryText(''); setSubmittingRetry(false)
  }

  async function handleSaveAsStory(question: Question, answerText: string) {
    const res = await fetch('/api/interviews/story-bank', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: question.question_text.slice(0, 200), competencies: [question.competency], outcome: answerText }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(apiErrorMessage(json.error, 'Could not save story.')); return }
    toast.success('Saved to your Story Bank.')
    setSavedStoryQuestionIds((prev) => new Set(prev).add(question.id))
  }

  async function handleRevokeShare(shareId: string) {
    const res = await fetch(`/api/interviews/shares/${shareId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Could not revoke link.'); return }
    toast.success('Link revoked.'); loadShares()
  }

  async function runAnalysis() {
    setAnalyzing(true)
    const analyzeRes = await fetch(`/api/interviews/sessions/${params.sessionId}/analyze`, { method: 'POST' })
    const analyzeJson = await analyzeRes.json()
    if (analyzeRes.ok) {
      if (analyzeJson.message) setAnalysisMessage(analyzeJson.message)
      const refreshed = await fetch(`/api/interviews/sessions/${params.sessionId}`)
      const refreshedJson = await refreshed.json()
      if (refreshed.ok) setDetail(refreshedJson.data)
    } else {
      toast.error(apiErrorMessage(analyzeJson.error, 'Scoring failed. Try again.'))
    }
    setAnalyzing(false)
  }

  useEffect(() => {
    async function loadAndAnalyze() {
      const res = await fetch(`/api/interviews/sessions/${params.sessionId}`)
      const json = await res.json()
      if (!res.ok) { toast.error(apiErrorMessage(json.error, 'Could not load results.')); router.push('/interviews'); return }
      setDetail(json.data)
      setLoading(false)
      if (json.data.session.status === 'completed') {
        const sharesRes = await fetch(`/api/interviews/sessions/${params.sessionId}/share`)
        const sharesJson = await sharesRes.json()
        if (sharesRes.ok) setShares(sharesJson.data ?? [])
      }
      if (json.data.session.analysis_status === 'pending') {
        await runAnalysis()
      }
    }
    loadAndAnalyze()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sessionId])

  async function handleDeleteSession() {
    if (!confirm('Delete this session, its transcript, and all answers permanently?')) return
    setDeleting(true)
    const res = await fetch(`/api/interviews/sessions/${params.sessionId}`, { method: 'DELETE' })
    if (!res.ok) { const json = await res.json(); toast.error(apiErrorMessage(json.error, 'Could not delete session.')); setDeleting(false); return }
    toast.success('Session deleted.'); router.push('/interviews')
  }

  if (loading || !detail) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  const { session, questions, transcript, latestEvaluation, dimensionScores } = detail
  const weakDimensionIds = dimensionScores.filter((d) => d.score < 70).sort((a, b) => a.score - b.score).map((d) => d.dimension_id)
  const answerAssessments = latestEvaluation?.result?.answerAssessments ?? []
  const assessmentByQuestionId = new Map(answerAssessments.map((a) => [a.questionId, a]))

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight capitalize">{session.session_type.replace(/_/g, ' ')} Results</h1>
          <p className="text-sm text-muted-foreground mt-1">{session.target_role}</p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDeleteSession} disabled={deleting} className="gap-2">
          <Trash2 className="h-3.5 w-3.5" /> Delete session
        </Button>
      </div>

      {/* Score / analysis state */}
      <Card>
        <CardHeader><CardTitle className="text-base">Interview Readiness</CardTitle></CardHeader>
        <CardContent>
          {analyzing ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-4 w-4 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
              Analyzing your session — this takes about 15-30 seconds…
            </div>
          ) : session.analysis_status === 'failed' || session.analysis_status === 'skipped' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {session.analysis_status === 'failed'
                  ? 'AI scoring ran into an error on this session. Your transcript is saved — you can retry below.'
                  : 'AI scoring wasn\'t available when this session completed. You can run it now.'}
              </p>
              <Button size="sm" onClick={runAnalysis}>Retry AI Scoring</Button>
            </div>
          ) : latestEvaluation ? (
            <>
              {/* Score + band */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-5xl font-bold text-foreground">{latestEvaluation.overall_score}</div>
                <div>
                  <div className={`text-lg font-semibold ${BAND_COLORS[latestEvaluation.readiness_band] ?? 'text-foreground'}`}>
                    {BAND_LABELS[latestEvaluation.readiness_band] ?? latestEvaluation.readiness_band}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">out of 100 · based on {dimensionScores.length} dimension{dimensionScores.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Top fixes */}
              {latestEvaluation.result?.topFixes?.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Top things to improve</p>
                  <ul className="space-y-2">
                    {latestEvaluation.result.topFixes.map((fix, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2.5">
                        <AlertCircle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                        {fix}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths */}
              {latestEvaluation.result?.strengths?.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">What was strong</p>
                  <ul className="space-y-2">
                    {latestEvaluation.result.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{analysisMessage ?? 'AI-powered evidence analysis is not yet enabled for Showcase Interview Lab.'}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4 border-t border-border/60 pt-3">
            Interview Readiness is a structured practice diagnostic based on your answers. It is not a hiring prediction.
          </p>
        </CardContent>
      </Card>

      {/* Dimension breakdown */}
      {dimensionScores.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Skill Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {dimensionScores
              .sort((a, b) => a.score - b.score)
              .map((d) => {
                const def = DIMENSION_REGISTRY[d.dimension_id as keyof typeof DIMENSION_REGISTRY]
                const label = def?.label ?? d.dimension_id.replace(/_/g, ' ')
                return (
                  <div key={d.dimension_id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground capitalize">{label}</span>
                      {d.confidence && (
                        <span className="text-[10px] text-muted-foreground/60">{CONFIDENCE_LABELS[d.confidence]}</span>
                      )}
                    </div>
                    <ScoreBar score={d.score} />
                    {d.explanation && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{d.explanation}</p>
                    )}
                  </div>
                )
              })}
          </CardContent>
        </Card>
      )}

      {/* Per-question coaching */}
      <Card>
        <CardHeader><CardTitle className="text-base">Your Answers + AI Coaching</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q) => {
            const answer = transcript.find((t) => t.question_id === q.id && t.speaker === 'candidate')
            const coaching = assessmentByQuestionId.get(q.id)
            const retryResult = retryResults[q.id]
            const coachingOpen = expandedCoaching.has(q.id)
            const hasCoaching = coaching && (
              coaching.strongMoments.length > 0 || coaching.weakMoments.length > 0 ||
              coaching.missingEvidence.length > 0 || coaching.suggestedStructure
            )

            return (
              <div key={q.id} className="space-y-3 pb-6 border-b border-border/40 last:border-0 last:pb-0">
                {/* Question */}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground/50 mt-1.5 shrink-0">Q{q.order_index + 1}</span>
                  <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                </div>

                {/* Answer */}
                <div className="ml-5">
                  <p className="text-sm text-muted-foreground bg-surface-100 rounded-xl p-3 leading-relaxed">
                    {answer?.content ?? <span className="italic opacity-60">(not answered)</span>}
                  </p>
                </div>

                {/* AI coaching toggle */}
                {hasCoaching && (
                  <div className="ml-5 space-y-2">
                    <button
                      onClick={() => setExpandedCoaching((prev) => {
                        const next = new Set(prev)
                        if (next.has(q.id)) next.delete(q.id); else next.add(q.id)
                        return next
                      })}
                      className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI coaching
                      {coachingOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {coachingOpen && (
                      <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 space-y-4">
                        {/* Strong moments */}
                        {coaching.strongMoments.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">What worked</p>
                            {coaching.strongMoments.map((m, i) => (
                              <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                {m.note}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Weak moments */}
                        {coaching.weakMoments.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">What to fix</p>
                            {coaching.weakMoments.map((m, i) => (
                              <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                                <AlertCircle className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                                {m.note}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Missing evidence */}
                        {coaching.missingEvidence.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Missing</p>
                            {coaching.missingEvidence.map((m, i) => (
                              <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                                <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                                {m}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Suggested rewrite */}
                        {coaching.suggestedStructure && (
                          <div className="space-y-1.5 border-t border-border/40 pt-3">
                            <p className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">Stronger version — say something like this</p>
                            <p className="text-sm text-foreground leading-relaxed italic">&ldquo;{coaching.suggestedStructure}&rdquo;</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {session.status === 'completed' && answer && (
                  <div className="ml-5 flex items-center gap-1 flex-wrap">
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
                      <BookmarkPlus className="h-3 w-3" />
                      {savedStoryQuestionIds.has(q.id) ? 'Saved to Story Bank' : 'Save as Story'}
                    </Button>
                  </div>
                )}

                {/* Retry answer form */}
                {retryingQuestionId === q.id && (
                  <div className="ml-5 space-y-2 pl-3 border-l-2 border-brand-500/30">
                    <Textarea value={retryText} onChange={(e) => setRetryText(e.target.value)} placeholder="Try answering again…" className="min-h-[100px]" maxLength={10000} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setRetryingQuestionId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => handleSubmitRetry(q.id)} disabled={submittingRetry}>{submittingRetry ? 'Comparing…' : 'Submit Retry'}</Button>
                    </div>
                  </div>
                )}

                {/* Retry result */}
                {retryResult && (
                  <div className="ml-5 rounded-xl border border-border/60 bg-surface-100 p-3 space-y-2">
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
                    <p className="text-xs text-muted-foreground pt-1">Objective text comparison — both attempts are saved.</p>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Story Bank explainer */}
      <Card>
        <CardContent className="p-5">
          <div className="flex gap-3">
            <BookmarkPlus className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">What is the Story Bank?</p>
              <p className="text-sm text-muted-foreground">
                It&apos;s a personal library of your strongest career stories — moments from your work history that
                demonstrate specific skills like leadership, conflict resolution, or delivering results under pressure.
                Interviewers use behavioral questions (&ldquo;Tell me about a time you…&rdquo;) constantly, and having your
                best stories pre-structured in STAR format (Situation, Task, Action, Result) means you answer faster
                and more precisely. When you click &ldquo;Save as Story&rdquo; on a good answer above, it goes here and becomes
                available for future sessions.
              </p>
              <Link href="/interviews/story-bank" className="text-xs text-brand-400 hover:underline inline-flex items-center gap-1 mt-1">
                View your Story Bank <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Practice recommendations */}
      {session.status === 'completed' && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Dumbbell className="h-4 w-4" /> Practice Next</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {weakDimensionIds.length > 0
                ? 'Drills targeting your lowest-scored dimensions from this session.'
                : latestEvaluation
                  ? 'You scored well across every dimension — general recommendations below.'
                  : 'General practice recommendations.'}
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {recommendDrillsForDimensions(weakDimensionIds).map((d) => (
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

      {/* Share */}
      {session.status === 'completed' && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Share2 className="h-4 w-4" /> Share This Report</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Private by default. Share links never include your transcript or audio. You control what&apos;s shared and can revoke any link at any time.
            </p>
            {newShareLink && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <p className="text-xs text-foreground font-medium">Link created — copy it now:</p>
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
