# Evidence Index

| Log file | Suite / action | Result |
|---|---|---|
| `logs/secrets.log` | `test:secrets` (gitleaks, 101 commits) | no leaks |
| `logs/rls.log` | `test:rls` | 13 passed, 0 failed |
| `logs/authorization.log` | `test:authorization` | 15 passed, 0 failed |
| `logs/abuse.log` | `test:abuse` (10 concurrent → 5 pass) | 3 passed, 0 failed |
| `logs/csrf.log` | `test:csrf` | 6 passed, 0 failed |
| `logs/stripe.log` | `test:stripe` (config + webhook) | 6 passed, 0 failed |
| `logs/uploads.log` | `test:uploads` | 8 passed, 0 failed |
| `logs/prompt-injection.log` | `test:prompt-injection` | 15 passed, 0 failed |
| `logs/headers.log` | `test:headers EXPECT_PROD=1` | 13 passed, 0 failed |
| `logs/deletion.log` | `test:deletion` | 13 passed, 0 failed |
| `logs/xss.log` | `test:xss` | 3 sec-pass; 1 non-security stale assertion fails |
| `logs/interview-rls.log` | `test:interview-rls` | 24 passed, 0 failed |
| `logs/interview-authorization.log` | `test:interview-authorization` | 16 passed, 0 failed |
| `logs/interview-deletion.log` | `test:interview-deletion` | 10 passed, 0 failed |
| `logs/interview-entitlements.log` | `test:interview-entitlements` | 19 passed, **5 stale-constant fails (not a vuln)** |
| `logs/kill-switches.log` | `test:kill-switches` | 4 passed, 0 failed |
| `logs/raw-http-attacks.log` | `scripts/security/raw-http-attacks.mjs` | 10 passed, 0 failed |
| `logs/build.log` | `npm run build` | exit 0 |
| `logs/typecheck.log` | `npm run typecheck` | exit 0 |
| `logs/lint.log` | `npm run lint` | **9 cosmetic errors (no sec impact)** |
| `logs/release-gate.log` | `npm run release:gate` | **NOT READY (1 LOW blocker: IL-17)** |
| `logs/server.log` | prod server boot | up |

## Source-of-truth files cited (no log, read directly)
- `src/app/api/interviews/sessions/[id]/live-token/route.ts` — Live token ownership/voice/Pro/kill-switch gates
- `src/lib/ai/rate-limit.ts` — `isProUser()` DB lookup, global + per-user atomic quota
- `supabase/migrations/011_rate_limit_counters.sql` — atomic `rate_limit_increment` RPC
- `src/lib/rate-limit/postgres.ts` — RPC wrapper (fail-open documented)
- `src/app/api/stripe/webhook/route.ts` — signature verify before DB write
- `src/app/api/stripe/create-checkout-session/route.ts` — env-driven priceId
- `src/lib/interviews/entitlements/plans.ts` — canonical server-authoritative limits
- `src/app/api/health/route.ts` — extended with commit/environment parity signals
