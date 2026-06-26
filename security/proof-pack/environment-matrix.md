# Environment Matrix

| Property | Value |
|---|---|
| Date | 2026-06-26 |
| Branch | `security/review-2026-06-26` |
| Base commit | `231f800` |
| Node | v22.20.0 |
| Next.js | 16.2.9 |
| Build | `NODE_ENV=production npm run build` (exit 0) |
| Server | `NODE_ENV=production npm run start` on `http://localhost:3000` |
| Supabase project | `yogwhfrjhcbnvoxitcay` (owner test accounts) |
| Stripe | test mode only |
| Health at test time | `{"status":"ok","checks":{"database":true,...}}` |
| Prod CSP at test time | `script-src 'self' 'unsafe-inline' https://js.stripe.com` (no `unsafe-eval`) |

## Which tests need a running server
- **No server (DB/logic only):** `test:secrets`, `test:rls`, prod-bundle grep.
- **Live prod server required:** `test:headers (EXPECT_PROD=1)`, `test:csrf`, `test:abuse`, `test:stripe`, `test:authorization`, `test:uploads`, `test:prompt-injection`, `test:deletion`, `test:interview-rls`, `test:interview-authorization`, `test:interview-deletion`, `test:kill-switches`, `raw-http-attacks.mjs`.

## Reproducibility note
The prior review's HTTP suites are **NOT_REPRODUCIBLE without a server** — running them against a non-running server fails with `fetch failed` (ECONNREFUSED). This review captured the connection-refused state first, then started a production server and re-ran every suite green. See `logs/server.log`.
