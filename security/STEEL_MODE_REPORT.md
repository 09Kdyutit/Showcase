# Showcase — Steel-Mode Security Report

**Date:** 2026-06-26
**Branch:** `security/review-2026-06-26` (base `231f800`)
**Scope:** `/Users/kumardyutit/Showcase/casefile`, Supabase `yogwhfrjhcbnvoxitcay` (test accounts), Stripe test mode.
**Method:** Source review + live adversarial testing against a **production build** (`NODE_ENV=production next build` + `next start` on `http://localhost:3000`). Every PASS below was executed against that running server or against the live DB/RPC, not merely read. Mandate: re-verify the prior report, do not rubber-stamp.

---

## 1. RELEASE DECISION

**CONDITIONAL GO for controlled production beta — with one honest correction to the prior report.**

- Open **CRITICAL: 0**, open **HIGH: 0** — confirmed by live re-testing, not inheritance.
- **However, `npm run release:gate` reports NOT READY** due to one release-**blocking** LOW item (IL-17 retry-race, deferred in code) plus non-blocking open items. The prior report's unqualified "GO" did not disclose this. The correct posture is: GO for beta is defensible on **security** grounds, but the operator must consciously accept the IL-17 LOW deferral and the open gate items below before shipping.

## 2. WHAT CHANGED FROM THE PRIOR REVIEW
- `src/app/api/health/route.ts` — added non-secret `commit` + `environment` fields for source/deployed parity verification (Phase 4).
- `scripts/security/raw-http-attacks.mjs` — new raw HTTP attack suite (Phase 6), 10/10.
- `package.json` — added `test:raw-http` and `test:steel-security` aggregate runner (Phase 19).
- `security/STEEL_MODE_*.md`, `security/steel-rls-verification.sql`, `security/proof-pack/*` — evidence artifacts.

## 3. KEY QUESTIONS — DIRECT ANSWERS

| Question | Answer | Evidence |
|---|---|---|
| Can a user become Pro by sending `isPro=true`/`plan=pro` in the body? | **No.** No route reads `isPro/plan/tier/user_id/quota/priceId/customer` from the body. `isProUser()` is a server-side `subscriptions` lookup. | `STEEL_MODE_GAP_ANALYSIS.md` row 1; `rate-limit.ts:119` |
| Can a user read another user's interview transcript by guessing the session ID? | **No.** `test:interview-rls` 24/24, `test:interview-authorization` 16/16; every session query is `.eq('user_id', user.id)`. | `logs/interview-*.log` |
| Does the Gemini Live token endpoint validate session ownership and voice mode? | **Yes.** Ownership `.eq('user_id', user.id)` → 404 cross-user; `delivery_mode !== 'voice'` → 409; status gate; `isProUser` → 403; kill-switch → 403. Returns only `{model, systemInstruction}` — real key never sent to browser. | `live-token/route.ts:28-71` |
| Can a user bypass the atomic rate limit with 10 concurrent requests? | **No.** `test:abuse` live: 10 concurrent → exactly 5 pass (5×200, 5×429). RPC is a single `INSERT … ON CONFLICT DO UPDATE … RETURNING` checking the post-increment count. | `logs/abuse.log`; migration 011 |
| Does the production build contain key-shaped strings in `.next/static`? | **No.** grep for `sk_`, `service_role`, JWT `eyJ`, `AIza`, `whsec_`, `postgres://creds` → 0 matches. gitleaks clean (101 commits). | `logs/secrets.log` |
| Does the webhook endpoint accept invalid signatures? | **No.** Forged sig → 400, missing sig → 400, before any DB write. | `logs/raw-http-attacks.log`; `webhook/route.ts` |
| Can User A access User B's files via storage? | **No.** `test:uploads` 8/8; storage RLS; deletion purges storage. | `logs/uploads.log` |
| Any route that accepts `user_id` in the body and uses it unverified? | **No.** grep audit: 0 such routes; inserts use `user_id: user.id`. | gap analysis row 1 |

