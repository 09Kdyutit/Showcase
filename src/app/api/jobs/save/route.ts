import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const saveSchema = z.object({
  job_listing_id: z.string().uuid().optional(),
  imported_title: z.string().max(300).optional(),
  imported_company: z.string().max(300).optional(),
  imported_description: z.string().max(30000).optional(),
  imported_url: z.string().url().optional().or(z.literal('')),
  match_score: z.number().min(0).max(100).optional(),
  match_breakdown: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['saved', 'tailoring', 'ready', 'applied', 'interview', 'offer', 'rejected', 'withdrawn', 'archived']).optional(),
  notes: z.string().max(2000).optional(),
  is_dismissed: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = saveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    if (!parsed.data.job_listing_id && !parsed.data.imported_title) {
      return NextResponse.json({ error: 'Provide either job_listing_id or imported_title' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('saved_jobs')
      .insert({
        user_id: user.id,
        ...parsed.data,
        imported_url: parsed.data.imported_url || null,
        match_breakdown: parsed.data.match_breakdown ?? null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already saved this job' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[jobs/save POST]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Failed to save job. Please try again.' }, { status: 500 })
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
      .from('saved_jobs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[jobs/save PATCH]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Failed to update job. Please try again.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const includeDismissed = searchParams.get('include_dismissed') === 'true'

    let query = supabase
      .from('saved_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)
    if (!includeDismissed) query = query.eq('is_dismissed', false)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[jobs/save GET]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Failed to load saved jobs.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase
      .from('saved_jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[jobs/save DELETE]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Failed to delete saved job.' }, { status: 500 })
  }
}
