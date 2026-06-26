# Steel-Mode Security Review — Scope

**Date:** 2026-06-26
**Branch:** `security/review-2026-06-26` (base commit `231f800`)
**Operator:** App owner (authorized, defensive review of own application)
**Method:** Source review + live adversarial testing against a **production build** (`NODE_ENV=production npm run build && npm run start`) on `http://localhost:3000`, plus direct DB/RPC inspection of Supabase project `yogwhfrjhcbnvoxitcay`.

## Mandate
Do **not** rubber-stamp `security/REVIEW_2026-06-26_REPORT.md`. Every PASS must carry: test name, target, attacker role, method, expected vs actual result, the command/script, evidence location, and the environment it ran in. Re-verify the specific claims the prior report made — especially the atomic rate-limit RPC and the Gemini Live token ownership/voice-mode checks.

## In scope
- Local Showcase app at `/Users/kumardyutit/Showcase/casefile`
- Supabase project `yogwhfrjhcbnvoxitcay` (owner test accounts only)
- Stripe **test mode only**
- Gemini / OpenAI within configured test flows and budget
- Vercel deployment owned by this app (parity verification only)

## Out of scope / prohibited
- Attacking any unrelated domain
- Real (live-mode) payment charges
- Spamming real emails
- Destructive actions against real user data
- Printing full secret values anywhere (only names / shapes / presence)
- Deploying the full app to `casefile-ten.vercel.app` (waitlist-only per owner policy)

## Environment of record
- Node production server, `NODE_ENV=production`, prod `next build` artifacts in `.next/`
- Health endpoint live: `{"status":"ok"}`, DB reachable
- Production CSP confirmed live: `script-src 'self' 'unsafe-inline' https://js.stripe.com` (no `unsafe-eval`)

## Deliverables
- `security/STEEL_MODE_SCOPE.md` (this file)
- `security/STEEL_MODE_GAP_ANALYSIS.md` — per-claim classification of the prior report
- `security/STEEL_MODE_REPORT.md` — full evidence + release decision
- `security/proof-pack/` — README, attack-matrix.json, environment-matrix.md, evidence-index.md, raw logs
- `scripts/security/*.mjs` — new attack scripts (raw HTTP, etc.)
