import type { RateLimiter, RateLimitCheckResult } from './types'

// Upstash Redis REST API, called directly via fetch  -  no SDK dependency needed for a
// single atomic command. Only used when UPSTASH_REDIS_REST_URL/TOKEN are configured;
// see index.ts for the selection logic. Uses INCR + EXPIRE (NX) for an atomic
// fixed-window counter, equivalent in semantics to the Postgres implementation.
export class UpstashRateLimiter implements RateLimiter {
  constructor(
    private readonly url: string,
    private readonly token: string
  ) {}

  async check(key: string, max: number, windowSeconds: number): Promise<RateLimitCheckResult> {
    try {
      // Pipeline: INCR the key, then set expiry only if this was the first increment
      // (NX), so the window doesn't keep sliding on every request.
      const res = await fetch(`${this.url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, String(windowSeconds), 'NX'],
          ['TTL', key],
        ]),
      })
      if (!res.ok) throw new Error(`Upstash request failed: ${res.status}`)
      const results = await res.json()
      const count = Number(results[0]?.result ?? 0)
      const ttl = Number(results[2]?.result ?? windowSeconds)

      return {
        allowed: count <= max,
        currentCount: count,
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      }
    } catch (err) {
      console.error('[rate-limit/upstash] check failed, failing open:', err instanceof Error ? err.message : err)
      return { allowed: true, currentCount: 0, retryAfterSeconds: 0 }
    }
  }
}
