Data authority matrix — Showcase production Supabase project (`yogwhfrjhcbnvoxitcay`).

Built from the **live remote schema** (pg_policies, information_schema, pg_proc) on 2026-06-23, not from migration files alone, since the local migration ledger and remote state have a known cosmetic numbering mismatch (see `security/EXECUTION_MANIFEST.md`). Verified by direct SQL against the remote project via the Supabase MCP tool, and by live adversarial RPC/REST calls using the real anon key (see Phase 3 findings below).

## Classification key

- **A. USER-EDITABLE** — owner may update via the normal authenticated client.
- **B. USER-READABLE, SERVER-WRITABLE** — owner may view; only server code (service-role) writes.
- **C. SERVER-ONLY** — no anon/authenticated client may read or write directly.
- **D. PUBLIC, SANITIZED** — anonymous read of deliberately published data only.

## profiles

| column | class | allowed actor | allowed ops | policy |
|---|---|---|---|---|
| id, email, full_name, avatar_url, target_role, experience_level, industry, onboarding_completed, portfolio_goal, linkedin_url, github_url, website_url, created_at, updated_at | A | owner (`auth.uid() = id`) | SELECT/INSERT/UPDATE | `Users can read/insert/update own profile` |

**Finding: clean.** No entitlement, plan, role, or admin column exists on `profiles` at all — entitlement was already correctly factored into a separate table before this audit. There is no DELETE policy (account deletion goes through the server-side `/api/account/delete` route using the service-role client, not direct client delete — confirmed in Phase 9).

## subscriptions

| column | class | allowed actor | allowed ops | policy |
|---|---|---|---|---|
| id, user_id, status, stripe_customer_id, stripe_subscription_id, price_id, current_period_end, cancel_at_period_end, created_at, updated_at, last_webhook_event_at | B | owner reads; only service-role (webhook handler) writes | SELECT only for owner; **no INSERT/UPDATE/DELETE policy exists for any client role** | `Users can read own subscription` (SELECT only) |

**Verified live:** `pg_policies` confirms exactly one policy on `subscriptions`, a SELECT. With RLS enabled and zero write policies, Postgres denies all INSERT/UPDATE/DELETE from `anon`/`authenticated` by default — this is not theoretical, it's the actual current state of the remote table.

## usage_events

| column | class | allowed actor | allowed ops | policy |
|---|---|---|---|---|
| id, user_id, event_name, metadata (jsonb), created_at | A (write-only) | owner may INSERT own rows; no one may SELECT/UPDATE/DELETE via client | INSERT only, `auth.uid() = user_id` | `Users can insert own usage events` |

