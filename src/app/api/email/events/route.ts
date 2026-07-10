import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import {
  RESEND_DELIVERY_EVENTS,
  isFreshWebhookTimestamp,
  normalizeEmailAddress,
  type ResendDeliveryEventType,
} from '@/lib/email/webhook'

export const maxDuration = 20

interface ResendDeliveryEvent {
  type: ResendDeliveryEventType
  created_at: string
  data: {
    email_id: string
    created_at: string
    to: string[]
    tags?: Record<string, string>
    bounce?: { message?: string; type?: string; subType?: string }
  }
}

function signedHeaders(headers: Headers) {
  return {
    id: headers.get('svix-id') ?? headers.get('webhook-id'),
    timestamp: headers.get('svix-timestamp') ?? headers.get('webhook-timestamp'),
    signature: headers.get('svix-signature') ?? headers.get('webhook-signature'),
  }
}

function isDeliveryEvent(value: unknown): value is ResendDeliveryEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<ResendDeliveryEvent>
  return typeof event.type === 'string'
    && (RESEND_DELIVERY_EVENTS as readonly string[]).includes(event.type)
    && typeof event.created_at === 'string'
    && Boolean(event.data)
    && typeof event.data?.email_id === 'string'
    && Array.isArray(event.data?.to)
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_DELIVERY_WEBHOOK_SECRET ?? process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[email/events] RESEND_DELIVERY_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }

  const headers = signedHeaders(request.headers)
  if (!headers.id || !headers.timestamp || !headers.signature
    || !isFreshWebhookTimestamp(headers.timestamp)) {
    return NextResponse.json({ error: 'Invalid or stale signature' }, { status: 401 })
  }

  const raw = await request.text()
  let verified: unknown
  try {
    const resend = new Resend(process.env.RESEND_API_KEY ?? 'webhook-verification-only')
    verified = resend.webhooks.verify({
      payload: raw,
      headers: { id: headers.id, timestamp: headers.timestamp, signature: headers.signature },
      webhookSecret,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Other signed Resend event types belong to other endpoints or require no state change.
  if (!isDeliveryEvent(verified)) return NextResponse.json({ ok: true, ignored: true })
  const event = verified
  const occurredAt = new Date(event.created_at)
  if (!Number.isFinite(occurredAt.getTime())) {
    return NextResponse.json({ error: 'Invalid event timestamp' }, { status: 400 })
  }

  const service = await createServiceClient()
  const eventId = `resend-delivery:${headers.id}`
  const { data: claim, error: claimError } = await service.rpc('claim_email_provider_event', {
    p_event_id: eventId,
    p_event_type: event.type,
    p_provider_message_id: event.data.email_id,
    p_event_occurred_at: occurredAt.toISOString(),
    p_stale_after_seconds: 300,
  })
  if (claimError) return NextResponse.json({ error: 'Webhook claim failed' }, { status: 500 })
  if (claim === 'processed') return NextResponse.json({ ok: true, duplicate: true })
  if (claim !== 'claimed') return NextResponse.json({ error: 'Webhook is already processing' }, { status: 409 })

  const finish = async (status: 'processed' | 'failed', error: string | null = null) => {
    await service.from('email_provider_events').update({
      status,
      processed_at: status === 'processed' ? new Date().toISOString() : null,
      last_error: error?.slice(0, 1000) ?? null,
      updated_at: new Date().toISOString(),
    }).eq('event_id', eventId)
  }

  try {
    const deliveryId = event.data.tags?.delivery_id
    const validDeliveryId = deliveryId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(deliveryId)
      ? deliveryId
      : null
    const deliveryUpdate = event.type === 'email.delivered'
      ? { provider_message_id: event.data.email_id, provider_status: 'delivered', delivered_at: occurredAt.toISOString() }
      : event.type === 'email.bounced'
        ? {
            provider_message_id: event.data.email_id,
            provider_status: 'bounced',
            bounced_at: occurredAt.toISOString(),
            last_error: event.data.bounce?.message?.slice(0, 500) ?? 'Email bounced',
          }
        : { provider_message_id: event.data.email_id, provider_status: 'complained', complained_at: occurredAt.toISOString() }

    const deliveryResult = validDeliveryId
      ? await service.from('email_deliveries').update(deliveryUpdate).eq('id', validDeliveryId).select('id')
      : await service.from('email_deliveries').update(deliveryUpdate).eq('provider_message_id', event.data.email_id).select('id')
    if (deliveryResult.error) throw new Error(deliveryResult.error.message)
    if (event.data.tags?.source === 'showcase_outbox' && (deliveryResult.data?.length ?? 0) === 0) {
      throw new Error('Outbox delivery is not committed yet; retry webhook')
    }

    if (event.type === 'email.bounced' || event.type === 'email.complained') {
      const reason = event.type === 'email.bounced' ? 'bounce' : 'complaint'
      const emails = [...new Set(event.data.to.slice(0, 50).map(normalizeEmailAddress).filter((email): email is string => Boolean(email)))]
      for (const email of emails) {
        const { data: applied, error: suppressionError } = await service.rpc(
          'apply_email_recipient_suppression',
          {
            p_email: email,
            p_reason: reason,
            p_provider: 'resend',
            p_provider_event_id: headers.id,
            p_event_at: occurredAt.toISOString(),
            p_metadata: event.type === 'email.bounced'
              ? { bounce_type: event.data.bounce?.type ?? null, bounce_subtype: event.data.bounce?.subType ?? null }
              : {},
          },
        )
        if (suppressionError || applied !== true) {
          throw new Error(suppressionError?.message ?? 'Recipient suppression was rejected')
        }
      }
    }

    await finish('processed')
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delivery webhook processing failed'
    await finish('failed', message)
    console.error('[email/events]', message)
    return NextResponse.json({ error: 'Delivery webhook processing failed' }, { status: 500 })
  }
}
