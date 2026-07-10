import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const now = new Date()
  const todayUtc = now.toISOString().slice(0, 10)
  const rateCounterCutoff = new Date(now.getTime() - 8 * 86400_000).toISOString()
  const emailLedgerCutoff = new Date(now.getTime() - 90 * 86400_000).toISOString()

  try {
    const [
      parses,
      reservations,
      counters,
      completedDeliveries,
      exhaustedDeliveries,
      providerEvents,
    ] = await Promise.all([
      service.from('pending_parses').delete({ count: 'exact' }).lte('expires_at', now.toISOString()),
      service.from('proofscore_reservations').delete({ count: 'exact' }).lt('reserved_for', todayUtc),
      service.from('rate_limit_counters').delete({ count: 'exact' }).lt('window_start', rateCounterCutoff),
      service.from('email_deliveries').delete({ count: 'exact' })
        .in('status', ['sent', 'suppressed'])
        .lt('created_at', emailLedgerCutoff),
      service.from('email_deliveries').delete({ count: 'exact' })
        .eq('status', 'failed')
        .gte('attempts', 3)
        .lt('created_at', emailLedgerCutoff),
      service.from('email_provider_events').delete({ count: 'exact' })
        .in('status', ['processed', 'failed'])
        .lt('updated_at', emailLedgerCutoff),
    ])

    for (const [name, result] of [
      ['pending parses', parses],
      ['ProofScore reservations', reservations],
      ['rate-limit counters', counters],
      ['completed email deliveries', completedDeliveries],
      ['exhausted email deliveries', exhaustedDeliveries],
      ['email provider events', providerEvents],
    ] as const) {
      if (result.error) throw new Error(`${name}: ${result.error.message}`)
    }

    return NextResponse.json({
      ok: true,
      deleted: {
        pendingParses: parses.count ?? 0,
        proofscoreReservations: reservations.count ?? 0,
        rateLimitCounters: counters.count ?? 0,
        emailDeliveries: (completedDeliveries.count ?? 0) + (exhaustedDeliveries.count ?? 0),
        emailProviderEvents: providerEvents.count ?? 0,
      },
      policy: {
        pendingParseAvailability: '48 hours; expired rows are purged by this hourly job',
        rateLimitCounters: '8 days',
        terminalEmailLedger: '90 days',
        suppressions: 'retained to honor opt-outs and provider complaints',
      },
    })
  } catch (error) {
    console.error('[cron/data-retention]', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Data retention cleanup failed' }, { status: 500 })
  }
}
