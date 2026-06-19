import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/builder', '/audit', '/resume', '/settings', '/billing', '/onboarding']
const AUTH_ROUTES = ['/login']
// Public self-serve signup is closed during the waitlist phase. No query string, auth
// state, or env config can re-open it — every request to this path is redirected, full stop.
const SIGNUP_CLOSED_ROUTES = ['/signup']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (SIGNUP_CLOSED_ROUTES.some((r) => path.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/waitlist'
    url.search = ''
    return NextResponse.redirect(url)
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
