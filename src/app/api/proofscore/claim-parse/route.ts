import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sanitizeParsedResume } from '@/lib/ai/sanitize-resume'
import type { ParsedResumeOutput } from '@/lib/ai/schemas'
import { trackAsync } from '@/lib/analytics/track'

export const maxDuration = 15

// Claims a resume parse stashed by the free ProofScore tool (see ./stash) for the
// now-signed-in user: atomically consumes the stash and creates their resumes row from its
// text + parse. Called once from onboarding mount with the token from localStorage. No AI call
// happens anywhere in this path — that's the point.
//
// The stash's parsed_json is re-run through the deterministic sanitizer against the raw
// text before it becomes a resumes row, so this path upholds the same "no unsupported
// values reach the database" guarantee as api/ai/analyze-resume.

const schema = z.object({ token: z.string().uuid() })

interface PendingParseClaim {
  resume_id: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

    const service = await createServiceClient()

    const { data: stash, error: stashError } = await service
      .from('pending_parses')
      .select('token, raw_text, parsed_json, expires_at')
      .eq('token', parsed.data.token)
      .maybeSingle()

    if (stashError) throw stashError

    if (!stash || new Date(stash.expires_at) <= new Date()) {
      if (stash) {
        const { error: expiryDeleteError } = await service
          .from('pending_parses')
          .delete()
          .eq('token', stash.token)
          .lte('expires_at', new Date().toISOString())
        if (expiryDeleteError) throw expiryDeleteError
      }
      // Expired or already claimed — onboarding falls back to the normal upload flow.
      return NextResponse.json({ data: { claimed: false } })
    }

    const sanitized = sanitizeParsedResume(stash.parsed_json as ParsedResumeOutput, stash.raw_text)

    // The RPC deletes the still-live bearer token and inserts the sanitized resume in one
    // transaction. Concurrent callers may both reach this point, but only the delete winner
    // can create a resume; an insert error rolls the token consumption back for a safe retry.
    const { data: claimRows, error: claimError } = await service.rpc('claim_pending_parse', {
      p_token: stash.token,
      p_user_id: user.id,
      p_parsed_json: sanitized as unknown as Record<string, unknown>,
    })
    if (claimError) throw claimError
    const claim = ((claimRows ?? []) as PendingParseClaim[])[0] ?? null
    if (!claim) return NextResponse.json({ data: { claimed: false } })

    trackAsync(user.id, 'resume_parsed', { source: 'proofscore_handoff' })

    return NextResponse.json({ data: { claimed: true, resumeId: claim.resume_id, parsed: sanitized } })
  } catch (err) {
    console.error('[proofscore/claim-parse]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
