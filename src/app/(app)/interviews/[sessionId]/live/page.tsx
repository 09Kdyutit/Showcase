'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, Volume2, Mic, MicOff, Info, PhoneOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/utils'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { speakText, stopSpeaking, useBrowserDictation, useSpeechSynthesisSupport } from '@/lib/interviews/browser-voice'
import { LiveInterviewEngine, type LiveTranscriptSegment } from '@/lib/interviews/live-voice-client'
import { LIVE_INTERVIEW_COMPLETE_PHRASE } from '@/lib/interviews/gemini/live-prompt'

interface Question {
  id: string
  question_text: string
  order_index: number
  competency: string
  answered_at: string | null
}

interface SessionDetail {
  session: { id: string; status: string; delivery_mode: 'text' | 'voice'; planned_question_count: number; completed_question_count: number }
  questions: Question[]
}

export default function InterviewLivePage() {
  const router = useRouter()
  const params = useParams<{ sessionId: string }>()
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/interviews/sessions/${params.sessionId}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) {
          toast.error(apiErrorMessage(json.error, 'Could not load session.'))
          router.push('/interviews')
          return
        }
        setDetail(json.data)
        setLoading(false)
      })
  }, [params.sessionId, router])

  if (loading || !detail) {
    return (
      <div className="max-w-2xl mx-auto p-6 lg:p-10 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (detail.session.delivery_mode === 'voice') {
    return <LiveVoiceInterview sessionId={params.sessionId} questions={detail.questions} />
  }

  return <WrittenInterview sessionId={params.sessionId} initialDetail={detail} />
}

