import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sanitizeParsedResume } from '@/lib/ai/sanitize-resume'
import type { ParsedResumeOutput } from '@/lib/ai/schemas'
import { trackAsync } from '@/lib/analytics/track'

export const maxDuration = 15

// The anonymous ProofScore tool is retired and no longer creates pending parses.
// Preserve only the four already-issued handoffs until the last one expires, then
// fail closed. This avoids destroying a visitor's in-flight work during retirement.
const LEGACY_CLAIM_GRACE_END_MS = Date.parse('2026-07-12T03:50:34.000Z')
const schema = z.object({ token: z.string().uuid() })

interface PendingParseClaim {
  resume_id: string
}

export async function POST(request: NextRequest) {
  if (Date.now() > LEGACY_CLAIM_GRACE_END_MS) {
    return NextResponse.json({ error: 'This retired handoff has expired' }, { status: 410 })
  }

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
      return NextResponse.json({ data: { claimed: false } })
    }

    const sanitized = sanitizeParsedResume(stash.parsed_json as ParsedResumeOutput, stash.raw_text)
    const { data: claimRows, error: claimError } = await service.rpc('claim_pending_parse', {
      p_token: stash.token,
      p_user_id: user.id,
      p_parsed_json: sanitized as unknown as Record<string, unknown>,
    })
    if (claimError) throw claimError
    const claim = ((claimRows ?? []) as PendingParseClaim[])[0] ?? null
    if (!claim) return NextResponse.json({ data: { claimed: false } })

    trackAsync(user.id, 'resume_parsed', { source: 'retired_public_tool_handoff' })
    return NextResponse.json({ data: { claimed: true, resumeId: claim.resume_id, parsed: sanitized } })
  } catch (err) {
    console.error('[proofscore/claim-parse]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
