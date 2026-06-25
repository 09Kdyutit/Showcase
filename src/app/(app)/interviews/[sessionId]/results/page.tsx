'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Trash2, Info, Share2, Copy, X, RotateCcw, CheckCircle2, MinusCircle,
  Dumbbell, ArrowRight, ChevronDown, ChevronUp, Sparkles, AlertCircle,
  Target, Search, FileText, User, Zap, TrendingUp, LayoutList,
  Code2, BrainCircuit, MessageCircle, Timer, Mic, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/utils'
import { recommendDrillsForDimensions } from '@/lib/interviews/drills'
import { DIMENSION_REGISTRY } from '@/lib/interviews/rubrics'
import type { LucideIcon } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface RetryComparison {
  originalWordCount: number; retryWordCount: number; wordCountDelta: number
  observations: { label: string; changed: boolean }[]
}
interface RetryResult { retryAnswer: { answer_text: string }; previousAnswer: { answer_text: string }; comparison: RetryComparison }
interface Share { id: string; scope: 'completion_only' | 'full_summary'; expires_at: string; revoked_at: string | null; access_count: number; created_at: string }
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
  result: { summaryParagraph?: string; topFixes: string[]; strengths: string[]; answerAssessments?: AnswerAssessment[] }
} | null
interface DimensionScore {
  dimension_id: string; score: number; weight: number
  explanation: string | null; confidence: 'low' | 'medium' | 'high' | null
}
interface SessionDetail {
  session: { id: string; status: string; target_role: string; session_type: string; analysis_status: string }
  questions: Question[]; transcript: TranscriptSegment[]
  latestEvaluation: Evaluation; dimensionScores: DimensionScore[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const BAND_LABELS: Record<string, string> = {
  starting: 'Starting', building: 'Building', practicing: 'Practicing',
  interview_ready: 'Interview Ready', strong: 'Strong',
}
const BAND_COLORS: Record<string, string> = {
  starting: 'text-red-400', building: 'text-orange-400', practicing: 'text-yellow-400',
  interview_ready: 'text-emerald-400', strong: 'text-emerald-400',
}

const DIMENSION_ICONS: Record<string, LucideIcon> = {
  answer_relevance: Target, evidence_specificity: Search, context_clarity: FileText,
  personal_ownership: User, action_quality: Zap, outcome_and_impact: TrendingUp,
  answer_structure: LayoutList, role_technical_depth: Code2, problem_solving_process: BrainCircuit,
  follow_up_handling: MessageCircle, concision: Timer, delivery_mechanics: Mic,
}

const FILLER_PATTERNS = [
  /\bum+\b/gi, /\buh+\b/gi, /\bhmm+\b/gi,
  /\byou know\b/gi, /\bbasically\b/gi, /\bliterally\b/gi,
  /\bsort of\b/gi, /\bkind of\b/gi, /\bi mean\b/gi,
]

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'that', 'this',
  'these', 'those', 'it', 'its', 'i', 'my', 'me', 'we', 'our', 'you', 'your', 'they',
  'their', 'so', 'if', 'then', 'when', 'where', 'how', 'what', 'which', 'who', 'not', 'no',
  'as', 'by', 'from', 'into', 'more', 'also', 'just', 'about', 'up', 'out', 'there', 'all',
  'some', 'other', 'than', 'through', 'very', 'said', 'think', 'know', 'get', 'got', 'one',
  'two', 'three', 'well', 'really', 'going', 'use', 'used', 'make', 'made', 'need', 'want',
  'way', 'able', 'try', 'tried', 'like', 'um', 'uh', 'hmm', 'okay', 'right', 'yeah', 'yes',
  'actually', 'because', 'here', 'had', 'see', 'come', 'now', 'look', 'over', 'think',
])

// ── Helper functions ──────────────────────────────────────────────────────────

function scoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Strong', color: 'text-emerald-400', bg: 'bg-emerald-500' }
  if (score >= 65) return { label: 'Good', color: 'text-yellow-400', bg: 'bg-yellow-500' }
  if (score >= 50) return { label: 'Moderate', color: 'text-orange-400', bg: 'bg-orange-500' }
  return { label: 'Needs Improvement', color: 'text-red-400', bg: 'bg-red-500' }
}

