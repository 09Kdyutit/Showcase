# Data Flow and Retention

**Code- and production-audited July 12, 2026.** Production has the canonical 49-record
application ledger through
`20260712035035_retire_public_proofscore_infrastructure.sql`. The guarded migration and
compatible application build were separately applied and verified in
`security/public-proofscore-retirement-evidence.json`. Provider-dependent guarantees remain
governed by their separate production controls and end-to-end release gates.

## Data inventory

| Category | Examples | Retention / deletion behavior |
|---|---|---|
| Account and career data | profile, resumes, portfolios, projects, audits, jobs, applications, tailored assets, evidence, interview sessions and answers | User-owned rows reference `auth.users` with cascading deletion and are removed with the account. |
| Uploaded files | resume files, portfolio images, interview recordings | `/api/account/delete` discovers every Storage bucket and recursively removes objects under the user's prefix before deleting the auth user. A Storage list/remove failure aborts account deletion so the user can retry without receiving a false success. |
| Billing state | local Stripe customer/subscription IDs and plan status | Local subscription rows are deleted with the account. Stripe remains the payment system of record and may retain customer and transaction records for its legal and operational obligations. Showcase does not store card or bank details. |
| Waitlist | email, goal, referral and admission state | A waitlist row can remain after account deletion, with `converted_user_id` unlinked. Privacy deletion requests can be sent to `hello@tryshowcase.ink`. |
| Retired anonymous-funnel remnants | legacy pending resume parse rows and public-audit reservation emails | Migration 048 ran only after the final grace boundary with zero unexpired parses and zero actionable reservations. The three legacy tables and three RPCs are absent in production, and only their exact retired rate-limit prefixes were deleted. |
| Growth and usage facts | attribution, trusted product events, feature usage, aggregate AI cost events | Used for product operation, abuse control, and aggregate measurement. User-owned rows follow their schema foreign-key behavior; aggregate/non-user facts may remain without resume contents. |
| Rate-limit counters | salted, hashed client fingerprint or user key, feature and window | Eligible for purge after eight days and removed by the daily retention job. Raw IP addresses are not written to these counters; remaining public endpoints fail closed in production unless `ABUSE_IP_HASH_SALT` contains at least 32 characters. |
| Email delivery ledger | recipient, rendered message, provider ID and delivery state | Completed/suppressed deliveries and exhausted failures are purged after 90 days. Pending/retryable work remains until delivered, suppressed, or exhausted. |
| Email provider events | signed Resend webhook identifiers and status | Processed and failed event claims are purged after 90 days. |
| Email suppressions | normalized email and bounce, complaint, or manual suppression reason | Retained so Showcase continues honoring opt-outs, bounces, and complaints. |
| Stripe webhook claims | provider event IDs used for idempotency | May remain for payment integrity and replay protection; they do not contain resume text. |

## Processors and data flows

- **Supabase** provides database, authentication, and object storage.
- **OpenAI** receives the text needed for AI analysis or generation requested by the user.
  Calls are server-side; private API keys are never shipped to the browser.
- **Stripe** handles checkout and payment details. Showcase stores only identifiers and
  subscription state required to grant access and reconcile webhooks.
- **Resend** receives recipient and rendered-message data for emails that the user requested
  or that are allowed by the configured lifecycle program.
- **Job-data provider:** if enabled, search terms are sent to that provider. Resume text is
  not required for the search request.

Showcase does not sell resume or portfolio data and does not use it to train its own AI
models. Published portfolios are intentionally public; unpublished portfolio and resume data
remain access-controlled.

## Deletion mechanics

`POST /api/account/delete` requires an authenticated user and the exact `DELETE`
confirmation. It discovers every current Storage bucket, recursively removes objects beneath
the authenticated user's prefix, clears matching retention-queue pointers, and only then calls
Supabase Admin `deleteUser`. Database foreign keys remove the associated user-owned graph. A
Storage list/remove failure returns an error before Auth deletion, leaving the account available
for a safe retry; a local adversarial proof verifies this fail-closed behavior, nested paths,
cross-user file survival, every canonical user-owned table, and intentional retained/unlinked
records.

## Operational requirements

- Keep the deployed `/api/cron/data-retention` job on its current once-daily 04:45 UTC
  schedule with a valid `CRON_SECRET`; re-verify retention behavior before increasing its
  cadence or enabling public traffic.
- Keep `EMAILS_ENABLED=false` until Resend, signed webhook handling, a valid physical postal
  address, and the unsubscribe secret are configured.
- Monitor cron and provider failures through `ERROR_WEBHOOK_URL` and logs.
- Run `npm run test:launch-offline` on every release and the credentialed staging suites before
  enabling public traffic.
- Re-audit this document whenever the schema, providers, or retention job changes.
