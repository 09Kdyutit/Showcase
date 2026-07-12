# General OpenAI USD Budget Guard

## Allocation

- General `runPrompt` traffic: **$4 UTC day / $80 UTC month**.
- Interview Lab provider traffic: **$1 UTC day / $20 UTC month** through its separate
  controls.
- Approved combined allocation: **$5/day and $100/month**.

Until Interview Lab receives atomic reservations and its own concurrency proof, set
`KILL_SWITCH_GEMINI=true` and `INTERVIEW_KILL_SWITCH=true`. In that state the enforceable
provider ceiling is the lower, safe **$4/day and $80/month** OpenAI allocation; company prep
uses its generic fallback, scanned PDFs require text paste, and the final $1/$20 is
unavailable rather than raceable.

The general guard is independent of `AI_GLOBAL_DAILY_LIMIT`, which remains a request-count
abuse ceiling. Both checks apply.

This migration makes the general $4/$80 allocation exact under concurrency. Interview Lab
must remain kill-switched until its separate $1/$20 global precheck has also passed an atomic
concurrency test; otherwise its read-then-check implementation can race even though the
configured allocation is correct.

## Enforcement model

Every non-mock `runPrompt` call follows one server-owned lifecycle:

1. Load explicit daily/monthly budgets and an exact, versioned rate for the configured
   model. Missing or malformed configuration denies the call.
2. Calculate an upper bound from the UTF-8 bytes of the in-memory request and structured
   schema, a framing allowance, the prompt's maximum output tokens, and the full (uncached)
   input/output rates.
3. Atomically reserve that maximum in `general_ai_budget_reservations`. PostgreSQL
   independently recomputes the nano-USD amount from the supplied token bound and frozen
   rates, hard-rejects budgets above the approved $4/$80 allocation, and refuses duplicate
   reservation UUIDs. A PostgreSQL
   advisory transaction lock serializes the daily and monthly sum plus insert, so concurrent
   requests cannot race past either ceiling.
4. Disable SDK retries for this guarded request so one reservation represents one provider
   attempt.
5. On a usable response, settle the reservation to provider-reported input, cached-input,
   and output tokens. PostgreSQL recomputes actual cost from the row's frozen rate version
   instead of trusting a caller-supplied dollar value. Accounting uses integer nano-USD.
6. On a definitive provider HTTP failure, release the reservation. If release accounting is
   unavailable, the user receives a temporary-unavailability error and the maximum remains.
   Timeouts/connection failures stay reserved because the provider may already have billed
   an otherwise lost response.
7. Before each later reservation, calls still `reserved` after 15 minutes are permanently
   settled to their estimate. Until that pass they already count at the same estimate; stale
   rows therefore never reopen spend capacity by expiring.

The reservation table stores feature/model identifiers, versioned rates, token counts,
costs, and timestamps. It has no prompt, resume, portfolio, request-body, or response-body
column. Table access and all three RPCs are restricted to `service_role`.

## Fair quota ordering

Authenticated provider routes use `runPromptWithQuota`: a separate one-minute attempt
throttle first bounds reservation churn, then the maximum dollar cost is reserved, then
`consume_ai_request_quota` atomically consumes the feature allowance/referral credit and
global request count, and only then may the provider run. A dollar denial or accounting
outage therefore occurs before product quota can be consumed. If product quota denies, the
unused dollar reservation is released idempotently.

The retired anonymous ProofScore funnel has no provider path and no separate public capacity
ledger. Remaining public request surfaces use the generic, fail-closed `ABUSE_IP_HASH_SALT`
fingerprint guard for abuse control, but they cannot spend the OpenAI budget. Provider calls
continue through authenticated quota and dollar-reservation boundaries.

Free first-portfolio generation uses three server-owned gates: `ai_generated_at` records the
current portfolio write, a completed `generations` row preserves lifetime history even if
that portfolio is deleted, and an atomic one-call/24-hour `portfolio_generated` quota stops
parallel requests from multiplying the still-unclaimed entitlement. Clients cannot delete
generation rows, and referral credits cannot extend this entitlement. A dollar denial
happens before the quota claim and therefore leaves it available. Once a provider attempt
starts, however, the quota remains consumed even if the provider later fails; retry may
require waiting for the 24-hour window. This conservative behavior avoids an unsafe blind
counter decrement or a replay-funded second provider call. Immediate failure refunds would
require a claim-ID reservation/commit/release ledger and are intentionally not approximated
here.

## Required production values

```dotenv
OPENAI_GENERAL_DAILY_BUDGET_USD=4
OPENAI_GENERAL_MONTHLY_BUDGET_USD=80
OPENAI_COST_RATES_JSON={...each active model with inputPerMillion,cachedInputPerMillion,outputPerMillion,pricingVersion...}

INTERVIEW_GLOBAL_DAILY_BUDGET_USD=1
INTERVIEW_GLOBAL_MONTHLY_BUDGET_USD=20
```

Apply migration `20260710033046_referral_abuse_and_credit_hardening.sql` before deploying the code.
The application deliberately fails closed if the migration/RPCs or required configuration
are missing.

Rates in `.env.example` were checked against OpenAI's model pages on 2026-07-09:
[GPT-4o mini](https://developers.openai.com/api/docs/models/gpt-4o-mini),
[GPT-4o](https://developers.openai.com/api/docs/models/gpt-4o), and
[GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini). Re-verify and bump
`pricingVersion` before changing a model or whenever provider pricing changes; rates do not
update themselves.

## Offline verification

```bash
npm run test:ai-budget
npm run typecheck

# Local Supabase concurrency proof for the Free first-generation mutex.
eval "$(npx supabase status -o env)"
RUN_LIVE_TESTS=1 \
NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
node scripts/test-portfolio-generation-entitlement-live.mjs
```

The deterministic test covers decimal/rate parsing, cached-token settlement math, SQL
serialization and stale behavior, service-role grants, reserve-before-quota ordering across
all authenticated OpenAI routes, one-shot/idempotent reservation behavior, retry disabling,
mock-mode bypass, retired public-capacity absence, and the approved allocation split.
The local credentialed tests fire real parallel database transactions: the dollar ledger
admits exactly five of ten near-cap reservations, while the Free portfolio entitlement
admits exactly one of ten claims with no referral-credit consumption. Both clean up their
rows and restore shared counters. After controlled production promotion, smoke-test the
complete deployed request path before opening the launch dials.
