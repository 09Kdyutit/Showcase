import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/ai/rate-limit'
import { isInterviewLiveEnabled } from '@/lib/interviews/config'
import { createLiveEphemeralToken } from '@/lib/interviews/gemini/live'

/**
 * Issues a short-lived Gemini Live ephemeral token for a voice session. Runs every
 * check the mission requires BEFORE reaching the point where a real implementation
 * would call Gemini — ownership, session state, entitlement — so that once Live is
 * actually enabled, this route does not need new security
 * plumbing, only the live.ts provider call itself. (Origin validation for all
 * /api/* state-changing requests already happens centrally in src/proxy.ts — see
 * security/release-gate.json P1-07 — so it is not repeated here.) As built,
 * isInterviewLiveEnabled() is false (see config.ts), so createLiveEphemeralToken()
 * always throws after all of those checks pass — proving the gate fails closed at the
 * LAST possible step, not by accident earlier for an unrelated reason.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, user_id, status, delivery_mode, max_duration_seconds')
      .eq('id', id)
      .eq('user_id', user.id) // ownership — a token can never be issued for another user's session
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.delivery_mode !== 'voice') {
      return NextResponse.json({ error: 'This session is not configured for voice delivery.', code: 'INVALID_DELIVERY_MODE' }, { status: 409 })
    }
    if (session.status !== 'planned' && session.status !== 'in_progress') {
      return NextResponse.json({ error: `Session is ${session.status}, cannot issue a live token.`, code: 'INVALID_STATE' }, { status: 409 })
    }

    const isPro = await isProUser(user.id)
    if (!isPro) {
      return NextResponse.json({ error: 'Voice interviews require a Pro subscription.', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    if (!isInterviewLiveEnabled()) {
      return NextResponse.json({
        error: 'Voice interviews are not yet available. Please use Text Mode.',
        code: 'LIVE_NOT_ENABLED',
      }, { status: 403 })
    }

    // Unreachable today — isInterviewLiveEnabled() always returns false in this build,
    // so the block above always returns first. Kept so the real call path exists and
    // typechecks once the gate opens, rather than being written for the first time
    // under pressure later.
    const token = await createLiveEphemeralToken({ sessionId: id, userId: user.id, maxDurationSeconds: session.max_duration_seconds })
    return NextResponse.json({ data: token })
  } catch (err) {
    console.error('[interviews/sessions/[id]/live-token POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to issue live session token.' }, { status: 500 })
  }
}
