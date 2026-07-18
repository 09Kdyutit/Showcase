import 'server-only'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AiFeatureUsageEvent = 'portfolio_generated' | 'audit_completed'
export type AiFeatureUsageTier = 'free' | 'pro'
export type AiFeatureUsageLeaseDenialReason =
  | 'historical_success'
  | 'success_limit'
  | 'attempt_limit'
  | 'in_flight'
  | 'global_limit'
  | 'target_missing'
  | 'source_changed'

interface ReservationRow {
  allowed: boolean
  lease_id: string | null
  lease_status: string | null
  tier_at_reservation: AiFeatureUsageTier
  denial_reason: AiFeatureUsageLeaseDenialReason | null
  retry_after_seconds: number
  attempt_count: number
  success_count: number
}

export type AiFeatureUsageLeaseReservation =
  | {
      allowed: true
      leaseId: string
      eventName: AiFeatureUsageEvent
      tierAtReservation: AiFeatureUsageTier
      attemptCount: number
      successCount: number
    }
  | {
      allowed: false
      eventName: AiFeatureUsageEvent
      tierAtReservation: AiFeatureUsageTier
      denialReason: AiFeatureUsageLeaseDenialReason
      retryAfterSeconds: number
      attemptCount: number
      successCount: number
    }

export async function reserveAiFeatureUsageLease(
  service: SupabaseClient,
  input: {
    userId: string
    eventName: AiFeatureUsageEvent
    portfolioId?: string | null
    resumeId?: string | null
    expectedPortfolioContent?: Record<string, unknown> | null
    expectedPortfolioTargetRole?: string | null
    expectedResumeRawText?: string | null
    expectedResumeParsedJson?: Record<string, unknown> | null
    globalMax: number
  },
): Promise<AiFeatureUsageLeaseReservation> {
  const { data, error } = await service
    .rpc('reserve_ai_feature_usage_lease', {
      p_user_id: input.userId,
      p_event_name: input.eventName,
      p_portfolio_id: input.portfolioId ?? null,
      p_resume_id: input.resumeId ?? null,
      p_expected_portfolio_content: input.expectedPortfolioContent ?? null,
      p_expected_portfolio_target_role: input.expectedPortfolioTargetRole ?? null,
      p_expected_resume_raw_text: input.expectedResumeRawText ?? null,
      p_expected_resume_parsed_json: input.expectedResumeParsedJson ?? null,
      p_global_max: input.globalMax,
    })
    .single() as { data: ReservationRow | null; error: { message: string } | null }

  if (error || !data) {
    console.error('[ai-feature-lease] reservation failed:', error?.message ?? 'no result')
    throw new Error('AI feature eligibility could not be verified. Please try again shortly.')
  }

  if (data.allowed) {
    if (!data.lease_id || data.lease_status !== 'reserved') {
      throw new Error('AI feature reservation returned an invalid lease.')
    }
    return {
      allowed: true,
      leaseId: data.lease_id,
      eventName: input.eventName,
      tierAtReservation: data.tier_at_reservation,
      attemptCount: data.attempt_count,
      successCount: data.success_count,
    }
  }

  if (!data.denial_reason) {
    throw new Error('AI feature reservation returned an invalid denial.')
  }
  return {
    allowed: false,
    eventName: input.eventName,
    tierAtReservation: data.tier_at_reservation,
    denialReason: data.denial_reason,
    retryAfterSeconds: data.retry_after_seconds,
    attemptCount: data.attempt_count,
    successCount: data.success_count,
  }
}

export async function releaseAiFeatureUsageLease(
  service: SupabaseClient,
  input: {
    leaseId: string
    userId: string
    eventName: AiFeatureUsageEvent
    reason: string
  },
): Promise<boolean> {
  const { data, error } = await service.rpc('release_ai_feature_usage_lease', {
    p_lease_id: input.leaseId,
    p_user_id: input.userId,
    p_event_name: input.eventName,
    p_reason: input.reason,
  }) as { data: boolean | null; error: { message: string } | null }

  if (error) throw new Error(`Could not release AI feature lease: ${error.message}`)
  return data === true
}

interface PortfolioCommitRow {
  lease_committed: boolean
  portfolio_persisted: boolean
  generation_id: string | null
  generated_at: string | null
  outcome: string
}

