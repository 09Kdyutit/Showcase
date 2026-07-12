export interface RateLimitCheckResult {
  allowed: boolean
  currentCount: number
  retryAfterSeconds: number
}

export interface RateLimitCheckOptions {
  /** Existing product features prefer availability. Public endpoints that can send email
   * should set this false so a limiter outage cannot become an unbounded mail relay. */
  failOpen?: boolean
}

export interface RateLimiter {
  /** Atomically increments the counter for `key` within `windowSeconds` and reports
   *  whether the request is still within `max`. Must be safe under concurrent calls
   *  across multiple server instances - never a read-then-write race. */
  check(
    key: string,
    max: number,
    windowSeconds: number,
    options?: RateLimitCheckOptions,
  ): Promise<RateLimitCheckResult>
}
