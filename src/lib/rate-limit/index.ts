import { MemoryRateLimiter } from './memory'
import { PostgresRateLimiter } from './postgres'
import { UpstashRateLimiter } from './distributed'
import type { RateLimiter } from './types'

export type { RateLimiter, RateLimitCheckResult } from './types'

let cached: RateLimiter | null = null

// Selection order: Upstash (if configured, lowest latency) > Postgres (always available
// when Supabase is configured, atomic, no extra infra) > in-memory (local-dev-only
// last resort  -  never selected once NEXT_PUBLIC_SUPABASE_URL is set, which it always
// is outside of a completely unconfigured fresh checkout).
export function getRateLimiter(): RateLimiter {
  if (cached) return cached

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (upstashUrl && upstashToken) {
    cached = new UpstashRateLimiter(upstashUrl, upstashToken)
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    cached = new PostgresRateLimiter()
  } else {
    cached = new MemoryRateLimiter()
  }
  return cached
}
