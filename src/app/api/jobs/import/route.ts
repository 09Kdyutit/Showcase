import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPrompt } from '@/lib/ai/client'
import { jobParsePrompt } from '@/lib/ai/prompts/registry'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { fetchUrlSafely, UnsafeUrlError } from '@/lib/security/url-fetch-guard'
import { extractJobFromHtml } from '@/lib/jobs/extract-job-text'
import { computeMatchScore } from '@/lib/jobs/match'
import { z } from 'zod'
import type { JobListing, ParsedResume } from '@/types/database'

const schema = z
  .object({
    description: z.string().min(50).max(20000).optional(),
    source_url: z.string().url().optional().or(z.literal('')),
    title: z.string().min(1).max(300).optional(),
    company: z.string().min(1).max(300).optional(),
  })
  .refine((v) => !!v.description || !!v.source_url, {
    message: 'Provide a job description or a URL to import from.',
  })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors ?? { _: [parsed.error.issues[0]?.message] } }, { status: 400 })
    }

    const isPro = await isProUser(user.id)
    const rl = await checkRateLimit(user.id, 'job_imported', isPro)
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.reason, code: 'RATE_LIMITED' }, { status: 429 })
    }

    let { description, title, company } = parsed.data
    const { source_url } = parsed.data

    // No pasted text — fetch the URL ourselves and pull the job description out of it.
    if (!description && source_url) {
      let html: string
      try {
        html = await fetchUrlSafely(source_url)
      } catch (err) {
        const message = err instanceof UnsafeUrlError ? err.message : 'Could not reach that URL.'
        return NextResponse.json({ error: message, code: 'FETCH_FAILED' }, { status: 422 })
      }

      const extracted = extractJobFromHtml(html)
      if (!extracted) {
        return NextResponse.json(
          { error: 'Could not find a job description on that page. Try pasting the description instead.', code: 'EXTRACT_FAILED' },
          { status: 422 }
        )
      }

      description = extracted.description
      title = title ?? extracted.title ?? undefined
      company = company ?? extracted.company ?? undefined
    }

    if (!description) {
      return NextResponse.json({ error: 'No job description to import.' }, { status: 400 })
    }

    // Parse the job description into structured data
    const { data: structuredData } = await runPrompt(jobParsePrompt, { jobText: description })

    // Extract title/company from description if not provided
    const inferredTitle = title ?? extractTitle(description)
    const inferredCompany = company ?? extractCompany(description)

    // Score the imported job against the user's most recent resume right away, so the
    // import flow surfaces a real match % and gap list instead of leaving them blank
    // until a separate tailoring step.
    let matchScore: number | null = null
    let matchBreakdown: ReturnType<typeof computeMatchScore>['breakdown'] | null = null
    const { data: resumeRow } = await supabase
      .from('resumes')
      .select('parsed_json')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (resumeRow?.parsed_json) {
      const tempJob: JobListing = {
        id: 'import-preview',
        provider: 'import',
        provider_job_id: null,
        source_url: source_url || null,
        title: inferredTitle,
        company: inferredCompany,
        location: null,
        work_mode: null,
        employment_type: 'full-time',
        seniority: null,
        salary_min: null,
        salary_max: null,
        salary_currency: 'USD',
        description,
        structured_data: structuredData,
        posted_at: null,
        fetched_at: new Date().toISOString(),
        expires_at: null,
      }
      const result = computeMatchScore(tempJob, resumeRow.parsed_json as unknown as ParsedResume)
      matchScore = result.score
      matchBreakdown = result.breakdown
    }

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'job_imported',
      metadata: { source: source_url ? 'url' : 'paste', has_url: !!source_url },
    })

    return NextResponse.json({
      data: {
        title: inferredTitle,
        company: inferredCompany,
        description,
        source_url: source_url || null,
        structured_data: structuredData,
        match_score: matchScore,
        match_breakdown: matchBreakdown,
      },
    })
  } catch (err) {
    console.error('[jobs/import]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Job import failed. Please try again.' }, { status: 500 })
  }
}

function extractTitle(text: string): string {
  // Look for common title patterns in first 500 chars
  const firstChunk = text.slice(0, 500)
  const lines = firstChunk.split('\n').map(l => l.trim()).filter(Boolean)
  // First non-empty line is often the title
  return lines[0]?.slice(0, 200) ?? 'Imported Role'
}

function extractCompany(text: string): string {
  const firstChunk = text.slice(0, 1000)
  // Look for common patterns like "at Company" or "Company is hiring"
  const m = firstChunk.match(/(?:at|join|with|for)\s+([A-Z][a-zA-Z0-9\s&,.]+?)(?:\s+is|\s+are|\s*[,.]|\n)/i)
  if (m) return m[1].trim().slice(0, 200)
  return 'Unknown Company'
}