function LiveVoiceInterview({ sessionId, questions }: { sessionId: string; questions: Question[] }) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'ending' | 'ended'>('idle')
  const [transcript, setTranscript] = useState<LiveTranscriptSegment[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const engineRef = useRef<LiveInterviewEngine | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef(status)

  useEffect(() => { statusRef.current = status }, [status])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  useEffect(() => {
    return () => { engineRef.current?.close() }
  }, [])

  async function endInterview(engine: LiveInterviewEngine) {
    statusRef.current = 'ending'  // prevent onClosed from firing false "connection lost" error
    setStatus('ending')
    engine.close()
    const segments = engine.getTranscript()
    try {
      if (segments.length > 0) {
        await fetch(`/api/interviews/sessions/${sessionId}/live-transcript`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segments }),
        })
      }
      const completeRes = await fetch(`/api/interviews/sessions/${sessionId}/complete`, { method: 'POST' })
      if (!completeRes.ok) {
        const json = await completeRes.json()
        toast.error(apiErrorMessage(json.error, 'Could not complete session.'))
      }
      setStatus('ended')
      router.push(`/interviews/${sessionId}/results`)
    } catch {
      toast.error('Could not save the interview transcript. Please try again.')
      setStatus('ended')
    }
  }

  function addDebug(event: string) {
    setDebugLog((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString('en',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})} ${event}`])
  }

  async function startCall() {
    setStatus('connecting')
    setErrorMessage(null)
    setDebugLog([])
    try {
      // Create engine and pre-init AudioContext NOW, while still in the synchronous
      // user-gesture handler — before any await. Browsers block audio playback created
      // outside a user gesture chain (especially Safari and Chrome on mobile). Doing
      // this before the fetch call ensures both AudioContexts are unlocked for the
      // full session lifetime, not just until the first await.
      const engine = new LiveInterviewEngine(
        questions.map((q) => ({ id: q.id, questionText: q.question_text })),
        LIVE_INTERVIEW_COMPLETE_PHRASE,
        {
          onConnected: () => { addDebug('connected'); setStatus('live') },
          onTranscriptUpdate: (segments) => setTranscript([...segments]),
          onInterviewComplete: () => { void endInterview(engine) },
          onError: (message) => {
            addDebug(`error: ${message}`)
            setErrorMessage(message)
            toast.error('Live connection error: ' + message)
          },
          onClosed: (wasError) => {
            addDebug(`closed wasError=${wasError}`)
            // Only treat as a problem if we were in an active state
            if (statusRef.current === 'live' || statusRef.current === 'connecting') {
              setErrorMessage('The live connection closed unexpectedly. Please try again.')
              toast.error('Live connection closed. Please try again.')
              setStatus('idle')
            }
          },
          onDebugEvent: addDebug,
        }
      )
      engine.preInitAudio()   // <-- synchronous, must be before any await
      engineRef.current = engine

      const tokenRes = await fetch(`/api/interviews/sessions/${sessionId}/live-token`, { method: 'POST' })
      const tokenJson = await tokenRes.json()
      if (!tokenRes.ok) {
        toast.error(apiErrorMessage(tokenJson.error, 'Could not start the live interview.'))
        addDebug(`token error: ${tokenJson.error}`)
        setStatus('idle')
        return
      }
      const { model, systemInstruction } = tokenJson.data
      addDebug(`token ok model=${model}`)

      // Get the Supabase session JWT to authenticate the Edge Function proxy.
      // The JWT is short-lived and passed as a URL param (WebSocket API has no header support).
      const supabase = createSupabaseClient()
      const { data: { session: supabaseSession } } = await supabase.auth.getSession()
      const jwt = supabaseSession?.access_token
      if (!jwt) {
        toast.error('Could not get session token. Please refresh and try again.')
        addDebug('auth: no jwt')
        setStatus('idle')
        return
      }

      // Build the proxy WebSocket URL. The Edge Function validates the JWT and
      // proxies to Gemini using the real API key (kept as a Supabase secret).
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const wsBaseUrl = supabaseUrl.replace(/^https?:\/\//, 'wss://')
      const wsUrl = `${wsBaseUrl}/functions/v1/live-interview-ws?jwt=${encodeURIComponent(jwt)}&session_id=${encodeURIComponent(sessionId)}`
      addDebug('proxy:ready')

      // Start mic capture BEFORE connecting — mic ready before setupComplete fires,
      // and permission dialog happens before the WebSocket opens.
      await engine.startMicCapture()
      addDebug('mic:ready')

      // connect() opens a WebSocket to the Edge Function proxy, sends the setup
      // message on open, and returns. The proxy forwards it to Gemini. When
      // setupComplete arrives back, the engine fires the kickoff automatically.
      await engine.connect(wsUrl, model, systemInstruction)
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      addDebug(`catch: ${msg}`)
      toast.error('Could not access your microphone, or the live connection failed. Please check mic permissions and try again.')
      setStatus('idle')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-10 space-y-6">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Live voice interview · {questions.length} questions</span>
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Private session</span>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6 min-h-[320px] flex flex-col">
        {status === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-brand-500/10 flex items-center justify-center">
              <Mic className="h-7 w-7 text-brand-500" />
            </div>
            <div>
              <p className="font-medium text-foreground">Ready for your live interview?</p>
              <p className="text-sm text-muted-foreground mt-1">Your AI interviewer will speak each question aloud and listen to your spoken answers in real time.</p>
            </div>
            <Button size="lg" onClick={startCall} className="gap-2"><Mic className="h-4 w-4" /> Start interview</Button>
          </div>
        )}

        {status === 'connecting' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            <p className="text-sm text-muted-foreground">Connecting to your AI interviewer…</p>
          </div>
        )}

        {(status === 'live' || status === 'ending') && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-600">Live</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-1">
              {transcript.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Listening… the interviewer will greet you shortly.</p>
              )}
              {transcript.map((seg, i) => (
                <div key={i} className={seg.speaker === 'interviewer' ? 'text-left' : 'text-right'}>
                  <span className={`inline-block rounded-xl px-3 py-2 text-sm max-w-[85%] ${seg.speaker === 'interviewer' ? 'bg-surface-100 text-foreground' : 'bg-brand-500 text-white'}`}>
                    {seg.content}
                  </span>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>

            <Button
              variant="outline" className="mt-4 gap-2 text-destructive"
              disabled={status === 'ending'}
              onClick={() => engineRef.current && endInterview(engineRef.current)}
            >
              {status === 'ending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
              End interview
            </Button>
          </div>
        )}

        {errorMessage && (
          <div className="mt-2">
            <p className="text-xs text-destructive">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function WrittenInterview({ sessionId, initialDetail }: { sessionId: string; initialDetail: SessionDetail }) {
  const router = useRouter()
  const [detail] = useState<SessionDetail>(initialDetail)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(initialDetail.questions.find((q) => !q.answered_at) ?? null)
  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const speechSynthesisSupported = useSpeechSynthesisSupport()
  const { dictationSupported, listening, toggleListening } = useBrowserDictation((segment) => {
    setAnswerText((prev) => (prev.trim() ? `${prev.trim()} ${segment}` : segment))
  })

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
      const res = await fetch(`/api/interviews/sessions/${sessionId}/transcript`, {
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
        const completeRes = await fetch(`/api/interviews/sessions/${sessionId}/complete`, { method: 'POST' })
        if (!completeRes.ok) {
          const completeJson = await completeRes.json()
          toast.error(apiErrorMessage(completeJson.error, 'Could not complete session.'))
          setSubmitting(false)
          return
        }
        router.push(`/interviews/${sessionId}/results`)
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
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
