// Typed registry of portfolio themes. The DB column (portfolios.theme) is a free-text
// string — anything stored there might be stale (an old default), hand-edited, or simply
// wrong. Every read goes through coerceThemeId() so an invalid value always degrades to a
// real theme instead of crashing the page or silently rendering nothing.

export const THEME_IDS = ['executive-dark', 'clean-editorial', 'creative-case-study'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export const DEFAULT_THEME_ID: ThemeId = 'executive-dark'

export interface ThemeMeta {
  id: ThemeId
  name: string
  description: string
  recommendedRoles: string[]
  /** Small swatch colors used by the builder's theme picker cards — not used in the real render. */
  swatch: { bg: string; accent: string; text: string }
}

export const THEME_REGISTRY: Record<ThemeId, ThemeMeta> = {
  'executive-dark': {
    id: 'executive-dark',
    name: 'Executive Dark',
    description: 'Restrained premium dark design with strong role positioning and serious project presentation.',
    recommendedRoles: ['Engineering', 'Product', 'Finance', 'Consulting', 'Leadership'],
    swatch: { bg: '#0a0a0f', accent: '#818cf8', text: '#f4f4f5' },
  },
  'clean-editorial': {
    id: 'clean-editorial',
    name: 'Clean Editorial',
    description: 'Bright, typography-first layout with generous whitespace and a sophisticated reading experience.',
    recommendedRoles: ['Marketing', 'Consulting', 'Writing', 'Research', 'General Professional'],
    swatch: { bg: '#fafaf9', accent: '#18181b', text: '#18181b' },
  },
  'creative-case-study': {
    id: 'creative-case-study',
    name: 'Creative Case Study',
    description: 'Highly visual, project-forward layout with bold navigation and rich case-study composition.',
    recommendedRoles: ['Design', 'Branding', 'Creative Development', 'Product Design'],
    swatch: { bg: '#0c0a14', accent: '#f97316', text: '#fafaf9' },
  },
}

/** Treat the pre-theme-system legacy default ('dark') as an alias for Executive Dark. */
const LEGACY_ALIASES: Record<string, ThemeId> = {
  dark: 'executive-dark',
}

export function coerceThemeId(value: string | null | undefined): ThemeId {
  if (!value) return DEFAULT_THEME_ID
  if ((THEME_IDS as readonly string[]).includes(value)) return value as ThemeId
  return LEGACY_ALIASES[value] ?? DEFAULT_THEME_ID
}

export function getThemeMeta(value: string | null | undefined): ThemeMeta {
  return THEME_REGISTRY[coerceThemeId(value)]
}

export const THEME_LIST: ThemeMeta[] = THEME_IDS.map((id) => THEME_REGISTRY[id])