function fillerQuality(count: number, wordCount: number): { label: string; color: string } {
  const rate = wordCount > 0 ? count / wordCount : 0
  if (rate < 0.015) return { label: 'Excellent control', color: 'text-emerald-400' }
  if (rate < 0.04) return { label: 'Good', color: 'text-yellow-400' }
  if (rate < 0.08) return { label: 'Work on reducing', color: 'text-orange-400' }
  return { label: 'Needs focused practice', color: 'text-red-400' }
}

function computeDelivery(transcript: TranscriptSegment[]) {
  const candidateSegments = transcript.filter((t) => t.speaker === 'candidate')
  const allText = candidateSegments.map((t) => t.content).join(' ')

  let fillerCount = 0
  for (const p of FILLER_PATTERNS) fillerCount += (allText.match(p) ?? []).length

  const wordCount = allText.trim().split(/\s+/).filter(Boolean).length

  const words = allText.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? []
  const freq: Record<string, number> = {}
  for (const w of words) {
    if (!STOP_WORDS.has(w)) freq[w] = (freq[w] ?? 0) + 1
  }
  const keywords = Object.entries(freq)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 22)
    .map(([word, count]) => ({ word, count }))

  return { fillerCount, wordCount, keywords }
}

function computeResponseDistribution(questions: Question[], transcript: TranscriptSegment[]) {
  const counts = questions.map((q) => {
    const seg = transcript.find((t) => t.question_id === q.id && t.speaker === 'candidate')
    if (!seg?.content) return null
    return seg.content.trim().split(/\s+/).filter(Boolean).length
  }).filter((n): n is number => n !== null)

  return {
    under50: counts.filter((n) => n < 50).length,
    between: counts.filter((n) => n >= 50 && n <= 100).length,
    over100: counts.filter((n) => n > 100).length,
    total: counts.length,
    avg: counts.length > 0 ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : 0,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-surface-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <span className="text-sm font-mono font-medium text-foreground w-9 text-right">{score}%</span>
    </div>
  )
}

