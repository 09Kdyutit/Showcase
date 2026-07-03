import { ImageResponse } from 'next/og'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServiceClient } from '@/lib/supabase/server'

export const alt = 'ProofScore on Showcase'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const iconBase64 = readFileSync(join(process.cwd(), 'public', 'logo-icon.png')).toString('base64')
const iconDataUri = `data:image/png;base64,${iconBase64}`

// The share card: "I'm 84/100 job-ready" is inherently screenshot-worthy — each shared
// ProofScore link that renders this becomes a signup funnel. Exposes only the number + role.
export default async function ProofOgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let score = 0
  let role = ''
  try {
    if (/^[a-f0-9]{16,48}$/.test(token)) {
      const supabase = await createServiceClient()
      const { data } = await supabase.from('audits').select('overall_score, user_id').eq('share_token', token).maybeSingle()
      if (data && typeof data.overall_score === 'number') {
        score = data.overall_score
        const { data: p } = await supabase.from('profiles').select('target_role').eq('id', data.user_id).maybeSingle()
        role = p?.target_role ?? ''
      }
    }
  } catch { /* defaults */ }

  const scoreColor = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', padding: '72px', backgroundColor: '#09090b',
          backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(99,102,241,0.28), transparent 55%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
          <img src={iconDataUri} width={40} height={40} alt="" />
          <span style={{ color: '#a1a1aa', fontSize: 26, fontWeight: 600 }}>Showcase · ProofScore</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ color: scoreColor, fontSize: 200, fontWeight: 800, lineHeight: 1 }}>{score}</span>
          <span style={{ color: '#71717a', fontSize: 60, fontWeight: 700 }}>/100</span>
        </div>
        <span style={{ color: '#fafafa', fontSize: 34, fontWeight: 700, marginTop: 24 }}>
          {role ? `Hiring-ready for ${role}` : 'Evidence-based hiring readiness'}
        </span>
        <span style={{ color: '#71717a', fontSize: 22, marginTop: 40 }}>Get your free ProofScore at showcase</span>
      </div>
    ),
    { ...size }
  )
}
