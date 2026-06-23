'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, Clock, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/utils'

interface SessionDetail {
  session: { id: string; status: string; session_type: string; target_role: string; planned_question_count: number; max_duration_seconds: number }
}

export default function InterviewLobbyPage() {
  const router = useRouter()
  const params = useParams<{ sessionId: string }>()
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [needsAgeConfirmation, setNeedsAgeConfirmation] = useState(false)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    async function load() {
      const [sessionRes, profileRes] = await Promise.all([
        fetch(`/api/interviews/sessions/${params.sessionId}`),
        fetch('/api/interviews/profile'),
      ])
      const sessionJson = await sessionRes.json()
      const profileJson = await profileRes.json()
      if (!sessionRes.ok) {
        toast.error(apiErrorMessage(sessionJson.error, 'Could not load session.'))
        router.push('/interviews')
        return
      }
      setDetail(sessionJson.data)
      setNeedsAgeConfirmation(!profileJson.data?.age_eligibility_confirmed)
      setLoading(false)
    }
    load()
  }, [params.sessionId, router])

  async function handleStart() {
    if (needsAgeConfirmation && !ageConfirmed) {
      toast.error('Please confirm you are 18 or older to continue.')
      return
    }
    setStarting(true)
    try {
      if (needsAgeConfirmation) {
        const profileRes = await fetch('/api/interviews/profile', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ageEligibilityConfirmed: true }),
        })
        if (!profileRes.ok) {
          const json = await profileRes.json()
          toast.error(apiErrorMessage(json.error, 'Could not confirm eligibility.'))
          setStarting(false)
          return
        }
      }
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

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight capitalize">{session.session_type.replace(/_/g, ' ')}</h1>
        <p className="text-sm text-muted-foreground mt-1">Practicing for: {session.target_role}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Before you start</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {session.planned_question_count} questions, up to {minutes} minutes</div>
          <p>Delivery mode: <span className="text-foreground">Text</span> — type your answers, no microphone needed.</p>
          <p>Your transcript is stored privately and visible only to you. No audio is recorded in text mode.</p>
          <p>This is a private practice session. Showcase does not represent any real employer and never shares your results without your explicit consent.</p>
        </CardContent>
      </Card>

      {needsAgeConfirmation && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Eligibility</CardTitle></CardHeader>
          <CardContent>
            <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-border" />
              <span>I confirm that I am 18 years of age or older.</span>
            </label>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleStart} disabled={starting} size="lg" className="w-full">
        {starting ? 'Starting…' : 'Start Interview'}
      </Button>
    </div>
  )
}
