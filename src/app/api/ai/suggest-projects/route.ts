import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPrompt } from '@/lib/ai/client'
import { projectSuggestionsPrompt } from '@/lib/ai/prompts/registry'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'

// Personalized portfolio-project ideas from the candidate's résumé. Runs on the same
// reliable OpenAI infra as every other AI feature (structured output, no fragile manual
// JSON parsing) — the previous raw-Gemini implementation 500'd whenever that path failed.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { resumeText, resumeId } = body as { resumeText?: string; resumeId?: string }

    let content = resumeText?.trim() ?? ''
    if (!content && resumeId) {
      const { data: resume } = await supabase
        .from('resumes')
        .select('raw_text, parsed_json')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (resume) content = resume.raw_text || (resume.parsed_json ? JSON.stringify(resume.parsed_json) : '')
    }
    if (!content || content.length < 50) {
      return NextResponse.json({ error: 'Add a résumé first — there was no résumé content to work from.', code: 'NO_RESUME' }, { status: 422 })
    }

    const isPro = await isProUser(user.id)
    const rl = await checkRateLimit(user.id, 'project_suggested', isPro)
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.reason, code: 'RATE_LIMITED', retryAfter: rl.retryAfter }, { status: 429 })
    }

    // Free users only ever generate the 3 Beginner projects — Intermediate/Master are Pro,
    // so we never spend tokens producing content a free user can't unlock.
    const { data } = await runPrompt(projectSuggestionsPrompt, { resumeText: content, beginnerOnly: !isPro })

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'project_suggested',
      metadata: { resume_id: resumeId ?? null, count: data.suggestions.length, is_pro: isPro },
    })

    return NextResponse.json({ data: { suggestions: data.suggestions.slice(0, 9), tier: isPro ? 'pro' : 'free' } })
  } catch (err) {
    console.error('[suggest-projects]', err instanceof Error ? (err.cause ?? err.message) : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not generate project ideas. Please try again.' }, { status: 500 })
  }
}
