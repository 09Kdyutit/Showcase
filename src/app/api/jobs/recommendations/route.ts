import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchJobs } from '@/lib/jobs/providers'
import { computeMatchScore, mapSeniority, SENIORITY_RANK } from '@/lib/jobs/match'
import { isProUser } from '@/lib/ai/rate-limit'
import { classifyRoleFamily, isSameOrAdjacentFamily, isAdjacentFamily } from '@/lib/jobs/role-taxonomy'
import type { ParsedResume, JobListing } from '@/types/database'
import { z } from 'zod'

const schema = z.object({
  parsed_resume: z.record(z.string(), z.unknown()),
  include_adjacent: z.boolean().default(false),
})

// Seniority more than this many ranks away from the candidate is an obvious mismatch
// (e.g. an entry-level candidate and an executive role), regardless of skill overlap.
const MAX_SENIORITY_RANK_GAP = 2

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
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const parsedResume = parsed.data.parsed_resume as unknown as ParsedResume
    const includeAdjacent = parsed.data.include_adjacent

    // Get profile for preferred role/industry signals
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_role, industry, experience_level')
      .eq('id', user.id)
      .maybeSingle()

    // Search using the candidate's target role as query
    const searchResult = await searchJobs({
      query: parsedResume.skills.slice(0, 3).join(' ') + (profile?.target_role ? ' ' + profile.target_role : ''),
      limit: 50,
    })

    // ── Hard filter: role-family and seniority compatibility, before scoring ──
    // computeMatchScore is a soft skill-overlap signal - it can't tell a Software Engineer
    // role apart from a Wastewater Process Engineer role just because both mention "Linux"
    // or "communication". Role family is checked explicitly instead.
    const candidateFamily = classifyRoleFamily(profile?.target_role ?? null)
    const candidateSeniority = mapSeniority(parsedResume)

    const familyFiltered = searchResult.jobs.filter((job: JobListing) => {
      const jobFamily = classifyRoleFamily(job.title)
      if (!isSameOrAdjacentFamily(candidateFamily, jobFamily, includeAdjacent)) return false

      if (candidateSeniority && job.seniority) {
        const gap = Math.abs(SENIORITY_RANK[candidateSeniority] - SENIORITY_RANK[job.seniority])
        if (gap > MAX_SENIORITY_RANK_GAP) return false
      }
      return true
    })

    // Score the family/seniority-filtered set against the parsed resume
    const scored = familyFiltered
      .map((job: JobListing) => {
        const { score, breakdown } = computeMatchScore(job, parsedResume)
        const jobFamily = classifyRoleFamily(job.title)
        return { job, score, breakdown, is_adjacent: isAdjacentFamily(candidateFamily, jobFamily) }
      })
      .filter(({ score }) => score >= 60) // Only show roles that are a real fit, not stretch/adjacent matches
      .sort((a, b) => b.score - a.score)

    // Return top 20 with match data
    const recommendations = scored.slice(0, 20).map(({ job, score, breakdown, is_adjacent }) => ({
      job,
      match_score: score,
      match_breakdown: breakdown,
      is_adjacent,
    }))

    return NextResponse.json({ data: recommendations, is_demo: searchResult.is_demo })
  } catch (err) {
    console.error('[jobs/recommendations]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: 'Recommendations failed. Please try again.' }, { status: 500 })
  }
}
