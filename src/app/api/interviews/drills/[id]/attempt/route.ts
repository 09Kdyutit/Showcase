import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDrillDefinition } from '@/lib/interviews/drills'
import { z } from 'zod'

const attemptSchema = z.object({
  answerText: z.string().min(1).max(5000),
})

/**
 * Records a drill attempt. The score is computed entirely server-side from the
 * deterministic check() function  -  the client can submit any text, but it can never
 * submit a score directly, so there is no path for a browser to fabricate a "best
 * score" (mirrors the scoring.ts discipline used for real interview evaluations:
 * the server computes the number, the client only ever supplies raw input).
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

    const result = definition.check(parsed.data.answerText)

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
