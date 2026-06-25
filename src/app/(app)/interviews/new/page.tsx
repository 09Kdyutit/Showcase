'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mic, Keyboard, ChevronLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, apiErrorMessage } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'

const SESSION_TYPES = [
  { value: 'recruiter_screen', label: 'Recruiter Screen', desc: 'Background, motivation, role fit, logistics.' },
  { value: 'behavioral', label: 'Behavioral', desc: 'STAR-style stories: conflict, failure, ownership, ambiguity.' },
  { value: 'hiring_manager', label: 'Hiring Manager', desc: 'Judgment, leadership, decisions you\'d defend.' },
  { value: 'portfolio_walkthrough', label: 'Portfolio Walkthrough', desc: 'Walk through a real project from your portfolio.' },
  { value: 'project_deep_dive', label: 'Project Deep Dive', desc: 'Architecture, tradeoffs, scaling, debugging.' },
  { value: 'technical_concept', label: 'Technical Concept', desc: 'Explain and reason about core concepts in your field.' },
  { value: 'case_problem_solving', label: 'Case / Problem Solving', desc: 'Structured reasoning through an ambiguous problem.' },
  { value: 'presentation_defense', label: 'Presentation Defense', desc: 'Defend a recommendation under pushback.' },
  { value: 'job_specific_full_loop', label: 'Job-Specific Full Loop', desc: 'Mapped to a specific role\'s real requirements.' },
  { value: 'rapid_fire_drill', label: 'Rapid-Fire Drill', desc: 'Many short, quick questions — speed and clarity.' },
] as const

const DIFFICULTIES = ['foundational', 'standard', 'challenging'] as const
const LENGTHS = [
  { value: 'quick', label: 'Quick', desc: '~5-7 min' },
  { value: 'standard', label: 'Standard', desc: '~12-15 min' },
  { value: 'full', label: 'Full', desc: 'maximum allowed' },
] as const

type DeliveryMode = 'voice' | 'text'

export default function NewInterviewPage() {
  const router = useRouter()
  const { subscription } = useUser()
  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing'

  const [step, setStep] = useState<'delivery' | 'details'>('delivery')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('text')
  const [sessionType, setSessionType] = useState<typeof SESSION_TYPES[number]['value']>('behavioral')
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>('standard')
  const [sessionLength, setSessionLength] = useState<typeof LENGTHS[number]['value']>('quick')
  const [targetRole, setTargetRole] = useState('')
  const [targetCompany, setTargetCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function chooseDelivery(mode: DeliveryMode) {
    setDeliveryMode(mode)
    setStep('details')
  }

  async function handleSubmit() {
    if (!targetRole.trim()) {
      toast.error('Enter a target role to practice for.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/interviews/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType, difficulty, sessionLength, targetRole: targetRole.trim(),
          targetCompany: targetCompany.trim() || undefined,
          deliveryMode, coachingMode: 'guided',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(apiErrorMessage(json.error, 'Could not create session.'))
        setSubmitting(false)
        return
      }
      router.push(`/interviews/${json.data.id}/lobby`)
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (step === 'delivery') {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">New Interview</h1>
          <p className="text-sm text-muted-foreground mt-1">How do you want to practice?</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => chooseDelivery('voice')}
            className="text-left p-6 rounded-2xl border border-border/60 hover:border-brand-500/60 hover:bg-brand-500/5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                <Mic className="h-5 w-5 text-brand-500" />
              </div>
              {!isPro && (
                <span className="text-[11px] font-medium uppercase tracking-wide text-brand-300 bg-brand-500/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Pro
                </span>
              )}
            </div>
            <p className="font-semibold text-foreground">Live Interview</p>
            <p className="text-sm text-muted-foreground mt-1">Your AI interviewer speaks each question aloud over a real-time voice call, and listens to your spoken answers — closest to a real interview.</p>
          </button>

          <button
            type="button"
            onClick={() => chooseDelivery('text')}
            className="text-left p-6 rounded-2xl border border-border/60 hover:border-brand-500/60 hover:bg-brand-500/5 transition-all"
          >
            <div className="h-10 w-10 rounded-xl bg-surface-200 flex items-center justify-center mb-3">
              <Keyboard className="h-5 w-5 text-foreground" />
            </div>
            <p className="font-semibold text-foreground">Written</p>
            <p className="text-sm text-muted-foreground mt-1">Type your answers at your own pace. Read questions aloud or dictate answers with your browser&apos;s built-in voice features, if you like.</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <button type="button" onClick={() => setStep('delivery')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
          <ChevronLeft className="h-3.5 w-3.5" /> Change interview type
        </button>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {deliveryMode === 'voice' ? 'Live Interview' : 'Written Interview'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {deliveryMode === 'voice' ? 'Configure your real-time voice practice session.' : 'Configure a realistic text-mode practice session.'}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Target role</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="targetRole">What role are you practicing for?</Label>
            <Input id="targetRole" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Product Designer" className="mt-2" maxLength={200} />
          </div>
          <div>
            <Label htmlFor="targetCompany">Target company (optional)</Label>
            <Input id="targetCompany" value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)} placeholder="e.g. Acme Corp" className="mt-2" maxLength={200} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Question style</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {SESSION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setSessionType(t.value)}
              className={cn(
                'text-left p-4 rounded-xl border transition-all',
                sessionType === t.value ? 'border-brand-500/60 bg-brand-500/10' : 'border-border/60 hover:bg-surface-200'
              )}
            >
              <p className="text-sm font-medium text-foreground">{t.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Difficulty</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={cn(
                'flex-1 capitalize text-sm py-2 rounded-xl border transition-all',
                difficulty === d ? 'border-brand-500/60 bg-brand-500/10 text-foreground' : 'border-border/60 text-muted-foreground hover:bg-surface-200'
              )}
            >
              {d}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Session length</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          {LENGTHS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setSessionLength(l.value)}
              className={cn(
                'flex-1 text-sm py-2 rounded-xl border transition-all',
                sessionLength === l.value ? 'border-brand-500/60 bg-brand-500/10 text-foreground' : 'border-border/60 text-muted-foreground hover:bg-surface-200'
              )}
            >
              <span className="font-medium">{l.label}</span>
              <span className="block text-[11px] opacity-70">{l.desc}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border/60 bg-surface-100 p-4 text-xs text-muted-foreground space-y-1">
        <p>Delivery mode: <span className="text-foreground">{deliveryMode === 'voice' ? 'Live voice' : 'Text'}</span></p>
        {deliveryMode === 'voice' ? (
          <>
            <p>Your microphone is used only to send your spoken answers to the AI interviewer in real time. A transcript of both sides is saved privately for you; no raw audio recording is stored.</p>
            {!isPro && <p className="text-brand-300">Live Interview requires Pro — you can pick it now and upgrade before you start.</p>}
          </>
        ) : (
          <p>Your transcript is private and stored only for you. No audio is recorded in text mode.</p>
        )}
        <p>This is practice, not a real interview — Showcase never represents itself as an employer.</p>
      </div>

      <Button onClick={handleSubmit} disabled={submitting} size="lg" className="w-full">
        {submitting ? 'Creating session…' : 'Continue to Lobby'}
      </Button>
    </div>
  )
}
