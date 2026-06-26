'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, FileText, Mic, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/utils'

interface SessionDetail {
  session: {
    id: string; status: string; session_type: string; target_role: string
    delivery_mode: 'voice' | 'text'; planned_question_count: number
    max_duration_seconds: number; completed_question_count: number
  }
}

export default function InterviewLobbyPage() {
  const router = useRouter()
  const params = useParams<{ sessionId: string }>()
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    async function load() {
      const sessionRes = await fetch(`/api/interviews/sessions/${params.sessionId}`)
      const sessionJson = await sessionRes.json()
      if (!sessionRes.ok) {
        toast.error(apiErrorMessage(sessionJson.error, 'Could not load session.'))
        router.push('/interviews')
        return
      }
      const data: SessionDetail = sessionJson.data
      const status = data.session.status

      // Already running  -  skip the lobby entirely and drop back into the live page
      if (status === 'in_progress') {
        router.replace(`/interviews/${params.sessionId}/live`)
        return
      }
      // Already done  -  send to results
      if (status === 'completed') {
        router.replace(`/interviews/${params.sessionId}/results`)
        return
      }

      setDetail(data)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sessionId])

  async function handleStart() {
    setStarting(true)
    try {
      const startRes = await fetch(`/api/interviews/sessions/${params.sessionId}/start`, { method: 'POST' })
      const startJson = await startRes.json()
      if (!startRes.ok) {
        toast.error(apiErrorMessage(startJson.error, 'Could not start session.'))
        setStarting(false)
        return
      }
      router.push(`/interviews/${params.sessionId}/live`)
    } catch {
      toast.error('Something went wrong. Please try again.')
      setStarting(false)
    }
  }

  if (loading || !detail) {
    return (
      <div className="max-w-2xl mx-auto p-6 lg:p-10 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const { session } = detail
  const minutes = Math.round(session.max_duration_seconds / 60)
  const isResuming = session.status === 'in_progress'

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight capitalize">
          {session.session_type.replace(/_/g, ' ')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Practicing for: {session.target_role}</p>
      </div>

      {isResuming && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4 text-sm text-foreground flex items-start gap-3">
          <RotateCcw className="h-4 w-4 mt-0.5 text-brand-400 shrink-0" />
          <div>
            <p className="font-medium">Resuming your session</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              You left this session in progress. Your answers so far are saved  -  you&apos;ll pick up from where you left off.
              {session.completed_question_count > 0 && ` (${session.completed_question_count} of ${session.planned_question_count} questions already answered)`}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {session.delivery_mode === 'voice' ? <Mic className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {isResuming ? 'Session details' : 'Before you start'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {session.planned_question_count} questions, up to {minutes} minutes
          </div>
          {session.delivery_mode === 'voice' ? (
            <>
              <p>Delivery mode: <span className="text-foreground">Live voice</span>  -  your AI interviewer speaks each question aloud and listens to your spoken answers. You&apos;ll need to allow microphone access.</p>
              <p>A transcript is stored privately and visible only to you. No raw audio recording is stored.</p>
            </>
          ) : (
            <>
              <p>Delivery mode: <span className="text-foreground">Text</span>  -  type your answers, no microphone needed.</p>
              <p>Your transcript is stored privately and visible only to you.</p>
            </>
          )}
          <p>This is a private practice session. Showcase does not represent any real employer and never shares your results without your explicit consent.</p>
        </CardContent>
      </Card>

      <Button onClick={handleStart} disabled={starting} size="lg" className="w-full gap-2">
        {starting
          ? 'Loading…'
          : isResuming
          ? <><RotateCcw className="h-4 w-4" /> Resume Interview</>
          : 'Start Interview'}
      </Button>
    </div>
  )
}
