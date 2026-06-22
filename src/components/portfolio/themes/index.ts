import type { ComponentType } from 'react'
import type { ThemeId } from '@/lib/portfolio/themes'
import type { ThemeProps } from './shared'
import { ExecutiveDarkTheme } from './executive-dark'
import { CleanEditorialTheme } from './clean-editorial'
import { CreativeCaseStudyTheme } from './creative-case-study'

export const THEME_COMPONENTS: Record<ThemeId, ComponentType<ThemeProps>> = {
  'executive-dark': ExecutiveDarkTheme,
  'clean-editorial': CleanEditorialTheme,
  'creative-case-study': CreativeCaseStudyTheme,
}

export type { ThemeProps, ThemePortfolio, ThemeContent } from './shared'
export { ExecutiveDarkTheme, CleanEditorialTheme, CreativeCaseStudyTheme }
