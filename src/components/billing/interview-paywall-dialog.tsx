'use client'

import type { RefObject } from 'react'
import { ArrowRight, CheckCircle2, MessagesSquare, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface InterviewPaywallReason {
  kind: 'session-type' | 'difficulty' | 'question-count' | 'voice' | 'quota' | 'retry'
  label: string
}

interface InterviewPaywallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason: InterviewPaywallReason
  returnFocusRef?: RefObject<HTMLButtonElement | null>
}

export function InterviewPaywallDialog({
  open,
  onOpenChange,
  reason,
  returnFocusRef,
}: InterviewPaywallDialogProps) {
  const router = useRouter()
  const quotaReached = reason.kind === 'quota'
  const retryIntent = reason.kind === 'retry'
  const freeActionLabel = quotaReached
    ? 'Review existing interviews'
    : retryIntent
      ? 'Review this completed interview'
      : 'Choose a Free practice option'

  function choosePlan(plan: 'monthly' | 'annual') {
    const intent = retryIntent ? '&intent=retry' : ''
    router.push(`/billing?plan=${plan}&source=interview${intent}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto p-0"
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current) return
          event.preventDefault()
          returnFocusRef.current.focus()
        }}
      >
        <div className="space-y-5 p-5 sm:p-7">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10">
              <MessagesSquare className="h-5 w-5 text-brand-400" />
            </div>
            <DialogTitle className="pr-8 text-xl sm:text-2xl">
              {quotaReached ? 'Keep your Interview Lab practice going.' : `Unlock ${reason.label}.`}
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              Pro expands written interview practice with additional session styles, challenging difficulty, more questions per session, and a much higher session limit.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-300">
              {quotaReached ? 'Free limit reached' : 'Your selected practice option'}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{reason.label}</p>
          </div>

          <div className="space-y-2 text-sm text-foreground/80">
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Choose from six additional interview session styles.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Use challenging difficulty and up to 30 questions in a written session.
            </p>
            <p className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Run up to 150 total interview sessions per billing period.
            </p>
            {retryIntent && (
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                Get more answer retries across your billing period.
              </p>
            )}
          </div>

          {reason.kind === 'voice' && (
            <p className="rounded-lg border border-border bg-surface-100 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Live voice practice is available only when the production feature is enabled, and it requires Pro.
            </p>
          )}

          <div className="grid gap-3">
            <Button
              type="button"
              variant="gradient"
              size="lg"
              onClick={() => choosePlan('monthly')}
              className="h-auto min-h-12 w-full flex-col items-start gap-1 whitespace-normal px-5 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
            >
              <span>Monthly Pro</span>
              <span className="flex items-center gap-1.5 text-white/90 sm:ml-auto">
                $15/month <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => choosePlan('annual')}
              className="h-auto min-h-12 w-full flex-col items-start gap-1 whitespace-normal px-5 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex flex-wrap items-center gap-2">
                Annual Pro
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Save $30</span>
              </span>
              <span className="text-muted-foreground sm:ml-auto">$150/year</span>
            </Button>
          </div>

          <p className="rounded-lg border border-border bg-surface-100 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {reason.kind === 'retry'
              ? 'Checkout upgrades your account; it does not submit the retry. After payment, return to Interview Lab, reopen this completed interview, and retry the answer again.'
              : 'Checkout upgrades your account; it does not create or start an interview. After payment, return to Interview Lab, choose New Interview, and configure your next practice session.'}
          </p>

          <Button type="button" variant="ghost" className="min-h-11 w-full whitespace-normal" onClick={() => onOpenChange(false)}>
            {freeActionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
