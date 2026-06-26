import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import type { PortfolioContent } from '@/types/database'
import { coerceThemeId } from '@/lib/portfolio/themes'
import { THEME_COMPONENTS, type ThemeContent } from '@/components/portfolio/themes'

interface PublicPortfolioPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PublicPortfolioPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('portfolios')
    .select('title, target_role, content')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!data) return { title: 'Portfolio not found' }

  const content = data.content as unknown as Partial<PortfolioContent>
  const hero = content?.hero
  return {
    title: `${data.title} · Showcase`,
    description: hero?.subheadline ?? `${data.target_role ?? 'Professional'} portfolio  -  built with Showcase`,
    openGraph: {
      title: `${data.title}  -  ${data.target_role ?? 'Portfolio'}`,
      description: hero?.subheadline ?? `View ${data.title}'s professional portfolio`,
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${data.title} · Showcase`,
      description: hero?.subheadline ?? '',
    },
  }
}

// This page only ever fetches `status = 'published'` rows  -  draft portfolios stay
// completely invisible at this route regardless of theme, slug guesses, or direct ID access.
export default async function PublicPortfolioPage({ params }: PublicPortfolioPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!portfolio) notFound()

  const content = (portfolio.content as unknown as ThemeContent) ?? {}
  const ThemeComponent = THEME_COMPONENTS[coerceThemeId(portfolio.theme)]

  return (
    <>
      {/* Premium display fonts for portfolio themes */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Syne:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400&display=swap" rel="stylesheet" />
      <ThemeComponent
        portfolio={{
          title: portfolio.title,
          slug: portfolio.slug,
          target_role: portfolio.target_role,
          status: portfolio.status,
        }}
        content={content}
      />
    </>
  )
}
