import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isTrustedOrigin } from '@/lib/security/origin-check'

const PROTECTED_ROUTES = ['/dashboard', '/builder', '/audit', '/resume', '/settings', '/billing', '/onboarding']
const AUTH_ROUTES = ['/login']
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
// Webhook providers sign their own payloads - the signature
// check in the route handler is the real authentication, and the request is
// legitimately cross-origin by design (it originates from provider servers, not a
// browser), so Origin enforcement doesn't apply to it.
const ORIGIN_CHECK_EXEMPT_PREFIXES = ['/api/stripe/webhook', '/api/email/events']

// Pre-launch admission: public waitlist/proof routes stay available, invited people can use
// a single-use token to reach signup, and existing/admitted accounts keep product access.
// LAUNCH_OPEN=true lifts admission entirely; it is still an env flag, never a query switch.
const LAUNCH_OPEN = process.env.LAUNCH_OPEN === 'true'
// /opengraph-image is a code-generated route (app/opengraph-image.tsx) with no file
// extension, so it isn't caught by the matcher's image-extension exclusion below  - 
// without this, a social crawler fetching /waitlist's og:image would get redirected
// to /waitlist itself instead of the actual image.
const WAITLIST_ALLOWED_PATHS = [
  '/waitlist', '/join', '/proofscore', '/privacy', '/terms', '/refund',
  '/opengraph-image', '/login', '/callback',
]
const WAITLIST_ALLOWED_API_PREFIXES = [
  '/api/waitlist',
  '/api/stripe/webhook',
  '/api/email/inbound',
  '/api/email/events',
  '/api/email/unsubscribe',
  '/api/cron/',
  '/api/proofscore',
  '/api/referral',
  '/api/health',
  '/api/marketing/track',
]
const INVITE_TOKEN_PATTERN = /^[a-f0-9]{48}$/

function requestInviteToken(request: NextRequest): string | null {
  const direct = request.nextUrl.searchParams.get('invite')?.trim().toLowerCase()
  if (direct && INVITE_TOKEN_PATTERN.test(direct)) return direct

  const next = request.nextUrl.searchParams.get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  try {
    const nested = new URL(next, 'https://showcase.local').searchParams.get('invite')?.trim().toLowerCase()
    return nested && INVITE_TOKEN_PATTERN.test(nested) ? nested : null
  } catch {
    return null
  }
}

function requestReferralCode(request: NextRequest): string | null {
  const direct = request.nextUrl.searchParams.get('ref')?.trim().toUpperCase()
  if (direct && /^[A-F0-9]{32}$/.test(direct)) return direct

  const next = request.nextUrl.searchParams.get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  try {
    const nested = new URL(next, 'https://showcase.local').searchParams.get('ref')?.trim().toUpperCase()
    return nested && /^[A-F0-9]{32}$/.test(nested) ? nested : null
  } catch {
    return null
  }
}

function lockdownResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Invite required while early access is active' }, { status: 403 })
  }
  const url = request.nextUrl.clone()
  url.pathname = '/waitlist'
  url.search = ''
  return NextResponse.redirect(url)
}

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

  const inviteToken = requestInviteToken(request)
  const isInviteEntry = !!inviteToken && (path === '/signup' || path === '/onboarding')
  const referralCode = requestReferralCode(request)
  const isReferralEntry = !!referralCode && (path === '/signup' || path === '/onboarding')
  const isLockdownBypass =
    WAITLIST_ALLOWED_PATHS.includes(path) ||
    WAITLIST_ALLOWED_API_PREFIXES.some((p) => path.startsWith(p)) ||
    isInviteEntry ||
    isReferralEntry

  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Without credentials, pass through all requests unauthenticated
  if (!supabaseUrl || !supabaseKey) {
    if (!LAUNCH_OPEN && !isLockdownBypass) return lockdownResponse(request)
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

  if (!LAUNCH_OPEN && !isLockdownBypass && user?.app_metadata?.showcase_admitted !== true) {
    return lockdownResponse(request)
  }

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