## 4. ATTACKS EXECUTED (all BLOCKED / WORKING)
See `security/proof-pack/attack-matrix.json` (A01–A19) for the full matrix with attacker role, method, expected vs actual, and evidence path. Headline live counts on the prod server:

`test:rls` 13/13 · `test:authorization` 15/15 · `test:abuse` 3/3 · `test:csrf` 6/6 · `test:stripe` 6/6 · `test:uploads` 8/8 · `test:prompt-injection` 15/15 · `test:headers (EXPECT_PROD)` 13/13 · `test:deletion` 13/13 · `test:interview-rls` 24/24 · `test:interview-authorization` 16/16 · `test:interview-deletion` 10/10 · `test:kill-switches` 4/4 · `raw-http-attacks` 10/10 · gitleaks: no leaks · prod-bundle secret scan: 0 matches.

## 5. FINDINGS (this review)

### STEEL-2026-0626-01 — `release:gate` NOT READY undisclosed by prior report (MEDIUM — process/integrity)
- The prior report issued an unqualified "GO" while `npm run release:gate` returns **NOT READY** with one release-blocking item (IL-17). This is a disclosure gap, not a product vuln. **Remediation:** either resolve IL-17 or explicitly record operator acceptance of the LOW deferral in the release record.

### STEEL-2026-0626-02 — IL-17 retry-race (LOW — confirmed deferred)
- Non-atomic `priorRetryCount` check allows a retry bypass when simultaneously retrying *different* questions in the *same completed* session. Impact ≤ one extra retry per session; Free users remain capped by their session limit. **Remediation:** per-session-scoped atomic RPC (analogous to `interview_reserve_usage` but counting by `session_id`). Deferred — acceptable for beta.

### STEEL-2026-0626-03 — migration 025 not applied to live DB (INFO — non-blocking)
- The 6-param `interview_reserve_usage` overload remains in the live DB; code workaround (`p_max_concurrent: null`) fully disambiguates PostgREST. **Remediation:** `supabase db push` migration 025. See `steel-rls-verification.sql` query 5.

### STEEL-2026-0626-04 — `test:interview-entitlements` 5 failing assertions are stale (INFO — test drift)
- Test asserts old plan numbers (Free 2/6, Pro 15/8/12); canonical `plans.ts` is Free 3/8, Pro 30/15/15. Constants are server-authoritative; security invariants hold (Free audio = 0; Pro audio finite; global ceiling clamps). **Remediation:** update test constants to match `plans.ts`.

### STEEL-2026-0626-05 — `npm run lint` 9 cosmetic errors (INFO)
- 8× `react/no-unescaped-entities`, 1× `setState-in-effect`. No security impact. **Remediation:** auto-fixable entities; the effect warning is a render-quality nit.

## 6. NOTABLE DESIGN TRADEOFFS (accepted, documented)
- **Rate limiter fails OPEN** on DB/RPC error (`postgres.ts`, `rate-limit.ts`) — availability over strictness. Combined with the global daily AI ceiling, aggregate spend is still bounded, but a sustained RPC outage would not throttle per-user quota. Operators should alert on `[rate-limit] check failed, failing open`.
- **Waitlist invite tokens use `Math.random()`** (prior SEC-0626-04) — low-value beta gate; auth and share/report tokens use CSPRNG. Accepted for beta.

## 7. CONCLUSION
The prior report's **security conclusions are accurate and reproducible** — all 17 attack claims re-verified EVIDENCE_STRONG against a live production build. The prior report's weakness was **completeness**: it should have disclosed the NOT-READY release gate and the two suites with failing (non-security) assertions. No CRITICAL or HIGH product vulnerability was found in this Steel-Mode pass. Security posture supports a controlled beta once the operator consciously accepts the IL-17 LOW deferral and applies migration 025.
