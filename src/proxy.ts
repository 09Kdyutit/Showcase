import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isTrustedOrigin } from '@/lib/security/origin-check'

const PROTECTED_ROUTES = ['/dashboard', '/builder', '/audit', '/resume', '/settings', '/billing', '/onboarding']
const AUTH_ROUTES = ['/login']
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
// Stripe (and any future webhook provider) signs its own payloads — the signature
// check in the route handler is the real authentication, and the request is
// legitimately cross-origin by design (it originates from Stripe's servers, not a
// browser), so Origin enforcement doesn't apply to it.
const ORIGIN_CHECK_EXEMPT_PREFIXES = ['/api/stripe/webhook']

// Pre-launch lockdown: the entire app — including the marketing homepage, /pricing,
// /login, /signup, and every authenticated route — redirects to /waitlist. Existing
// accounts get zero exception; there is no query string or path that opens a door.
// Set LAUNCH_OPEN=true (env var on Vercel, not a query param) on launch day to lift this.
const LAUNCH_OPEN = process.env.LAUNCH_OPEN === 'true'
const WAITLIST_ALLOWED_PATHS = ['/waitlist', '/privacy', '/terms', '/refund']
const WAITLIST_ALLOWED_API_PREFIXES = ['/api/waitlist', '/api/stripe/webhook', '/api/health']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (
    path.startsWith('/api/') &&
    STATE_CHANGING_METHODS.has(request.method) &&
    !ORIGIN_CHECK_EXEMPT_PREFIXES.some((p) => path.startsWith(p)) &&
    !isTrustedOrigin(request.headers, request.headers.get('host'))
  ) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  }

  if (!LAUNCH_OPEN) {
    const isAllowed =
      WAITLIST_ALLOWED_PATHS.includes(path) ||
      WAITLIST_ALLOWED_API_PREFIXES.some((p) => path.startsWith(p))
    if (!isAllowed) {
      const url = request.nextUrl.clone()
      url.pathname = '/waitlist'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Without credentials, pass through all requests unauthenticated
  if (!supabaseUrl || !supabaseKey) {
    const isProtected = PROTECTED_ROUTES.some((r) => path.startsWith(r))
    if (isProtected) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', path)
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtected = PROTECTED_ROUTES.some((r) => path.startsWith(r))
  const isAuthRoute = AUTH_ROUTES.some((r) => path.startsWith(r))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', path)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
