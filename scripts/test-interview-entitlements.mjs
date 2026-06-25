#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for the pure parts of the entitlements module: plan limit
// constants, period-boundary math, and session-type gating. No network, no database —
// the real atomic-reservation behavior under concurrency is tested separately in
// test:interview-limits, which needs a live server and real parallel HTTP requests.
import { FREE_PLAN_LIMITS, PRO_PLAN_LIMITS, isSessionTypeAllowed, getPlanLimits } from '../src/lib/interviews/entitlements/plans.ts'
import { freeCalendarMonthPeriod, proBillingPeriod } from '../src/lib/interviews/entitlements/limits.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

console.log('── Plan limits match the published Free/Pro policy ──')
record('Free: 2 sessions/period', FREE_PLAN_LIMITS.sessionsPerPeriod === 2)
record('Free: 0 audio sessions (text-only)', FREE_PLAN_LIMITS.audioSessionsPerPeriod === 0)
record('Free: 6 primary questions max', FREE_PLAN_LIMITS.maxPrimaryQuestions === 6)
record('Free: 2 adaptive follow-ups max', FREE_PLAN_LIMITS.maxAdaptiveFollowUps === 2)
record('Free: 1 retry per session (not a period pool)', FREE_PLAN_LIMITS.retriesPerPeriod === 'per_session_one')
record('Pro: 15 sessions/period', PRO_PLAN_LIMITS.sessionsPerPeriod === 15)
record('Pro: 8 audio sessions/period', PRO_PLAN_LIMITS.audioSessionsPerPeriod === 8)
record('Pro: 12 primary questions max', PRO_PLAN_LIMITS.maxPrimaryQuestions === 12)
record('Pro: 5 adaptive follow-ups max', PRO_PLAN_LIMITS.maxAdaptiveFollowUps === 5)
record('Pro: 30 retries/period (a real number, not "unlimited")', PRO_PLAN_LIMITS.retriesPerPeriod === 30)
record('Pro audio allowance is NOT advertised as unlimited', PRO_PLAN_LIMITS.audioSessionsPerPeriod < 1000)

console.log('\n── Session-type gating ──')
record('Free can access recruiter_screen', isSessionTypeAllowed('free', 'recruiter_screen'))
record('Free can access behavioral', isSessionTypeAllowed('free', 'behavioral'))
record('Free CANNOT access case_problem_solving', !isSessionTypeAllowed('free', 'case_problem_solving'))
record('Free CANNOT access rapid_fire_drill', !isSessionTypeAllowed('free', 'rapid_fire_drill'))
record('Pro can access every session type', ['recruiter_screen', 'case_problem_solving', 'rapid_fire_drill', 'presentation_defense'].every((t) => isSessionTypeAllowed('pro', t)))

console.log('\n── Global env ceilings clamp plan constants, never the other way ──')
process.env.INTERVIEW_MAX_FOLLOW_UPS = '1'
record('A tighter global follow-up ceiling clamps Pro\'s 5 down to 1', getPlanLimits('pro').maxAdaptiveFollowUps === 1)
delete process.env.INTERVIEW_MAX_FOLLOW_UPS
record('With no override, Pro keeps its real 5 follow-ups', getPlanLimits('pro').maxAdaptiveFollowUps === 5)

console.log('\n── Free period is a real calendar month ──')
{
  const period = freeCalendarMonthPeriod(new Date('2026-06-15T12:00:00Z'))
  record('Starts on the 1st of the month', period.start.toISOString() === '2026-06-01T00:00:00.000Z')
  record('Ends on the 1st of the NEXT month (exclusive)', period.end.toISOString() === '2026-07-01T00:00:00.000Z')
}
{
  // December must roll into January of the following year, not month 13.
  const period = freeCalendarMonthPeriod(new Date('2026-12-20T00:00:00Z'))
  record('December correctly rolls into January of the next year', period.end.toISOString() === '2027-01-01T00:00:00.000Z')
}

console.log('\n── Pro period is derived from the real Stripe billing interval ──')
{
  process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_test_monthly'
  process.env.STRIPE_PRICE_ID_PRO_ANNUAL = 'price_test_annual'
  const monthly = proBillingPeriod({ currentPeriodEnd: new Date('2026-07-15T00:00:00Z'), priceId: 'price_test_monthly' })
  record('Monthly price -> period start is ~1 month before period end', monthly.start.toISOString() === '2026-06-15T00:00:00.000Z')
  const annual = proBillingPeriod({ currentPeriodEnd: new Date('2027-06-15T00:00:00Z'), priceId: 'price_test_annual' })
  record('Annual price -> period start is ~1 year before period end', annual.start.toISOString() === '2026-06-15T00:00:00.000Z')
  const unknown = proBillingPeriod({ currentPeriodEnd: new Date('2026-07-15T00:00:00Z'), priceId: 'price_unrecognized' })
  const days = (unknown.end.getTime() - unknown.start.getTime()) / 86400000
  record('Unrecognized price ID falls back to a conservative ~30-day window, not "unlimited"', Math.abs(days - 30) < 1)
  delete process.env.STRIPE_PRICE_ID_PRO_MONTHLY
  delete process.env.STRIPE_PRICE_ID_PRO_ANNUAL
}

console.log(`\n  Interview entitlements test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
