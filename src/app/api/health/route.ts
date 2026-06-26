import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// No secrets, no stack traces, no internal hostnames — this endpoint is meant to be
// hit by uptime monitors and load balancers, which may be unauthenticated and
// internet-facing.
export async function GET() {
  const checks: Record<string, boolean> = {}

  try {
    const supabase = await createServiceClient()
    const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' }).limit(1)
    checks.database = !error
  } catch {
    checks.database = false
  }

  checks.stripe_configured = !!process.env.STRIPE_SECRET_KEY
  checks.openai_configured = !!process.env.OPENAI_API_KEY

  // Source/deployed parity signals. These are NOT secrets: a short commit hash and the
  // build environment let an operator (or a deployment-parity test) confirm the running
  // server matches the reviewed commit. Vercel exposes VERCEL_GIT_COMMIT_SHA at build time.
  const commit = (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    'unknown'
  ).slice(0, 12)
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'

  const healthy = checks.database === true
  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks, commit, environment, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  )
}
