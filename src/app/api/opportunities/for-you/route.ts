import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllOpportunities } from '@/app/api/opportunities/search/route'
import type { Opportunity, OpportunityCategory } from '@/app/api/opportunities/search/route'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get user's latest resume for personalization
    const { data: resumes } = await supabase
      .from('resumes').select('parsed_json')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    type ParsedResume = {
      location?: string
      skills?: string[]
      education?: Array<{ degree?: string; field?: string; institution?: string }>
      experience?: Array<{ title?: string; company?: string; description?: string }>
    }

    const parsed: ParsedResume | null = resumes?.[0]?.parsed_json ?? null

    const userSkills: string[] = (parsed?.skills ?? []).map((s: string) => s.toLowerCase())
    const userLocation = (parsed?.location ?? '').split(',')[0].trim().toLowerCase()
    const educationLevel = detectEducationLevel(parsed?.education)
    const experienceLevel = detectExperienceLevel(parsed?.experience)

    // Fetch all opportunities across all categories
    const all: Opportunity[] = await fetchAllOpportunities()

    if (all.length === 0) {
      return NextResponse.json({ data: [], reason: 'no_opportunities', profile: null })
    }

    // Score each opportunity against resume
    const scored = all.map(o => {
      let score = 0
      const searchable = [o.title, o.description ?? '', ...o.tags].join(' ').toLowerCase()

      // Skill match (highest weight)
      for (const skill of userSkills) {
        if (skill.length > 2 && searchable.includes(skill)) score += 8
      }

      // Location boost
      if (!o.is_online && o.location && o.location.toLowerCase().includes(userLocation)) score += 20
      if (o.is_online) score += 5

      // Education level match
      const contentLower = searchable
      if (educationLevel === 'undergraduate') {
        if (contentLower.includes('undergraduate') || contentLower.includes('student') || contentLower.includes('fresh')) score += 10
      } else if (educationLevel === 'graduate') {
        if (contentLower.includes('graduate') || contentLower.includes('postgrad') || contentLower.includes('phd') || contentLower.includes('doctoral')) score += 10
      }

      // Experience level match
      if (experienceLevel === 'early') {
        if (contentLower.includes('junior') || contentLower.includes('entry') || contentLower.includes('intern') || contentLower.includes('student')) score += 8
      }

      // Deadline urgency sweet spot (5-30 days — far enough to act, close enough to be relevant)
      if (o.days_left !== null) {
        if (o.days_left >= 5 && o.days_left <= 30) score += 12
        else if (o.days_left > 30 && o.days_left <= 90) score += 5
        else if (o.days_left >= 0 && o.days_left < 5) score += 3
      }

      // Prize/funding adds relevance signal
      if (o.prize) score += 6

      // Freshness boost
      if (o.published_at) {
        const ageMs = Date.now() - new Date(o.published_at).getTime()
        const ageDays = ageMs / 86400000
        if (ageDays < 7) score += 5
        else if (ageDays < 30) score += 2
      }

      return { ...o, match_score: score }
    })

    // Sort by score descending, take top 60
    scored.sort((a, b) => b.match_score - a.match_score)
    const top = scored.slice(0, 60)

    const profile = {
      location: userLocation || null,
      skills: userSkills.slice(0, 10),
      education_level: educationLevel,
      experience_level: experienceLevel,
    }

    return NextResponse.json({ data: top, profile })
  } catch (err) {
    console.error('[opportunities/for-you]', err)
    return NextResponse.json({ error: 'Failed to load personalised opportunities' }, { status: 500 })
  }
}

function detectEducationLevel(
  education: Array<{ degree?: string }> | undefined
): 'undergraduate' | 'graduate' | 'unknown' {
  if (!education?.length) return 'unknown'
  const degrees = education.map(e => (e.degree ?? '').toLowerCase()).join(' ')
  if (degrees.includes('phd') || degrees.includes('doctorate') || degrees.includes('master') || degrees.includes('msc') || degrees.includes('mba')) return 'graduate'
  if (degrees.includes('bachelor') || degrees.includes('b.sc') || degrees.includes('b.eng') || degrees.includes('bsc') || degrees.includes('undergraduate')) return 'undergraduate'
  return 'undergraduate'
}

function detectExperienceLevel(
  experience: Array<{ title?: string }> | undefined
): 'early' | 'mid' | 'senior' | 'unknown' {
  if (!experience?.length) return 'early'
  if (experience.length <= 2) return 'early'
  if (experience.length <= 4) return 'mid'
  return 'senior'
}

// Re-export for external use
export type { Opportunity, OpportunityCategory }
