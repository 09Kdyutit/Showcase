// Browsers attach the real Origin header to cross-site requests and never let JS
// override it, so checking it against our own origin is a real, standard CSRF
// mitigation for cookie-authenticated state-changing requests  -  a malicious site
// can make the browser send our cookies, but it cannot make the browser lie about
// where the request came from.
export function isTrustedOrigin(headers: Headers, expectedHost: string | null): boolean {
  const origin = headers.get('origin')

  // No Origin header at all: same-origin requests from older browsers, and
  // non-browser clients (curl, server-to-server) don't send one either. We accept
  // this rather than block it, because the real protection here is against
  // browser-driven cross-site requests, which always carry Origin.
  if (!origin) return true

  try {
    const originHost = new URL(origin).host
    return expectedHost !== null && originHost === expectedHost
  } catch {
    return false
  }
}
