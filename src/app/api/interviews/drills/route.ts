import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DRILL_CATALOG } from '@/lib/interviews/drills'

/**
 * Merges the static drill catalog with this user's real records (attempt count, best
 * score, status) so the UI can show the full catalog even for drills never attempted  - 
 * "recommend or allow manual selection" (mission) requires showing what's available,
 * not just what the user has already touched.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: records, error } = await supabase
      .from('interview_drills')
      .select('*')
      .eq('user_id', user.id)
    if (error) throw error

    const recordsByType = new Map((records ?? []).map((r) => [r.drill_type, r]))
    const data = DRILL_CATALOG.map((def) => ({
      id: def.id,
      label: def.label,
      competency: def.competency,
      objective: def.objective,
      instructions: def.instructions,
      prompt: def.prompt,
      timeLimitSeconds: def.timeLimitSeconds,
      minWords: def.minWords,
      maxWords: def.maxWords,
      record: recordsByType.get(def.id) ?? null,
    }))

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[interviews/drills GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load drills.' }, { status: 500 })
  }
}