**Finding, verified non-exploitable:** this table is an append-only client-writable event log, not the quota-enforcement mechanism (that's `rate_limit_counters`, below). A user can write arbitrary `event_name`/`metadata` here, but cannot read it back, and nothing in the codebase (`grep -rn "usage_events"`) uses this table to gate access — it does not feed plan-limit decisions. Low-severity hygiene note: confirm this stays purely observational and is never wired into a billing/limit decision without server-side revalidation.

## rate_limit_counters

| column | class | allowed actor | allowed ops | policy |
|---|---|---|---|---|
| key, count, window_start | C | service-role only, via `rate_limit_increment()` RPC | none for anon/authenticated | **zero policies** (RLS enabled, default-deny) |

**Verified live by direct attack** (see Phase 3): called `rate_limit_increment()` as an anonymous client with the real publishable key. Result: `"new row violates row-level security policy for table \"rate_limit_counters\"" (42501)`. The function is not `SECURITY DEFINER`, so it runs as the caller's role; with zero RLS policies on the table, the call fails closed even though Postgres-level `EXECUTE` is (unnecessarily) granted to `anon`/`authenticated`. Confirmed via code review that the application itself only calls this RPC through `createServiceClient()` (`src/lib/rate-limit/postgres.ts:11`), never the anon/authenticated client.

**Hardening recommendation (LOW):** revoke `EXECUTE` on `rate_limit_increment` from `anon`/`authenticated`/`PUBLIC` — it is unused by the app and currently fails safely only because of the RLS backstop. Removing the unnecessary grant is defense-in-depth in case RLS is ever weakened by a future migration mistake.

## processed_webhook_events

| column | class | allowed actor | allowed ops | policy |
|---|---|---|---|---|
| (Stripe event id, type, processed_at) | C | service-role only (webhook handler) | none for anon/authenticated | **zero policies** (RLS enabled, default-deny) |

Same pattern and same verification method as `rate_limit_counters`.

## waitlist_signups, beta_feedback, marketing_events

| class | allowed actor | allowed ops | policy |
|---|---|---|---|
| C (insert path is server-side only) | service-role only for read; write happens through server API routes that use service-role, not direct client insert | none for anon/authenticated directly | **zero policies** (RLS enabled, default-deny) |

Confirmed via code: `/api/waitlist/join`, `/api/beta/feedback`, `/api/marketing/track` all use `createServiceClient()` server-side, never exposing direct table writes to the browser.

## resumes

| column | class | allowed actor | allowed ops | policy |
|---|---|---|---|---|
| all columns including storage path | A (row metadata) | owner only, `auth.uid() = user_id` | ALL (CRUD) | `Users can CRUD own resumes` |

Storage object policies (separate from the table) additionally scope the actual file bytes in the `resumes` bucket by `(storage.foldername(name))[1] = auth.uid()::text` — verified live via `pg_policies` on `storage.objects`. Bucket confirmed `public: false`, 4MB limit, MIME allowlist (`pdf`, `docx`, `txt`).

## portfolios

| column | class | allowed actor | allowed ops | policy |
|---|---|---|---|---|
| all columns | A for owner; D for `status='published'` rows, anonymous | owner: ALL; anonymous: SELECT only on published rows | `Users can CRUD own portfolios` (ALL, owner) + `Anyone can read published portfolios` (SELECT, `status='published'`) |

**Note for Phase 4:** RLS controls row visibility, not column visibility — confirming the public portfolio API route explicitly selects only sanitized columns (not `select *`) is an API-layer check, tracked in `API_AUTHORIZATION_MATRIX.md`, not solely an RLS concern.

## projects, audits, generations, saved_jobs, applications, tailored_assets, voice_profiles, evidence_items, feedback

All follow the same owner-scoped pattern: `auth.uid() = user_id` on every policy present, RLS enabled, no cross-user policy exists. `feedback` and `usage_events` are INSERT-only (no read-back); the rest support the CRUD subset the feature actually needs (e.g., `audits`/`generations` are insert+read, no update/delete — append-only by design).

## job_listings_cache

| column | class | allowed actor | allowed ops | policy |
|---|---|---|---|---|
| cached public job listing data | D-like shared cache | any authenticated user | SELECT (`true`), INSERT (`true`) | `Authenticated users can cache job listings` / `...read cached job listings` |

Intentional: this is a shared cache of public third-party job listing data, not user-private data — no `user_id` column, no ownership boundary needed.

## SECURITY DEFINER functions

| function | search_path pinned | finding |
|---|---|---|
| `rls_auto_enable` | yes (`pg_catalog`) | clean |
| `handle_new_user` | **no** | **MEDIUM finding** — `SECURITY DEFINER` trigger on `auth.users` insert with no explicit `search_path`. Exploitability is low in practice (no user-controlled arguments; only references fixed `NEW.*` trigger fields and the literal `public.profiles` table), but it doesn't meet the hardening bar and is the kind of finding Supabase's own advisor flags as "Function Search Path Mutable." Fixed in migration 016 (see Phase 3). |

## Table-level grants (anon/authenticated)

Supabase's standard default: `anon`/`authenticated` hold full table-level grants (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) on every public table, relying entirely on RLS to filter rows. This is Supabase's own platform default, not something introduced by this codebase's migrations.

**Finding (LOW): `TRUNCATE` is not filtered by RLS at all** — it's an all-or-nothing table operation. PostgREST (and therefore `supabase-js`, which is the only client-side path available) does not expose a truncate operation, so there is currently no reachable path for `anon`/`authenticated` to invoke it — verified by inspecting the actual REST surface, not just assumed. Still, granting `TRUNCATE`/`TRIGGER`/`REFERENCES` to client roles serves no legitimate purpose and is removed in migration 016 as defense-in-depth.