function DistBar({ value, max, label, count }: { value: number; max: number; label: string; count: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-surface-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-foreground w-4 text-right">{count}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
  const [expandedCoaching, setExpandedCoaching] = useState<Set<string>>(new Set())

  async function loadShares() {
    const res = await fetch(`/api/interviews/sessions/${params.sessionId}/share`)
    const json = await res.json()
    if (res.ok) setShares(json.data ?? [])
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
    async function load() {
      const res = await fetch(`/api/interviews/sessions/${params.sessionId}`)
      const json = await res.json()
      if (!res.ok) { toast.error(apiErrorMessage(json.error, 'Could not load results.')); router.push('/interviews'); return }
      setDetail(json.data)
      setLoading(false)
      if (json.data.session.status === 'completed') loadShares()
      if (json.data.session.analysis_status === 'pending') await runAnalysis()
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sessionId])

  async function handleSubmitRetry(questionId: string) {
    if (!retryText.trim()) { toast.error('Write a retry answer first.'); return }
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

  async function handleDeleteSession() {
    if (!confirm('Delete this session, transcript, and all answers permanently?')) return
    setDeleting(true)
    const res = await fetch(`/api/interviews/sessions/${params.sessionId}`, { method: 'DELETE' })
    if (!res.ok) { const j = await res.json(); toast.error(apiErrorMessage(j.error, 'Could not delete.')); setDeleting(false); return }
    toast.success('Session deleted.'); router.push('/interviews')
  }

  const delivery = useMemo(() => detail ? computeDelivery(detail.transcript) : null, [detail])
  const responseDist = useMemo(() => detail ? computeResponseDistribution(detail.questions, detail.transcript) : null, [detail])

  if (loading || !detail) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-4">
        <Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /><Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const { session, questions, transcript, latestEvaluation, dimensionScores } = detail
  const weakDimensionIds = dimensionScores.filter((d) => d.score < 70).sort((a, b) => a.score - b.score).map((d) => d.dimension_id)
  const answerAssessments = latestEvaluation?.result?.answerAssessments ?? []
  const assessmentByQuestionId = new Map(answerAssessments.map((a) => [a.questionId, a]))
  const hasAnalysis = !!latestEvaluation

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight capitalize">
            {session.session_type.replace(/_/g, ' ')} Results
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{session.target_role}</p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDeleteSession} disabled={deleting} className="gap-2">
          <Trash2 className="h-3.5 w-3.5" /> Delete session
        </Button>
      </div>

      {/* ── Main score card ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          {analyzing ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
              <div className="h-4 w-4 rounded-full border-2 border-brand-400 border-t-transparent animate-spin shrink-0" />
              Analyzing your session — this takes 15–30 seconds…
            </div>
          ) : session.analysis_status === 'failed' || session.analysis_status === 'skipped' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{session.analysis_status === 'failed'
                  ? 'AI scoring ran into an error. Your transcript is saved — you can retry below.'
                  : 'AI scoring wasn\'t available when this session completed.'}</p>
              </div>
              <Button size="sm" onClick={runAnalysis} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Run AI Scoring</Button>
            </div>
          ) : latestEvaluation ? (
            <div className="space-y-6">
              {/* Score */}
              <div className="flex items-end gap-5 flex-wrap">
                <div>
                  <div className="text-6xl font-bold text-foreground leading-none">{latestEvaluation.overall_score}</div>
                  <div className="text-xs text-muted-foreground mt-1">out of 100</div>
                </div>
                <div className="mb-1">
                  <div className={`text-xl font-semibold ${BAND_COLORS[latestEvaluation.readiness_band] ?? 'text-foreground'}`}>
                    {BAND_LABELS[latestEvaluation.readiness_band] ?? latestEvaluation.readiness_band}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">across {dimensionScores.length} skill dimension{dimensionScores.length !== 1 ? 's' : ''}</div>
                </div>
              </div>

              {/* Summary paragraph */}
              {latestEvaluation.result?.summaryParagraph && (
                <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-brand-500/40 pl-4 italic">
                  {latestEvaluation.result.summaryParagraph}
                </p>
              )}

              {/* Strengths / Next steps side by side */}
              <div className="grid sm:grid-cols-2 gap-5">
                {latestEvaluation.result?.strengths?.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">What you did well</p>
                    <ul className="space-y-2">
                      {latestEvaluation.result.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2.5 leading-relaxed">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {latestEvaluation.result?.topFixes?.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Next steps</p>
                    <ul className="space-y-2">
                      {latestEvaluation.result.topFixes.map((fix, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2.5 leading-relaxed">
                          <AlertCircle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />{fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{analysisMessage ?? 'AI-powered analysis is not yet available for this session.'}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-6 border-t border-border/60 pt-3">
            Interview Readiness is a structured practice diagnostic. It is not a hiring prediction.
          </p>
        </CardContent>
      </Card>

      {/* ── Skill breakdown ─────────────────────────────────────────────────── */}
      {dimensionScores.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Skill Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {dimensionScores
              .sort((a, b) => b.score - a.score)
              .map((d) => {
                const def = DIMENSION_REGISTRY[d.dimension_id as keyof typeof DIMENSION_REGISTRY]
                const label = def?.label ?? d.dimension_id.replace(/_/g, ' ')
                const { label: scoreL, color, bg } = scoreLabel(d.score)
                const Icon = DIMENSION_ICONS[d.dimension_id] ?? Target
                return (
                  <div key={d.dimension_id} className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-surface-200 flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground capitalize">{label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-medium ${color}`}>{scoreL}</span>
                            {d.confidence && (
                              <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
                                {d.confidence === 'low' ? '· low data' : d.confidence === 'high' ? '· high data' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pl-9.5">
                      <ScoreBar score={d.score} color={bg} />
                      {d.explanation && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{d.explanation}</p>
                      )}
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      )}

      {/* ── Delivery analysis ────────────────────────────────────────────────── */}
      {delivery && session.status === 'completed' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Delivery Signals</CardTitle></CardHeader>
          <CardContent className="space-y-6">

            {/* Filler words */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Filler word count</p>
                <div className="text-right">
                  <span className="text-lg font-bold text-foreground">{delivery.fillerCount}</span>
                  <span className={`text-xs ml-2 ${fillerQuality(delivery.fillerCount, delivery.wordCount).color}`}>
                    {fillerQuality(delivery.fillerCount, delivery.wordCount).label}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Counts &ldquo;um,&rdquo; &ldquo;uh,&rdquo; &ldquo;you know,&rdquo; &ldquo;I mean,&rdquo; &ldquo;sort of,&rdquo; &ldquo;kind of,&rdquo; and similar
                filler words across your answers. Frequent fillers signal hesitation or lack of structure to interviewers —
                even technically strong candidates lose credibility with high filler rates.
              </p>
            </div>

            {/* Response length distribution */}
            {responseDist && responseDist.total > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Response length distribution</p>
                  <span className="text-xs text-muted-foreground">avg {responseDist.avg} words</span>
                </div>
                <div className="space-y-2">
                  <DistBar label="Under 50 words" value={responseDist.under50} max={responseDist.total} count={responseDist.under50} />
                  <DistBar label="50 – 100 words" value={responseDist.between} max={responseDist.total} count={responseDist.between} />
                  <DistBar label="Over 100 words" value={responseDist.over100} max={responseDist.total} count={responseDist.over100} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Most strong interview answers land between 60-120 words — specific enough to show depth, short enough to
                  not lose the interviewer. Under 50 words often signals a missed opportunity; over 150 can signal rambling.
                </p>
              </div>
            )}

            {/* Keyword heatmap */}
            {delivery.keywords.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Keyword heatmap</p>
                  <span className="text-xs text-muted-foreground">from your answers — darker = used more</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {delivery.keywords.map(({ word, count }, i) => {
                    const maxCount = delivery.keywords[0]?.count ?? 1
                    const intensity = count / maxCount
                    const opacity = 0.2 + intensity * 0.8
                    return (
                      <div
                        key={word}
                        className="text-xs px-2.5 py-1.5 rounded-lg text-white font-medium"
                        style={{ backgroundColor: `rgba(159, 112, 255, ${opacity})` }}
                        title={`${count} mention${count !== 1 ? 's' : ''}`}
                      >
                        {word}
                        {i < 8 && <span className="ml-1.5 opacity-70 text-[10px]">{count}</span>}
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Topics you mentioned most across all your answers. Heavy repetition of a single keyword can indicate
                  over-reliance on one concept — interviewers value range and specificity.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Per-question coaching ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Answers</CardTitle>
          {hasAnalysis && (
            <p className="text-xs text-muted-foreground mt-0.5">Click &ldquo;AI coaching&rdquo; under each answer for specific, personalized feedback.</p>
          )}
        </CardHeader>
        <CardContent className="space-y-7">
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
              <div key={q.id} className="space-y-3 pb-7 border-b border-border/40 last:border-0 last:pb-0">
                {/* Question */}
                <div className="flex items-start gap-2.5">
                  <span className="text-[11px] font-mono text-muted-foreground/50 mt-1 shrink-0 w-6">Q{q.order_index + 1}</span>
                  <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                </div>

                {/* Answer */}
                <div className="ml-8">
                  <p className="text-sm text-muted-foreground bg-surface-100 rounded-xl p-3.5 leading-relaxed">
                    {answer?.content ?? <span className="italic opacity-50">(not answered)</span>}
                  </p>
                </div>

                {/* AI coaching expand */}
                {hasCoaching && (
                  <div className="ml-8 space-y-2">
                    <button
                      onClick={() => setExpandedCoaching((prev) => {
                        const next = new Set(prev); if (next.has(q.id)) next.delete(q.id); else next.add(q.id); return next
                      })}
                      className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI coaching
                      {coachingOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {coachingOpen && (
                      <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.04] p-4 space-y-5">
                        {coaching.strongMoments.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">What worked</p>
                            {coaching.strongMoments.map((m, i) => (
                              <div key={i} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />{m.note}
                              </div>
                            ))}
                          </div>
                        )}
                        {coaching.weakMoments.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">What to fix</p>
                            {coaching.weakMoments.map((m, i) => (
                              <div key={i} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                                <AlertCircle className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />{m.note}
                              </div>
                            ))}
                          </div>
                        )}
                        {coaching.missingEvidence.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Missing from your answer</p>
                            {coaching.missingEvidence.map((m, i) => (
                              <div key={i} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                                <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />{m}
                              </div>
                            ))}
                          </div>
                        )}
                        {coaching.suggestedStructure && (
                          <div className="space-y-2 border-t border-border/40 pt-4">
                            <p className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">How a stronger answer sounds</p>
                            <p className="text-sm text-foreground leading-relaxed italic bg-brand-500/5 rounded-lg p-3">
                              &ldquo;{coaching.suggestedStructure}&rdquo;
                            </p>
                            <p className="text-[10px] text-muted-foreground/60">This is an example, not a script — adapt it to your actual experience.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Retry this answer */}
                {session.status === 'completed' && answer && (
                  <div className="ml-8">
                    {!retryResult && retryingQuestionId !== q.id && (
                      <Button size="sm" variant="ghost" onClick={() => { setRetryingQuestionId(q.id); setRetryText('') }} className="gap-1.5 h-7 text-xs">
                        <RotateCcw className="h-3 w-3" /> Retry this answer
                      </Button>
                    )}
                  </div>
                )}

                {retryingQuestionId === q.id && (
                  <div className="ml-8 space-y-2 pl-3 border-l-2 border-brand-500/30">
                    <Textarea value={retryText} onChange={(e) => setRetryText(e.target.value)} placeholder="Try answering again…" className="min-h-[100px]" maxLength={10000} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setRetryingQuestionId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => handleSubmitRetry(q.id)} disabled={submittingRetry}>{submittingRetry ? 'Comparing…' : 'Submit Retry'}</Button>
                    </div>
                  </div>
                )}

                {retryResult && (
                  <div className="ml-8 rounded-xl border border-border/60 bg-surface-100 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">Your retry</p>
                    <p className="text-sm text-foreground">{retryResult.retryAnswer.answer_text}</p>
                    <div className="space-y-1 pt-2 border-t border-border/60">
                      {retryResult.comparison.observations.map((o, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {o.changed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" /> : <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />}
                          <span className={o.changed ? 'text-foreground' : 'text-muted-foreground'}>{o.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">Objective text comparison — your original answer is preserved.</p>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Practice recommendations ─────────────────────────────────────────── */}
      {session.status === 'completed' && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Dumbbell className="h-4 w-4" /> Practice Next</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {weakDimensionIds.length > 0
                ? 'Drills targeting your lowest-scoring dimensions from this session.'
                : hasAnalysis ? 'You scored well across every dimension — general recommendations below.' : 'General practice recommendations.'}
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

      {/* ── Share ─────────────────────────────────────────────────────────────── */}
      {session.status === 'completed' && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Share2 className="h-4 w-4" /> Share This Report</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Private by default. Share links never include your transcript or audio. Revokable at any time.</p>
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
              <Button size="sm" variant="outline" disabled={creatingShare} onClick={() => {
                setCreatingShare(true)
                fetch(`/api/interviews/sessions/${params.sessionId}/share`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scope: 'completion_only', expiresInDays: 30 }),
                }).then(r => r.json()).then(j => { if (j.data) setNewShareLink(`${window.location.origin}/shared/${j.data.token}`); setCreatingShare(false); loadShares() })
              }}>Share completion only</Button>
              <Button size="sm" variant="outline" disabled={creatingShare} onClick={() => {
                setCreatingShare(true)
                fetch(`/api/interviews/sessions/${params.sessionId}/share`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scope: 'full_summary', expiresInDays: 30 }),
                }).then(r => r.json()).then(j => { if (j.data) setNewShareLink(`${window.location.origin}/shared/${j.data.token}`); setCreatingShare(false); loadShares() })
              }}>Share full summary</Button>
            </div>
            {shares.filter((s) => !s.revoked_at).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-xs font-medium text-foreground">Active links</p>
                {shares.filter((s) => !s.revoked_at).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{s.scope === 'full_summary' ? 'Full summary' : 'Completion only'} · expires {new Date(s.expires_at).toLocaleDateString()} · viewed {s.access_count}x</span>
                    <Button size="sm" variant="ghost" onClick={async () => { await fetch(`/api/interviews/shares/${s.id}`, { method: 'DELETE' }); loadShares() }} className="gap-1 h-7"><X className="h-3 w-3" /> Revoke</Button>
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
