import type { MetadataRoute } from 'next'
import { configuredAppUrl } from '@/lib/app-url'

const PUBLIC_ROUTES = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/resume-to-portfolio', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/for-career-services', changeFrequency: 'monthly', priority: 0.8 },
] as const satisfies ReadonlyArray<{
  path: string
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}>

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = configuredAppUrl()

  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${appUrl}${path}`,
    changeFrequency,
    priority,
  }))
}
