import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(200),
  competencies: z.array(z.string()).min(1).max(10),
  situation: z.string().max(1000).nullable().optional(),
  task: z.string().max(1000).nullable().optional(),
  actions: z.array(z.string().max(500)).max(10).optional(),
  outcome: z.string().max(1000).nullable().optional(),
  reflection: z.string().max(1000).nullable().optional(),
  verifiedMetrics: z.array(z.string().max(200)).max(10).optional(),
  resumeSourceId: z.string().uuid().nullable().optional(),
  projectSourceId: z.string().uuid().nullable().optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('interview_story_bank')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[interviews/story-bank GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load story bank.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    // Ownership of any referenced resume/project is verified explicitly - a story
    // bank entry must never be plantable against another user's source material,
    // even though resumeSourceId/projectSourceId are just FKs (RLS on resumes/
    // projects would also block a cross-user SELECT, but this route writes the FK
    // without first reading the row through the user's own client, so it needs its
    // own explicit check).
    if (parsed.data.resumeSourceId) {
      const { data: owned } = await supabase.from('resumes').select('id').eq('id', parsed.data.resumeSourceId).eq('user_id', user.id).maybeSingle()
      if (!owned) return NextResponse.json({ error: 'Resume source not found.' }, { status: 404 })
    }
    if (parsed.data.projectSourceId) {
      const { data: owned } = await supabase.from('projects').select('id').eq('id', parsed.data.projectSourceId).eq('user_id', user.id).maybeSingle()
      if (!owned) return NextResponse.json({ error: 'Project source not found.' }, { status: 404 })
    }

    const evidenceStatus = parsed.data.resumeSourceId || parsed.data.projectSourceId ? 'partially_verified' : 'unverified'

    const { data, error } = await supabase
      .from('interview_story_bank')
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        competencies: parsed.data.competencies,
        situation: parsed.data.situation ?? null,
        task: parsed.data.task ?? null,
        actions: parsed.data.actions ?? [],
        outcome: parsed.data.outcome ?? null,
        reflection: parsed.data.reflection ?? null,
        verified_metrics: parsed.data.verifiedMetrics ?? [],
        resume_source_id: parsed.data.resumeSourceId ?? null,
        project_source_id: parsed.data.projectSourceId ?? null,
        evidence_status: evidenceStatus,
      })
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[interviews/story-bank POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to save story.' }, { status: 500 })
  }
}
