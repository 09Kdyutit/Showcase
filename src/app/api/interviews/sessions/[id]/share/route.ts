import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateShareToken, hashShareToken } from '@/lib/interviews/report-sharing'
import { z } from 'zod'

const createSchema = z.object({
  scope: z.enum(['completion_only', 'full_summary']),
  expiresInDays: z.number().int().min(1).max(90).default(30),
})

/** Lists this user's active shares for a session — metadata only, never the raw
 *  token (it was never stored after creation, so there is nothing to return). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('interview_shared_reports')
      .select('id, scope, expires_at, revoked_at, access_count, last_accessed_at, created_at')
      .eq('session_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[interviews/sessions/[id]/share GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load shares.' }, { status: 500 })
  }
}

/**
 * Creates a new share for a completed session. The raw token is returned exactly
 * once, in this response — only its sha256 hash is ever stored, so it cannot be
 * retrieved again after this call returns. The token is never logged.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.status !== 'completed') {
      return NextResponse.json({ error: 'Only a completed session can be shared.', code: 'INVALID_STATE' }, { status: 409 })
    }

    const rawToken = generateShareToken()
    const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)

    const { data: share, error: shareError } = await supabase
      .from('interview_shared_reports')
      .insert({
        user_id: user.id, session_id: id, token_hash: hashShareToken(rawToken),
        scope: parsed.data.scope, expires_at: expiresAt.toISOString(),
      })
      .select('id, scope, expires_at, created_at')
      .single()
    if (shareError) throw shareError

    return NextResponse.json({ data: { ...share, token: rawToken } }, { status: 201 })
  } catch (err) {
    console.error('[interviews/sessions/[id]/share POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to create share.' }, { status: 500 })
  }
}
