import { createElement, type ComponentType } from 'react'
import type { ThemeId } from '@/lib/portfolio/themes'
import type { ThemeProps } from './shared'
import { CinematicDarkTheme } from './cinematic-dark'
import { ExecutiveDarkTheme } from './executive-dark'
import { CleanEditorialTheme } from './clean-editorial'
import { CreativeCaseStudyTheme } from './creative-case-study'
import { GlassmorphismTheme } from './glassmorphism'
import { NeonNightTheme } from './neon-night'
import { GradientStudioTheme } from './gradient-studio'
import { Minimal3DTheme } from './minimal-3d'
import { BentoTheme } from './bento'
import { MagazineTheme } from './magazine'
import { PresetTheme } from './preset-theme'
import { PRESETS } from './presets'

// The 30 preset-engine themes. Each is a thin wrapper that renders the (client) PresetTheme
// with its serializable preset prop. Built with createElement in this non-'use client'
// module so it stays renderable from server components (e.g. the published /p/[slug] page),
// which calling a client factory at module-eval would break. Typed as Record<string> so the
// spread below doesn't claim the builtin keys.
const PRESET_COMPONENTS: Record<string, ComponentType<ThemeProps>> = Object.fromEntries(
  PRESETS.map((p) => {
    const Wrapper = (props: ThemeProps) => createElement(PresetTheme, { ...props, preset: p })
    Wrapper.displayName = `PresetTheme(${p.id})`
    return [p.id, Wrapper]
  })
)

export const THEME_COMPONENTS = {
  'cinematic-dark': CinematicDarkTheme,
  'executive-dark': ExecutiveDarkTheme,
  'clean-editorial': CleanEditorialTheme,
  'creative-case-study': CreativeCaseStudyTheme,
  'glassmorphism': GlassmorphismTheme,
  'neon-night': NeonNightTheme,
  'gradient-studio': GradientStudioTheme,
  'minimal-3d': Minimal3DTheme,
  'bento': BentoTheme,
  'magazine': MagazineTheme,
  ...PRESET_COMPONENTS,
} as Record<ThemeId, ComponentType<ThemeProps>>

export type { ThemeProps, ThemePortfolio, ThemeContent } from './shared'
export {
  CinematicDarkTheme,
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
