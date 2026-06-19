import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProUser } from '@/lib/ai/rate-limit'
import { z } from 'zod'

const FREE_SAVED_JOBS_LIMIT = 5

// Jobs from search/recommendations (fixture or external-provider) aren't rows in
// job_listings_cache yet — their `id` is provider-local, not a cache UUID. To save one we
// either get a real cache UUID directly, or get the full listing and cache it ourselves.
const jobSnapshotSchema = z.object({
  provider: z.string().min(1).max(100),
  provider_job_id: z.string().max(300).nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  title: z.string().min(1).max(300),
  company: z.string().min(1).max(300),
  location: z.string().max(300).nullable().optional(),
  work_mode: z.enum(['remote', 'hybrid', 'on-site', 'flexible']).nullable().optional(),
  employment_type: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship']).nullable().optional(),
  seniority: z.enum(['internship', 'entry', 'mid', 'senior', 'staff', 'principal', 'director', 'executive']).nullable().optional(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  salary_currency: z.string().max(10).optional(),
  description: z.string().max(30000).nullable().optional(),
  structured_data: z.record(z.string(), z.unknown()).nullable().optional(),
  posted_at: z.string().nullable().optional(),
})

const saveSchema = z.object({
  job_listing_id: z.string().uuid().optional(),
  job: jobSnapshotSchema.optional(),
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

    const isPro = await isProUser(user.id)
    if (!isPro) {
      const { count } = await supabase
        .from('saved_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_dismissed', false)

      if ((count ?? 0) >= FREE_SAVED_JOBS_LIMIT) {
        return NextResponse.json(
          {
            error: `Free plan is limited to ${FREE_SAVED_JOBS_LIMIT} saved jobs. Upgrade to Pro for unlimited saves, or archive an existing one.`,
            code: 'PRO_REQUIRED',
          },
          { status: 403 }
        )
      }
    }

    const { job, job_listing_id: bodyJobListingId, ...rest } = parsed.data

    let job_listing_id = bodyJobListingId ?? null
    if (!job_listing_id && job) {
      // Fixture/external-provider jobs aren't cache rows yet — find or create one by
      // (provider, provider_job_id) so saved_jobs can FK to a real listing.
      if (job.provider_job_id) {
        const { data: existing } = await supabase
          .from('job_listings_cache')
          .select('id')
          .eq('provider', job.provider)
          .eq('provider_job_id', job.provider_job_id)
          .maybeSingle()
        if (existing) job_listing_id = existing.id
      }
      if (!job_listing_id) {
        const { data: cached, error: cacheError } = await supabase
          .from('job_listings_cache')
          .insert({ ...job, salary_currency: job.salary_currency ?? 'USD' })
          .select('id')
          .single()
        if (cacheError) throw cacheError
        job_listing_id = cached.id
      }
    }

    if (!job_listing_id && !rest.imported_title) {
      return NextResponse.json({ error: 'Provide either job_listing_id, job, or imported_title' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('saved_jobs')
      .insert({
        user_id: user.id,
        ...rest,
        job_listing_id,
        imported_url: rest.imported_url || null,
        match_breakdown: rest.match_breakdown ?? null,
      })
      .select('*, job_listings_cache(*)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already saved this job' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[jobs/save POST]', err instanceof Error ? err.message : err)
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
    console.error('[jobs/save PATCH]', err instanceof Error ? err.message : err)
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
      .select('*, job_listings_cache(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)
    if (!includeDismissed) query = query.eq('is_dismissed', false)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[jobs/save GET]', err instanceof Error ? err.message : err)
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
    console.error('[jobs/save DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to delete saved job.' }, { status: 500 })
  }
}
