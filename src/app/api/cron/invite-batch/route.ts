import { NextRequest, NextResponse } from 'next/server'
import { runInviteBatch } from '@/lib/growth/invite-batch'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // A valid cron credential proves caller authority; it does not make an intentionally
  // disabled or incomplete mail configuration an internal server error. Keep these
  // preconditions ahead of claims/provider work and make the operational state explicit.
  if (process.env.EMAILS_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Invite batch is disabled', code: 'EMAILS_DISABLED' },
      { status: 503 },
    )
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_POSTAL_ADDRESS?.trim()) {
    return NextResponse.json(
      { error: 'Invite email delivery is not configured', code: 'EMAILS_NOT_CONFIGURED' },
      { status: 503 },
    )
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
