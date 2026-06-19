import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchJobs } from '@/lib/jobs/providers'
import { computeMatchScore } from '@/lib/jobs/match'
import { isProUser } from '@/lib/ai/rate-limit'
import type { ParsedResume, JobListing } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isPro = await isProUser(user.id)
    if (!isPro) {
      return NextResponse.json({
        error: 'Personalized recommendations require a Pro subscription.',
        code: 'PRO_REQUIRED',
      }, { status: 403 })
    }

    const body = await request.json()
    const parsedResume: ParsedResume | null = body.parsed_resume ?? null

    if (!parsedResume) {
      return NextResponse.json({ error: 'parsed_resume required' }, { status: 400 })
    }

    // Get profile for preferred role/industry signals
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_role, industry, experience_level')
      .eq('id', user.id)
      .single()

    // Search using the candidate's target role as query
    const searchResult = await searchJobs({
      query: parsedResume.skills.slice(0, 3).join(' ') + (profile?.target_role ? ' ' + profile.target_role : ''),
      limit: 50,
    })

    // Score all results against the parsed resume
    const scored = searchResult.jobs
      .map((job: JobListing) => {
        const { score, breakdown } = computeMatchScore(job, parsedResume)
        return { job, score, breakdown }
      })
      .filter(({ score }) => score >= 60) // Only show roles that are a real fit, not stretch/adjacent matches
      .sort((a, b) => b.score - a.score)

    // Return top 20 with match data
    const recommendations = scored.slice(0, 20).map(({ job, score, breakdown }) => ({
      job,
      match_score: score,
      match_breakdown: breakdown,
    }))

    return NextResponse.json({ data: recommendations, is_demo: searchResult.is_demo })
  } catch (err) {
    console.error('[jobs/recommendations]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: 'Recommendations failed. Please try again.' }, { status: 500 })
  }
}
