import { ImageResponse } from 'next/og'

export const alt = 'Showcase — Your résumé lists claims. Showcase turns them into evidence.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Code-generated, not a designed asset — uses the product's real brand gradient
// (brand-500 → violet-500, the same one used on the logo mark and CTAs) rather than
// a generic stock-photo social card. Real product language, no fabricated metric.
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#09090b',
          backgroundImage:
            'radial-gradient(circle at 25% 30%, rgba(99,102,241,0.25), transparent 50%), radial-gradient(circle at 80% 70%, rgba(167,139,250,0.18), transparent 50%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
            }}
          >
            <span style={{ color: 'white', fontSize: 28, fontWeight: 700 }}>S</span>
          </div>
          <span style={{ color: '#fafafa', fontSize: 32, fontWeight: 700 }}>Showcase</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 980 }}>
          <span style={{ color: '#fafafa', fontSize: 60, fontWeight: 800, lineHeight: 1.15 }}>
            Your résumé lists claims.
          </span>
          <span
            style={{
              fontSize: 60,
              fontWeight: 800,
              lineHeight: 1.15,
              background: 'linear-gradient(135deg, #818cf8, #a78bfa, #c4b5fd)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Showcase turns them into evidence.
          </span>
        </div>
        <span style={{ color: '#a1a1aa', fontSize: 26, marginTop: 36 }}>
          Built for students, new grads, and early-career professionals.
        </span>
      </div>
    ),
    { ...size }
  )
}
