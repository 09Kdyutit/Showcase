'use client'

import { useState, useSyncExternalStore } from 'react'
import { Copy, Share2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { configuredAppUrl } from '@/lib/app-url'
import { buildReferralMessage, buildReferralUrl } from '@/lib/referrals/share'

interface CompletionReferralDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  referralCode: string
}

const subscribeToBrowserCapability = () => () => {}

export function CompletionReferralDialog({
  open,
  onOpenChange,
  referralCode,
}: CompletionReferralDialogProps) {
  const [message, setMessage] = useState(() => buildReferralMessage(buildReferralUrl(
    configuredAppUrl(),
    referralCode,
  )))
  const canShare = useSyncExternalStore(
    subscribeToBrowserCapability,
    () => typeof navigator.share === 'function',
    () => false,
  )

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      recordShare('copy')
      toast.success('Invite message copied')
      onOpenChange(false)
    } catch {
      toast.error('Could not copy. Select the message and copy it manually.')
    }
  }

  async function shareMessage() {
    if (!navigator.share) return
    try {
      await navigator.share({ title: 'Try Showcase', text: message })
      recordShare('native_share')
      onOpenChange(false)
    } catch (error) {
      // AbortError means the user dismissed the native share sheet; no error toast needed.
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error('Could not open sharing. You can copy the message instead.')
    }
  }

  function recordShare(channel: 'copy' | 'native_share') {
    fetch('/api/growth/referral-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
      keepalive: true,
    }).catch(() => {})
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10">
            <Sparkles className="h-5 w-5 text-brand-400" />
          </div>
          <DialogTitle>Your first portfolio is ready. Know someone still sending PDFs into the void?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            You earned 3 invites by completing your first portfolio. Each one skips the waitlist. Your friend starts with +5 AI credits, and you earn +5 when they complete their first portfolio. Share only with someone it could genuinely help.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="completion-referral-message" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your invite message <span className="normal-case font-normal">(edit anything)</span>
          </label>
          <Textarea
            id="completion-referral-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-[145px] text-sm leading-relaxed"
          />
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Credits are awarded for a real outcome, not for sending: the friend receives their +5 on referral claim, and your +5 is released only after their first portfolio generation completes.
        </p>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" className="gap-2" onClick={copyMessage} disabled={!message.trim()}>
              <Copy className="h-4 w-4" /> Copy message
            </Button>
            {canShare && (
              <Button type="button" variant="gradient" className="gap-2" onClick={shareMessage} disabled={!message.trim()}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
