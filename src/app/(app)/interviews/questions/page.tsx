'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Mic, MicOff, Square, ChevronRight, BookOpen, RotateCcw, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  BEHAVIORAL_CATEGORIES,
  BEHAVIORAL_QUESTIONS,
  type BehavioralCategory,
  type BehavioralQuestion,
} from '@/lib/interviews/behavioral-questions'

interface ScoreResult {
  clarity: number
  action: number
  impact: number
  structure: number
  total: number
  label: string
  strengths: string[]
  improvements: string[]
}

// ── Score Card ─────────────────────────────────────────────────────────────

function ScoreCard({ result, onRetry }: { result: ScoreResult; onRetry: () => void }) {
  const labelColor =
    result.label === 'Excellent' ? 'text-emerald-600' :
    result.label === 'Good' ? 'text-brand-700' :
    result.label === 'Fair' ? 'text-amber-600' :
    'text-red-600'

  const dims = [
    { label: 'Clarity & Context', value: result.clarity },
    { label: 'Action Specificity', value: result.action },
    { label: 'Measurable Impact', value: result.impact },
    { label: 'STAR Structure', value: result.structure },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-4xl font-bold text-foreground stat-number">{result.total}<span className="text-lg text-muted-foreground font-normal">/100</span></p>
          <p className={cn('text-sm font-semibold mt-0.5', labelColor)}>{result.label}</p>
        </div>
        <div className="w-20 h-20 relative flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="none" className="text-white/5" />
            <circle
              cx="40" cy="40" r="34"
              stroke="currentColor" strokeWidth="6" fill="none"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - result.total / 100)}`}
              className={
                result.total >= 90 ? 'text-emerald-600' :
                result.total >= 75 ? 'text-brand-600' :
                result.total >= 55 ? 'text-amber-600' :
                'text-red-600'
              }
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <span className={cn('text-xs font-bold', labelColor)}>{result.total}%</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {dims.map((d) => (
          <div key={d.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="text-foreground font-medium">{d.value}/25</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${(d.value / 25) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {result.strengths.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">What worked</p>
          <ul className="space-y-1.5">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.improvements.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Strengthen this</p>
          <ul className="space-y-1.5">
            {result.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <XCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button onClick={onRetry} variant="outline" size="sm" className="w-full gap-2">
        <RotateCcw className="h-3.5 w-3.5" />
        Try Again
      </Button>
    </div>
  )
}

// ── Written Practice Dialog ─────────────────────────────────────────────────

function WrittenPracticeDialog({
  question,
  open,
  onClose,
}: {
  question: BehavioralQuestion | null
  open: boolean
  onClose: () => void
}) {
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)

  function reset() {
    setAnswer('')
    setResult(null)
  }

  useEffect(() => {
    if (!open) { setAnswer(''); setResult(null) }
  }, [open])

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0

  async function handleSubmit() {
    if (!question) return
    if (wordCount < 30) {
      toast.error('Write at least 30 words before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/interviews/questions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: question.text, answerText: answer }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Scoring failed -- try again.')
        return
      }
      setResult(json.data)
    } catch {
      toast.error('Could not connect -- check your internet connection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Written Practice</DialogTitle>
        </DialogHeader>
        {question && (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary border border-border p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{question.text}</p>
              {question.followUp && (
                <p className="text-xs text-muted-foreground/50 mt-2 italic">Follow-up: {question.followUp}</p>
              )}
            </div>

            {result ? (
              <ScoreCard result={result} onRetry={reset} />
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Use the STAR method: Situation -- set the scene. Task -- what was your role. Action -- what YOU specifically did. Result -- what happened and what you learned."
                  className="min-h-[180px] text-sm resize-none bg-secondary border-border focus:border-brand-500/40"
                />
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs', wordCount < 30 ? 'text-muted-foreground/40' : 'text-emerald-600')}>
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}{wordCount < 30 ? ` (min 30)` : ''}
                  </span>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || wordCount < 30}
                    variant="gradient"
                    size="sm"
                    className="gap-1.5"
                  >
                    {submitting ? 'Scoring...' : 'Get AI Feedback'}
                    {!submitting && <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Spoken Practice Dialog ──────────────────────────────────────────────────

type VoiceState = 'idle' | 'recording' | 'processing' | 'done'

function SpokenPracticeDialog({
  question,
  open,
  onClose,
}: {
  question: BehavioralQuestion | null
  open: boolean
  onClose: () => void
}) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [hasSpeechAPI, setHasSpeechAPI] = useState(true)
  const [fallbackAnswer, setFallbackAnswer] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (!open) {
      stopRecording()
      setVoiceState('idle')
      setTranscript('')
      setResult(null)
      setFallbackAnswer('')
    }
  }, [open])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getSpeechRecognition(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
  }

  useEffect(() => {
    if (!getSpeechRecognition()) setHasSpeechAPI(false)
  }, [])

  function stopRecording() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }
  }

  function startRecording() {
    const SR = getSpeechRecognition()
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let finalText = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += t + ' '
        else interim = t
      }
      setTranscript(finalText + interim)
    }
    recognition.onend = () => {
      setTranscript(finalText.trim())
      setVoiceState('processing')
      scoreAnswer(finalText.trim())
    }
    recognition.onerror = () => {
      setVoiceState('idle')
      toast.error('Microphone error -- check browser permissions.')
    }

    recognitionRef.current = recognition
    recognition.start()
    setVoiceState('recording')
  }

  const scoreAnswer = useCallback(async (text: string) => {
    if (!question || text.trim().split(/\s+/).length < 10) {
      setVoiceState('idle')
      toast.error('Not enough speech detected -- try again.')
      return
    }
    try {
      const res = await fetch('/api/interviews/questions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: question.text, answerText: text }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Scoring failed.')
        setVoiceState('idle')
        return
      }
      setResult(json.data)
      setVoiceState('done')
    } catch {
      toast.error('Scoring failed -- check your connection.')
      setVoiceState('idle')
    }
  }, [question])

  async function handleFallbackSubmit() {
    if (fallbackAnswer.trim().split(/\s+/).length < 30) {
      toast.error('Write at least 30 words.')
      return
    }
    setVoiceState('processing')
    await scoreAnswer(fallbackAnswer)
  }

  function reset() {
    setVoiceState('idle')
    setTranscript('')
    setResult(null)
    setFallbackAnswer('')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { stopRecording(); onClose() } }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Spoken Practice</DialogTitle>
        </DialogHeader>
        {question && (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary border border-border p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{question.text}</p>
            </div>

            {result ? (
              <ScoreCard result={result} onRetry={reset} />
            ) : !hasSpeechAPI ? (
              <div className="space-y-3">
                <p className="text-xs text-amber-600 bg-amber-400/10 rounded-lg px-3 py-2">
                  Voice input is not supported in this browser. Type your spoken answer below.
                </p>
                <Textarea
                  value={fallbackAnswer}
                  onChange={(e) => setFallbackAnswer(e.target.value)}
                  placeholder="Type what you would say out loud..."
                  className="min-h-[140px] text-sm resize-none bg-secondary border-border"
                />
                <Button
                  onClick={handleFallbackSubmit}
                  variant="gradient"
                  size="sm"
                  className="w-full"
                  disabled={voiceState === 'processing'}
                >
                  {voiceState === 'processing' ? 'Scoring...' : 'Get AI Feedback'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 py-4">
                {voiceState === 'idle' && (
                  <button
                    onClick={startRecording}
                    className="w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))',
                      boxShadow: '0 0 30px color-mix(in oklch, var(--color-brand-500) 40%, transparent)',
                    }}
                  >
                    <Mic className="h-8 w-8 text-white" />
                  </button>
                )}

                {voiceState === 'recording' && (
                  <button
                    onClick={() => { stopRecording() }}
                    className="w-24 h-24 rounded-full flex items-center justify-center animate-pulse"
                    style={{
                      background: 'linear-gradient(135deg, oklch(50% 0.22 25), oklch(60% 0.22 15))',
                      boxShadow: '0 0 40px oklch(55% 0.22 25 / 60%)',
                    }}
                  >
                    <Square className="h-8 w-8 text-white fill-white" />
                  </button>
                )}

                {voiceState === 'processing' && (
                  <div className="w-24 h-24 rounded-full flex items-center justify-center bg-white/5 border border-white/10 animate-pulse">
                    <MicOff className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                <p className="text-sm text-muted-foreground text-center">
                  {voiceState === 'idle' && 'Tap the mic to start recording your answer'}
                  {voiceState === 'recording' && 'Recording -- tap the square to stop'}
                  {voiceState === 'processing' && 'Analyzing your response...'}
                </p>

                {transcript && voiceState !== 'processing' && (
                  <div className="w-full rounded-xl bg-secondary border border-border p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs text-muted-foreground/70 mb-1">Transcript</p>
                    <p className="text-sm text-foreground/80">{transcript}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Question Card ───────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  onWritten,
  onSpoken,
}: {
  question: BehavioralQuestion
  index: number
  onWritten: (q: BehavioralQuestion) => void
  onSpoken: (q: BehavioralQuestion) => void
}) {
  return (
    <div className="glass-card p-5 flex flex-col gap-4 group card-3d">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-6 h-6 rounded-lg bg-secondary border border-border flex items-center justify-center text-[10px] text-muted-foreground/50 font-mono mt-0.5">
          {index + 1}
        </span>
        <p className="text-sm font-medium text-foreground/90 leading-relaxed flex-1">{question.text}</p>
      </div>

      {question.followUp && (
        <p className="text-xs text-muted-foreground/40 italic pl-9 leading-relaxed">
          Common follow-up: {question.followUp}
        </p>
      )}

      <div className="flex gap-2 pl-9 pt-1">
        <Button
          size="sm"
          variant="gradient"
          className="h-8 text-xs gap-1.5 flex-1"
          onClick={() => onWritten(question)}
        >
          Practice Written
          <ChevronRight className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 flex-1"
          onClick={() => onSpoken(question)}
        >
          <Mic className="h-3 w-3" />
          Speak Answer
        </Button>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function QuestionLibraryPage() {
  const [activeCategory, setActiveCategory] = useState<BehavioralCategory>('leadership')
  const [writtenQ, setWrittenQ] = useState<BehavioralQuestion | null>(null)
  const [spokenQ, setSpokenQ] = useState<BehavioralQuestion | null>(null)

  const categoryQuestions = BEHAVIORAL_QUESTIONS.filter((q) => q.category === activeCategory)
  const activeLabel = BEHAVIORAL_CATEGORIES.find((c) => c.id === activeCategory)?.label ?? ''

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-border overflow-y-auto thin-scrollbar">
        <div className="p-5 border-b border-border">
          <Link
            href="/interviews"
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Interview Lab
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand-600" />
            <h1 className="text-sm font-semibold">Question Library</h1>
          </div>
          <p className="text-xs text-muted-foreground/50 mt-1">72 behavioral questions, AI-scored</p>
        </div>

        <nav className="flex-1 p-2.5 space-y-0.5">
          {BEHAVIORAL_CATEGORIES.map((cat) => {
            const count = BEHAVIORAL_QUESTIONS.filter((q) => q.category === cat.id).length
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-left',
                  activeCategory === cat.id
                    ? 'nav-active text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <span>{cat.label}</span>
                <span className={cn('text-[11px] font-mono', activeCategory === cat.id ? 'text-brand-700' : 'text-muted-foreground/30')}>
                  {count}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Mobile category selector */}
      <div className="lg:hidden px-4 pt-4">
        <Link
          href="/interviews"
          className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Interview Lab
        </Link>
        <select
          value={activeCategory}
          onChange={(e) => setActiveCategory(e.target.value as BehavioralCategory)}
          className="w-full bg-surface-100 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
        >
          {BEHAVIORAL_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.label} ({BEHAVIORAL_QUESTIONS.filter((q) => q.category === cat.id).length})</option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 lg:p-8 max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-semibold text-foreground">{activeLabel}</h2>
            <span className="text-xs font-mono text-muted-foreground/40 bg-secondary border border-border px-1.5 py-0.5 rounded-md">
              {categoryQuestions.length} questions
            </span>
          </div>
          <p className="text-sm text-muted-foreground/60">
            Practice written or spoken answers -- get instant AI feedback scored on STAR structure.
          </p>
        </div>

        <div className="space-y-3">
          {categoryQuestions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              onWritten={setWrittenQ}
              onSpoken={setSpokenQ}
            />
          ))}
        </div>
      </main>

      <WrittenPracticeDialog
        question={writtenQ}
        open={!!writtenQ}
        onClose={() => setWrittenQ(null)}
      />
      <SpokenPracticeDialog
        question={spokenQ}
        open={!!spokenQ}
        onClose={() => setSpokenQ(null)}
      />
    </div>
  )
}
