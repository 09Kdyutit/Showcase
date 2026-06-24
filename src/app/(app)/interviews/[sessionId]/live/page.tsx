'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, Volume2, Mic, MicOff, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/utils'
import { speakText, stopSpeaking, useBrowserDictation, useSpeechSynthesisSupport } from '@/lib/interviews/browser-voice'

interface Question {
  id: string
  question_text: string
  order_index: number
  competency: string
  answered_at: string | null
}

interface SessionDetail {
  session: { id: string; status: string; planned_question_count: number; completed_question_count: number }
  questions: Question[]
}

export default function InterviewLivePage() {
  const router = useRouter()
  const params = useParams<{ sessionId: string }>()
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const speechSynthesisSupported = useSpeechSynthesisSupport()
  const { dictationSupported, listening, toggleListening } = useBrowserDictation((segment) => {
    setAnswerText((prev) => (prev.trim() ? `${prev.trim()} ${segment}` : segment))
  })

  useEffect(() => {
    fetch(`/api/interviews/sessions/${params.sessionId}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) {
          toast.error(apiErrorMessage(json.error, 'Could not load session.'))
          router.push('/interviews')
          return
        }
        const data: SessionDetail = json.data
        setDetail(data)
        setCurrentQuestion(data.questions.find((q) => !q.answered_at) ?? null)
        setLoading(false)
      })
  }, [params.sessionId, router])

  useEffect(() => {
    return () => stopSpeaking()
  }, [])

  async function handleSubmitAnswer() {
    if (!currentQuestion || !answerText.trim()) {
      toast.error('Write an answer before continuing.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/interviews/sessions/${params.sessionId}/transcript`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: currentQuestion.id, answerText: answerText.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(apiErrorMessage(json.error, 'Could not submit answer.'))
        setSubmitting(false)
        return
      }
      setAnswerText('')
      stopSpeaking()
      if (json.data.nextQuestion) {
        setCurrentQuestion(json.data.nextQuestion)
        setSubmitting(false)
      } else {
        const completeRes = await fetch(`/api/interviews/sessions/${params.sessionId}/complete`, { method: 'POST' })
        if (!completeRes.ok) {
          const completeJson = await completeRes.json()
          toast.error(apiErrorMessage(completeJson.error, 'Could not complete session.'))
          setSubmitting(false)
          return
        }
        router.push(`/interviews/${params.sessionId}/results`)
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading || !detail) {
    return (
      <div className="max-w-2xl mx-auto p-6 lg:p-10 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto p-6 lg:p-10 text-center space-y-4">
        <p className="text-sm text-muted-foreground">All questions answered. Finishing up…</p>
      </div>
    )
  }

  const total = detail.session.planned_question_count
  const answeredSoFar = detail.questions.filter((q) => q.order_index < currentQuestion.order_index).length

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-10 space-y-6">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Question {answeredSoFar + 1} of {total}</span>
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Private session</span>
      </div>

      <div className="w-full h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${((answeredSoFar) / total) * 100}%` }} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{currentQuestion.competency.replace(/_/g, ' ')}</p>
          {speechSynthesisSupported && (
            <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs shrink-0" onClick={() => speakText(currentQuestion.question_text)}>
              <Volume2 className="h-3.5 w-3.5" /> Read aloud
            </Button>
          )}
        </div>
        <p className="text-lg font-medium text-foreground leading-relaxed">{currentQuestion.question_text}</p>
      </div>

      {(speechSynthesisSupported || dictationSupported) && (
        <div className="rounded-xl border border-border/60 bg-surface-100 p-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">Browser Voice (Beta).</strong> Uses your device&apos;s built-in voice features to read questions aloud and dictate answers. This is not Showcase&apos;s AI voice interviewer — nothing is sent to Gemini or any AI provider, and your speech is only ever turned into text in your own browser.
          </p>
        </div>
      )}

      <div className="relative">
        <Textarea
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          placeholder={dictationSupported ? 'Type your answer, or tap the mic to dictate…' : 'Type your answer…'}
          className="min-h-[180px]"
          maxLength={10000}
          disabled={submitting}
        />
        {dictationSupported && (
          <Button
            type="button" size="sm" variant={listening ? 'gradient' : 'outline'}
            onClick={toggleListening} disabled={submitting}
            className="absolute bottom-3 right-3 gap-1.5 h-8 text-xs"
          >
            {listening ? <><MicOff className="h-3.5 w-3.5" /> Stop dictating</> : <><Mic className="h-3.5 w-3.5" /> Dictate</>}
          </Button>
        )}
      </div>
      {!dictationSupported && (
        <p className="text-xs text-muted-foreground">Voice dictation isn&apos;t supported in this browser — try Chrome or Edge, or just type your answer.</p>
      )}

      <Button onClick={handleSubmitAnswer} disabled={submitting} size="lg" className="w-full">
        {submitting ? 'Submitting…' : answeredSoFar + 1 === total ? 'Submit & Finish' : 'Submit & Continue'}
      </Button>
    </div>
  )
}
