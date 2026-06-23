'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, apiErrorMessage } from '@/lib/utils'

const SESSION_TYPES = [
  { value: 'recruiter_screen', label: 'Recruiter Screen', desc: 'Background, motivation, role fit, logistics.' },
  { value: 'behavioral', label: 'Behavioral', desc: 'STAR-style stories: conflict, failure, ownership, ambiguity.' },
  { value: 'portfolio_walkthrough', label: 'Portfolio Walkthrough', desc: 'Walk through a real project from your portfolio.' },
] as const

const DIFFICULTIES = ['foundational', 'standard', 'challenging'] as const
const LENGTHS = [
  { value: 'quick', label: 'Quick', desc: '~5-7 min' },
  { value: 'standard', label: 'Standard', desc: '~12-15 min' },
  { value: 'full', label: 'Full', desc: 'maximum allowed' },
] as const

export default function NewInterviewPage() {
  const router = useRouter()
  const [sessionType, setSessionType] = useState<typeof SESSION_TYPES[number]['value']>('behavioral')
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>('standard')
  const [sessionLength, setSessionLength] = useState<typeof LENGTHS[number]['value']>('quick')
  const [targetRole, setTargetRole] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
          deliveryMode: 'text', coachingMode: 'guided',
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

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">New Interview</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure a realistic practice session — text mode, today.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Target role</CardTitle></CardHeader>
        <CardContent>
          <Label htmlFor="targetRole">What role are you practicing for?</Label>
          <Input id="targetRole" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Product Designer" className="mt-2" maxLength={200} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Interview format</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
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
        <p>Delivery mode: <span className="text-foreground">Text</span> (voice is not yet available)</p>
        <p>Your transcript is private and stored only for you. No audio is recorded in text mode.</p>
        <p>This is practice, not a real interview — Showcase never represents itself as an employer.</p>
      </div>

      <Button onClick={handleSubmit} disabled={submitting} size="lg" className="w-full">
        {submitting ? 'Creating session…' : 'Continue to Lobby'}
      </Button>
    </div>
  )
}
