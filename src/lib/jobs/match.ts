import type { JobListing, ParsedResume, MatchBreakdown, Seniority } from '@/types/database'

const SENIORITY_RANK: Record<Seniority, number> = {
  internship: 0,
  entry: 1,
  mid: 2,
  senior: 3,
  staff: 4,
  principal: 5,
  director: 6,
  executive: 7,
}

function extractYearsFromRequirements(requirements: string[]): number | null {
  for (const req of requirements) {
    const m = req.match(/(\d+)\+?\s*(?:–|-)\s*(\d+)?\s*year/i) ?? req.match(/(\d+)\+?\s*year/i)
    if (m) return parseInt(m[1], 10)
  }
  return null
}

function normalizeSkill(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function skillsOverlap(resumeSkills: string[], jobSkills: string[]): { matched: string[]; missing: string[] } {
  const normalized = resumeSkills.map(normalizeSkill)
  const matched: string[] = []
  const missing: string[] = []
  for (const skill of jobSkills) {
    const n = normalizeSkill(skill)
    if (normalized.some(rs => rs.includes(n) || n.includes(rs))) {
      matched.push(skill)
    } else {
      missing.push(skill)
    }
  }
  return { matched, missing }
}

function mapSeniority(parsed: ParsedResume): Seniority | null {
  if (parsed.seniority_level === 'student') return 'entry'
  if (parsed.seniority_level === 'junior') return 'entry'
  if (parsed.seniority_level === 'mid') return 'mid'
  if (parsed.seniority_level === 'senior') return 'senior'
  if (parsed.seniority_level === 'lead') return 'staff'
  if (parsed.seniority_level === 'executive') return 'executive'
  return null
}

export interface MatchScoreResult {
  score: number
  breakdown: MatchBreakdown
}

// Deterministic scoring — AI explanation is layered on top by the API route
export function computeMatchScore(job: JobListing, parsed: ParsedResume): MatchScoreResult {
  const sd = job.structured_data
  const allResumeSkills = [
    ...parsed.skills,
    ...parsed.experience.flatMap(e => e.bullets.join(' ').split(/\s+/).filter(w => w.length > 4)),
  ]

  // ── Skill matching ─────────────────────────────────────────────────────────
  const requiredSkills = sd?.required_skills ?? []
  const preferredSkills = sd?.preferred_skills ?? []

  const { matched: matchedRequired, missing: missingRequired } = skillsOverlap(allResumeSkills, requiredSkills)
  const { matched: matchedPreferred } = skillsOverlap(allResumeSkills, preferredSkills)

  const skillScore =
    requiredSkills.length === 0
      ? 70
      : Math.round((matchedRequired.length / requiredSkills.length) * 100)

  // ── Experience matching ────────────────────────────────────────────────────
  const minYears = extractYearsFromRequirements(sd?.experience_requirements ?? [])
  const candidateYears = parsed.years_of_experience ?? 0
  let experienceScore = 70
  if (minYears !== null) {
    if (candidateYears >= minYears + 2) experienceScore = 100
    else if (candidateYears >= minYears) experienceScore = 90
    else if (candidateYears >= minYears - 1) experienceScore = 70
    else if (candidateYears >= minYears - 2) experienceScore = 50
    else experienceScore = 30
  }

  // ── Seniority matching ─────────────────────────────────────────────────────
  const jobSeniority = job.seniority
  const candidateSeniority = mapSeniority(parsed)
  let seniorityMatch: MatchBreakdown['seniority_match'] = 'unknown'
  let seniorityScore = 70

  if (jobSeniority && candidateSeniority) {
    const jobRank = SENIORITY_RANK[jobSeniority]
    const cRank = SENIORITY_RANK[candidateSeniority]
    if (cRank === jobRank) { seniorityMatch = 'exact'; seniorityScore = 100 }
    else if (cRank === jobRank + 1) { seniorityMatch = 'above'; seniorityScore = 85 }
    else if (cRank === jobRank - 1) { seniorityMatch = 'below'; seniorityScore = 75 }
    else if (cRank < jobRank) { seniorityMatch = 'below'; seniorityScore = 40 }
    else { seniorityMatch = 'above'; seniorityScore = 70 }
  }

  // ── Work mode matching ─────────────────────────────────────────────────────
  const locationMatch = true // deterministic without user location pref
  const workModeMatch = true // deterministic without user work pref

  // ── Project relevance ──────────────────────────────────────────────────────
  const domain = sd?.domain?.toLowerCase() ?? ''
  const relevantProjects = parsed.projects.filter(p => {
    const text = (p.description + ' ' + p.technologies.join(' ')).toLowerCase()
    return domain ? text.includes(domain.split('/')[0].trim()) : false
  })

  // ── Opportunity detection ──────────────────────────────────────────────────
  const opportunities: MatchBreakdown['opportunities'] = []
  if (relevantProjects.length > 0) {
    opportunities.push({
      type: 'highlight_project',
      description: `"${relevantProjects[0].title}" is directly relevant — move it first in your portfolio`,
      source: relevantProjects[0].title,
    })
  }
  if (matchedPreferred.length > 0) {
    opportunities.push({
      type: 'move_bullet',
      description: `You match ${matchedPreferred.length} preferred skills — make these prominent: ${matchedPreferred.slice(0, 3).join(', ')}`,
    })
  }
  if (missingRequired.slice(0, 2).length > 0) {
    opportunities.push({
      type: 'add_evidence',
      description: `Can you demonstrate ${missingRequired[0]}? Add a project, certificate, or bullet that shows it`,
    })
  }

  // ── Composite score ────────────────────────────────────────────────────────
  // Weights: skills 40%, experience 30%, seniority 20%, projects 10%
  const projectScore = relevantProjects.length > 0 ? 80 : 60
  const compositeScore = Math.round(
    skillScore * 0.4 +
    experienceScore * 0.3 +
    seniorityScore * 0.2 +
    projectScore * 0.1
  )

  // Clamp to 15–95 (never claim 0 or 100 — those extremes are meaningless)
  const finalScore = Math.min(95, Math.max(15, compositeScore))

  const breakdown: MatchBreakdown = {
    matched_skills: matchedRequired,
    missing_skills: missingRequired,
    matching_experience: parsed.experience.slice(0, 2).map(e => `${e.role} at ${e.company}`),
    experience_gaps: missingRequired.slice(0, 3).map(s => `No evidence of ${s}`),
    matching_projects: relevantProjects.map(p => p.title),
    domain_alignment: domain ? `Domain: ${sd?.domain}` : 'Domain not specified',
    location_match: locationMatch,
    work_mode_match: workModeMatch,
    seniority_match: seniorityMatch,
    opportunities,
    ai_explanation: null,
  }

  return { score: finalScore, breakdown }
}

export function salaryDisplay(job: JobListing): string | null {
  if (!job.salary_min && !job.salary_max) return null
  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`
  if (job.salary_min && job.salary_max) {
    return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`
  }
  if (job.salary_min) return `${fmt(job.salary_min)}+`
  if (job.salary_max) return `Up to ${fmt(job.salary_max)}`
  return null
}

export function daysAgo(dateStr: string | null): string {
  if (!dateStr) return 'Recently posted'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}
