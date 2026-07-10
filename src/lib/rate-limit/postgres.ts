import { createServiceClient } from '@/lib/supabase/server'
import type { RateLimiter, RateLimitCheckOptions, RateLimitCheckResult } from './types'

// Backed by the rate_limit_increment() Postgres function (migration 011), which does the
// read-and-increment as a single atomic statement - safe across any number of server
// instances since they all hit the same database. Slower than Redis under very high
// throughput, but correct, and requires no additional infrastructure or account.
export class PostgresRateLimiter implements RateLimiter {
  async check(
    key: string,
    max: number,
    windowSeconds: number,
    options?: RateLimitCheckOptions,
  ): Promise<RateLimitCheckResult> {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .rpc('rate_limit_increment', { p_key: key, p_window_seconds: windowSeconds, p_max: max })
      .single() as { data: { allowed: boolean; current_count: number; retry_after_seconds: number } | null, error: { message: string } | null }

    if (error || !data) {
      if (options?.failOpen === false) {
        throw new Error(`Rate limit unavailable: ${error?.message ?? 'no result'}`)
      }
      // Default remains fail-open for existing product features. Mail-sending public
      // endpoints opt into the strict branch above so an outage cannot amplify abuse.
      console.error('[rate-limit/postgres] check failed, failing open:', error?.message)
      return { allowed: true, currentCount: 0, retryAfterSeconds: 0 }
    }

    return {
      allowed: data.allowed,
      currentCount: data.current_count,
      retryAfterSeconds: data.retry_after_seconds,
    }
  }
}
