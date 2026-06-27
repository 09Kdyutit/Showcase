import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getRateLimiter } from '@/lib/rate-limit'
import { MARKETING_EVENTS, ALLOWED_METADATA_KEYS } from '@/lib/marketing/events'

const metadataSchema = z
  .record(z.string(), z.union([z.string().max(120), z.number(), z.boolean(), z.null()]))
  .refine((meta) => Object.keys(meta).every((k) => ALLOWED_METADATA_KEYS.has(k)), {
    message: 'metadata contains a key outside the allowed set',
  })

const schema = z.object({
  event_name: z.enum(MARKETING_EVENTS),
  session_id: z.string().min(8).max(64),
  path: z.string().max(200).optional(),
  metadata: metadataSchema.optional(),
  utm_source: z.string().max(120).optional(),
  utm_medium: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
})

// Generous, since this fires often during normal browsing (scroll-triggered section
// views) - the goal is abuse prevention, not throttling real visitors.
const IP_LIMIT = 60
const IP_WINDOW_SECONDS = 60

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await getRateLimiter().check(`marketing-track:${ip}`, IP_LIMIT, IP_WINDOW_SECONDS)
  if (!rl.allowed) {
    return NextResponse.json({ success: true }, { status: 200 }) // never let analytics surface an error to the visitor
  }

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    // Malformed analytics payloads are never the visitor's problem to see.
    return NextResponse.json({ success: true }, { status: 200 })
  }

  try {
    const supabase = await createServiceClient()
    await supabase.from('marketing_events').insert({
      session_id: parsed.data.session_id,
      event_name: parsed.data.event_name,
      path: parsed.data.path ?? null,
      metadata: parsed.data.metadata ?? {},
      utm_source: parsed.data.utm_source ?? null,
      utm_medium: parsed.data.utm_medium ?? null,
      utm_campaign: parsed.data.utm_campaign ?? null,
    })
  } catch {
    // Analytics must never surface an error to a visitor or block the page.
    // Also covers the case where the marketing_events migration has not been
    // applied yet in a given environment - fails closed and silent.
  }

  return NextResponse.json({ success: true })
}
