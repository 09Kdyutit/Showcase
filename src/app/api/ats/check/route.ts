import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPrompt } from '@/lib/ai/client'
import { atsCheckPrompt } from '@/lib/ai/prompts/registry'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { z } from 'zod'

const schema = z.object({
  resume_text: z.string().min(50).max(15000),
  job_keywords: z.array(z.string()).max(30).default([]),
  tailored_asset_id: z.string().uuid().optional(),
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

    const isPro = await isProUser(user.id)
    const rl = await checkRateLimit(user.id, 'ats_checked', isPro)
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.reason, code: 'RATE_LIMITED' }, { status: 429 })
    }

    const { resume_text, job_keywords, tailored_asset_id } = parsed.data

    const { data: report, meta } = await runPrompt(atsCheckPrompt, { resumeText: resume_text, jobKeywords: job_keywords })

    // Store ATS report on tailored asset if provided
    if (tailored_asset_id) {
      await supabase
        .from('tailored_assets')
        .update({ ats_report: report })
        .eq('id', tailored_asset_id)
        .eq('user_id', user.id)
    }

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'ats_checked',
      metadata: {
        score: report.overall_score,
        keywords_checked: job_keywords.length,
        issues_found: report.issues.length,
      },
    })

    await supabase.from('generations').insert({
      user_id: user.id,
      type: 'ats_check',
      output: report as unknown as Record<string, unknown>,
      model_used: meta.model,
      prompt_id: meta.promptId,
      prompt_version: meta.promptVersion,
      provider: meta.provider,
      status: 'completed',
    })

    return NextResponse.json({ data: report })
  } catch (err) {
    console.error('[ats/check]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'ATS check failed. Please try again.' }, { status: 500 })
  }
}
