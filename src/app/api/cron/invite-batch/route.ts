import { NextRequest, NextResponse } from 'next/server'
import { runInviteBatch } from '@/lib/growth/invite-batch'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requested = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '100', 10)
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, requested)) : 100

  try {
    const result = await runInviteBatch({ limit })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[cron/invite-batch]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Invite batch failed' }, { status: 500 })
  }
}
