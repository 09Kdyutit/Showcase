import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only a same-app relative path is ever a legitimate value here — this is a
// post-authentication redirect, exactly the kind of target phishing campaigns
// abuse open redirects for ("click this real login link, end up on a fake page").
// Reject anything that isn't a plain relative path: no protocol-relative ("//evil.com"),
// no embedded scheme, no backslashes (some browsers normalize "\" to "/", which can
// turn an otherwise-safe-looking value into a protocol-relative one).
function safeNextPath(next: string | null): string {
  if (!next) return '/dashboard'
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\') || next.includes('://')) {
    return '/dashboard'
  }
  return next
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
