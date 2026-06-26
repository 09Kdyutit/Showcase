import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreToBand } from '@/lib/interviews/rubrics'

/**
 * Computes readiness summaries server-side from stored interview_evaluations  - 
 * never from a single session in isolation, and never presented with false
 * precision (mission: "do not show false precision such as 17.347%"). Grouped by
 * target role, since the mission is explicit that unrelated sessions should not be
 * blindly averaged together.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const targetRole = searchParams.get('targetRole')

    let sessionQuery = supabase
      .from('interview_sessions')
      .select('id, target_role, session_type, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10)
    if (targetRole) sessionQuery = sessionQuery.eq('target_role', targetRole)

    const { data: sessions } = await sessionQuery
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        data: {
          targetRole: targetRole ?? null, sessionType: null, score: 0, band: 'starting',
          sessionCount: 0, sampleLabel: 'No completed sessions yet', trend: 'insufficient_data',
          strongestDimension: null, priorityDimension: null,
        },
      })
    }

    const sessionIds = sessions.map((s) => s.id)
    const { data: evaluations } = await supabase
      .from('interview_evaluations')
      .select('id, session_id, overall_score, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({
        data: {
          targetRole: targetRole ?? sessions[0].target_role, sessionType: sessions[0].session_type,
          score: 0, band: 'starting', sessionCount: sessions.length,
          sampleLabel: `${sessions.length} completed session${sessions.length === 1 ? '' : 's'}, no scored analysis yet`,
          trend: 'insufficient_data', strongestDimension: null, priorityDimension: null,
        },
      })
    }

    const recentScores = evaluations.slice(0, 5).map((e) => e.overall_score)
    const avgScore = Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length)

    let trend: 'up' | 'down' | 'flat' | 'insufficient_data' = 'insufficient_data'
    if (evaluations.length >= 2) {
      const delta = evaluations[0].overall_score - evaluations[1].overall_score
      trend = delta > 3 ? 'up' : delta < -3 ? 'down' : 'flat'
    }

    const evaluationIds = evaluations.slice(0, 5).map((e) => e.id)
    const { data: dimensionScores } = await supabase
      .from('interview_dimension_scores')
      .select('dimension_id, score')
      .in('evaluation_id', evaluationIds)

    let strongestDimension: string | null = null
    let priorityDimension: string | null = null
    if (dimensionScores && dimensionScores.length > 0) {
      const byDimension = new Map<string, number[]>()
      for (const d of dimensionScores) {
        byDimension.set(d.dimension_id, [...(byDimension.get(d.dimension_id) ?? []), d.score])
      }
      const averaged = [...byDimension.entries()].map(([id, scores]) => ({ id, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
      averaged.sort((a, b) => b.avg - a.avg)
      strongestDimension = averaged[0]?.id ?? null
      priorityDimension = averaged[averaged.length - 1]?.id ?? null
    }

    const sampleLabel = evaluations.length === 1
      ? 'Early estimate based on 1 session.'
      : `Based on your last ${recentScores.length} of ${evaluations.length} scored sessions.`

    return NextResponse.json({
      data: {
        targetRole: targetRole ?? sessions[0].target_role,
        sessionType: sessions[0].session_type,
        score: avgScore,
        band: scoreToBand(avgScore),
        sessionCount: evaluations.length,
        sampleLabel,
        trend,
        strongestDimension,
        priorityDimension,
      },
    })
  } catch (err) {
    console.error('[interviews/readiness GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load interview readiness.' }, { status: 500 })
  }
}
