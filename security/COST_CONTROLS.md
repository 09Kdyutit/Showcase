# Cost Controls

Per-provider financial damage containment, verified against actual current configuration where access exists. Where dashboard-only controls couldn't be checked, marked BLOCKED rather than assumed.

## OpenAI

- **Credential scope:** standard API key (not a scoped/restricted key — OpenAI does not currently offer per-key spend caps the way Stripe offers restricted keys). Server-only, guarded by `import 'server-only'` in `src/lib/ai/openai.ts` and `src/lib/ai/client.ts`.
- **Per-user limit:** enforced server-side, atomic (fixed this session — see `security/EXECUTION_MANIFEST.md`). 3–25 calls/day per event type depending on tier and free/Pro.
- **Global limit:** **NEW this session.** `AI_GLOBAL_DAILY_LIMIT` (default 2000/day), atomic counter independent of per-user limits, in `src/lib/ai/rate-limit.ts`.
- **Kill switch:** `KILL_SWITCH_AI=true` — checked first in `checkRateLimit()`, before any quota math. Verified present in `src/lib/feature-flags.ts`.
- **Account-level budget/alert:** **BLOCKED** — requires the OpenAI dashboard (Settings → Limits), which this session has no access to. Human action required: set a monthly spend limit and an email alert threshold directly in the OpenAI account.
- **Owner:** account owner.
- **Rotation procedure:** see `CREDENTIAL_ROTATION.md`.

## Supabase

- **Credential scope:** service-role key bypasses RLS entirely — the single most powerful credential in this system. Server-only (`import 'server-only'` added this session to `src/lib/supabase/server.ts`).
- **Plan/budget:** confirmed via `get_organization` (see `BACKUP_RESTORE.md`): **Free tier**. Free tier has hard resource ceilings (DB size, bandwidth, Edge Function invocations) rather than a metered bill that can run away — the practical risk is service suspension/throttling on overuse, not surprise spend, as long as the project stays on Free.
- **Kill switch:** none needed at the database layer; `KILL_SWITCH_PUBLISHING` and `KILL_SWITCH_AI` indirectly bound the load this app puts on it.
- **Owner:** account owner.

## Vercel

- **Credential scope:** Vercel CLI token, used only for deployment/env management from this session, never embedded in the app.
- **Plan/budget:** not independently verified this session (would require Vercel billing dashboard access). **BLOCKED** for direct confirmation of a spend cap; Vercel's standard behavior on the plan tiers used here is usage-based with dashboard alerts, not an automatic hard cutoff.
- **Owner:** account owner.

## Jobs provider (jobdataapi)

- **Credential scope:** `JOBDATA_API_KEY`, server-only (`src/lib/jobs/providers/jobdataapi.ts`, guarded via the parent `src/lib/jobs/providers/index.ts` `server-only` import added this session).
- **Per-user limit:** job search/import/recommendations routes are rate-limited server-side (see `API_AUTHORIZATION_MATRIX.md`).
- **Kill switch:** `KILL_SWITCH_JOBS_PROVIDER=true`, falls back to the fixture provider — verified in `src/lib/feature-flags.ts` / `src/lib/jobs/providers/index.ts`.
- **Account-level budget/alert:** **BLOCKED** — requires the jobdataapi dashboard, no access this session.
- **Owner:** account owner.

## Stripe

- **Credential scope:** standard secret key (test mode, confirmed via `test:stripe-config` this session). Server-only.
- **Spend risk:** Stripe doesn't charge the platform for normal API/webhook usage at this volume; the relevant risk is fraudulent/spoofed *payment* activity, not provider cost — covered under Stripe security in the main findings, not here.
- **Kill switch:** `KILL_SWITCH_CHECKOUT=true` — verified in `src/lib/feature-flags.ts`, checked in `create-checkout-session`.
- **Owner:** account owner.

## Redis / rate-limit provider

- **Status:** not currently provisioned (Upstash). The Postgres-backed atomic rate limiter (`rate_limit_increment()`, migration 011) is the production rate-limiting mechanism today and was verified this session to correctly serialize concurrent requests (10 parallel → exactly N allowed, not race-bypassed). P1-05 in the release gate is open and non-blocking pending an Upstash account decision; this is not a security gap today, just a future scalability one if request volume grows enough that Postgres-row-level locking becomes a bottleneck.

## Monitoring provider

- **Status:** provider-neutral observability adapter exists (`src/lib/observability/error-reporter.ts`), works without configuration (missing webhook URL is a no-op, not a crash) — verified by code review (the fetch call is wrapped and the webhook URL is read from env with no hard dependency).

## Emergency switches (env-controlled, checked server-side)

| Switch | Verified location | Effect when set to `true` |
|---|---|---|
| `KILL_SWITCH_AI` | `src/lib/feature-flags.ts`, `src/lib/ai/rate-limit.ts` | Every AI route returns a safe 503-equivalent message before calling OpenAI |
| `KILL_SWITCH_CHECKOUT` | `src/lib/feature-flags.ts`, `create-checkout-session/route.ts` | New checkout sessions blocked; existing subscriptions/webhooks unaffected |
| `KILL_SWITCH_JOBS_PROVIDER` | `src/lib/feature-flags.ts`, `jobs/providers/index.ts` | Falls back to the fixture provider instead of calling the external jobs API |
| `KILL_SWITCH_PUBLISHING` | `src/lib/feature-flags.ts`, `portfolio/publish/route.ts` | New publishes blocked; already-published portfolios remain live |

All four default to enabled (unset = on); flipping requires a deliberate env var change, never accidental.

## Human actions required (cannot be completed from this session)

1. Set an OpenAI monthly spend limit + alert threshold in the OpenAI dashboard.
2. Confirm Vercel's billing alert configuration in the Vercel dashboard.
3. Confirm jobdataapi's usage/budget dashboard, if one exists for the plan in use.
