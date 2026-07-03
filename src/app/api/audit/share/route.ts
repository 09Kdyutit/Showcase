import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 15

// Creates (or returns) a public share token for the user's most recent audit. The public
// page at /proof/[token] exposes only the score + category names/scores — never findings,
// recommendations, or resume content. Server-authoritative: the client can't pick the audit
// or forge a token.
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Reads/writes go through the service client (scoped to the authenticated user's own
    // audit) because the audits table has no owner-UPDATE RLS policy — a user-session write
    // would silently affect 0 rows. Ownership is enforced by the user_id filters below.
    const service = await createServiceClient()
    const { data: audit } = await service
      .from('audits')
      .select('id, share_token')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!audit) {
      return NextResponse.json({ error: 'Run a ProofScore first, then share it.' }, { status: 404 })
    }

    let token = audit.share_token
    if (!token) {
      token = randomBytes(12).toString('hex')
      const { error } = await service
        .from('audits')
        .update({ share_token: token })
        .eq('id', audit.id)
        .eq('user_id', user.id)
      if (error) return NextResponse.json({ error: 'Could not create share link.' }, { status: 500 })
    }

    const base = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    return NextResponse.json({ data: { url: `${base}/proof/${token}`, token } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
