import type { TailoredContent, ParsedResume } from '@/types/database'

export interface TruthMapEntryLite {
  requires_confirmation: boolean
  user_confirmed: boolean | null
}

// Export is blocked while any entry that needs confirmation hasn't been explicitly confirmed true.
export function getUnconfirmedFabricationRisks<T extends TruthMapEntryLite>(truthMap: T[]): T[] {
  return truthMap.filter((e) => e.requires_confirmation && e.user_confirmed !== true)
}

export interface CoverageResult {
  coverage_pct: number
  sections_found: string[]
  sections_missing: string[]
}

export function extractTextFromDocx(
  content: TailoredContent | null,
  parsed: ParsedResume | null
): string {
  const parts: string[] = []

  if (content) {
    parts.push(content.professional_summary)
    parts.push(content.skills.join(' '))
    for (const exp of content.experience) {
      parts.push(exp.company, exp.role, exp.period)
      for (const b of exp.tailored_bullets) {
        if (b.accepted !== false) parts.push(b.tailored)
      }
    }
    if (content.cover_letter) parts.push(content.cover_letter)
  } else if (parsed) {
    parts.push(parsed.name, parsed.email, parsed.phone, parsed.location, parsed.summary)
    parts.push(parsed.skills.join(' '))
    for (const exp of parsed.experience) {
      parts.push(exp.company, exp.role, exp.period, ...exp.bullets)
    }
    for (const edu of parsed.education) {
      parts.push(edu.institution, edu.degree)
    }
  }

  return parts.filter(Boolean).join('\n')
}

export function computeCoverage(
  text: string,
  content: TailoredContent | null,
  parsed: ParsedResume | null
): CoverageResult {
  const lower = text.toLowerCase()
  const sections_found: string[] = []
  const sections_missing: string[] = []

  const checks: { name: string; present: boolean }[] = [
    { name: 'contact', present: content != null ? true : !!(parsed?.email || parsed?.phone) },
    { name: 'summary', present: lower.includes('professional') || lower.includes('summary') || (parsed?.summary?.length ?? 0) > 10 },
    { name: 'skills', present: lower.includes('skill') || (content?.skills?.length ?? parsed?.skills?.length ?? 0) > 0 },
    { name: 'experience', present: (content?.experience?.length ?? parsed?.experience?.length ?? 0) > 0 },
    { name: 'education', present: (parsed?.education?.length ?? 0) > 0 || lower.includes('university') || lower.includes('degree') },
    { name: 'dates', present: /\d{4}/.test(text) },
    { name: 'bullets', present: (content?.experience?.flatMap(e => e.tailored_bullets).length ?? parsed?.experience?.flatMap(e => e.bullets).length ?? 0) > 0 },
  ]

  for (const c of checks) {
    if (c.present) sections_found.push(c.name)
    else sections_missing.push(c.name)
  }

  const coverage_pct = Math.round((sections_found.length / checks.length) * 100)
  return { coverage_pct, sections_found, sections_missing }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}
