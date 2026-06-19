import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callStructured } from '@/lib/ai/client'
import { ImprovedBulletSchema } from '@/lib/ai/schemas'
import { buildResumeBulletImprovementPrompt } from '@/lib/ai/prompts'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { z } from 'zod'

const schema = z.object({
  bullet: z.string().min(5).max(1000),
  role: z.string().min(1).max(200),
  context: z.string().max(500).default(''),
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

    const { bullet, role, context } = parsed.data
    const isPro = await isProUser(user.id)

    const rl = await checkRateLimit(user.id, 'bullet_improved', isPro)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.reason, code: 'RATE_LIMITED', retryAfter: rl.retryAfter },
        { status: 429 }
      )
    }

    const result = await callStructured(
      [{ role: 'user', content: buildResumeBulletImprovementPrompt(bullet, role, context) }],
      ImprovedBulletSchema,
      'improved_bullet',
      { tier: 'fast', maxOutputTokens: 1500, temperature: 0.3 }
    )

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'bullet_improved',
      metadata: { role, original_length: bullet.length },
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[improve-resume]', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Improvement failed. Please try again.' }, { status: 500 })
  }
}
