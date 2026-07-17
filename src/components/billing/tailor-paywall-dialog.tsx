'use client'

import type { RefObject } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TailorPaywallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef?: RefObject<HTMLButtonElement | null>
}

export function TailorPaywallDialog({ open, onOpenChange, returnFocusRef }: TailorPaywallDialogProps) {
  const router = useRouter()

  function choosePlan(plan: 'monthly' | 'annual') {
    router.push(`/billing?plan=${plan}&source=tailor`)
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
              <Sparkles className="h-5 w-5 text-brand-400" />
            </div>
            <DialogTitle className="pr-8 text-xl sm:text-2xl">
              Create an application kit for this saved role.
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              Showcase Pro creates an editable résumé draft grounded in your saved experience and this role. Review it before use; Showcase does not submit applications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-foreground/80">
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Review the tailored draft and accept or revert suggested experience-bullet changes.
            </p>
            <p className="flex items-start gap-2">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Get a Truth Ledger and interview brief grounded in your saved materials.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Add a cover letter or recruiter note when you choose those options.
            </p>
          </div>

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
            Checkout upgrades your account; it does not generate or submit the kit. After payment, return to this saved role, review your options, and choose Generate.
          </p>

          <Button type="button" variant="ghost" className="min-h-11 w-full whitespace-normal" onClick={() => onOpenChange(false)}>
            Keep this role saved for free
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
