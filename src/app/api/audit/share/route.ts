import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 15

// Creates (or returns) a public share token for the user's most recent audit. The public
// page at /proof/[token] exposes only the score + category names/scores — never findings,
// recommendations, or resume content. Links use a 256-bit token, expire after 30 days, and
// can be revoked. Server-authoritative: the client can't pick the audit or forge a token.
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
      .select('id, share_token, share_token_expires_at, share_token_revoked_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!audit) {
      return NextResponse.json({ error: 'Run a ProofScore first, then share it.' }, { status: 404 })
    }

    const existingIsActive = !!audit.share_token
      && !audit.share_token_revoked_at
      && !!audit.share_token_expires_at
      && new Date(audit.share_token_expires_at) > new Date()

    let token = existingIsActive ? audit.share_token : null
    let expiresAt = existingIsActive ? audit.share_token_expires_at : null
    if (!token) {
      token = randomBytes(32).toString('hex')
      const createdAt = new Date()
      expiresAt = new Date(createdAt.getTime() + 30 * 86400_000).toISOString()
      const { error } = await service
        .from('audits')
        .update({
          share_token: token,
          share_token_created_at: createdAt.toISOString(),
          share_token_expires_at: expiresAt,
          share_token_revoked_at: null,
        })
        .eq('id', audit.id)
        .eq('user_id', user.id)
      if (error) return NextResponse.json({ error: 'Could not create share link.' }, { status: 500 })
    }

    const base = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    return NextResponse.json({ data: { url: `${base}/proof/${token}`, token, expiresAt } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = await createServiceClient()
    const { error } = await service
      .from('audits')
      .update({ share_token_revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .not('share_token', 'is', null)
      .is('share_token_revoked_at', null)
    if (error) throw error

    return NextResponse.json({ data: { revoked: true } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
