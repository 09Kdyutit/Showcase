import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callStructured } from '@/lib/ai/client'
import { RoleMatchSchema } from '@/lib/ai/schemas'
import { buildRoleMatchPrompt } from '@/lib/ai/prompts'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { z } from 'zod'
import type { ParsedResume } from '@/types/database'

const schema = z.object({
  parsedResume: z.record(z.string(), z.unknown()),
  targetRole: z.string().min(1).max(200),
  industry: z.string().min(1).max(200),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { parsedResume, targetRole, industry } = parsed.data
    const isPro = await isProUser(user.id)

    const rl = await checkRateLimit(user.id, 'role_matched', isPro)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.reason, code: 'RATE_LIMITED', retryAfter: rl.retryAfter },
        { status: 429 }
      )
    }

    const result = await callStructured(
      [{ role: 'user', content: buildRoleMatchPrompt(parsedResume as unknown as ParsedResume, targetRole, industry) }],
      RoleMatchSchema,
      'role_match',
      { tier: 'fast', maxOutputTokens: 3000, temperature: 0.2 }
    )

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'role_matched',
      metadata: { target_role: targetRole, industry },
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[role-match]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Role match failed. Please try again.' }, { status: 500 })
  }
}
