# Data Flow and Retention

**Code-audited July 9, 2026.** This document describes the repository through migration
`046`. Production does not have these guarantees until migrations `035`–`046`, the cron
configuration in `vercel.json`, and the documented provider settings have been deployed.

## Data inventory

| Category | Examples | Retention / deletion behavior |
|---|---|---|
| Account and career data | profile, resumes, portfolios, projects, audits, jobs, applications, tailored assets, evidence, interview sessions and answers | User-owned rows reference `auth.users` with cascading deletion and are removed with the account. |
| Uploaded files | resume files, portfolio images, interview recordings | `/api/account/delete` recursively attempts to remove every object under the user's prefix before deleting the auth user. Storage is outside the database cascade, so failures are logged for operator follow-up rather than silently described as guaranteed. |
| Billing state | local Stripe customer/subscription IDs and plan status | Local subscription rows are deleted with the account. Stripe remains the payment system of record and may retain customer and transaction records for its legal and operational obligations. Showcase does not store card or bank details. |
| Waitlist | email, goal, referral and admission state | A waitlist row can remain after account deletion, with `converted_user_id` unlinked. Privacy deletion requests can be sent to `hello@tryshowcase.ink`. |
| Anonymous ProofScore parse | resume text and parsed JSON behind an unguessable claim token | Available for at most 48 hours, deleted atomically when claimed, and expired rows are purged by the hourly retention job. The stash and claim endpoints also remove expired rows opportunistically. |
| ProofScore reservation | email and one future audit date | Deleted after the reserved date has passed. The email is used to send the requested reservation link, not enrolled in lifecycle marketing. |
| Growth and usage facts | attribution, trusted product events, feature usage, aggregate AI cost events | Used for product operation, abuse control, and aggregate measurement. User-owned rows follow their schema foreign-key behavior; aggregate/non-user facts may remain without resume contents. |
| Rate-limit counters | hashed client fingerprint or user key, feature and window | Purged after eight days by the hourly retention job. Raw IP addresses are not written to these counters. |
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
confirmation. It recursively removes objects from `resumes`, `portfolio-images`, and
`interview-recordings`, then calls Supabase Admin `deleteUser`. Database foreign keys remove
the associated user-owned graph. Storage cleanup is best effort because object storage is not
transactional with Auth; every failure is logged, and the public policy directs the user to
contact support if they need cleanup verified after a provider outage.

## Operational requirements

- Deploy `/api/cron/data-retention` hourly with a valid `CRON_SECRET`.
- Keep `EMAILS_ENABLED=false` until Resend, signed webhook handling, a valid physical postal
  address, and the unsubscribe secret are configured.
- Monitor cron and provider failures through `ERROR_WEBHOOK_URL` and logs.
- Run `npm run test:launch-offline` on every release and the credentialed staging suites before
  enabling public traffic.
- Re-audit this document whenever the schema, providers, or retention job changes.
