import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPrompt } from '@/lib/ai/client'
import { roleMatchPrompt } from '@/lib/ai/prompts/registry'
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

    const { data: result, meta } = await runPrompt(roleMatchPrompt, {
      parsedResume: parsedResume as unknown as ParsedResume,
      targetRole,
      industry,
    })

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'role_matched',
      metadata: { target_role: targetRole, industry },
    })

    await supabase.from('generations').insert({
      user_id: user.id,
      type: 'role_match',
      output: result as unknown as Record<string, unknown>,
      model_used: meta.model,
      prompt_id: meta.promptId,
      prompt_version: meta.promptVersion,
      provider: meta.provider,
      status: 'completed',
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[role-match]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Role match failed. Please try again.' }, { status: 500 })
  }
}
