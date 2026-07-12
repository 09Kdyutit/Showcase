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
  const rateCounterCutoff = new Date(now.getTime() - 8 * 86400_000).toISOString()
  const emailLedgerCutoff = new Date(now.getTime() - 90 * 86400_000).toISOString()

  try {
    const [
      counters,
      completedDeliveries,
      exhaustedDeliveries,
      providerEvents,
    ] = await Promise.all([
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
        rateLimitCounters: counters.count ?? 0,
        emailDeliveries: (completedDeliveries.count ?? 0) + (exhaustedDeliveries.count ?? 0),
        emailProviderEvents: providerEvents.count ?? 0,
      },
      policy: {
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
