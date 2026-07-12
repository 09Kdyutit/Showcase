import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPromptWithQuota } from '@/lib/ai/client'
import { interviewAnswerScorePrompt } from '@/lib/ai/prompts/registry'
import { isProUser, rateLimitResponse } from '@/lib/ai/rate-limit'
import { z } from 'zod'

// Heavy AI/render route — raise the serverless timeout above the platform default so
// slow provider responses (portfolio gen, analysis, exports) complete instead of 504ing.
export const maxDuration = 60

// Scores a single practice answer via the app's reliable OpenAI runPrompt path (structured
// output + schema validation + retries). Previously a raw Gemini call with manual JSON
// parsing that 500'd whenever the provider hiccuped or the Gemini env wasn't configured.
const schema = z.object({
  questionText: z.string().min(1).max(1200),
  answerText: z.string().min(30, 'Answer must be at least 30 characters').max(6000),
  rubricFocus: z.string().max(600).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: first }, { status: 400 })
    }
    const { questionText, answerText, rubricFocus } = parsed.data

    // Practice grading is cheap but abusable — rate-limit per user (Free vs Pro).
    const isPro = await isProUser(user.id)
    const prompt = await runPromptWithQuota(interviewAnswerScorePrompt, {
      question: questionText,
      answer: answerText,
      rubricFocus,
    }, {
      userId: user.id,
      eventName: 'question_scored',
      isPro,
    })
    if (!prompt.allowed) return rateLimitResponse(prompt.rateLimit)
    const { data } = prompt

    const total = data.clarity + data.action + data.impact + data.structure
    const label =
      total >= 90 ? 'Excellent' :
      total >= 75 ? 'Good' :
      total >= 55 ? 'Fair' :
      'Needs Work'

    return NextResponse.json({
      data: {
        clarity: data.clarity,
        action: data.action,
        impact: data.impact,
        structure: data.structure,
        total,
        label,
        strengths: data.strengths,
        improvements: data.improvements,
      },
    })
  } catch (err) {
    console.error('[questions/score]', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: 'Scoring failed — please try again.' }, { status: 500 })
  }
}
