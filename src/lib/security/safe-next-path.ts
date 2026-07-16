const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/
export const AUTH_RETURN_PREFIXES = [
  '/dashboard',
  '/builder',
  '/audit',
  '/resume',
  '/settings',
  '/billing',
  '/onboarding',
] as const

/**
 * Return a same-app relative destination or a known-safe fallback.
 *
 * Authentication redirects are a common phishing boundary. Keep this helper
 * usable in the proxy, route handlers, and client components so every auth
 * method applies the same rule.
 */
export function safeNextPath(
  value: string | null | undefined,
): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('://') ||
    CONTROL_CHARACTER.test(value)
  ) {
    return '/dashboard'
  }

  try {
    const target = new URL(value, 'https://showcase.local')
    const allowed = AUTH_RETURN_PREFIXES.some((prefix) => (
      target.pathname === prefix || target.pathname.startsWith(`${prefix}/`)
    ))
    return target.origin === 'https://showcase.local' && allowed
      ? `${target.pathname}${target.search}${target.hash}`
      : '/dashboard'
  } catch {
    return '/dashboard'
  }
}
