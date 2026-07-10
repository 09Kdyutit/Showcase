import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getRateLimiter } from '@/lib/rate-limit'
import { clientFingerprint } from '@/lib/proofscore/capacity'

export const maxDuration = 15

// Stashes an anonymous visitor's already-parsed resume from the free ProofScore tool so
// that, if they sign up, onboarding can claim it by token and skip both re-upload and
// re-parse (design: .agents/marketing/02-proofscore-lead-magnet.md). The tool's scoring
// path runs the real sanitized parse and calls this with its output; the claim route
// re-runs the deterministic sanitizer anyway, so a hand-crafted stash can't smuggle
// tainted values past the same guard the normal upload path has.
//
// Rows expire after 48h (DB default) and are swept lazily here and on claim — that
// retention window is stated publicly in the lead-magnet copy; keep them in sync.

const IP_LIMIT = 5
const IP_WINDOW_SECONDS = 60 * 60
const MAX_BODY_BYTES = 128 * 1024

class PayloadTooLargeError extends Error {}

async function readBoundedJson(request: NextRequest): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError()
  }
  if (!request.body) return null

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new PayloadTooLargeError()
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    reader.releaseLock()
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const schema = z.object({
  rawText: z.string().min(50).max(60_000),
  parsed: z.record(z.string(), z.unknown()),
})

export async function POST(request: NextRequest) {
  try {
    const fingerprint = clientFingerprint(request)

    let rl
    try {
      rl = await getRateLimiter().check(
        `parse-stash:${fingerprint}`,
        IP_LIMIT,
        IP_WINDOW_SECONDS,
        { failOpen: false },
      )
    } catch (error) {
      console.error('[proofscore/stash] strict rate limit unavailable:', error instanceof Error ? error.message : error)
      return NextResponse.json({ error: 'Resume handoff is temporarily unavailable.' }, { status: 503 })
    }
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    let body: unknown
    try {
      body = await readBoundedJson(request)
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: 'Resume payload is too large.' }, { status: 413 })
      }
      throw error
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid resume payload' }, { status: 400 })
    }

    const service = await createServiceClient()

    // Lazy sweep: expired stashes are dead weight and a privacy liability — clear them on
    // the write path so the table never accumulates beyond ~48h of traffic.
    await service.from('pending_parses').delete().lt('expires_at', new Date().toISOString())

    const { data, error } = await service
      .from('pending_parses')
      .insert({ raw_text: parsed.data.rawText, parsed_json: parsed.data.parsed })
      .select('token, expires_at')
      .single()
    if (error || !data) throw error ?? new Error('stash insert returned no row')

    return NextResponse.json({ data: { token: data.token, expiresAt: data.expires_at } })
  } catch (err) {
    console.error('[proofscore/stash]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
