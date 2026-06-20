# Showcase — Release Execution Manifest

**NEXT ACTION (resume point):** Work the first row below with status `NOT_STARTED` or `IN_PROGRESS`, in ID order, skipping `BLOCKED` rows. Do not re-run a `PASS` row unless its `implementation files` changed since the commit hash listed.

**Baseline confirmed this session (2026-06-19):** clean git tree at `2e9ba51`, all 9 migrations applied (001-009), 91/91 existing tests pass (`test:match` 17, `test:taxonomy` 17, `test:truth-ledger` 15, `test:ats` 7, `test:rls` 13, `test:uploads` 8, `test:xss` 4, `test:prompt-injection` 9, `test:ai` connects), `verify.mjs` 60/60, typecheck/lint/build clean. No regressions found — prior security pass holds.

Status values: `NOT_STARTED` / `IN_PROGRESS` / `PASS` / `FAIL` / `BLOCKED`.

## P0 — Critical (auth bypass, cross-user access, payment integrity, secrets, RCE, data loss)

| ID | Release area | Exact task | Status | Implementation files | Verification command | Evidence | Blocker | Next action | Commit |
|---|---|---|---|---|---|---|---|---|---|
| P0-01 | Authorization | API ownership matrix across all 21 routes | PASS | `security/API_AUTHORIZATION_MATRIX.md` | manual + `test:authorization` | Zero missing ownership checks across all 21 routes | — | done | 9b2 (pending) |
| P0-02 | Authorization | Adversarial cross-user test: saved_jobs, applications, tailored_assets, portfolios, resumes, Stripe portal via real API calls | PASS | `scripts/test-api-authorization.mjs` | `npm run test:authorization` | 15/15. Found+fixed 2 real bugs: PATCH on jobs/save and applications returned 500 (PGRST116, `.single()` on zero-row UPDATE) instead of 404 when targeting another user's resource | — | done | 9b2 (pending) |
| P0-03 | Authorization | Stripe portal session cannot be opened for another user's customer | PASS | `src/app/api/stripe/create-portal-session/route.ts` | `npm run test:authorization` | Confirmed: customer_id always derived from session, never accepts client input | — | done | 9b2 (pending) |
| P0-04 | Authorization | Publishing/exporting another user's resume or portfolio is rejected | PASS | `scripts/test-api-authorization.mjs` | `npm run test:authorization` | Covered in the 15/15 above | — | done | 9b2 (pending) |
| P0-05 | Secrets | Rotate credentials pasted in chat this session (Stripe keys, Supabase service role, DB password) | BLOCKED | — | manual | Flagged twice already | Requires user to rotate in Stripe/Supabase dashboards — only they can authorize/execute this | Document exact steps; await user action | — |
| P0-06 | Secrets | gitleaks scan of full repo + git history | PASS | `.gitleaks.toml`, `src/lib/stripe/client.ts` | `npm run test:secrets` | Found 1 hit (placeholder string shaped like a Stripe key, never real); fixed the string + added allowlist for the historical commit. Clean scan now. | — | done | pending |
| P0-07 | AI Truth | Truth Ledger export-block still fails closed under expanded adversarial set | NOT_STARTED | `scripts/test-truth-ledger.mjs` | `npm run test:truth-ledger` | 15/15 (existing scope) | — | Expand adversarial cases | — |
| P0-08 | Data loss | Account deletion cascades correctly across all 14 tables + storage | PASS | `src/app/api/account/delete/route.ts`, `src/app/(app)/settings/page.tsx`, `scripts/test-account-deletion.mjs` | `npm run test:deletion` | 13/13. Was a non-functional stub before this session (button just toasted "contact support"). Built real deletion: type-DELETE-to-confirm dialog -> auth.admin.deleteUser cascades all 14+ tables (all have ON DELETE CASCADE) + explicit storage cleanup. Verified deleted user cannot log back in. | — | done | pending |

## P1 — High (production webhook, rate limiting, session hardening, CSRF, monitoring, rollback, backups)

