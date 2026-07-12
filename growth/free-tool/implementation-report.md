# Public ProofScore + completion referral — implementation report

> **HISTORICAL IMPLEMENTATION RECORD — NOT CURRENT PRODUCT OR DEPLOYMENT AUTHORITY.**
> The anonymous public ProofScore tool, reservation flow, and `/proofscore` acquisition funnel
> described below were subsequently removed under the founder's 2026-07-11 decision. Preserve
> this report as an audit trail; do not use its deployment checklist, public-route description,
> copy, or design sources to restore or market the retired flow. Authenticated in-product
> ProofScore feedback is a separate capability.

**Implemented:** 2026-07-09
**Public route:** `/proofscore`
**Design sources:** `growth/free-tool/spec.md`, `.agents/marketing/02-proofscore-lead-magnet.md`, `.agents/marketing/03-referral-program.md`

## Delivered behavior

- Mobile-first, no-account resume paste flow with an optional target role.
- One extraction call using the existing truth-constrained resume parser. The model extracts structure only; `lib/proofscore/engine.ts` deterministically calculates every number.
- Overall score plus numeric scores for all 11 real engine categories.
- The two lowest categories include evidence, explanation, a complete fix, and a bracketed truth-safe draft. The other nine fixes are not returned in the API payload.
- A sanitized parse and original pasted text are stashed server-side for at most 48 hours. The anonymous token is stored as `showcase_parse_token`, which the existing onboarding claim flow consumes without another parse.
- Anonymous acquisition events include view, start, completion, cap hit, reservation, and signup click. Metadata is allowlisted and contains no resume text, name, or email; existing UTM capture remains active.

## Real capacity and reservation contract

Migration `20260710033040_proofscore_public_capacity.sql` adds a service-only capacity ledger and one-use reservations:

- Three attempts per IP fingerprint per rolling hour, enforced before provider spend.
- Up to twenty-five provider-backed public audit attempts per UTC day (failed provider attempts still consume capacity so the spend bound remains real).
- When today is full, a consenting visitor may request one transactional email for one slot tomorrow.
- Tomorrow's reservations are subtracted before general traffic is admitted. General traffic can never consume a held slot.
- Reservation and capacity claims share a Postgres advisory lock, preventing concurrent over-allocation.
- A reservation token can be claimed once and only on its reserved UTC date.
- Reservation email rows are deleted opportunistically after their audit day.
- Accounting fails closed: a database accounting outage returns 503 instead of silently allowing unbounded AI calls.
- Actual anonymous token usage is sent to `recordPromptCost({ userId: null, meta })`; missing cost-rate configuration skips guessed cost rather than creating an inaccurate ledger row.

## Referral activation

- The first completed portfolio generation opens one editable invite dialog, once per referral code/browser.
- Copy and native share actions occur only after an explicit user click. Nothing is posted or sent automatically.
- The dialog states the real payout order: the friend receives 5 consumable AI credits on referral claim; the referrer receives 5 only after the friend's first portfolio completes.
- Settings copy now matches the three-slot, consumable-credit completion program.

## Verification

- `npm run test:public-proofscore` — 23 assertions covering deterministic output, 11 numeric scores, two-fix gating, PII omission, referral URL/message construction, reserve-before-spend ordering, anonymous cost recording, capacity locking, reservation priority, one-use enforcement, and email-row expiry.
- `npm run test:proofscore` — existing engine suite, 13 assertions.
- Targeted ESLint — clean for every added/edited ProofScore and referral file.
- Production `npm run build` — passed after implementation.
- In-app browser visual QA could not run because this session exposed no in-app browser/tab. The page still completed Next.js compilation, static generation, and TypeScript checks during the successful production build.

## Deployment checklist

1. Apply migrations through `20260710033040_proofscore_public_capacity.sql` in canonical filename order before deploying the route.
2. Confirm `OPENAI_API_KEY`, `RESEND_API_KEY`, Supabase service-role credentials, and `NEXT_PUBLIC_APP_URL` are present.
3. Configure `OPENAI_COST_RATES_JSON` with a versioned rate for the parser model if cost-ledger coverage is required; the app intentionally does not guess missing prices.
4. Optionally set `PROOFSCORE_IP_HASH_SALT`; otherwise the server derives a private salt from its service credential.
5. Verify the `hello@tryshowcase.ink` sending domain and run one real cap-reservation delivery test in the deployment environment.
