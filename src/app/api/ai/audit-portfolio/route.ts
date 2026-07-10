import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runPromptWithQuota } from '@/lib/ai/client'
import { proofScoreExplanationPrompt } from '@/lib/ai/prompts/registry'
import type { ParsedResumeOutput, PortfolioContentOutput } from '@/lib/ai/schemas'
import { computeProofScore } from '@/lib/proofscore/engine'
import { isProUser, rateLimitResponse } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'
import { recordPromptCost } from '@/lib/growth/prompt-cost'
import { recordTrustedEventSafe } from '@/lib/growth/trusted-events'

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
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const service = await createServiceClient()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { portfolioId, resumeId, targetRole, industry } = parsed.data
    const isPro = await isProUser(user.id)

    let portfolioContent: PortfolioContentOutput | null = null
    if (portfolioId) {
      const { data } = await supabase
        .from('portfolios')
        .select('content')
        .eq('id', portfolioId)
        .eq('user_id', user.id)
        .single()
      portfolioContent = (data?.content as unknown as PortfolioContentOutput) ?? null
    }

    let parsedResume: ParsedResumeOutput | null = null
    let resumeText: string | null = null
    if (resumeId) {
      const { data } = await supabase
        .from('resumes')
        .select('raw_text, parsed_json')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .single()
      resumeText = data?.raw_text ?? null
      parsedResume = (data?.parsed_json as unknown as ParsedResumeOutput) ?? null
    }

    if (!parsedResume && !portfolioContent) {
      return NextResponse.json(
        { error: resumeId ? 'This resume has not been parsed yet. Re-upload it to run ProofScore.' : 'Provide a resume or a portfolio to audit' },
        { status: 400 }
      )
    }

    trackAsync(user.id, 'proofscore_started', { portfolio_id: portfolioId ?? null, is_pro: isPro })

    // Deterministic first: every numeric score and its supporting evidence is computed
    // from structured facts, not AI judgment. AI is only used afterward to explain them.
    const deterministic = computeProofScore(parsedResume, portfolioContent, targetRole, industry, isPro)

    const prompt = await runPromptWithQuota(proofScoreExplanationPrompt, {
      resumeText,
      portfolioContent: portfolioContent as unknown as Record<string, unknown> | null,
      targetRole,
      industry,
      categories: deterministic.categories,
    }, {
      userId: user.id,
      eventName: 'audit_completed',
      isPro,
    })
    if (!prompt.allowed) return rateLimitResponse(prompt.rateLimit)
    const { data: explanation, meta } = prompt
    await recordPromptCost({ userId: user.id, meta })

    const explanationByKey = new Map(explanation.categories.map((c) => [c.key, c]))
    const rankedKeys = deterministic.categories
      .filter((c) => c.score !== null)
      .slice()
      .sort((a, b) => a.weight * (100 - (a.score ?? 100)) < b.weight * (100 - (b.score ?? 100)) ? 1 : -1)
      .map((c) => c.key)

    const mergedCategories = deterministic.categories.map((det) => {
      const exp = explanationByKey.get(det.key)
      const priority = det.score === null ? 0 : rankedKeys.indexOf(det.key) + 1
      return {
        key: det.key,
        name: det.name,
        score: det.score,
        maxScore: det.maxScore,
        weight: det.weight,
        explanation: exp?.explanation ?? det.evidence.join(' '),
        issues: exp?.issues ?? [],
        severity: det.severity,
        fix: exp?.fix ?? 'Upgrade to Pro to see a specific fix for this category.',
        example: exp?.example ?? '',
        priority,
        gated: det.gated,
      }
    })

    const result = {
      overall_score: deterministic.overall_score,
      summary: explanation.summary,
      categories: mergedCategories,
      missing_evidence: explanation.missing_evidence,
      top_priorities: explanation.top_priorities,
    }

    const { data: audit, error: auditError } = await service.from('audits').insert({
      user_id: user.id,
      portfolio_id: portfolioId ?? null,
      resume_id: resumeId ?? null,
      audit_type: isPro ? 'full' : 'preview',
      overall_score: result.overall_score,
      category_scores: result.categories as unknown as Record<string, unknown>,
      findings: result.missing_evidence as unknown as Record<string, unknown>,
      recommendations: result.top_priorities as unknown as Record<string, unknown>,
    }).select().single()
    if (auditError || !audit) throw auditError ?? new Error('Could not save ProofScore')

    if (portfolioId && audit) {
      const { error: scoreUpdateError } = await service
        .from('portfolios')
        .update({ proof_score: result.overall_score })
        .eq('id', portfolioId)
        .eq('user_id', user.id)
      if (scoreUpdateError) throw scoreUpdateError
    }

    const { error: generationError } = await service.from('generations').insert({
      user_id: user.id,
      type: 'audit_explanation',
      output: explanation as unknown as Record<string, unknown>,
      model_used: meta.model,
      prompt_id: meta.promptId,
      prompt_version: meta.promptVersion,
      provider: meta.provider,
      status: 'completed',
    })
    if (generationError) throw generationError

    trackAsync(user.id, 'audit_completed', {
      overall_score: result.overall_score,
      audit_id: audit.id,
      is_pro: isPro,
    })
    trackAsync(user.id, 'proofscore_completed', {
      overall_score: result.overall_score,
      audit_id: audit.id,
      is_pro: isPro,
    })
    await recordTrustedEventSafe({
      idempotencyKey: `proofscore-viewed:${user.id}:${audit.id}`,
      eventName: 'proofscore_viewed',
      userId: user.id,
      entityType: 'audit',
      entityId: audit.id,
      source: 'authenticated_proofscore_route',
      metadata: { overall_score: result.overall_score, is_pro: isPro },
    }, service)

    return NextResponse.json({ data: result, auditId: audit?.id })
  } catch (err) {
    console.error('[audit-portfolio]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Audit failed. Please try again.' }, { status: 500 })
  }
}
