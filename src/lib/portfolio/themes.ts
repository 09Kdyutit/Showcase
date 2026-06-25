// Typed registry of portfolio themes. The DB column (portfolios.theme) is a free-text
// string — anything stored there might be stale (an old default), hand-edited, or simply
// wrong. Every read goes through coerceThemeId() so an invalid value always degrades to a
// real theme instead of crashing the page or silently rendering nothing.

export const THEME_IDS = [
  'executive-dark',
  'clean-editorial',
  'creative-case-study',
  'glassmorphism',
  'neon-night',
  'gradient-studio',
  'minimal-3d',
  'bento',
  'magazine',
] as const

export type ThemeId = (typeof THEME_IDS)[number]

export const DEFAULT_THEME_ID: ThemeId = 'executive-dark'

export interface ThemeMeta {
  id: ThemeId
  name: string
  description: string
  recommendedRoles: string[]
  /** Small swatch colors used by the builder's theme picker cards — not used in the real render. */
  swatch: { bg: string; accent: string; text: string }
  badge?: string
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
  'glassmorphism': {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    description: 'Frosted glass panels, floating orbs, and 3D tilt cards over a deep dark background. Ultra-modern.',
    recommendedRoles: ['Engineering', 'Product', 'Tech Leadership', 'AI/ML', 'Startup'],
    swatch: { bg: '#080810', accent: '#818cf8', text: '#ffffff' },
    badge: 'Popular',
  },
  'neon-night': {
    id: 'neon-night',
    name: 'Neon Night',
    description: 'Cyberpunk-inspired monochrome grid with glowing skill bars and neon accent highlights.',
    recommendedRoles: ['Engineering', 'DevOps', 'Security', 'Game Dev', 'Fullstack'],
    swatch: { bg: '#03020a', accent: '#00f5ff', text: '#ffffff' },
    badge: 'New',
  },
  'gradient-studio': {
    id: 'gradient-studio',
    name: 'Gradient Studio',
    description: 'Bold colorful gradients, tabbed project spotlight, and a fresh light aesthetic with real personality.',
    recommendedRoles: ['Design', 'Creative', 'Marketing', 'Brand', 'Growth'],
    swatch: { bg: '#fafafa', accent: '#f72585', text: '#0a0a0a' },
    badge: 'New',
  },
  'minimal-3d': {
    id: 'minimal-3d',
    name: 'Minimal 3D',
    description: 'Surgical white space with 3D parallax project cards and a floating sticky sidebar on scroll.',
    recommendedRoles: ['Product', 'Consulting', 'General Professional', 'Research', 'Finance'],
    swatch: { bg: '#ffffff', accent: '#0066ff', text: '#0a0a0a' },
    badge: 'New',
  },
  'bento': {
    id: 'bento',
    name: 'Bento',
    description: 'Asymmetric bento grid hero with marquee skill ticker and large-format project spreads. Ultra modern.',
    recommendedRoles: ['Engineering', 'Product', 'Design', 'Startup', 'Tech Leadership'],
    swatch: { bg: '#080c08', accent: '#a3e635', text: '#ffffff' },
    badge: 'Hot',
  },
  'magazine': {
    id: 'magazine',
    name: 'Magazine',
    description: 'Editorial magazine spread with full-bleed photography, serif typography and alternating project layouts.',
    recommendedRoles: ['Design', 'Creative', 'Marketing', 'Brand', 'Writing', 'UX'],
    swatch: { bg: '#f7f3ee', accent: '#e85d2a', text: '#0a0a0a' },
    badge: 'Hot',
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
