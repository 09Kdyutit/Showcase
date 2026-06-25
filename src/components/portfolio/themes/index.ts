import type { ComponentType } from 'react'
import type { ThemeId } from '@/lib/portfolio/themes'
import type { ThemeProps } from './shared'
import { ExecutiveDarkTheme } from './executive-dark'
import { CleanEditorialTheme } from './clean-editorial'
import { CreativeCaseStudyTheme } from './creative-case-study'
import { GlassmorphismTheme } from './glassmorphism'
import { NeonNightTheme } from './neon-night'
import { GradientStudioTheme } from './gradient-studio'
import { Minimal3DTheme } from './minimal-3d'
import { BentoTheme } from './bento'
import { MagazineTheme } from './magazine'

export const THEME_COMPONENTS: Record<ThemeId, ComponentType<ThemeProps>> = {
  'executive-dark': ExecutiveDarkTheme,
  'clean-editorial': CleanEditorialTheme,
  'creative-case-study': CreativeCaseStudyTheme,
  'glassmorphism': GlassmorphismTheme,
  'neon-night': NeonNightTheme,
  'gradient-studio': GradientStudioTheme,
  'minimal-3d': Minimal3DTheme,
  'bento': BentoTheme,
  'magazine': MagazineTheme,
}

export type { ThemeProps, ThemePortfolio, ThemeContent } from './shared'
export {
  ExecutiveDarkTheme,
  CleanEditorialTheme,
  CreativeCaseStudyTheme,
  GlassmorphismTheme,
  NeonNightTheme,
  GradientStudioTheme,
  Minimal3DTheme,
  BentoTheme,
  MagazineTheme,
}
