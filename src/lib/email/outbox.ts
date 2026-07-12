import type { SupabaseClient } from '@supabase/supabase-js'
import type { Resend } from 'resend'

export interface EmailDeliveryInput {
  idempotencyKey: string
  userId?: string | null
  recipientEmail: string
  template: string
  subject: string
  html: string
  text: string
  scheduledAt?: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface EmailDeliveryRow {
  id: string
  idempotency_key: string
  user_id: string | null
  recipient_email: string
  template: string
  subject: string
  html_body: string
  text_body: string
  attempts: number
}

export async function enqueueEmailDeliveries(
  supabase: SupabaseClient,
  deliveries: EmailDeliveryInput[]
): Promise<void> {
  if (deliveries.length === 0) return
  const { error } = await supabase.from('email_deliveries').upsert(deliveries.map((delivery) => ({
    idempotency_key: delivery.idempotencyKey,
    user_id: delivery.userId ?? null,
    recipient_email: delivery.recipientEmail,
    template: delivery.template,
    subject: delivery.subject,
    html_body: delivery.html,
    text_body: delivery.text,
    scheduled_at: delivery.scheduledAt ?? new Date().toISOString(),
    metadata: delivery.metadata ?? {},
  })), { onConflict: 'idempotency_key', ignoreDuplicates: true })
  if (error) throw new Error(`Could not enqueue email: ${error.message}`)
}

export async function claimEmailDeliveries(
  supabase: SupabaseClient,
  templates: string[],
  limit: number
): Promise<EmailDeliveryRow[]> {
  const { data, error } = await supabase.rpc('claim_email_deliveries', {
    p_templates: templates,
    p_limit: limit,
  })
  if (error) throw new Error(`Could not claim email deliveries: ${error.message}`)
  return (data ?? []) as EmailDeliveryRow[]
}

function providerErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message.slice(0, 500)
  }
  return 'Email provider rejected the request'
}

async function deliverOne(
  supabase: SupabaseClient,
  resend: Resend,
  from: string,
  delivery: EmailDeliveryRow
): Promise<'sent' | 'failed'> {
  try {
    const result = await resend.emails.send({
      from,
      to: delivery.recipient_email,
      subject: delivery.subject,
      html: delivery.html_body,
      text: delivery.text_body,
      tags: [
        { name: 'source', value: 'showcase_outbox' },
        { name: 'delivery_id', value: delivery.id },
      ],
    }, { idempotencyKey: delivery.idempotency_key })

    if (result.error || !result.data?.id) throw result.error ?? new Error('Email provider returned no message id')
    const { error } = await supabase.from('email_deliveries').update({
      status: 'sent',
      provider_message_id: result.data.id,
      sent_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', delivery.id).eq('status', 'processing')
    if (error) throw error
    // Do not overwrite a delivered/bounced/complained webhook that raced the API response.
    await supabase.from('email_deliveries').update({ provider_status: 'sent' })
      .eq('id', delivery.id)
      .in('provider_status', ['pending', 'failed'])
    return 'sent'
  } catch (error) {
    await supabase.from('email_deliveries').update({
      status: 'failed',
      last_error: providerErrorMessage(error),
      updated_at: new Date().toISOString(),
    }).eq('id', delivery.id).eq('status', 'processing')
    await supabase.from('email_deliveries').update({ provider_status: 'failed' })
      .eq('id', delivery.id)
      .eq('provider_status', 'pending')
    return 'failed'
  }
}

export async function processEmailDeliveries(input: {
  supabase: SupabaseClient
  resend: Resend
  from: string
  templates: string[]
  limit: number
  concurrency?: number
}): Promise<{ attempted: number; sent: number; failed: number }> {
  const claimed = await claimEmailDeliveries(input.supabase, input.templates, input.limit)
  const concurrency = Math.max(1, Math.min(input.concurrency ?? 5, 10))
  let sent = 0
  let failed = 0
  for (let index = 0; index < claimed.length; index += concurrency) {
    const results = await Promise.all(claimed.slice(index, index + concurrency).map((delivery) =>
      deliverOne(input.supabase, input.resend, input.from, delivery)
    ))
    sent += results.filter((result) => result === 'sent').length
    failed += results.filter((result) => result === 'failed').length
  }
  return { attempted: claimed.length, sent, failed }
}
