# Data Flow & Retention

**Verified against the live schema (`yogwhfrjhcbnvoxitcay`, 19 tables, all RLS-enabled)
on 2026-06-19.**

## What personal data is stored, and where

| Table | What it holds | Deleted when account is deleted? |
|---|---|---|
| `profiles` | Name, email, target role, industry, experience level | Yes — `ON DELETE CASCADE` from `auth.users` |
| `resumes` | Raw resume text, parsed structure, uploaded file metadata | Yes |
| `portfolios` | Generated portfolio content, public slug | Yes |
| `projects` | Portfolio project entries | Yes |
| `audits` | ProofScore audit results (may include resume excerpts) | Yes |
| `generations` | AI-generated content history | Yes |
| `usage_events` | Feature-usage events (used for rate limiting and analytics) | Yes |
| `feedback` / `beta_feedback` | User-submitted feedback text | Yes |
| `job_listings_cache` | Cached third-party job postings — **not personal data**, shared across users | N/A (not user-owned) |
| `saved_jobs` | Jobs a user saved/imported | Yes |
| `applications` | Application tracking entries | Yes |
| `tailored_assets` | AI-tailored resume/cover-letter variants | Yes |
| `voice_profiles` | Writing-style profile derived from the user's own resume | Yes |
| `evidence_items` | Extracted accomplishment evidence | Yes |
| `subscriptions` | Stripe customer/subscription IDs, plan status | Yes |
| `processed_webhook_events` | Stripe event IDs (idempotency tracking) | No — contains no personal data, just event IDs |
| `rate_limit_counters` | IP/user rate-limit counters | No — ephemeral, expires via its own time window |
| `waitlist_signups` | Pre-signup waitlist data (email, goals, referral info) | **No** — `converted_user_id` is set to `NULL` (`ON DELETE SET NULL`), the waitlist record itself is preserved |

**Storage (not Postgres):** the `resumes` bucket holds uploaded resume files
(PDF/DOCX/TXT) under a `{user_id}/` prefix, RLS-scoped via Storage policies.
Deleted explicitly by `/api/account/delete` (best-effort; the auth user
deletion itself proceeds even if storage cleanup fails, since an orphaned file
under a deleted user's prefix is unreachable — RLS is scoped to `auth.uid()`,
which no longer exists once the user is gone).

## Account deletion: what actually happens

Verified end-to-end this session (`scripts/test-account-deletion.mjs`, 13/13):
calling `auth.admin.deleteUser()` (service-role, via `/api/account/delete`)
cascades every row above marked "Yes" automatically — confirmed via direct
`pg_constraint` inspection, every user-owned table has `ON DELETE CASCADE` to
`auth.users(id)`. The one deliberate exception is `waitlist_signups`, which
keeps its row (for product-research purposes — top-of-funnel deletion would
make waitlist conversion data structurally incoherent) but unlinks it from the
now-deleted user.

**What deletion does NOT do:** it does not reach into Stripe to delete the
customer object or payment history — Stripe is the source of truth for
financial records and is generally subject to its own retention requirements
(tax/accounting law in most jurisdictions requires keeping payment records for
years, independent of a user's deletion request). The local `subscriptions`
row is deleted, but the Stripe customer object persists. This is normal and
expected for payment-processing systems, but should be stated plainly in the
privacy policy if it isn't already.

## AI providers and third-party data sharing

- **OpenAI**: resume text, job descriptions, and portfolio content are sent to
  OpenAI's API for analysis/generation (server-side only — verified this
  session that no client-side code calls OpenAI directly). Per OpenAI's API
  terms, API data is not used for model training by default. This is an
  external processor relationship that belongs in the privacy policy.
- **Stripe**: name, email, and payment details for billing.
- **Supabase**: hosts all of the above (database + auth + storage).
- No other third party receives user data. The jobs-search feature, when a
  real provider is configured (vs. fixture/demo data), sends search queries
  (not personal resume data) to that provider.

## Test-account hygiene

This session's adversarial test suites create real accounts against the live
project (most don't clean up after themselves — only `test:deletion` does).
107 leftover `*@example.com` test accounts accumulated and were removed via
`scripts/cleanup-test-accounts.mjs` (real `auth.admin.deleteUser()` calls, same
mechanism as the verified account-deletion feature — not a raw table DELETE).
`profiles` is back down to genuine rows only as of 2026-06-19. Re-run that
script if running the test suites again leaves accounts behind — it only ever
targets `@example.com` (RFC 2606 reserved, no real user can have this domain).
