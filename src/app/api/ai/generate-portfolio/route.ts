import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPrompt } from '@/lib/ai/client'
import { portfolioGenerationPrompt } from '@/lib/ai/prompts/registry'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'
import type { ParsedResume } from '@/types/database'
import { isEditedSinceGeneration } from '@/lib/portfolio/guard'
import { sanitizePortfolioCopy } from '@/lib/portfolio/sanitize-copy'
import { isGeminiReviewEnabled, callGeminiReviewer } from '@/lib/ai/gemini'

const schema = z.object({
  parsedResume: z.record(z.string(), z.unknown()),
  targetRole: z.string().min(1).max(200),
  industry: z.string().min(1).max(200),
  portfolioGoal: z.string().min(1).max(500),
  links: z.record(z.string(), z.string()).default({}),
  portfolioId: z.string().uuid(),
  confirmOverwrite: z.boolean().optional(),
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

    const { parsedResume, targetRole, industry, portfolioGoal, links, portfolioId, confirmOverwrite } = parsed.data

    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id, content, ai_generated_at, updated_at')
      .eq('id', portfolioId)
      .eq('user_id', user.id)
      .single()

    if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })

    // A draft that already has real content is either (a) untouched since the last AI
    // generation  -  safe to regenerate over  -  or (b) edited by the user since then, in which
    // case silently overwriting their edits would be the exact kind of data loss this whole
    // generation pipeline needs to avoid. ai_generated_at vs updated_at is the only signal
    // available to tell those two cases apart without a separate edit-history table.
    const editedSinceGeneration = isEditedSinceGeneration(portfolio.content, portfolio.updated_at, portfolio.ai_generated_at)

    if (editedSinceGeneration && !confirmOverwrite) {
      return NextResponse.json(
        { error: 'This portfolio has edits that generating again would overwrite.', code: 'CONFIRM_OVERWRITE' },
        { status: 409 }
      )
    }

    trackAsync(user.id, 'portfolio_generation_started', { portfolio_id: portfolioId })

    const { data: rawResult, meta } = await runPrompt(portfolioGenerationPrompt, {
      parsedResume: parsedResume as unknown as ParsedResume,
      targetRole,
      industry,
      portfolioGoal,
      links,
    })
    const result = sanitizePortfolioCopy(rawResult)

    const generatedAt = new Date().toISOString()
    await supabase
      .from('portfolios')
      .update({
        content: result as unknown as Record<string, unknown>,
        target_role: targetRole,
        ai_generated_at: generatedAt,
        updated_at: generatedAt,
      })
      .eq('id', portfolioId)
      .eq('user_id', user.id)

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'portfolio_generated',
      metadata: { portfolio_id: portfolioId, target_role: targetRole },
    })

    await supabase.from('generations').insert({
      user_id: user.id,
      type: 'portfolio_generation',
      output: result as unknown as Record<string, unknown>,
      model_used: meta.model,
      prompt_id: meta.promptId,
      prompt_version: meta.promptVersion,
      provider: meta.provider,
      status: 'completed',
    })

    // Gemini shadow review hook  -  a strict no-op today. isGeminiReviewEnabled() checks
    // AI_REVIEW_MODE (default 'off'), a configured key, per-task eligibility, and the
    // privacy/legal gate in src/lib/ai/gemini.ts, all of which must be true before this does
    // anything; even then callGeminiReviewer() is not wired to a live call yet (see its own
    // comment). Fire-and-forget so it can never add latency or fail the user's request.
    if (isGeminiReviewEnabled('portfolio-generation')) {
      void runShadowReview('portfolio-generation', result, targetRole).catch(() => {})
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[generate-portfolio]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed. Please try again.' }, { status: 500 })
  }
}

async function runShadowReview(promptId: string, output: unknown, targetRole: string) {
  // dataClassification: 'user' here is honest, not a placeholder  -  this route handles real
  // user-generated portfolios. callGeminiReviewer()'s synthetic-only guard (Phase 3 of the
  // Gemini mission) rejects anything but 'synthetic' unconditionally, so this call is
  // structurally guaranteed to fail closed even if isGeminiReviewEnabled() were ever
  // misconfigured to return true  -  two independent gates, not one.
  const { data: review, meta } = await callGeminiReviewer({
    promptId,
    output,
    normalizedEvidence: {},
    targetRole,
    dataClassification: 'user',
  })
  // Shadow mode: record aggregate metrics only, never raw content  -  Phase 8/10. No table
  // exists for this yet because no review has ever actually run; add one alongside the first
  // real Gemini call rather than now, to avoid an empty, unused metrics table.
  console.log('[gemini-shadow-review]', { promptId, verdict: review.verdict, confidence: review.confidence, latencyMs: meta.latencyMs })
}
