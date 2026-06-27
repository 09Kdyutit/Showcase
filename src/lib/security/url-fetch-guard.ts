import dns from 'node:dns/promises'
import net from 'node:net'

const FETCH_TIMEOUT_MS = 8000
const MAX_RESPONSE_BYTES = 3_000_000 // 3MB — job posting pages are never bigger than this
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

// Job boards block bot-looking UAs; a normal browser UA avoids most 403s without
// pretending to be a specific browser version that goes stale.
const FETCH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export class UnsafeUrlError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number)
    const [a, b] = parts
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true // link-local, incl. cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    return false
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    if (lower === '::1') return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local
    if (lower.startsWith('fe80')) return true // link-local
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7))
    return false
  }
  return true // unrecognized format — treat as unsafe
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new UnsafeUrlError('URL resolves to a private network address.')
    return
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new UnsafeUrlError('URL points to a local hostname.')
  }
  let records: { address: string }[]
  try {
    records = await dns.lookup(hostname, { all: true })
  } catch {
    throw new UnsafeUrlError('Could not resolve that URL.')
  }
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new UnsafeUrlError('URL resolves to a private network address.')
  }
}

/**
 * Fetches a user-supplied URL with SSRF protections: protocol allowlist, DNS
 * resolution check against private/loopback/link-local ranges (including the
 * cloud metadata address), a timeout, a response-size cap, and no redirect
 * auto-follow (each hop is re-validated).
 */
export async function fetchUrlSafely(rawUrl: string, redirectsLeft = 3): Promise<string> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new UnsafeUrlError('That is not a valid URL.')
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError('Only http and https URLs are supported.')
  }

  await assertPublicHost(url.hostname)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': FETCH_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UnsafeUrlError('That URL took too long to respond.')
    }
    throw new UnsafeUrlError('Could not reach that URL.')
  } finally {
    clearTimeout(timeout)
  }

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (!location || redirectsLeft <= 0) {
      throw new UnsafeUrlError('That URL redirected too many times.')
    }
    const next = new URL(location, url)
    return fetchUrlSafely(next.toString(), redirectsLeft - 1)
  }

  if (!res.ok) {
    throw new UnsafeUrlError(`That page responded with an error (${res.status}). Try pasting the description instead.`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new UnsafeUrlError('That URL did not return a webpage.')
  }

  const reader = res.body?.getReader()
  if (!reader) throw new UnsafeUrlError('Could not read that page.')

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new UnsafeUrlError('That page is too large to import.')
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8')
}
