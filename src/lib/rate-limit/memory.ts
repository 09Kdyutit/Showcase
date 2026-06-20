import type { RateLimiter, RateLimitCheckResult } from './types'

// Single-process only — correct for local dev (one Next.js process), NOT safe for any
// production deployment with more than one instance, since each instance has its own
// Map. Never select this implementation when DATABASE_URL/Supabase is configured;
// it exists purely as the zero-dependency fallback so local dev never requires
// distributed infrastructure.
const buckets = new Map<string, { count: number; windowStart: number }>()

export class MemoryRateLimiter implements RateLimiter {
  async check(key: string, max: number, windowSeconds: number): Promise<RateLimitCheckResult> {
    const now = Date.now()
    const existing = buckets.get(key)
    const windowMs = windowSeconds * 1000

    if (!existing || now - existing.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now })
      return { allowed: 1 <= max, currentCount: 1, retryAfterSeconds: windowSeconds }
    }

    existing.count++
    const retryAfterSeconds = Math.max(0, Math.ceil((existing.windowStart + windowMs - now) / 1000))
    return { allowed: existing.count <= max, currentCount: existing.count, retryAfterSeconds }
  }
}
