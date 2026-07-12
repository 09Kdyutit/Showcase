# API authorization matrix

Reviewed from the current source on 2026-07-10. Scope is **every** `route.ts` below
`src/app/api`: 82 route modules and 102 exported HTTP handlers. The machine-readable source
of truth is [`security/api-authorization-matrix.json`](./api-authorization-matrix.json).
`scripts/test-api-authorization-local.mjs --inventory-only` fails if a route or method is
missing, stale, duplicated, or placed behind an unreviewed trust boundary.

## Trust-boundary key

- `session`: a verified Supabase cookie user is required before database, storage, provider,
  or service-role work. Client-supplied user IDs are not authority.
- `owner-filter`: every accepted resource ID is constrained by the cookie user's `user_id`
  (or the profile primary key equal to `user.id`), independently of RLS.
- `service-after-owner`: a service-role operation is reachable only after session identity
  and resource ownership are established; service RPC arguments use the server-derived user.
- `cron-secret`: a `Bearer CRON_SECRET` check precedes cron work.
- `stripe-signature` / `resend-signature`: the raw provider payload is cryptographically
  verified before idempotency claims or writes.
- `public-token`: a high-entropy bearer token resolves a deliberately sanitized response.
- `public-capacity`: an intentionally anonymous acquisition surface protected by bounded
  validation, rate/capacity controls, and service-only persistence.
- `public-input`: intentional anonymous intake with a strict schema and no private read path.

## Complete route matrix

