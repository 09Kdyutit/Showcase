import 'server-only'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { betaInviteEmail } from '@/lib/email/invite-email'
import { findSuppressedEmails } from '@/lib/email/suppressions'
import { normalizeEmailAddress } from '@/lib/email/webhook'

interface ClaimedInvite {
  signup_id: string
  email: string
  full_name: string | null
  invite_token: string
  claim_id: string
  delivery_key: string
}

export interface InviteBatchResult {
  claimed: number
  sent: number
  failed: number
  suppressed: number
  pausedOrAtLimit: boolean
}

export async function runInviteBatch(options: { limit?: number; appUrl?: string } = {}): Promise<InviteBatchResult> {
  if (process.env.EMAILS_ENABLED !== 'true') throw new Error('EMAILS_ENABLED is not true')
  const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 100)))
  const appUrl = options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.tryshowcase.ink'
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) throw new Error('RESEND_API_KEY is not configured')
  const postalAddress = process.env.EMAIL_POSTAL_ADDRESS?.trim()
  if (!postalAddress) throw new Error('EMAIL_POSTAL_ADDRESS is required before sending invitations')

  const service = await createServiceClient()
  const { data, error } = await service.rpc('claim_waitlist_invites', { p_limit: limit })
  if (error) throw new Error(`Could not claim invite batch: ${error.message}`)

  const claims = (data ?? []) as ClaimedInvite[]
  if (claims.length === 0) {
    return { claimed: 0, sent: 0, failed: 0, suppressed: 0, pausedOrAtLimit: true }
  }

  const resend = new Resend(resendKey)
  const excluded = new Set(
    (process.env.INVITE_EXCLUDE ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
  )
  // Read once for the claimed batch. Lookup errors throw before the first provider call,
  // leaving claims retryable instead of turning a suppression outage into unwanted mail.
  const providerSuppressed = await findSuppressedEmails(service, claims.map((claim) => claim.email))
  let sent = 0
  let failed = 0
  let suppressed = 0

  for (const claim of claims) {
    const normalizedEmail = normalizeEmailAddress(claim.email)
    const suppressionReason = excluded.has(normalizedEmail ?? claim.email.trim().toLowerCase())
      ? 'Suppressed by INVITE_EXCLUDE'
      : !normalizedEmail || providerSuppressed.has(normalizedEmail)
        ? 'Suppressed by provider feedback'
        : null
    if (suppressionReason) {
      suppressed++
      const { error: suppressError } = await service
        .from('waitlist_signups')
        .update({
          invite_claim_id: null,
          invite_claimed_at: null,
          invite_next_attempt_at: '9999-12-31T23:59:59.999Z',
          invite_last_error: suppressionReason,
        })
        .eq('id', claim.signup_id)
        .eq('invite_claim_id', claim.claim_id)
      if (suppressError) {
        failed++
        console.error('[invite-batch] exclusion could not be persisted', {
          signupId: claim.signup_id,
          error: suppressError.message,
        })
      }
      continue
    }

    try {
      const message = betaInviteEmail(claim.full_name, appUrl, claim.invite_token, postalAddress)
      const response = await resend.emails.send(
        {
          from: 'Showcase <hello@tryshowcase.ink>',
          to: claim.email,
          subject: message.subject,
          html: message.html,
          text: message.text,
          tags: [{ name: 'type', value: 'paced_waitlist_invite' }],
        },
        { idempotencyKey: `showcase-waitlist-invite-${claim.delivery_key}` }
      )

      if (response.error || !response.data?.id) {
        throw new Error(response.error?.message ?? 'Resend returned no message id')
      }

      const { data: completed, error: completeError } = await service.rpc('complete_waitlist_invite', {
        p_signup_id: claim.signup_id,
        p_claim_id: claim.claim_id,
        p_provider_message_id: response.data.id,
      })
      if (completeError || completed !== true) {
        throw new Error(completeError?.message ?? 'Invite claim could not be completed')
      }
      sent++
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : 'Invite delivery failed'
      const { error: releaseError } = await service.rpc('release_waitlist_invite', {
        p_signup_id: claim.signup_id,
        p_claim_id: claim.claim_id,
        p_error: message.slice(0, 500),
      })
      if (releaseError) {
        console.error('[invite-batch] claim release failed', {
          signupId: claim.signup_id,
          error: releaseError.message,
        })
      }
      console.error('[invite-batch] delivery failed', { signupId: claim.signup_id, error: message })
    }
  }

  return { claimed: claims.length, sent, failed, suppressed, pausedOrAtLimit: false }
}
