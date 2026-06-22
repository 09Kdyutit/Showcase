import type { PortfolioContent } from '@/types/database'

export interface ThemePortfolio {
  title: string
  slug: string
  target_role: string | null
  status: 'draft' | 'published'
}

export interface ThemeContent extends Partial<PortfolioContent> {
  recruiterSummary?: string
  featuredResult?: string
}

export interface ThemeProps {
  portfolio: ThemePortfolio
  content: ThemeContent
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'P'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Every theme needs the same null-safe shape out of `content` — the AI output, a
 * hand-edited draft, or a half-filled-in record can each be missing any field. Themes share
 * this normalization so "what counts as present" can't drift between them, while the actual
 * layout each one builds from this data stays theme-specific.
 */
export function normalizePortfolioContent(portfolio: ThemePortfolio, content: ThemeContent) {
  const hero = content?.hero
  const about = content?.about
  const skills = content?.skills ?? []
  const experience = content?.experience ?? []
  const projects = content?.projects ?? []
  const proof = content?.proof?.filter((p) => p.value && p.label) ?? []
  const contact = content?.contact
  const cta = content?.cta
  const recruiterSummary = content?.recruiterSummary
  const featuredResult = content?.featuredResult

  const initials = getInitials(portfolio.title)

  const skillsByCategory = skills.reduce<Record<string, typeof skills>>((acc, skill) => {
    const cat = skill.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(skill)
    return acc
  }, {})
  const categoryOrder = Object.keys(skillsByCategory)

  const hasContent = !!(hero?.headline || about?.bio || projects.length > 0 || experience.length > 0)
  const bioParagraphs = about?.bio?.split('\n\n').filter(Boolean) ?? []

  return {
    hero, about, skills, experience, projects, proof, contact, cta,
    recruiterSummary, featuredResult, initials, skillsByCategory, categoryOrder,
    hasContent, bioParagraphs,
  }
}

export function getLevelDot(level: string) {
  if (level === 'Expert') return 'bg-brand-400'
  if (level === 'Advanced') return 'bg-violet-400'
  if (level === 'Proficient') return 'bg-emerald-500'
  return 'bg-surface-400'
}

export const PROJECT_ACCENT_COLORS = [
  'border-brand-500/30 bg-brand-500/[0.02]',
  'border-violet-500/30 bg-violet-500/[0.02]',
  'border-emerald-500/30 bg-emerald-500/[0.02]',
  'border-amber-500/30 bg-amber-500/[0.02]',
]

export const GRADIENT_TEXT_STYLE = {
  background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
  WebkitBackgroundClip: 'text' as const,
  WebkitTextFillColor: 'transparent' as const,
  backgroundClip: 'text' as const,
  display: 'inline-block' as const,
  willChange: 'transform' as const,
  transform: 'translateZ(0)',
}