| ID | Release area | Exact task | Status | Implementation files | Verification command | Evidence | Blocker | Next action | Commit |
|---|---|---|---|---|---|---|---|---|---|
| P1-01 | Stripe | Webhook event idempotency (duplicate/replayed events don't double-apply) | PASS | `src/app/api/stripe/webhook/route.ts`, migration 010 | `npm run test:stripe-webhook` | 6/6. Added `processed_webhook_events` table (unique event_id) + `last_webhook_event_at` out-of-order guard. Real test: signed duplicate event short-circuits, older out-of-order event doesn't regress newer status. | — | done | pending |
| P1-02 | Stripe | Invalid signature, wrong price ID, frontend Pro spoof all rejected | PASS | `scripts/test-stripe-config.mjs`, `scripts/test-stripe-webhook.mjs` | `npm run test:stripe` | 14/14 combined (8 config + 6 webhook) | — | done | pending |
| P1-03 | Stripe | Production webhook endpoint registered | BLOCKED | — | manual | — | No deployed public URL exists yet | User must deploy first, then register webhook in Stripe dashboard | — |
| P1-04 | Rate limiting | Distributed rate limiter abstraction (memory fallback for local dev) | NOT_STARTED | `src/lib/rate-limit/*` | `npm run test:abuse` | — | — | Build types.ts/memory.ts/distributed.ts/index.ts | — |
| P1-05 | Rate limiting | Upstash Redis wired for production | BLOCKED | — | manual | — | Requires Upstash account creation + API token | User must create account and provide `UPSTASH_REDIS_REST_URL`/`TOKEN` | — |
| P1-06 | Auth | Session/redirect/cookie hardening real-browser tests | NOT_STARTED | `scripts/test-auth.mjs` | `npm run test:auth` | — | — | Write + run | — |
| P1-07 | CSRF | Origin/Host validation helper for cookie-authenticated state-changing routes | NOT_STARTED | `src/lib/security/origin-check.ts` | `npm run test:csrf` | — | — | Build + apply | — |
| P1-08 | SSRF | Confirm zero server-side user-URL fetches (re-verify after this session's new routes) | PASS (prior session) | — | `npm run test:ssrf` | Verified via code search: zero `fetch()` calls in any API route on user input | — | Add automated test script for regression protection | 2e9ba51 |
| P1-09 | Monitoring | Provider-neutral observability layer (request IDs, error adapter, redaction) | NOT_STARTED | `src/lib/observability/*` | manual | — | — | Build | — |
| P1-10 | Monitoring | Sentry (or equivalent) wired via env var, app works without it | NOT_STARTED | — | manual | — | — | Build adapter; actual Sentry account is user's choice | — |
| P1-11 | Reliability | Kill switches: AI routes, checkout, jobs provider, public publishing | NOT_STARTED | `src/lib/feature-flags.ts` | manual | — | — | Build env-var-gated switches | — |
| P1-12 | Reliability | Health check (liveness/readiness) endpoints, no secret leakage | NOT_STARTED | `src/app/api/health/route.ts` | manual curl | — | — | Build | — |
| P1-13 | Backup | Backup/restore documentation + Supabase PITR confirmation | NOT_STARTED | `security/BACKUP_RESTORE.md` | manual | — | — | Document; real restore drill needs a disposable project (BLOCKED without one) | — |
| P1-14 | Deployment | Staging env config + DEPLOYMENT.md/LAUNCH_CHECKLIST.md | NOT_STARTED | `DEPLOYMENT.md`, `LAUNCH_CHECKLIST.md` | manual | — | — | Write | — |
| P1-15 | Deployment | Actual staging deployment | BLOCKED | — | manual | — | No Vercel/hosting account access | User must connect repo to a host | — |
| P1-16 | Email | Production SMTP / confirmation / reset readiness docs | NOT_STARTED | `security/EMAIL_READINESS.md` | manual | — | — | Document; actual SMTP creds are user's | — |
| P1-17 | CI | GitHub Actions security workflow | NOT_STARTED | `.github/workflows/security.yml` | manual (no remote to trigger yet) | — | No git remote configured | Write workflow file regardless; trigger is BLOCKED until a remote exists | — |
| P1-18 | Headers | CSP/header tightening + automated header test | NOT_STARTED | `next.config.ts`, `scripts/test-headers.mjs` | `npm run test:headers` | — | — | Audit current headers, tighten, test | — |
| P1-19 | Privacy | Account deletion route + UI if missing | PASS | Same as P0-08 | `npm run test:deletion` | Same as P0-08 | — | done | pending |
| P1-20 | Privacy | DATA_FLOW.md / RETENTION_POLICY.md / PRIVACY_OPERATIONS.md | NOT_STARTED | `security/*.md` | manual | — | — | Write | — |

## P2 — Medium (load testing, accessibility, visual QA, docs) — only after P0/P1 substantially done

| ID | Release area | Exact task | Status | Implementation files | Verification command | Evidence | Blocker | Next action | Commit |
|---|---|---|---|---|---|---|---|---|---|
| P2-01 | Load | k6/Artillery scripts against local dev | NOT_STARTED | `scripts/load/*` | `npm run test:load` | — | — | Build after P0/P1 | — |
| P2-02 | E2E | Full 25-step paid-path Playwright run | NOT_STARTED | `scripts/test-e2e-full.mjs` | manual run | — | Stripe annual flow + email confirmation untested live | Build after P0/P1 | — |
| P2-03 | Accessibility | Axe/Lighthouse pass on primary screens | NOT_STARTED | — | manual | — | — | After P0/P1 | — |
| P2-04 | Visual QA | Desktop+mobile screenshot review, all primary screens | NOT_STARTED | — | manual | — | — | After P0/P1 | — |

## Release gate

See `security/release-gate.json` (machine-readable) and run `npm run release:gate`.

## Notes for future sessions

- Do not repeat Phase-1 regression baseline unless `git log` shows changes since `2e9ba51` that touched test-relevant files.
- Do not re-litigate whether the original mega-audit prompt's full scope is achievable in one session — it isn't, and that's already been said. Just work the manifest.
- BLOCKED rows have an exact one-line human action each — do not attempt to work around them (no fabricated accounts, no guessed credentials, no skipping verification).
