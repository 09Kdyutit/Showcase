import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsageSnapshot } from '@/lib/interviews/entitlements'

// Read-only usage display endpoint. The browser may show these numbers, but every
// number here is re-derived server-side from the real reservation ledger and the
// real, server-verified subscription  -  never trusted from a client-held value, and
// this route has no corresponding write capability.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const snapshot = await getUsageSnapshot(supabase, user.id)
    return NextResponse.json({ data: snapshot })
  } catch (err) {
    console.error('[interviews/usage GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load usage.' }, { status: 500 })
  }
}
