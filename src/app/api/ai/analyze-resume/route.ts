import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPromptWithQuota } from '@/lib/ai/client'
import { resumeParsePrompt } from '@/lib/ai/prompts/registry'
import { isProUser, rateLimitResponse } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { z } from 'zod'
import { hashString } from '@/lib/utils'
import { sanitizeParsedResume } from '@/lib/ai/sanitize-resume'
import { recordPromptCost } from '@/lib/growth/prompt-cost'

// Heavy AI/render route — raise the serverless timeout above the platform default so
// slow provider responses (portfolio gen, analysis, exports) complete instead of 504ing.
export const maxDuration = 60

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

    // Re-parsing identical text is pure waste - same AI cost, same result, and it eats into
    // the user's daily rate limit for nothing. Only short-circuit when the stored text is an
    // exact match for what's being submitted now; any actual edit still gets a fresh parse.
    if (resumeId) {
      const { data: existing } = await supabase
        .from('resumes')
        .select('raw_text, parsed_json')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .single()
      if (existing?.parsed_json && existing.raw_text === resumeText) {
        return NextResponse.json({ data: existing.parsed_json, cached: true })
      }
    }

    const inputHash = hashString(resumeText)

    const prompt = await runPromptWithQuota(resumeParsePrompt, { resumeText }, {
      userId: user.id,
      eventName: 'resume_analyzed',
      isPro,
    })
    if (!prompt.allowed) return rateLimitResponse(prompt.rateLimit)
    const { data: rawResult, meta } = prompt
    await recordPromptCost({ userId: user.id, meta })
    const result = sanitizeParsedResume(rawResult, resumeText)

    // A structurally hollow parse (no name, no skills, no experience) means the input
    // wasn't resume content the model could read — image-only PDF text, decoration,
    // gibberish. Storing it would strand the user with an empty resume row and a dead-end
    // builder, so refuse honestly and steer them to paste real text instead.
    if (!(result.name ?? '').trim() && result.skills.length === 0 && result.experience.length === 0) {
      return NextResponse.json(
        {
          error: "We couldn't find readable resume content in that text. Open your resume, select all (Cmd/Ctrl+A), copy, and paste it here instead.",
          code: 'EMPTY_PARSE',
        },
        { status: 422 }
      )
    }

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
      model_used: meta.model,
      prompt_id: meta.promptId,
      prompt_version: meta.promptVersion,
      provider: meta.provider,
      status: 'completed',
    })

    trackAsync(user.id, 'resume_analyzed', {
      resume_id: resumeId ?? null,
      word_count: resumeText.split(' ').length,
    })
    trackAsync(user.id, 'resume_parsed', {
      resume_id: resumeId ?? null,
      word_count: resumeText.split(' ').length,
      seniority: result.seniority_level ?? null,
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[analyze-resume]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
