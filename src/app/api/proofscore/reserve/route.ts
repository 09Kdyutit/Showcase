import { NextRequest, NextResponse } from 'next/server'
import { Resend, type ErrorResponse } from 'resend'
import { z } from 'zod'
import { proofScoreReservationEmail } from '@/lib/email/proofscore-reservation-email'
import { isEmailSuppressed } from '@/lib/email/suppressions'
import { absoluteUrl } from '@/lib/utils'
import { createServiceClient } from '@/lib/supabase/server'
import {
  ProofScoreCapacityError,
  clientFingerprint,
  enforceAtomicLimit,
  getCapacitySnapshot,
  reserveTomorrow,
} from '@/lib/proofscore/capacity'

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(320).toLowerCase(),
  consent: z.literal(true, { error: 'Confirm that we may send the one reservation email.' }),
  websiteUrlHidden: z.string().max(200).optional().default(''),
})

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

function isDefinitiveProviderRejection(error: ErrorResponse): boolean {
  const status = error.statusCode
  return status !== null
    && status >= 400
    && status < 500
    && ![408, 409, 425, 429].includes(status)
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > 8 * 1024) {
      return noStore({ error: 'Request is too large.' }, { status: 413 })
    }

    const json = await request.json().catch(() => null)
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return noStore({ error: parsed.error.issues[0]?.message ?? 'Check your email and try again.' }, { status: 400 })
    }

    // Honeypot submissions receive a quiet success without writing a reservation or email.
    if (parsed.data.websiteUrlHidden) return noStore({ success: true })

    const service = await createServiceClient()
    const fingerprint = clientFingerprint(request)
    const limit = await enforceAtomicLimit(
      service,
      `proofscore-reservation:${fingerprint}`,
      5,
      24 * 60 * 60,
    )
    if (!limit.allowed) {
      return noStore(
        { error: 'Too many reservation attempts from this connection. Please try again tomorrow.' },
        { status: 429 },
      )
    }

    // Reservation is the overflow path, not an alternate way to bank tomorrow's capacity
    // while real spots remain today.
    const today = await getCapacitySnapshot(service)
    if (today.remaining > 0) {
      return noStore(
        { error: `${today.remaining} free audit${today.remaining === 1 ? ' is' : 's are'} still available today.`, code: 'TODAY_STILL_AVAILABLE' },
        { status: 409 },
      )
    }

    if (await isEmailSuppressed(service, parsed.data.email)) {
      return noStore(
        { error: 'We cannot send a reservation email to this address.', code: 'EMAIL_UNAVAILABLE' },
        { status: 409 },
      )
    }
    if (process.env.EMAILS_ENABLED !== 'true') {
      return noStore(
        { error: 'Reservation email is temporarily unavailable.', code: 'EMAIL_DISABLED' },
        { status: 503 },
      )
    }

    const reservation = await reserveTomorrow(service, parsed.data.email)
    if (!reservation.allowed || !reservation.reservation_token) {
      return noStore(
        { error: "Tomorrow's 25 reserved audit spots are already full.", code: 'TOMORROW_FULL' },
        { status: 409 },
      )
    }

    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
    const auditUrl = absoluteUrl(`/proofscore?reservation=${encodeURIComponent(reservation.reservation_token)}`)
    const email = proofScoreReservationEmail(auditUrl, reservation.reservation_date)

    let definitiveRejection = false
    try {
      if (!resend) {
        definitiveRejection = true
        throw new Error('Email provider is not configured')
      }
      const { error } = await resend.emails.send(
        {
          from: 'Showcase <hello@tryshowcase.ink>',
          to: parsed.data.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          tags: [{ name: 'type', value: 'proofscore_reservation' }],
        },
        { idempotencyKey: `proofscore-reservation-${reservation.reservation_token}` },
      )
      if (error) {
        definitiveRejection = isDefinitiveProviderRejection(error)
        throw new Error(error.message)
      }
    } catch (error) {
      // A transport/5xx response can occur after the provider accepted the request. Keep the
      // reservation in that ambiguous case; a retry reuses both token and provider
      // idempotency key. Only an explicit, non-retryable 4xx rejection releases capacity.
      if (definitiveRejection) {
        const { error: releaseError } = await service
          .from('proofscore_reservations')
          .delete()
          .eq('token', reservation.reservation_token)
          .eq('status', 'reserved')
        if (releaseError) {
          definitiveRejection = false
          console.error('[proofscore/reserve] rejected reservation could not be released:', releaseError.message)
        }
      }
      console.error('[proofscore/reserve] email delivery failed:', error instanceof Error ? error.message : 'unknown error')
      return noStore(
        definitiveRejection
          ? { error: 'We could not send the reservation email, so no spot was held. Please try again.', code: 'EMAIL_REJECTED' }
          : { error: 'Email delivery is still being confirmed. Your spot remains held; submit again to retry safely.', code: 'EMAIL_DELIVERY_PENDING' },
        { status: 503 },
      )
    }

    return noStore({
      success: true,
      alreadyReserved: reservation.already_reserved,
      reservedFor: reservation.reservation_date,
    })
  } catch (error) {
    if (!(error instanceof ProofScoreCapacityError)) {
      console.error('[proofscore/reserve]', error instanceof Error ? error.message : 'unknown error')
    }
    return noStore(
      { error: 'Reservations are temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    )
  }
}
