import { ImageResponse } from 'next/og'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@/lib/supabase/server'
import type { PortfolioContent } from '@/types/database'

export const alt = 'Portfolio on Showcase'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Per-portfolio social card: when someone shares showcase.app/p/their-name in LinkedIn,
// a group chat, or Twitter, this renders a rich preview with their real name, role, and
// tagline instead of a bare link — turning every published portfolio into a growth surface.
const iconBase64 = readFileSync(join(process.cwd(), 'public', 'logo-icon.png')).toString('base64')
const iconDataUri = `data:image/png;base64,${iconBase64}`

export default async function PortfolioOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let title = 'Portfolio'
  let role = ''
  let tagline = ''
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('portfolios')
      .select('title, target_role, content')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
    if (data) {
      title = data.title ?? title
      role = data.target_role ?? ''
      const hero = (data.content as unknown as Partial<PortfolioContent>)?.hero
      tagline = hero?.subheadline ?? hero?.headline ?? ''
    }
  } catch { /* fall through to defaults */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '72px', backgroundColor: '#09090b',
          backgroundImage:
            'radial-gradient(circle at 20% 25%, rgba(99,102,241,0.28), transparent 52%), radial-gradient(circle at 82% 78%, rgba(167,139,250,0.20), transparent 55%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={iconDataUri} width={44} height={44} alt="" />
          <span style={{ color: '#a1a1aa', fontSize: 26, fontWeight: 600 }}>Showcase</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1050 }}>
          {role ? (
            <span style={{ color: '#818cf8', fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
              {role}
            </span>
          ) : null}
          <span style={{ color: '#fafafa', fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>{title}</span>
          {tagline ? (
            <span style={{ color: '#d4d4d8', fontSize: 30, lineHeight: 1.3, marginTop: 22, maxWidth: 980 }}>
              {tagline.length > 140 ? tagline.slice(0, 137) + '…' : tagline}
            </span>
          ) : null}
        </div>

        <span style={{ color: '#71717a', fontSize: 22 }}>
          Evidence-based portfolio · built with Showcase
        </span>
      </div>
    ),
    { ...size }
  )
}
