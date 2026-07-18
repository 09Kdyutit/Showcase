import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runPromptWithFeatureUsageLease } from '@/lib/ai/client'
import { portfolioGenerationPrompt } from '@/lib/ai/prompts/registry'
import { isProUser, rateLimitResponse } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'
import type { ParsedResume } from '@/types/database'
import { isEditedSinceGeneration } from '@/lib/portfolio/guard'
import { sanitizePortfolioCopy } from '@/lib/portfolio/sanitize-copy'
import { isGeminiReviewEnabled, callGeminiReviewer } from '@/lib/ai/gemini'
import { recordPromptCost } from '@/lib/growth/prompt-cost'
import { recordTrustedEventSafe } from '@/lib/growth/trusted-events'
import {
  aiFeatureUsageLeaseDenialResponse,
  commitPortfolioGenerationLease,
  releaseAiFeatureUsageLease,
} from '@/lib/ai/feature-usage-leases'

// Heavy AI/render route — raise the serverless timeout above the platform default so
// slow provider responses (portfolio gen, analysis, exports) complete instead of 504ing.
export const maxDuration = 60

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
  let service: Awaited<ReturnType<typeof createServiceClient>> | null = null
  let leaseUserId: string | null = null
  let leaseId: string | null = null
  let leaseFinalized = false

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    service = await createServiceClient()
    leaseUserId = user.id

    // Free includes the FIRST portfolio generation - it's the product's core aha moment
    // (onboarding promises "one click builds your full portfolio from this", and an empty
    // builder behind a paywall breaks that promise at the moment of first value). Any
    // generation after the first (regeneration, or a second portfolio) requires Pro.
    // Server-decided: the client never controls this.
    const isPro = await isProUser(user.id)

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { parsedResume, targetRole, industry, portfolioGoal, links, portfolioId, confirmOverwrite } = parsed.data

    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id, content, target_role, ai_generated_at, updated_at')
      .eq('id', portfolioId)
      .eq('user_id', user.id)
      .single()

    if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })

    // A draft that already has real content is either (a) untouched since the last AI
    // generation - safe to regenerate over - or (b) edited by the user since then, in which
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

    const prompt = await runPromptWithFeatureUsageLease(portfolioGenerationPrompt, {
      parsedResume: parsedResume as unknown as ParsedResume,
      targetRole,
      industry,
      portfolioGoal,
      links,
    }, {
      service,
      userId: user.id,
      eventName: 'portfolio_generated',
      portfolioId,
      expectedPortfolioContent: portfolio.content as unknown as Record<string, unknown> | null,
      expectedPortfolioTargetRole: portfolio.target_role,
      isProForAttemptThrottle: isPro,
    })
    if (!prompt.allowed) {
      return prompt.denial.kind === 'attempt_throttle'
        ? rateLimitResponse(prompt.denial.rateLimit)
        : aiFeatureUsageLeaseDenialResponse(prompt.denial.lease)
    }
    leaseId = prompt.leaseId
    const { data: rawResult, meta } = prompt
    await recordPromptCost({ userId: user.id, meta })
    const result = sanitizePortfolioCopy(rawResult)

    const commit = await commitPortfolioGenerationLease(service, {
      leaseId,
      userId: user.id,
      portfolioId,
      content: result as unknown as Record<string, unknown>,
      targetRole,
      modelUsed: meta.model,
      promptId: meta.promptId,
      promptVersion: meta.promptVersion,
      provider: meta.provider,
    })
    leaseFinalized = commit.lease_committed
    if (!commit.lease_committed) {
      throw new Error(`Portfolio generation could not be committed (${commit.outcome}).`)
    }
    if (!commit.portfolio_persisted) {
      const targetDeleted = commit.outcome === 'target_deleted_before_commit'
      const targetModified = commit.outcome === 'target_modified_before_commit'
      return NextResponse.json({
        error: targetDeleted
          ? 'The portfolio was deleted while generation was running, so the result could not be saved.'
          : targetModified
            ? 'Your portfolio changed while generation was running. Your newer edits were preserved, so this result was not saved.'
            : 'A newer portfolio generation finished first, so this result was not saved.',
        code: targetDeleted
          ? 'PORTFOLIO_TARGET_DELETED'
          : targetModified
            ? 'PORTFOLIO_TARGET_MODIFIED'
            : 'GENERATION_SUPERSEDED',
      }, { status: 409 })
    }
    if (!commit.generated_at || !commit.generation_id) {
      throw new Error('Portfolio generation commit returned incomplete authority.')
    }
    const generatedAt = commit.generated_at

    await recordTrustedEventSafe({
      idempotencyKey: `portfolio-generated:${user.id}:${portfolioId}:${generatedAt}`,
      eventName: 'portfolio_generated',
      userId: user.id,
      entityType: 'portfolio',
      entityId: portfolioId,
      source: 'ai_generate_portfolio_route',
      occurredAt: generatedAt,
      metadata: { target_role: targetRole },
    }, service)

    trackAsync(user.id, 'portfolio_generated', {
      portfolio_id: portfolioId,
      target_role: targetRole,
    })

    // Completion earns this user their real, bounded allocation of three admission links.
    // The RPC is idempotent and never lowers a founder top-up or previously-used count.
    try {
      const { error: inviteGrantError } = await service.rpc('grant_completion_referral_invites', {
        p_user_id: user.id,
        p_invite_count: 3,
      })
      if (inviteGrantError) throw inviteGrantError
    } catch (err) {
      console.error('[ai/generate-portfolio] referral invite grant failed (continuing):', err instanceof Error ? err.message : err)
    }

    // Referral payout fires on the referred user's first portfolio COMPLETION — publishing
    // is Pro-only, so anchoring the reward there would gate a free user's referral payout
    // behind their friend buying Pro (see 20260710033037_referral_completion_credit.sql; idempotent,
    // at most one payout per user, self-guarding). Never let a payout hiccup fail the
    // generation the user just spent their one free credit on.
    try {
      const { error: referralCreditError } = await service.rpc('credit_referrer_on_completion', { p_completed_user: user.id })
      if (referralCreditError) throw referralCreditError
    } catch (err) {
      console.error('[ai/generate-portfolio] referral credit failed (continuing):', err instanceof Error ? err.message : err)
    }

    // Gemini shadow review hook - a strict no-op today. isGeminiReviewEnabled() checks
    // AI_REVIEW_MODE (default 'off'), a configured key, per-task eligibility, and the
    // privacy/legal gate in src/lib/ai/gemini.ts, all of which must be true before this does
    // anything; even then callGeminiReviewer() is not wired to a live call yet (see its own
    // comment). Fire-and-forget so it can never add latency or fail the user's request.
    if (isGeminiReviewEnabled('portfolio-generation')) {
      void runShadowReview('portfolio-generation', result, targetRole).catch(() => {})
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    if (service && leaseUserId && leaseId && !leaseFinalized) {
      try {
        await releaseAiFeatureUsageLease(service, {
          leaseId,
          userId: leaseUserId,
          eventName: 'portfolio_generated',
          reason: 'route_failed_before_commit',
        })
      } catch (recoveryError) {
        console.error(
          '[generate-portfolio] exact feature lease release failed:',
          recoveryError instanceof Error ? recoveryError.message : 'unknown error',
        )
      }
    }
    console.error('[generate-portfolio]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed. Please try again.' }, { status: 500 })
  }
}

async function runShadowReview(promptId: string, output: unknown, targetRole: string) {
  // dataClassification: 'user' here is honest, not a placeholder - this route handles real
  // user-generated portfolios. callGeminiReviewer()'s synthetic-only guard (Phase 3 of the
  // Gemini mission) rejects anything but 'synthetic' unconditionally, so this call is
  // structurally guaranteed to fail closed even if isGeminiReviewEnabled() were ever
  // misconfigured to return true - two independent gates, not one.
  const { data: review, meta } = await callGeminiReviewer({
    promptId,
    output,
    normalizedEvidence: {},
    targetRole,
    dataClassification: 'user',
  })
  // Shadow mode: record aggregate metrics only, never raw content - Phase 8/10. No table
  // exists for this yet because no review has ever actually run; add one alongside the first
  // real Gemini call rather than now, to avoid an empty, unused metrics table.
  console.log('[gemini-shadow-review]', { promptId, verdict: review.verdict, confidence: review.confidence, latencyMs: meta.latencyMs })
}
