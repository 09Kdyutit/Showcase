import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDrillDefinition } from '@/lib/interviews/drills'
import { runPrompt } from '@/lib/ai/client'
import { interviewAnswerScorePrompt } from '@/lib/ai/prompts/registry'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { z } from 'zod'

// Heavy AI/render route — raise the serverless timeout above the platform default so
// slow provider responses (portfolio gen, analysis, exports) complete instead of 504ing.
export const maxDuration = 60

const attemptSchema = z.object({
  answerText: z.string().min(1).max(5000),
})

/**
 * Records a drill attempt, graded by AI against the drill's own objective (passed as
 * rubricFocus). The score is still computed entirely server-side — the client submits
 * only raw text and can never inject a score — but the judgment is now the same OpenAI
 * grader used for written practice, not a deterministic checklist.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const definition = getDrillDefinition(id)
    if (!definition) return NextResponse.json({ error: 'Unknown drill.' }, { status: 404 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = attemptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const isPro = await isProUser(user.id)
    const rl = await checkRateLimit(user.id, 'question_scored', isPro)
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.reason, code: 'RATE_LIMITED', retryAfter: rl.retryAfter }, { status: 429 })
    }

    // AI grades the drill answer against the drill's own objective + instructions.
    const { data: ai } = await runPrompt(interviewAnswerScorePrompt, {
      question: definition.prompt,
      answer: parsed.data.answerText,
      rubricFocus: `${definition.label} — ${definition.objective}\n${definition.instructions}`,
    })
    const total = ai.clarity + ai.action + ai.impact + ai.structure
    const label =
      total >= 90 ? 'Excellent' : total >= 75 ? 'Good' : total >= 55 ? 'Fair' : 'Needs Work'
    const result = {
      score: total,
      label,
      passed: total >= 75,
      dimensions: { clarity: ai.clarity, action: ai.action, impact: ai.impact, structure: ai.structure },
      strengths: ai.strengths,
      improvements: ai.improvements,
    }

    const { data: existing } = await supabase
      .from('interview_drills')
      .select('id, attempt_count, best_score')
      .eq('user_id', user.id)
      .eq('drill_type', id)
      .maybeSingle()

    const newBest = existing?.best_score != null ? Math.max(existing.best_score, result.score) : result.score
    const nowIso = new Date().toISOString()

    let record
    if (existing) {
      const { data, error } = await supabase
        .from('interview_drills')
        .update({
          attempt_count: existing.attempt_count + 1,
          best_score: newBest,
          status: 'completed',
          completed_at: nowIso,
        })
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .select('*')
        .single()
      if (error) throw error
      record = data
    } else {
      const { data, error } = await supabase
        .from('interview_drills')
        .insert({
          user_id: user.id, drill_type: id, competency: definition.competency,
          status: 'completed', attempt_count: 1, best_score: result.score, completed_at: nowIso,
        })
        .select('*')
        .single()
      if (error) throw error
      record = data
    }

    return NextResponse.json({ data: { record, result } })
  } catch (err) {
    console.error('[interviews/drills/[id]/attempt POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to record drill attempt.' }, { status: 500 })
  }
}
