export interface RateLimitCheckResult {
  allowed: boolean
  currentCount: number
  retryAfterSeconds: number
}

export interface RateLimiter {
  /** Atomically increments the counter for `key` within `windowSeconds` and reports
   *  whether the request is still within `max`. Must be safe under concurrent calls
   *  across multiple server instances — never a read-then-write race. */
  check(key: string, max: number, windowSeconds: number): Promise<RateLimitCheckResult>
}
