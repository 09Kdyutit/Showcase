# Steel-Mode Gap Analysis — Re-verification of REVIEW_2026-06-26_REPORT.md

Each prior claim is independently re-tested and classified:
`EVIDENCE_STRONG` / `EVIDENCE_WEAK` / `NOT_REPRODUCIBLE` / `MISSING_ARTIFACT` / `NEEDS_DEEPER_TEST` / `REGRESSION_FOUND`.

Prior-review branch diff vs `main` (`git diff main...security/review-2026-06-26 --stat`):
`next.config.ts`, `scripts/test-headers.mjs`, plus the two report markdown files — i.e. the prior review's only product change was the CSP fail-safe.

| # | Prior claim | Classification | Re-verification evidence |
|---|---|---|---|
| 1 | Become Pro by spoofing `isPro`/`plan` in body — BLOCKED | **EVIDENCE_STRONG** | `grep` over `src/app/api/**` finds **zero** routes reading `user_id/plan/isPro/tier/subscription/quota/priceId/customer` from the body. `isProUser()` is a pure server-side `subscriptions` lookup (`src/lib/ai/rate-limit.ts:119`). Session route comments: "the browser's request body is never" trusted for plan/tier. |
| 2 | Self-upgrade via success URL — BLOCKED | **EVIDENCE_STRONG** | Subscription state mutates only in the signature-verified webhook (`src/app/api/stripe/webhook/route.ts`). No client path writes `subscriptions`. |
| 3 | Replay Stripe webhook — BLOCKED | **EVIDENCE_STRONG** | `test:stripe` 6/6 live against prod server. Idempotency via unique `processed_webhook_events`. |
| 4 | Forged webhook signature — BLOCKED | **EVIDENCE_STRONG** | Live raw HTTP: forged sig → **400**, missing sig → **400** (`scripts/security/raw-http-attacks.mjs`, log `raw-http-attacks.log`). `constructEvent` runs before any DB write. |
| 5 | Out-of-order webhook regression — BLOCKED | **EVIDENCE_STRONG** | `test:stripe` 6/6: older event does not regress newer `past_due`. |
| 6 | Quota via fake tier — BLOCKED | **EVIDENCE_STRONG** | Rate-limit key is `ai:{event}:{userId}`; tier derived server-side. |
| 7 | Parallel-call limit bypass — BLOCKED | **EVIDENCE_STRONG** | `test:abuse` 3/3 live: 10 concurrent → exactly 5 pass (statuses 200×5, 429×5). RPC `rate_limit_increment` is a single `INSERT … ON CONFLICT DO UPDATE … RETURNING` with `allowed = count <= max` on the **post-increment** count (migration 011). |
| 8 | Read another user's data (RLS/API) — BLOCKED | **EVIDENCE_STRONG** | `test:rls` 13/13, `test:authorization` 15/15, `test:interview-rls` 24/24, `test:interview-authorization` 16/16 — all live. |
| 9 | Access another user's files — BLOCKED | **EVIDENCE_STRONG** | `test:uploads` 8/8 live; deletion suite purges storage (`test:deletion` 13/13, `test:interview-deletion` 10/10). |
| 10 | Gemini Live token for another user / voice gate — BLOCKED | **EVIDENCE_STRONG** | Source re-read (`live-token/route.ts`): ownership `.eq('user_id', user.id)` + `delivery_mode !== 'voice'` → 409 + status gate + `isProUser` gate + `isInterviewLiveEnabled()` gate. Returns only `{model, systemInstruction}` — **real GEMINI_API_KEY never returned to browser**. |
| 11 | Secret in browser bundles — BLOCKED | **EVIDENCE_STRONG** | Prod `.next/static` + `public/` scan for `sk_`, `service_role`, `eyJ` JWT, `AIza`, `whsec_`, `postgres://creds`: **zero matches**. `gitleaks` clean (101 commits). |
| 12 | AI override of deterministic controls — BLOCKED | **EVIDENCE_STRONG** | `test:prompt-injection` 15/15 live. |
| 13 | CSRF / cross-origin — BLOCKED | **EVIDENCE_STRONG** | `test:csrf` 6/6 live (forged Origin → 403; webhook exempt by signature). |
| 14 | XSS via portfolio links — BLOCKED (security assertions) | **EVIDENCE_STRONG** (sec) / **MISSING_ARTIFACT** (test quality) | `test:xss` security assertions PASS (no `javascript:`, no `data:`, no script exec). The **1 failing assertion** is non-security ("safe https link still renders") — stale test data shape, exactly as prior report SEC-2026-0626-03 stated. Prior report should have surfaced the failing count explicitly. |
| 15 | Account deletion cascade — WORKS | **EVIDENCE_STRONG** | `test:deletion` 13/13 + `test:interview-deletion` 10/10 live. |
| 16 | Kill switches — WORK | **EVIDENCE_STRONG** | `test:kill-switches` 4/4 live. |
| 17 | CSP `unsafe-eval` absent in prod — FIXED | **EVIDENCE_STRONG** | Live prod CSP header has no `unsafe-eval`; `.next/static`/header grep confirms. `test:headers` 13/13 with `EXPECT_PROD=1`. |

## Gaps the prior report did NOT disclose

| ID | Gap | Classification | Notes |
|---|---|---|---|
| G-1 | `test:interview-entitlements` reports **19 passed, 5 failed** | **MISSING_ARTIFACT** (not a vuln) | 5 failures are **stale test expectations** (test asserts Free=2 sessions/6 questions, Pro=15 sessions/8 audio/12 questions; canonical `plans.ts` is Free=3/8, Pro=30/15/15). Constants are **server-authoritative** and not client-supplied; security invariants (Free audio=0, Pro audio finite `<1000`, global ceiling clamps) still hold. Prior report did not run/disclose this suite. **Fix recommended:** update test constants to match `plans.ts`. |
| G-2 | `npm run lint` → **9 errors** | **MISSING_ARTIFACT** (not a vuln) | All cosmetic: 8× `react/no-unescaped-entities`, 1× `setState-in-effect`. No security impact. Prior report claimed suites pass without noting lint failure. |
| G-3 | `npm run release:gate` → **NOT READY** | **NEEDS_DEEPER_TEST** | One release-**blocking** item: **IL-17 known gap (b)** — non-atomic `priorRetryCount` check allows a retry-bypass race when simultaneously retrying *different* questions in the *same completed* session. Severity LOW (impact ≤ one extra retry/session; Free users still capped by session limit). Deferred in code. Prior report's "GO" did not mention this open blocker. |
| G-4 | Migration `025` (drop 6-param `interview_reserve_usage` overload) not applied to live DB | **NEEDS_DEEPER_TEST** | Code workaround (always passes `p_max_concurrent: null`) protects against PostgREST ambiguity; orphaned overload remains in live DB. Non-blocking but should be applied. |
| G-5 | Health endpoint lacked commit/build parity signal | **FIXED THIS REVIEW** | Extended `/api/health` to return `commit` + `environment` (non-secret) for deployment-parity checks. |

## Net assessment of prior report
The prior report's **security conclusions are accurate and reproducible** (all 17 attack claims re-verified EVIDENCE_STRONG). Its weakness is **completeness of disclosure**: it issued an unqualified "GO" while `release:gate` is NOT READY (G-3), and it did not surface two suites with failing assertions (G-1 test drift, G-2 lint). None of the undisclosed gaps is a CRITICAL/HIGH product vulnerability.