| Route | Methods | Boundary | Record authority | Source-reviewed enforcement |
|---|---|---|---|---|
| `/api/account/delete` | POST | session | session-user | Cookie user is resolved before confirmation parsing; deletion uses only user.id. |
| `/api/ai/analyze-resume` | POST | session | owner-filter | Optional resume update is filtered by id and user_id; generated rows use user.id. |
| `/api/ai/audit-portfolio` | POST | session | owner-filter | Portfolio and resume lookups are filtered by user_id before the provider call. |
| `/api/ai/cover-letter` | POST | session | owner-filter | Saved-job and resume IDs are resolved through caller-owned rows only. |
| `/api/ai/generate-portfolio` | POST | session | service-after-owner | Entitlement is server-derived; target portfolio is owner-filtered before AI and service writes. |
| `/api/ai/improve-resume` | POST | session | session-user | No record ID is accepted; quota and generation ledger use user.id. |
| `/api/ai/outreach` | POST | session | owner-filter | Optional saved-job and resume IDs are filtered by user_id before AI. |
| `/api/ai/role-match` | POST | session | session-user | No record ID is accepted; quota and generation ledger use user.id. |
| `/api/ai/suggest-projects` | POST | session | owner-filter | Optional resume ID is filtered by user_id before AI. |
| `/api/applications` | GET/POST/PATCH | session | owner-filter | Lists, saved-job validation, insert owner, and updates are all scoped to user.id. |
| `/api/ats/check` | POST | session | owner-filter | Optional tailored-asset update is filtered by id and user_id. |
| `/api/audit/share` | POST/DELETE | session | service-after-owner | Service-role audit reads and writes are constrained to the cookie user's user_id. |
| `/api/beta/feedback` | POST | public-input | service-validation | Intentional pre-account input; bounded body and schema validation precede a service-only insert. |
| `/api/career-packet` | GET | session | owner-filter | All packet queries derive from and filter by user.id. |
| `/api/cron/data-retention` | GET | cron-secret | service-cron | Bearer CRON_SECRET is required before retention mutations. |
| `/api/cron/growth-scorecard` | GET | cron-secret | service-cron | Bearer CRON_SECRET is required before aggregate reads or email work. |
| `/api/cron/interview-retention` | GET | cron-secret | service-cron | Bearer CRON_SECRET is required before retention RPC and storage deletion. |
| `/api/cron/invite-batch` | GET | cron-secret | service-cron | Bearer CRON_SECRET is required before the paced invite batch. |
| `/api/cron/lifecycle-email` | GET | cron-secret | service-cron | Bearer CRON_SECRET is required before candidate reads or outbox work. |
| `/api/cron/weekly-digest` | GET | cron-secret | service-cron | Bearer CRON_SECRET is required before profile reads or outbox work. |
| `/api/email/events` | POST | resend-signature | signed-provider-event | Fresh Standard Webhooks/Svix signature is verified before service RPC or writes. |
| `/api/email/inbound` | POST | resend-signature | signed-provider-event | Fresh Svix HMAC is verified before claim RPC, forwarding, or writes. |
| `/api/email/unsubscribe` | GET/POST | public-token-confirmation | signed-bearer-token | GET is read-only confirmation; POST requires an HMAC over token and preference scope. |
| `/api/growth/attribution/claim` | POST | session | service-after-owner | Attribution RPC receives the cookie user id, never a client-supplied user id. |
| `/api/growth/portfolio-events` | POST | session | service-after-owner | Portfolio is owner-filtered before trusted events are written with user.id. |
| `/api/growth/referral-events` | POST | session | session-user | Event subject and rate-limit key are derived from user.id. |
| `/api/health` | GET | public-sanitized | public-no-private-data | Returns coarse health/configuration booleans only, never keys or user data. |
| `/api/interviews/companies/prep` | POST | session | session-user | No user-owned record ID is accepted; quota and cost records use user.id. |
| `/api/interviews/drills/[id]/attempt` | POST | session | session-user | id selects a fixed server catalog entry; drill storage is read/written by user.id. |
| `/api/interviews/drills` | GET | session | owner-filter | Drill progress is filtered by user_id. |
| `/api/interviews/profile` | GET | session | owner-filter | Profile lookup is filtered by user_id. |
| `/api/interviews/questions/score` | POST | session | session-user | No record ID mutation; quota and cost rows use user.id. |
| `/api/interviews/readiness` | GET | session | owner-filter | Readiness inputs are caller-owned interview records only. |
| `/api/interviews/reminders` | GET/POST/DELETE | session | owner-filter | List, create owner, and delete are all scoped to user.id. |
| `/api/interviews/reports/[token]` | GET | public-token | sanitized-share-token | High-entropy token is hashed for lookup; resolver returns the explicit report DTO only. |
| `/api/interviews/sessions/[id]/analyze` | POST | session | owner-filter | Session, resume, and project evidence are filtered by user_id before analysis. |
| `/api/interviews/sessions/[id]/answers/[questionId]/recording` | POST | session | service-after-owner | Session and question ownership are checked before feature gate, upload, transcription, or service usage writes. |
| `/api/interviews/sessions/[id]/answers/[questionId]/retry` | POST | session | service-after-owner | Session and question are owner-filtered before the service-only retry reservation. |
| `/api/interviews/sessions/[id]/complete` | POST | session | owner-filter | Session lookup and completion update are filtered by user_id. |
| `/api/interviews/sessions/[id]/live-token` | POST | session | owner-filter | Session ownership/state/entitlement are checked before any provider token request. |
| `/api/interviews/sessions/[id]/live-transcript` | POST | session | service-after-owner | Session is owner-filtered and question IDs are constrained to that session before inserts. |
| `/api/interviews/sessions/[id]` | GET/DELETE | session | service-after-owner | Detail and deletion both owner-filter the session; service cleanup rechecks user_id. |
| `/api/interviews/sessions/[id]/share` | GET/POST | session | owner-filter | Share list and completed-session lookup are filtered by user_id; raw token is returned once. |
| `/api/interviews/sessions/[id]/start` | POST | session | owner-filter | Session read and state transition are filtered by user_id. |
| `/api/interviews/sessions/[id]/transcript` | POST | session | service-after-owner | Session and question are owner-filtered before transcript/answer insert and usage commit. |
| `/api/interviews/sessions` | POST/GET | session | service-after-owner | List is owner-filtered; creation derives owner and validates optional job/resume/portfolio ownership before service quota work. |
| `/api/interviews/shares/[id]` | DELETE | session | owner-filter | Share deletion is filtered by id and user_id. |
| `/api/interviews/story-bank/[id]` | PATCH/DELETE | session | owner-filter | Story mutation and deletion are filtered by id and user_id. |
| `/api/interviews/story-bank` | GET/POST | session | owner-filter | List and insert use user.id; optional resume/project sources are owner-checked. |
| `/api/interviews/usage` | GET | session | session-user | Server entitlement snapshot is derived solely from user.id. |
| `/api/jobs/[id]/tailor` | POST | session | owner-filter | Path job id and body saved_job_id must resolve to a caller-owned saved job before AI. |
| `/api/jobs/import` | POST | session | session-user | No existing record ID; created job and generation rows use user.id. |
| `/api/jobs/match` | POST | session | session-user | Shared job cache is non-private; results and quota use the cookie user. |
| `/api/jobs/recommendations` | POST | session | owner-filter | Resume/profile inputs are caller-owned and plan is server-derived. |
| `/api/jobs/save` | POST/PATCH/GET/DELETE | session | owner-filter | Create owner, list, update, and delete all use user.id filters. |
| `/api/jobs/saved-searches` | GET/POST/DELETE | session | owner-filter | Create owner, list, cap, and delete all use user.id filters. |
| `/api/jobs/search` | GET | session | session-user | Searches shared provider data; provider access is behind authentication. |
| `/api/marketing/track` | POST | public-input | service-validation | Intentional analytics intake; bounded body, event allowlist, and service-only insert. |
| `/api/opportunities/for-you` | GET | session | owner-filter | Profile, resume, and saved-job state are filtered by user_id. |
| `/api/opportunities/search` | GET | session | owner-filter | User context reads are owner-filtered; returned opportunities are public-source data. |
| `/api/portfolio/export-html` | POST | session | owner-filter | Requested portfolio is filtered by id and user_id before export rendering. |
| `/api/portfolio/publish` | POST | session | service-after-owner | Portfolio ownership is checked with the session client before service-role publication fields change. |
| `/api/portfolio/save` | POST | session | owner-filter | Update is filtered by portfolio id and user_id. |
| `/api/portfolio/upload-image` | POST | session | session-user | Private storage path is generated under user.id; no client owner field is accepted. |
| `/api/projects/saved` | GET/POST/DELETE | session | owner-filter | Create owner, list/cap, and delete are all scoped to user.id. |
| `/api/proofscore/claim-parse` | POST | session | service-after-owner | Temporary claim-only grace path for tokens issued before public-tool retirement; atomically consumes a live token into a resume owned by the cookie user and returns 410 after the final legacy expiry. |
| `/api/referral/claim` | POST | session | service-after-owner | Route supplies cookie user id to the atomic claim RPC; user/IP pacing and profile precondition apply. |
| `/api/referral/validate` | GET | public-capacity | service-capacity | Strict code format, connection throttle, and remaining-count-only response. |
| `/api/resume/export-pdf` | POST | session | owner-filter | Resume or tailored asset lookup is filtered by id and user_id before rendering. |
| `/api/resume/export` | POST | session | owner-filter | Resume or tailored asset lookup is filtered by id and user_id before rendering. |
| `/api/resume/extract-text` | POST | session | session-user | No existing record ID or client owner field; authenticated upload validation precedes extraction. |
| `/api/resume/generate-from-portfolio` | POST | session | owner-filter | Source portfolio is filtered by id and user_id; resulting resume owner is user.id. |
| `/api/stripe/create-checkout-session` | POST | session | service-after-owner | Customer, metadata user_id, founding reservation, and idempotency key derive from cookie user. |
| `/api/stripe/create-portal-session` | POST | session | owner-filter | Stripe customer id is loaded from the caller's subscription row only. |
| `/api/stripe/founding-availability` | GET | session | service-after-owner | Authentication precedes the service-only aggregate slot snapshot. |
| `/api/stripe/reconcile-session` | POST | session | signed-provider-ownership | Retrieved Stripe session metadata.user_id must equal the cookie user before service reconciliation. |
| `/api/stripe/webhook` | POST | stripe-signature | signed-provider-event | Raw-body Stripe signature is verified before idempotency claim or subscription writes. |
| `/api/waitlist/admission` | GET/POST | GET: public-token; POST: session | token-read-session-redeem | GET returns only masked email and expiry for a high-entropy token; POST supplies the cookie user and one-use token to an atomic email-matching redemption RPC. |
| `/api/waitlist/join` | POST | public-capacity | service-capacity | Bounded schema, consent, honeypot, IP pacing, duplicate handling, and server-generated tokens. |

