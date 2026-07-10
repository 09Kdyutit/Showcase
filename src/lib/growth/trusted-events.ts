import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

export const TRUSTED_GROWTH_EVENTS = [
  'signup_completed',
  'portfolio_generated',
  'portfolio_preview_viewed',
  'portfolio_completed',
  'proofscore_viewed',
  'portfolio_published',
  'publish_paywall_viewed',
  'checkout_completed',
  'meaningful_return',
] as const

export type TrustedGrowthEvent = (typeof TRUSTED_GROWTH_EVENTS)[number]
export type TrustedEventMetadata = Record<string, string | number | boolean | null>

export interface TrustedEventInput {
  idempotencyKey: string
  eventName: TrustedGrowthEvent
  userId?: string | null
  entityType?: string | null
  entityId?: string | null
  source: string
  metadata?: TrustedEventMetadata
  occurredAt?: string
}

/**
 * Records an idempotent server-authored fact. Callers must authenticate and verify the
 * underlying resource before calling this helper; the service role is intentionally kept
 * inside server code.
 */
export async function recordTrustedEvent(
  input: TrustedEventInput,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? await createServiceClient()
  const { error } = await supabase.from('trusted_events').upsert({
    idempotency_key: input.idempotencyKey,
    user_id: input.userId ?? null,
    event_name: input.eventName,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    source: input.source,
    metadata: input.metadata ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true })

  if (error) throw new Error(`Could not record trusted event: ${error.message}`)
}

/** Growth telemetry must never turn a successful product mutation into an error. */
export async function recordTrustedEventSafe(
  input: TrustedEventInput,
  client?: SupabaseClient
): Promise<boolean> {
  try {
    await recordTrustedEvent(input, client)
    return true
  } catch (error) {
    console.error('[growth/trusted-event]', error instanceof Error ? error.message : error)
    return false
  }
}
