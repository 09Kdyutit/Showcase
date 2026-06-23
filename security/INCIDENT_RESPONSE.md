# Incident Response

Internal only — do not publish. No actual credentials are recorded anywhere in this file.

## General first steps for any incident

1. Identify scope: which users, which data, which time window.
2. If a credential is involved, rotate it immediately (see `CREDENTIAL_ROTATION.md`) — do not wait until root cause is understood.
3. If active abuse is in progress, flip the relevant kill switch (`KILL_SWITCH_AI`, `KILL_SWITCH_CHECKOUT`, `KILL_SWITCH_JOBS_PROVIDER`, `KILL_SWITCH_PUBLISHING`) in Vercel Production env vars and redeploy.
4. Preserve evidence before remediating where possible (Supabase logs via `get_logs`, Stripe event log, Vercel deployment logs) — fixing the hole shouldn't destroy the record of how it was used.
5. After containment, write down what happened while it's fresh, even informally — this file should grow from real incidents, not stay theoretical.

## Leaked Supabase service-role key

- **Impact:** full read/write bypass of RLS on every table — the most severe credential leak possible in this system.
- **Immediate action:** rotate the service-role key in the Supabase dashboard (Project Settings → API). Update `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and the Vercel Production + Preview environments. Redeploy.
- **Investigation:** review `get_logs(service: 'postgres')` and `get_logs(service: 'api')` for the affected window for anomalous service-role-pattern queries.
- **Note:** rotating this key invalidates it everywhere instantly — there is no overlap/grace period, so plan for a brief redeploy gap.

## Leaked database password

- **Impact:** direct Postgres access, bypassing PostgREST/RLS entirely if the attacker has the connection string.
- **Immediate action:** reset the database password in Supabase dashboard (Project Settings → Database). Update `DATABASE_URL` everywhere it's configured. This does not require an app redeploy if `DATABASE_URL` isn't used by the running app (confirm: this app uses the Supabase client libraries, not a direct Postgres connection, for all current runtime code paths — verify before assuming low urgency).

## Leaked OpenAI key

- **Immediate action:** revoke the key in the OpenAI dashboard, generate a new one, update `OPENAI_API_KEY` in `.env.local` + Vercel, redeploy.
- **Investigation:** check OpenAI's own usage dashboard for the affected window for anomalous spend/volume before revoking, if time allows without prolonging exposure materially.
- **Containment while investigating:** flip `KILL_SWITCH_AI=true` immediately, rotate after.

## Leaked Stripe key

- **Immediate action:** roll the key in the Stripe dashboard (Developers → API keys → roll key). This invalidates the old key immediately. Update `STRIPE_SECRET_KEY` everywhere, redeploy.
- **Containment while investigating:** flip `KILL_SWITCH_CHECKOUT=true` to stop new checkout sessions; existing subscriptions and webhook processing are unaffected by this switch (intentional — don't disrupt paying customers' renewals while investigating a leaked key used for new-session creation).

## Leaked webhook secret

- **Impact:** an attacker with this secret could forge signed webhook events (e.g., fake `customer.subscription.created`) — verified this session that signature verification and idempotency both work correctly against real and forged events, but a leaked secret defeats the signature check entirely.
- **Immediate action:** in the Stripe dashboard, delete the compromised webhook endpoint and register a new one for the same URL — this generates a new signing secret. Update `STRIPE_WEBHOOK_SECRET`. Do not reuse the old endpoint ID.
- **Investigation:** review `processed_webhook_events` for the affected window for subscription status changes with no corresponding real Stripe event (cross-check against the Stripe dashboard's event log).

## Cross-user data exposure (RLS gap, API ownership gap, or similar)

- **Immediate action:** if actively exploitable, consider taking the affected route or table access down via the appropriate kill switch or a fast-follow deploy disabling the route, rather than leaving it live while a proper fix is written.
- **Fix:** add/correct the RLS policy or the API ownership check; this session's pattern is to verify with a real two-user adversarial script (`scripts/test-rls.mjs`, `scripts/test-authorization.mjs`) before and after the fix, not just read the policy and assume it's correct.
- **Notification:** if real user data was actually exposed (not just theoretically exposable), document who, what data, and for how long — needed for any disclosure decision, which is a business/legal call, not a purely technical one.

## Abusive AI traffic / cost spike

- **Immediate action:** flip `KILL_SWITCH_AI=true`. The global daily ceiling (`AI_GLOBAL_DAILY_LIMIT`, added this session) should already have capped worst-case damage before manual intervention.
- **Investigation:** query `usage_events` (now purely an audit log, not load-bearing for enforcement) grouped by `user_id` for the affected window to identify the source account(s); check `auth.users.created_at` for the same accounts — a burst of recently-created accounts each maxing their per-user limit is the expected signature of distributed abuse across many free accounts.
- **Follow-up:** consider tightening free-tier signup velocity if the same pattern recurs (out of scope for this audit — flagged, not implemented).

## Malicious file upload

- **Status:** verified this session (`test:uploads`, 8/8 real adversarial cases) that magic-byte/MIME/size checks reject renamed executables, HTML-as-PDF, oversized files, zero-byte files, and corrupted archives without crashing the server or leaking internal error detail.
- **If a malicious file is ever found to have been accepted:** identify the gap in the magic-byte/MIME check that let it through, add a regression case to `scripts/test-uploads.mjs` proving the fix, then fix.

## Failed Stripe webhooks

- **Symptom:** subscription status in `subscriptions` table doesn't match the Stripe dashboard's actual status for a customer.
- **Investigation:** check `processed_webhook_events` for the relevant `stripe_subscription_id` / event types; check Vercel function logs for the webhook route around the expected delivery time; check the Stripe dashboard's own webhook delivery log (Stripe retries failed deliveries automatically for a period).
- **Manual reconciliation:** if a webhook genuinely failed permanently, the subscription state can be manually corrected via a direct, clearly-logged service-role update — this is the one case where bypassing the normal webhook flow for `subscriptions` is appropriate, since the table has no client-write policy by design and this is an explicit operator action, not user-facing.

## Unavailable Supabase

- **Symptom:** health endpoint reports `database: false`.
- **Immediate action:** check Supabase's own status page; the app's rate limiters and AI routes are designed to fail open on a DB error (documented tradeoff favoring availability), so most of the app degrades rather than hard-fails, but auth and all data-dependent features will be down.
- **No action needed on our side** beyond monitoring — Supabase availability is outside this application's control.

## Compromised user account

- **Immediate action:** the account owner (or support, on their behalf, with appropriate verification) should change the password immediately via the reset-password flow, which the code review this session confirmed uses enumeration-resistant responses and a safe redirect allowlist.
- **If the account was used to publish abusive/malicious portfolio content:** unpublish via the standard publish-flow code path (preserves the draft/version history rather than destructively deleting), then investigate.
