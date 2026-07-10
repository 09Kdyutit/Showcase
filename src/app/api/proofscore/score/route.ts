import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { preparePromptCall } from '@/lib/ai/client'
import { resumeParsePrompt } from '@/lib/ai/prompts/registry'
import { sanitizeParsedResume } from '@/lib/ai/sanitize-resume'
import { isAIEnabled, KILL_SWITCH_MESSAGE } from '@/lib/feature-flags'
import { createServiceClient } from '@/lib/supabase/server'
import { recordPromptCost } from '@/lib/growth/prompt-cost'
import { buildPublicProofScore } from '@/lib/proofscore/public-tool'
import {
  PUBLIC_PROOFSCORE_IP_LIMIT,
  ProofScoreCapacityError,
  claimDailyCapacity,
  clientFingerprint,
  enforceAtomicLimit,
  getCapacitySnapshot,
  getReservationState,
} from '@/lib/proofscore/capacity'

export const maxDuration = 60

const requestSchema = z.object({
  resumeText: z.string().trim().min(200, 'Paste at least 200 characters so the audit has enough evidence.').max(12000, 'Keep resume text under 12,000 characters.'),
  targetRole: z.string().trim().max(120).optional().default(''),
  industry: z.string().trim().max(120).optional().default(''),
  reservationToken: z.string().uuid().optional(),
})

const reservationTokenSchema = z.string().uuid()

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

export async function GET(request: NextRequest) {
  try {
    const service = await createServiceClient()
    const capacity = await getCapacitySnapshot(service)
    const rawToken = request.nextUrl.searchParams.get('reservation')
    let reservation: Awaited<ReturnType<typeof getReservationState>> | null = null

    if (rawToken) {
      const token = reservationTokenSchema.safeParse(rawToken)
      reservation = token.success
        ? await getReservationState(service, token.data)
        : { state: 'invalid', reservedFor: null }
    }

    return noStore({ data: { capacity, reservation } })
  } catch (error) {
    console.error('[proofscore/score:get]', error instanceof Error ? error.message : 'unknown error')
    return noStore(
      { error: 'Live audit capacity is temporarily unavailable. Please try again shortly.', code: 'CAPACITY_UNAVAILABLE' },
      { status: 503 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAIEnabled()) {
      return noStore({ error: KILL_SWITCH_MESSAGE, code: 'AI_DISABLED' }, { status: 503 })
    }

    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
      return noStore({ error: 'Request is too large.', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }

    const json = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(json)
    if (!parsed.success) {
      return noStore(
        { error: parsed.error.issues[0]?.message ?? 'Check the resume text and try again.', code: 'INVALID_INPUT' },
        { status: 400 },
      )
    }

    const service = await createServiceClient()
    const { resumeText, targetRole, industry, reservationToken } = parsed.data

    // Validate a reservation before touching either quota. This prevents an early/expired
    // link from consuming the visitor's IP allowance, and prevents an IP denial from burning
    // the one-use reservation itself.
    if (reservationToken) {
      const reservation = await getReservationState(service, reservationToken)
      if (reservation.state !== 'ready') {
        const messages = {
          early: `This reserved audit is valid on ${reservation.reservedFor} (UTC).`,
          used: 'This one-use reservation has already been used.',
          expired: 'This reservation has expired.',
          invalid: 'This reservation link is not valid.',
        } as const
        return noStore(
          {
            error: messages[reservation.state],
            code: `RESERVATION_${reservation.state.toUpperCase()}`,
            reservedFor: reservation.reservedFor,
          },
          { status: 409 },
        )
      }
    }

    // The IP counter is an abuse-attempt throttle rather than a promised audit slot. Keep
    // it ahead of budget reservation so one connection cannot churn reserve/release calls.
    const fingerprint = clientFingerprint(request)
    const ipLimit = await enforceAtomicLimit(
      service,
      `proofscore-public:${fingerprint}`,
      PUBLIC_PROOFSCORE_IP_LIMIT,
      60 * 60,
    )
    if (!ipLimit.allowed) {
      return noStore(
        {
          error: 'Too many audit attempts were started from this connection this hour. Please try again later.',
          code: 'IP_RATE_LIMITED',
          retryAfter: new Date(Date.now() + ipLimit.retry_after_seconds * 1000).toISOString(),
        },
        { status: 429 },
      )
    }

    // Reserve the maximum dollar cost before consuming a daily slot or one-use reservation.
    // A budget denial/outage therefore cannot burn actual public audit capacity.
    const preparedPrompt = await preparePromptCall(resumeParsePrompt, { resumeText })
    try {
      const capacity = await claimDailyCapacity(service, reservationToken)
      if (!capacity.allowed) {
        const snapshot = await getCapacitySnapshot(service)
        return noStore(
          {
            error: reservationToken
              ? 'This reserved audit is no longer available.'
              : "Today's 25 free audits are done.",
            code: reservationToken ? 'RESERVATION_UNAVAILABLE' : 'DAILY_CAP_REACHED',
            capacity: snapshot,
          },
          { status: 429 },
        )
      }

      // The model extracts structure only. Every score and every priority below is computed by
      // the deterministic engine; the provider never decides whether a resume deserves a 42.
      const { data: rawResume, meta } = await preparedPrompt.run()
      await recordPromptCost({ userId: null, meta })
      const sanitizedResume = sanitizeParsedResume(rawResume, resumeText)
      const result = buildPublicProofScore(sanitizedResume, targetRole, industry)

      // Parse handoff is best-effort after the completed audit. A storage outage should not
      // hide a score the visitor already spent capacity to compute; it only disables the
      // onboarding shortcut for that response.
      await service.from('pending_parses').delete().lt('expires_at', new Date().toISOString())
      const { data: handoff, error: handoffError } = await service
        .from('pending_parses')
        .insert({
          raw_text: resumeText,
          parsed_json: sanitizedResume as unknown as Record<string, unknown>,
        })
        .select('token, expires_at')
        .single()

      if (handoffError) {
        console.error('[proofscore/score] parse handoff unavailable:', handoffError.message)
      }

      return noStore({
        data: {
          result,
          capacity: {
            cap: 25,
            remaining: capacity.remaining,
          },
          handoff: handoff
            ? { token: handoff.token, expiresAt: handoff.expires_at }
            : null,
        },
      })
    } finally {
      // Idempotent and a no-op once run() begins, so ambiguous provider outcomes retain
      // their conservative reservation while every pre-provider exit releases it.
      await preparedPrompt.release()
    }
  } catch (error) {
    if (error instanceof ProofScoreCapacityError) {
      return noStore(
        { error: 'Live audit capacity is temporarily unavailable. Please try again shortly.', code: 'CAPACITY_UNAVAILABLE' },
        { status: 503 },
      )
    }
    console.error(
      '[proofscore/score:post]',
      error instanceof Error ? (error.cause ?? error.message) : 'unknown error',
    )
    return noStore(
      { error: 'We could not finish this audit. Please try again.', code: 'AUDIT_FAILED' },
      { status: 500 },
    )
  }
}
