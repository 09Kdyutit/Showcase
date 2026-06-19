import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callStructured } from '@/lib/ai/client'
import { MODELS } from '@/lib/ai/openai'
import { ParsedResumeSchema } from '@/lib/ai/schemas'
import { buildResumeParsePrompt, RESUME_PARSE_PROMPT } from '@/lib/ai/prompts'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'
import { hashString } from '@/lib/utils'

const schema = z.object({
  resumeText: z.string().min(50, 'Resume text is too short').max(15000, 'Resume text is too long'),
  resumeId: z.string().uuid().optional(),
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

    const { resumeText, resumeId } = parsed.data
    const isPro = await isProUser(user.id)

    const rl = await checkRateLimit(user.id, 'resume_analyzed', isPro)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.reason, code: 'RATE_LIMITED', retryAfter: rl.retryAfter },
        { status: 429 }
      )
    }

    const inputHash = hashString(resumeText)

    const result = await callStructured(
      [
        { role: 'system', content: RESUME_PARSE_PROMPT },
        { role: 'user', content: buildResumeParsePrompt(resumeText) },
      ],
      ParsedResumeSchema,
      'parsed_resume',
      { tier: 'fast', maxOutputTokens: 4000, temperature: 0.1 }
    )

    if (resumeId) {
      await supabase
        .from('resumes')
        .update({ parsed_json: result as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
        .eq('id', resumeId)
        .eq('user_id', user.id)
    }

    await supabase.from('generations').insert({
      user_id: user.id,
      type: 'resume_analysis',
      input_hash: inputHash,
      output: result as unknown as Record<string, unknown>,
      model_used: MODELS.fast,
      status: 'completed',
    })

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'resume_analyzed',
      metadata: { resume_id: resumeId, word_count: resumeText.split(' ').length },
    })
    trackAsync(user.id, 'resume_parsed', {
      resume_id: resumeId ?? null,
      word_count: resumeText.split(' ').length,
      seniority: result.seniority_level ?? null,
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[analyze-resume]', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
