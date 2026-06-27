import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPrompt } from '@/lib/ai/client'
import { tailorApplicationPrompt } from '@/lib/ai/prompts/registry'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { FIXTURE_JOBS } from '@/lib/jobs/providers/fixture'
import { z } from 'zod'
import type { ParsedResume, JobListing } from '@/types/database'

const schema = z.object({
  parsed_resume: z.record(z.string(), z.unknown()),
  resume_id: z.string().uuid().optional(),
  portfolio_id: z.string().uuid().optional(),
  generate_cover_letter: z.boolean().default(false),
  generate_recruiter_note: z.boolean().default(false),
  saved_job_id: z.string().uuid().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isPro = await isProUser(user.id)
    if (!isPro) {
      return NextResponse.json({
        error: 'Tailor Studio requires a Pro subscription.',
        code: 'PRO_REQUIRED',
      }, { status: 403 })
    }

    const rl = await checkRateLimit(user.id, 'job_tailored', isPro)
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.reason, code: 'RATE_LIMITED' }, { status: 429 })
    }

    const { id: jobId } = await params
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const {
      parsed_resume,
      resume_id,
      portfolio_id,
      generate_cover_letter,
      generate_recruiter_note,
      saved_job_id,
    } = parsed.data

    // Resolve job - `jobId` is the saved job's job_listing_id, a real job_listings_cache
    // UUID (jobs are cached there on save, since fixture/external-provider ids aren't UUIDs).
    let job: JobListing | null = FIXTURE_JOBS.find(j => j.id === jobId) ?? null
    if (!job) {
      const { data: cached } = await supabase
        .from('job_listings_cache')
        .select('*')
        .eq('id', jobId)
        .maybeSingle()
      if (cached) job = cached as JobListing
    }
    if (!job && saved_job_id) {
      // Fall back to saved job import data
      const { data: savedJob } = await supabase
        .from('saved_jobs')
        .select('*')
        .eq('id', saved_job_id)
        .eq('user_id', user.id)
        .single()

      if (savedJob?.imported_title) {
        job = {
          id: savedJob.id,
          provider: 'import',
          provider_job_id: null,
          source_url: savedJob.imported_url,
          title: savedJob.imported_title,
          company: savedJob.imported_company ?? 'Unknown Company',
          location: null,
          work_mode: null,
          employment_type: 'full-time',
          seniority: null,
          salary_min: null,
          salary_max: null,
          salary_currency: 'USD',
          description: savedJob.imported_description,
          structured_data: null,
          posted_at: null,
          fetched_at: new Date().toISOString(),
          expires_at: null,
        }
      }
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const resumeData = parsed_resume as unknown as ParsedResume

    // Run the tailor prompt - the most important AI call in the product
    const { data: tailored, meta } = await runPrompt(tailorApplicationPrompt, {
      parsedResume: resumeData,
      job,
      generateCoverLetter: generate_cover_letter,
      generateRecruiterNote: generate_recruiter_note,
    })

    // Store the tailored asset
    const { data: asset, error: assetErr } = await supabase
      .from('tailored_assets')
      .insert({
        user_id: user.id,
        saved_job_id: saved_job_id ?? null,
        asset_type: 'application_kit',
        base_resume_id: resume_id ?? null,
        base_portfolio_id: portfolio_id ?? null,
        content: {
          professional_summary: tailored.professional_summary,
          skills: tailored.skills,
          experience: tailored.experience,
          recommended_projects: tailored.recommended_projects,
          portfolio_headline: tailored.portfolio_headline,
          recruiter_summary: tailored.recruiter_summary,
          cover_letter: tailored.cover_letter,
          recruiter_note: tailored.recruiter_note,
          interview_brief: tailored.interview_brief,
        },
        truth_map: tailored.truth_map,
        version: 1,
      })
      .select()
      .single()

    if (assetErr) {
      console.error('[tailor] asset save error:', assetErr.message)
    }

    // Update saved job status to 'tailoring' if we have one
    if (saved_job_id) {
      await supabase
        .from('saved_jobs')
        .update({ status: 'tailoring' })
        .eq('id', saved_job_id)
        .eq('user_id', user.id)
    }

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'job_tailored',
      metadata: {
        job_id: jobId,
        cover_letter: generate_cover_letter,
        recruiter_note: generate_recruiter_note,
        truth_entries: tailored.truth_map.length,
      },
    })

    await supabase.from('generations').insert({
      user_id: user.id,
      type: 'tailor_application',
      output: tailored as unknown as Record<string, unknown>,
      model_used: meta.model,
      prompt_id: meta.promptId,
      prompt_version: meta.promptVersion,
      provider: meta.provider,
      status: 'completed',
    })

    return NextResponse.json({
      data: {
        ...tailored,
        asset_id: asset?.id ?? null,
      },
    })
  } catch (err) {
    console.error('[tailor]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Tailor failed. Please try again.' }, { status: 500 })
  }
}
