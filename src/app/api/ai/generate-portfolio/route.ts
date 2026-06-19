import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callStructured } from '@/lib/ai/client'
import { buildPortfolioGenerationPrompt } from '@/lib/ai/prompts'
import { PortfolioContentSchema } from '@/lib/ai/schemas'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'
import type { ParsedResume } from '@/types/database'

const schema = z.object({
  parsedResume: z.record(z.string(), z.unknown()),
  targetRole: z.string().min(1).max(200),
  industry: z.string().min(1).max(200),
  portfolioGoal: z.string().min(1).max(500),
  links: z.record(z.string(), z.string()).default({}),
  portfolioId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isPro = await isProUser(user.id)
    if (!isPro) return NextResponse.json({ error: 'Pro subscription required', code: 'PRO_REQUIRED' }, { status: 403 })

    const rl = await checkRateLimit(user.id, 'portfolio_generated', true)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.reason, code: 'RATE_LIMITED', retryAfter: rl.retryAfter },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { parsedResume, targetRole, industry, portfolioGoal, links, portfolioId } = parsed.data

    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .eq('id', portfolioId)
      .eq('user_id', user.id)
      .single()

    if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })

    trackAsync(user.id, 'portfolio_generation_started', { portfolio_id: portfolioId })

    const result = await callStructured(
      [
        {
          role: 'user',
          content: buildPortfolioGenerationPrompt(
            parsedResume as unknown as ParsedResume,
            targetRole,
            industry,
            portfolioGoal,
            links
          ),
        },
      ],
      PortfolioContentSchema,
      'portfolio_content',
      { tier: 'main', maxOutputTokens: 12000, temperature: 0.4 }
    )

    await supabase
      .from('portfolios')
      .update({
        content: result as unknown as Record<string, unknown>,
        target_role: targetRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', portfolioId)
      .eq('user_id', user.id)

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'portfolio_generated',
      metadata: { portfolio_id: portfolioId, target_role: targetRole },
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[generate-portfolio]', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed. Please try again.' }, { status: 500 })
  }
}
