import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createSchema = z.object({
  saved_job_id: z.string().uuid(),
  stage: z.enum(['saved', 'tailoring', 'ready', 'applied', 'interview', 'offer', 'rejected', 'withdrawn']).default('saved'),
  applied_at: z.string().datetime().optional(),
  recruiter_name: z.string().max(200).optional(),
  recruiter_contact: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  source: z.string().max(200).optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(['saved', 'tailoring', 'ready', 'applied', 'interview', 'offer', 'rejected', 'withdrawn']).optional(),
  applied_at: z.string().datetime().nullable().optional(),
  follow_up_at: z.string().datetime().nullable().optional(),
  interview_at: z.string().datetime().nullable().optional(),
  offer_received_at: z.string().datetime().nullable().optional(),
  recruiter_name: z.string().max(200).nullable().optional(),
  recruiter_contact: z.string().max(200).nullable().optional(),
  tailored_asset_id: z.string().uuid().nullable().optional(),
  next_action: z.string().max(500).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage')

    let query = supabase
      .from('applications')
      .select('*, saved_jobs(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (stage) query = query.eq('stage', stage)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[applications GET]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Failed to load applications.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    // Verify the saved job belongs to the user
    const { data: savedJob } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('id', parsed.data.saved_job_id)
      .eq('user_id', user.id)
      .single()

    if (!savedJob) {
      return NextResponse.json({ error: 'Saved job not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('applications')
      .insert({ user_id: user.id, ...parsed.data })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[applications POST]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Failed to create application.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { id, ...updates } = parsed.data

    const { data, error } = await supabase
      .from('applications')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Sync status on saved_job
    if (updates.stage) {
      const app = data as { saved_job_id?: string }
      if (app.saved_job_id) {
        await supabase
          .from('saved_jobs')
          .update({ status: updates.stage })
          .eq('id', app.saved_job_id)
          .eq('user_id', user.id)
      }
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[applications PATCH]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Failed to update application.' }, { status: 500 })
  }
}
