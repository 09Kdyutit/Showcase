# Showcase Security Review — Scope & Rules of Engagement

**Date:** 2026-06-26
**Reviewer:** Autonomous ethical security team (authorized, owner's own app)
**Target:** Showcase (dir: `/Users/kumardyutit/Showcase/casefile`), Next.js 16 / Tailwind v4 / Supabase / Stripe / OpenAI / Gemini

## Authorized scope
- Local app source at `/Users/kumardyutit/Showcase/casefile`
- Supabase project `yogwhfrjhcbnvoxitcay` (LIVE — test accounts only, no destructive ops)
- Stripe TEST MODE only (test cards only, no real charges)
- Gemini/OpenAI within controlled budget + configured test flows only
- Vercel deployment owned by this app (`casefile-ten.vercel.app` is waitlist-only — never deploy full app there without asking)

## Prohibited
- Attacking unrelated domains
- Real payment charges
- Spamming emails
- Leaking/printing secrets (describe locations, never print values)
- Destructive attacks on real users / production data
- Bypassing provider terms

## Methodology (16 phases)
0. Scope doc (this file)
1. Baseline: build, typecheck, inventory routes + RLS + secrets handling
2. AuthN/AuthZ: session, ownership scoping, IDOR
3. Payment integrity: Pro bypass, webhook spoof/replay, quota forgery
4. Rate limit / quota: parallel-call races, forged tier
5. RLS / data isolation: cross-user reads via API + direct DB
6. File storage: cross-user file access, upload abuse
7. AI token issuance: Gemini live-token scoping
8. Secret exposure in client bundles
9. Prompt injection / AI overriding deterministic controls
10. Webhook spoofing (Stripe)
11. CSRF / origin checks
12. Security headers / CSP
13. Input validation / XSS / SSRF
14. Kill switches / cost controls
15. Regression tests added + run
16. Report + commit

## Severity scale
CRITICAL (payment/data-isolation break, RCE) > HIGH (auth bypass, cross-user) > MEDIUM (info leak, weak control) > LOW (hardening) > INFO.

## Decision gate
Release-eligible for controlled beta only if zero open CRITICAL and zero open HIGH affecting payment integrity or cross-user data isolation.
