import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, MessageSquare, Mic, BookOpen, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { scoreToBand } from '@/lib/interviews/rubrics'

const BAND_LABELS: Record<string, string> = {
  starting: 'Starting', building: 'Building', practicing: 'Practicing',
  interview_ready: 'Interview Ready', strong: 'Strong',
}

export default async function InterviewHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [sessionsRes, storyBankRes, evaluationsRes] = await Promise.all([
    supabase.from('interview_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('interview_story_bank').select('id, title, evidence_status').eq('user_id', user.id),
    supabase.from('interview_evaluations').select('id, overall_score, session_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
  ])

  const sessions = sessionsRes.data ?? []
  const storyBank = storyBankRes.data ?? []
  const evaluations = evaluationsRes.data ?? []
  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((sum, e) => sum + e.overall_score, 0) / evaluations.length)
    : null
  const band = avgScore !== null ? scoreToBand(avgScore) : null

  const completedCount = sessions.filter((s) => s.status === 'completed').length
  const inProgress = sessions.find((s) => s.status === 'in_progress' || s.status === 'planned')

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Interview Lab</h1>
          <p className="text-sm text-muted-foreground mt-1">Practice the interview. Prove the answer.</p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link href={inProgress ? `/interviews/${inProgress.id}/lobby` : '/interviews/new'}>
            {inProgress ? 'Resume Session' : 'Start an Interview'} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Interview Readiness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interview Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          {avgScore === null ? (
            <p className="text-sm text-muted-foreground">
              No scored sessions yet. Complete a practice interview to see your readiness here.
            </p>
          ) : (
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-4xl font-bold text-foreground">{avgScore}</div>
              <div>
                <Badge variant="info">{band ? BAND_LABELS[band] : ''}</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {evaluations.length === 1 ? 'Early estimate based on 1 session.' : `Based on your last ${evaluations.length} scored sessions.`}
                </p>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground/70 mt-4 border-t border-border/60 pt-3">
            Interview Readiness is a structured practice diagnostic based on your answers in Showcase. It is not a hiring prediction.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><MessageSquare className="h-4 w-4" /><span className="text-xs font-medium">Sessions completed</span></div>
            <div className="text-2xl font-bold text-foreground">{completedCount}</div>
          </CardContent>
        </Card>
        <Link href="/interviews/story-bank">
          <Card className="h-full hover:bg-surface-200 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2"><BookOpen className="h-4 w-4" /><span className="text-xs font-medium">Story bank</span></div>
              <div className="text-2xl font-bold text-foreground">{storyBank.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{storyBank.filter((s) => s.evidence_status !== 'unverified').length} with linked evidence</p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><Mic className="h-4 w-4" /><span className="text-xs font-medium">Voice interviews</span></div>
            <div className="text-sm font-medium text-foreground">Coming soon</div>
            <p className="text-xs text-muted-foreground mt-1">Text mode is available today.</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            sessions.map((s) => (
              <Link
                key={s.id}
                href={s.status === 'completed' ? `/interviews/${s.id}/results` : `/interviews/${s.id}/lobby`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-200 transition-colors border border-border/60"
              >
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">{s.session_type.replace(/_/g, ' ')} · {s.target_role}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()} · {s.status.replace(/_/g, ' ')}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Privacy summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Privacy</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Your practice sessions are private by default — only you can see your transcripts and scores.</p>
          <p>Voice and recording features are not yet enabled. Text-mode sessions never record audio.</p>
          <p>You can delete any session and its transcript at any time from the session&apos;s results page.</p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground/60 text-center pt-2">
        Showcase never invents experience for your answers. Camera is optional and never used for appearance scoring.
      </p>
    </div>
  )
}
