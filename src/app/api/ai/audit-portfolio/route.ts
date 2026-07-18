import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runPromptWithFeatureUsageLease } from '@/lib/ai/client'
import { proofScoreExplanationPrompt } from '@/lib/ai/prompts/registry'
import type { ParsedResumeOutput, PortfolioContentOutput } from '@/lib/ai/schemas'
import { computeProofScore, mergeAuditExplanation } from '@/lib/proofscore/engine'
import { isProUser, rateLimitResponse } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'
import { recordPromptCost } from '@/lib/growth/prompt-cost'
import { recordTrustedEventSafe } from '@/lib/growth/trusted-events'
import {
  aiFeatureUsageLeaseDenialResponse,
  commitAuditLease,
  releaseAiFeatureUsageLease,
} from '@/lib/ai/feature-usage-leases'

// Heavy AI/render route — raise the serverless timeout above the platform default so
// slow provider responses (portfolio gen, analysis, exports) complete instead of 504ing.
export const maxDuration = 60

const schema = z.object({
  portfolioId: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
  targetRole: z.string().min(1).max(200),
  industry: z.string().min(1).max(200),
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

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { portfolioId, resumeId, targetRole, industry } = parsed.data
    const isPro = await isProUser(user.id)

    let resolvedPortfolioId: string | null = null
    let portfolioContent: PortfolioContentOutput | null = null
    if (portfolioId) {
      const { data, error } = await supabase
        .from('portfolios')
        .select('id, content')
        .eq('id', portfolioId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      if (!data) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })
      resolvedPortfolioId = data.id
      // No status predicate: an owned private draft is valid audit context and does not
      // need to be published. The client chooses the portfolio explicitly so the server
      // never pairs the selected resume with an unrelated "latest" portfolio.
      portfolioContent = (data.content as unknown as PortfolioContentOutput) ?? null
    }

    let parsedResume: ParsedResumeOutput | null = null
    let resumeText: string | null = null
    if (resumeId) {
      const { data, error } = await supabase
        .from('resumes')
        .select('raw_text, parsed_json')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      if (!data) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
      resumeText = data?.raw_text ?? null
      parsedResume = (data?.parsed_json as unknown as ParsedResumeOutput) ?? null
    }

    if (!parsedResume && !portfolioContent) {
      return NextResponse.json(
        { error: resumeId ? 'This resume has not been parsed yet. Re-upload it to run an evidence audit.' : 'Provide a resume or a portfolio to audit' },
        { status: 400 }
      )
    }

    trackAsync(user.id, 'proofscore_started', { portfolio_id: resolvedPortfolioId, is_pro: isPro })

    // Deterministic first: every numeric score and its supporting evidence is computed
    // from structured facts, not AI judgment. AI is only used afterward to explain them.
    const deterministic = computeProofScore(parsedResume, portfolioContent, targetRole, industry)

    const prompt = await runPromptWithFeatureUsageLease(proofScoreExplanationPrompt, {
      resumeText,
      portfolioContent: portfolioContent as unknown as Record<string, unknown> | null,
      targetRole,
      industry,
      categories: deterministic.categories,
    }, {
      service,
      userId: user.id,
      eventName: 'audit_completed',
      portfolioId: resolvedPortfolioId,
      resumeId: resumeId ?? null,
      expectedPortfolioContent: portfolioContent as unknown as Record<string, unknown> | null,
      expectedResumeRawText: resumeText,
      expectedResumeParsedJson: parsedResume as unknown as Record<string, unknown> | null,
      isProForAttemptThrottle: isPro,
    })
    if (!prompt.allowed) {
      return prompt.denial.kind === 'attempt_throttle'
        ? rateLimitResponse(prompt.denial.rateLimit)
        : aiFeatureUsageLeaseDenialResponse(prompt.denial.lease)
    }
    leaseId = prompt.leaseId
    const { data: explanation, meta } = prompt
    await recordPromptCost({ userId: user.id, meta })

    const result = mergeAuditExplanation(deterministic, explanation)

    const commit = await commitAuditLease(service, {
      leaseId,
      userId: user.id,
      portfolioId: resolvedPortfolioId,
      resumeId: resumeId ?? null,
      overallScore: result.overall_score,
      categoryScores: result.categories,
      findings: result.missing_evidence,
      recommendations: result.top_priorities,
      explanation: explanation as unknown as Record<string, unknown>,
      modelUsed: meta.model,
      promptId: meta.promptId,
      promptVersion: meta.promptVersion,
      provider: meta.provider,
    })
    leaseFinalized = commit.lease_committed
    if (!commit.lease_committed) {
      throw new Error(`Audit could not be committed (${commit.outcome}).`)
    }
    if (!commit.audit_persisted && commit.outcome === 'source_changed_before_commit') {
      return NextResponse.json({
        error: 'The selected portfolio or resume changed while the audit was running. Your newer work was preserved, so the stale audit was not saved.',
        code: 'AUDIT_SOURCE_CHANGED',
      }, { status: 409 })
    }
    if (!commit.audit_persisted || !commit.audit_id) {
      throw new Error(`Audit could not be persisted (${commit.outcome}).`)
    }
    const auditId = commit.audit_id

    trackAsync(user.id, 'audit_completed', {
      overall_score: result.overall_score,
      audit_id: auditId,
      is_pro: isPro,
    })
    trackAsync(user.id, 'proofscore_completed', {
      overall_score: result.overall_score,
      audit_id: auditId,
      is_pro: isPro,
    })
    await recordTrustedEventSafe({
      idempotencyKey: `proofscore-viewed:${user.id}:${auditId}`,
      eventName: 'proofscore_viewed',
      userId: user.id,
      entityType: 'audit',
      entityId: auditId,
      source: 'authenticated_proofscore_route',
      metadata: { overall_score: result.overall_score, is_pro: isPro },
    }, service)

    return NextResponse.json({ data: result, auditId })
  } catch (err) {
    if (service && leaseUserId && leaseId && !leaseFinalized) {
      try {
        await releaseAiFeatureUsageLease(service, {
          leaseId,
          userId: leaseUserId,
          eventName: 'audit_completed',
          reason: 'route_failed_before_commit',
        })
      } catch (releaseError) {
        console.error('[audit-portfolio] exact feature lease release failed:',
          releaseError instanceof Error ? releaseError.message : 'unknown error')
      }
    }
    console.error('[audit-portfolio]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Audit failed. Please try again.' }, { status: 500 })
  }
}