## Executable evidence

The local suite proves more than source shape:

- all 80 session handlers return 401 to an anonymous caller, using valid-enough route
  parameters so validation cannot mask the auth result;
- two real cookie sessions attempt cross-user access across portfolio, resume, application,
  jobs, growth, audit-sharing, and Interview Lab resource families, followed by database
  integrity checks;
- missing, wrong, and correct local cron secrets are exercised for all six cron handlers;
- Stripe and both Resend webhook routes reject invalid signatures and accept locally signed,
  provider-free ignored events;
- anonymous and authenticated Data API clients attack six critical service-only RPCs;
- referral capacity, waitlist email-bound admission, public share redaction, ProofScore
  capacity, and signed unsubscribe confirmation are exercised without external providers.

Run the inventory-only part anywhere:

```bash
node scripts/test-api-authorization-local.mjs --inventory-only
```

Run the credentialed phase only through the repository's disposable local Supabase harness;
the script rejects non-loopback app, database, and Supabase targets.

## Honest limits

The provider-free suite deliberately does not make OpenAI, Gemini, Stripe API, Resend API,
or job-provider network calls. It proves authentication and ownership before those calls,
validates provider webhook signatures locally, and checks post-provider record mutations by
source plus RLS/explicit Data API grants. Separate provider E2E tests remain the evidence for
successful third-party responses; they are not an authorization prerequisite.
