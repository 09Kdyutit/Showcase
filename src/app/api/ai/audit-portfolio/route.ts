import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callStructured } from '@/lib/ai/client'
import { buildAuditPrompt } from '@/lib/ai/prompts'
import { AuditResultSchema } from '@/lib/ai/schemas'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'

const schema = z.object({
  resumeText: z.string().max(15000).optional(),
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

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { resumeText, portfolioId, resumeId, targetRole, industry } = parsed.data
    const isPro = await isProUser(user.id)

    const rl = await checkRateLimit(user.id, 'audit_completed', isPro)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: rl.reason,
          code: rl.reason.includes('Pro') ? 'PRO_REQUIRED' : 'RATE_LIMITED',
          retryAfter: rl.retryAfter,
        },
        { status: isPro ? 429 : 403 }
      )
    }

    let portfolioContent = null
    if (portfolioId) {
      const { data } = await supabase
        .from('portfolios')
        .select('content')
        .eq('id', portfolioId)
        .eq('user_id', user.id)
        .single()
      portfolioContent = data?.content ?? null
    }

    let resolvedResumeText = resumeText ?? null
    if (resumeId && !resolvedResumeText) {
      const { data } = await supabase
        .from('resumes')
        .select('raw_text')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .single()
      resolvedResumeText = data?.raw_text ?? null
    }

    if (!resolvedResumeText && !portfolioContent) {
      return NextResponse.json({ error: 'Provide resume text or a portfolio to audit' }, { status: 400 })
    }

    trackAsync(user.id, 'proofscore_started', { portfolio_id: portfolioId ?? null, is_pro: isPro })

    const result = await callStructured(
      [
        {
          role: 'user',
          content: buildAuditPrompt(
            resolvedResumeText,
            portfolioContent as Record<string, unknown> | null,
            targetRole,
            industry,
            isPro
          ),
        },
      ],
      AuditResultSchema,
      'audit_result',
      { tier: 'main', maxOutputTokens: 8000, temperature: 0.2 }
    )

    const { data: audit } = await supabase.from('audits').insert({
      user_id: user.id,
      portfolio_id: portfolioId ?? null,
      resume_id: resumeId ?? null,
      audit_type: isPro ? 'full' : 'preview',
      overall_score: result.overall_score,
      category_scores: result.categories as unknown as Record<string, unknown>,
      findings: result.missing_evidence as unknown as Record<string, unknown>,
      recommendations: result.top_priorities as unknown as Record<string, unknown>,
    }).select().single()

    if (portfolioId && audit) {
      await supabase
        .from('portfolios')
        .update({ proof_score: result.overall_score })
        .eq('id', portfolioId)
        .eq('user_id', user.id)
    }

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'audit_completed',
      metadata: { overall_score: result.overall_score, audit_id: audit?.id, is_pro: isPro },
    })
    trackAsync(user.id, 'proofscore_completed', {
      overall_score: result.overall_score,
      audit_id: audit?.id ?? null,
      is_pro: isPro,
    })

    return NextResponse.json({ data: result, auditId: audit?.id })
  } catch (err) {
    console.error('[audit-portfolio]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Audit failed. Please try again.' }, { status: 500 })
  }
}
