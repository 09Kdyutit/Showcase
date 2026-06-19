import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callStructured } from '@/lib/ai/client'
import { MatchExplanationSchema } from '@/lib/ai/schemas'
import { buildMatchExplanationPrompt } from '@/lib/ai/prompts'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { computeMatchScore } from '@/lib/jobs/match'
import { getJobById } from '@/lib/jobs/providers'
import { FIXTURE_JOBS } from '@/lib/jobs/providers/fixture'
import { z } from 'zod'
import type { JobListing, ParsedResume } from '@/types/database'

const schema = z.object({
  job_id: z.string().optional(),
  // For inline match against pasted/imported job
  job: z.object({
    title: z.string(),
    company: z.string(),
    seniority: z.string().nullable().optional(),
    structured_data: z.record(z.string(), z.unknown()).nullable().optional(),
  }).optional(),
  parsed_resume: z.record(z.string(), z.unknown()),
  include_ai_explanation: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const isPro = await isProUser(user.id)
    const rl = await checkRateLimit(user.id, 'job_matched', isPro)
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.reason, code: 'RATE_LIMITED' }, { status: 429 })
    }

    const { job_id, job: inlineJob, parsed_resume, include_ai_explanation } = parsed.data
    const resumeData = parsed_resume as unknown as ParsedResume

    // Resolve job listing
    let jobListing: JobListing | null = null
    if (job_id) {
      // Try fixture first (fast), then the cache (saved/searched jobs are cached there), then provider
      jobListing = FIXTURE_JOBS.find(j => j.id === job_id) ?? null
      if (!jobListing) {
        const { data: cached } = await supabase.from('job_listings_cache').select('*').eq('id', job_id).maybeSingle()
        jobListing = (cached as JobListing | null) ?? null
      }
      if (!jobListing) {
        jobListing = await getJobById(job_id)
      }
    } else if (inlineJob) {
      jobListing = {
        id: 'inline',
        provider: 'inline',
        provider_job_id: null,
        source_url: null,
        location: null,
        work_mode: null,
        employment_type: 'full-time',
        salary_min: null,
        salary_max: null,
        salary_currency: 'USD',
        description: null,
        posted_at: null,
        fetched_at: new Date().toISOString(),
        expires_at: null,
        ...inlineJob,
        structured_data: (inlineJob.structured_data as JobListing['structured_data']) ?? null,
        seniority: (inlineJob.seniority as JobListing['seniority']) ?? null,
      }
    }

    if (!jobListing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Deterministic scoring
    const { score, breakdown } = computeMatchScore(jobListing, resumeData)

    // AI explanation (Pro only, or if explicitly requested and within limits)
    let aiExplanation: string | null = null
    if (include_ai_explanation && isPro) {
      try {
        const explanation = await callStructured(
          [{
            role: 'user',
            content: buildMatchExplanationPrompt(
              resumeData,
              jobListing,
              score,
              breakdown.matched_skills,
              breakdown.missing_skills
            ),
          }],
          MatchExplanationSchema,
          'match_explanation',
          { tier: 'fast', maxOutputTokens: 800, temperature: 0.2 }
        )
        aiExplanation = [
          explanation.score_justification,
          `Strength: ${explanation.top_strength}`,
          `Gap: ${explanation.primary_gap}`,
          `Next step: ${explanation.recommended_action}`,
        ].join('\n\n')
        breakdown.ai_explanation = aiExplanation
      } catch {
        // AI explanation failure is non-fatal — deterministic score is still valid
      }
    }

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'job_matched',
      metadata: { job_id, score, has_ai: !!aiExplanation },
    })

    return NextResponse.json({ data: { score, breakdown } })
  } catch (err) {
    console.error('[jobs/match]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: 'Match analysis failed. Please try again.' }, { status: 500 })
  }
}