export async function commitPortfolioGenerationLease(
  service: SupabaseClient,
  input: {
    leaseId: string
    userId: string
    portfolioId: string
    content: Record<string, unknown>
    targetRole: string
    modelUsed: string
    promptId: string
    promptVersion: string
    provider: string
  },
): Promise<PortfolioCommitRow> {
  const { data, error } = await service
    .rpc('commit_portfolio_generation_lease', {
      p_lease_id: input.leaseId,
      p_user_id: input.userId,
      p_portfolio_id: input.portfolioId,
      p_content: input.content,
      p_target_role: input.targetRole,
      p_model_used: input.modelUsed,
      p_prompt_id: input.promptId,
      p_prompt_version: input.promptVersion,
      p_provider: input.provider,
    })
    .single() as { data: PortfolioCommitRow | null; error: { message: string } | null }

  if (error || !data) {
    throw new Error(error?.message ?? 'Portfolio generation lease commit returned no result')
  }
  return data
}

interface AuditCommitRow {
  lease_committed: boolean
  audit_persisted: boolean
  audit_id: string | null
  resolved_portfolio_id: string | null
  resolved_resume_id: string | null
  outcome: string
}

export async function commitAuditLease(
  service: SupabaseClient,
  input: {
    leaseId: string
    userId: string
    portfolioId?: string | null
    resumeId?: string | null
    overallScore: number
    categoryScores: unknown[]
    findings: unknown[]
    recommendations: unknown[]
    explanation: Record<string, unknown>
    modelUsed: string
    promptId: string
    promptVersion: string
    provider: string
  },
): Promise<AuditCommitRow> {
  const { data, error } = await service
    .rpc('commit_audit_lease', {
      p_lease_id: input.leaseId,
      p_user_id: input.userId,
      p_portfolio_id: input.portfolioId ?? null,
      p_resume_id: input.resumeId ?? null,
      p_overall_score: input.overallScore,
      p_category_scores: input.categoryScores,
      p_findings: input.findings,
      p_recommendations: input.recommendations,
      p_explanation: input.explanation,
      p_model_used: input.modelUsed,
      p_prompt_id: input.promptId,
      p_prompt_version: input.promptVersion,
      p_provider: input.provider,
    })
    .single() as { data: AuditCommitRow | null; error: { message: string } | null }

  if (error || !data) {
    throw new Error(error?.message ?? 'Audit lease commit returned no result')
  }
  return data
}

export function aiFeatureUsageLeaseDenialResponse(
  denial: Extract<AiFeatureUsageLeaseReservation, { allowed: false }>,
) {
  const retryAfter = denial.retryAfterSeconds > 0
    ? new Date(Date.now() + denial.retryAfterSeconds * 1000).toISOString()
    : undefined

  if (denial.denialReason === 'historical_success') {
    return NextResponse.json({
      error: 'Your free plan includes one AI portfolio generation. Upgrade to Pro to regenerate or build more portfolios.',
      code: 'PRO_REQUIRED',
    }, { status: 403 })
  }
  if (denial.denialReason === 'target_missing') {
    return NextResponse.json({ error: 'The selected source no longer exists.', code: 'TARGET_NOT_FOUND' }, { status: 404 })
  }
  if (denial.denialReason === 'source_changed') {
    return NextResponse.json({
      error: denial.eventName === 'portfolio_generated'
        ? 'Your portfolio changed before generation could start. Your newer edits were preserved; review them and try again.'
        : 'The selected audit source changed before the audit could start. Review the latest version and try again.',
      code: denial.eventName === 'portfolio_generated'
        ? 'PORTFOLIO_TARGET_MODIFIED'
        : 'AUDIT_SOURCE_CHANGED',
    }, { status: 409 })
  }
  if (denial.denialReason === 'in_flight') {
    return NextResponse.json({
      error: denial.eventName === 'portfolio_generated'
        ? 'A portfolio generation is already in progress.'
        : 'An audit is already in progress.',
      code: denial.eventName === 'portfolio_generated'
        ? 'GENERATION_IN_PROGRESS'
        : 'AUDIT_IN_PROGRESS',
      retryAfter,
    }, { status: 409 })
  }
  if (denial.denialReason === 'global_limit') {
    return NextResponse.json({
      error: 'AI features are temporarily at capacity platform-wide. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter,
    }, { status: 503 })
  }

  const feature = denial.eventName === 'portfolio_generated' ? 'portfolio generations' : 'audits'
  const limit = denial.tierAtReservation === 'pro' ? 10 : 1
  const message = denial.denialReason === 'attempt_limit'
    ? `Too many ${feature} were attempted in the last 24 hours. Please try again later.`
    : `You have reached your ${denial.tierAtReservation} limit of ${limit} ${feature}. ${denial.tierAtReservation === 'free' ? 'Upgrade to Pro for higher limits.' : 'Try again later.'}`
  return NextResponse.json({ error: message, code: 'RATE_LIMITED', retryAfter }, { status: 429 })
}
