# Cost Controls

Per-provider financial damage containment, verified against actual current configuration where access exists. Where dashboard-only controls couldn't be checked, marked BLOCKED rather than assumed.

## OpenAI

- **Credential scope:** standard API key (not a scoped/restricted key — OpenAI does not currently offer per-key spend caps the way Stripe offers restricted keys). Server-only, guarded by `import 'server-only'` in `src/lib/ai/openai.ts` and `src/lib/ai/client.ts`.
- **Per-user limit:** enforced server-side, atomic (fixed this session — see `security/EXECUTION_MANIFEST.md`). 3–25 calls/day per event type depending on tier and free/Pro.
- **Global request limit:** `AI_GLOBAL_DAILY_LIMIT` (explicitly configured; example 2,000/day),
  an atomic counter independent of per-user limits in `src/lib/ai/rate-limit.ts`.
- **Global dollar limit:** general `runPrompt` traffic now reserves worst-case cost atomically
  before provider contact and settles to reported usage afterward, with fail-closed
  **$4/day and $80/month** controls. Migration 046 and a staging concurrency run are still
  required before that becomes production evidence.
- **Approved total budget:** **$5/day and $100/month.** The separate Interview Lab allocation
  is $1/$20, but its global precheck is not yet atomic. Keep `INTERVIEW_KILL_SWITCH=true`;
  while disabled, the enforceable total is the lower, safe $4/$80 general ceiling.
- **Kill switch:** `KILL_SWITCH_AI=true` — checked first in `checkRateLimit()`, before any quota math. Verified present in `src/lib/feature-flags.ts`.
- **Gemini boundary:** `KILL_SWITCH_GEMINI` fails closed unless explicitly set to `false`.
  Keep it `true` for launch: company prep falls back to generic guidance, scanned-PDF
  vision falls back to manual paste, Interview Lab remains disabled, and the legacy Edge
  WebSocket proxy separately requires `INTERVIEW_LIVE_PROXY_ENABLED=true` as a Supabase
  secret. These paths must not be enabled until they join an atomic dollar ledger.
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

- **Credential scope:** the local application environment currently contains live Showcase
  keys and the existing $15/month and $150/year live prices. The separately authenticated
  Stripe CLI test credential belongs to another sandbox/account. Never mix them; staging
  requires Showcase test-mode keys and recreated $15/$150/$99 test prices. Server-only.
- **Spend risk:** Stripe doesn't charge the platform for normal API/webhook usage at this volume; the relevant risk is fraudulent/spoofed *payment* activity, not provider cost — covered under Stripe security in the main findings, not here.
- **Kill switch:** `KILL_SWITCH_CHECKOUT=true` — verified in `src/lib/feature-flags.ts`, checked in `create-checkout-session`.
- **Owner:** account owner.

## Redis / rate-limit provider

- **Status:** encrypted production variables for Upstash were confirmed by name on
  2026-07-09, without reading their values. The correctness boundary remains the
  Postgres-backed atomic limiter and migration-046 quota transaction; Upstash is a scaling
  optimization, not the proof for AI quota or dollar-budget enforcement.

## Monitoring provider

- **Status:** provider-neutral observability adapter exists (`src/lib/observability/error-reporter.ts`), works without configuration (missing webhook URL is a no-op, not a crash) — verified by code review (the fetch call is wrapped and the webhook URL is read from env with no hard dependency).

## Emergency switches (env-controlled, checked server-side)

| Switch | Verified location | Effect when set to `true` |
|---|---|---|
| `KILL_SWITCH_AI` | `src/lib/feature-flags.ts`, `src/lib/ai/rate-limit.ts` | Every AI route returns a safe 503-equivalent message before calling OpenAI |
| `KILL_SWITCH_GEMINI` | `src/lib/feature-flags.ts` and every Gemini client boundary | All Google provider calls are disabled unless explicitly set to `false` |
| `KILL_SWITCH_CHECKOUT` | `src/lib/feature-flags.ts`, `create-checkout-session/route.ts` | New checkout sessions blocked; existing subscriptions/webhooks unaffected |
| `KILL_SWITCH_JOBS_PROVIDER` | `src/lib/feature-flags.ts`, `jobs/providers/index.ts` | Falls back to the fixture provider instead of calling the external jobs API |
| `KILL_SWITCH_PUBLISHING` | `src/lib/feature-flags.ts`, `portfolio/publish/route.ts` | New publishes blocked; already-published portfolios remain live |

The four legacy product features default to enabled when their switch is unset. Gemini is
stricter: unset is disabled, and only the literal value `false` enables Google traffic.

## Human actions required (cannot be completed from this session)

1. Apply migration 046 in staging and prove both the request-quota transaction and general
   dollar reservations under concurrency. Configure the OpenAI provider alert/limit as a
   second boundary. Keep Interview Lab disabled until its separate global path is atomic.
2. Confirm Vercel's billing alert configuration in the Vercel dashboard.
3. Confirm jobdataapi's usage/budget dashboard, if one exists for the plan in use.
