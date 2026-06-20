# Launch Checklist

For the detailed, continuously-updated release-readiness tracking, see
`security/EXECUTION_MANIFEST.md` and run `npm run release:gate` — that's the
source of truth. This file is the short human-readable version.

**Status as of 2026-06-19:** Stripe product/price creation, webhook signature
verification, RLS, rate limiting, and security headers are done and verified
(see manifest). What's left is genuinely unavoidable human action.

## Critical (must do before launch)

- [ ] **Rotate every credential ever pasted into a chat/terminal session**
  (Stripe keys, Supabase service-role key, DB password) in the Stripe and
  Supabase dashboards. This is P0-05 in the manifest — flagged, not yet done.

- [ ] **Upgrade the Supabase project off the Free tier.** Confirmed directly
  against the project this session: Free tier has **zero automated backups and
  zero point-in-time recovery**. See `security/BACKUP_RESTORE.md` for the full
  finding and what tier to pick. Do not launch with real customer/payment data
  on a database with no backup coverage.

- [ ] **Set all env vars in your deployment environment**, including
  `LAUNCH_OPEN=true` and `OPENAI_API_KEY` (not `AI_API_KEY` — the app uses
  OpenAI, not Anthropic). Copy from `.env.example`. See [DEPLOYMENT.md](./DEPLOYMENT.md).

- [ ] **Deploy to a real launch target — NOT the existing Vercel project.**
  The Vercel project already linked in this repo (`casefile-ten.vercel.app`)
  is reserved for the waitlist landing page only, per explicit instruction.
  Launch needs its own separate deployment target.

- [ ] **Register the production Stripe webhook** against the real launch
  domain once it exists. See [STRIPE_SETUP.md](./STRIPE_SETUP.md). Add the
  signing secret as `STRIPE_WEBHOOK_SECRET`, and confirm `npm run test:stripe`
  still passes against it.

- [ ] **Apply all Supabase migrations to the production project** (currently
  011 total):
  ```bash
  supabase link --project-ref yogwhfrjhcbnvoxitcay
  supabase db push
  ```
  Verify RLS is on every table — run the verification SQL in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## Verification (must test before announcing)

- [ ] Sign up with a real email → verify email → complete onboarding
- [ ] Paste a resume → run AI analysis → verify results make sense
- [ ] Run a ProofScore audit → verify 11 categories appear
- [ ] Use Stripe test card `4242 4242 4242 4242` → complete checkout → verify Pro status
- [ ] Generate a portfolio with AI (requires Pro)
- [ ] Publish portfolio → visit `/p/your-slug` → verify it loads publicly
- [ ] Open billing portal → cancel subscription → verify downgrade at period end
- [ ] Try to publish as a free user → verify 403 error
- [ ] Delete a test account → confirm it can no longer log in
- [ ] Run a real Stripe **live-mode** transaction once (small/refundable) before
  announcing — everything to date has only been verified against test-mode keys

## Before announcing to users

- [ ] Read privacy policy — update company name and contact email
- [ ] Read terms of service — update company name and contact email  
- [ ] Confirm you have a refund email address
- [ ] Confirm Supabase Auth redirect URL is set correctly for production domain
- [ ] Test auth callback: `/callback` must work for magic links

## What does NOT need to be done (verified this session, see manifest for evidence)

- Rate limiting: Postgres-backed, atomic, proven under real concurrent load (`test:abuse`)
- RLS: cross-user isolation proven via real adversarial two-account tests (`test:rls`)
- API ownership checks: all 21 routes audited, zero gaps (`test:authorization`)
- Webhook signature verification + idempotency + out-of-order protection (`test:stripe`)
- CSRF/Origin enforcement on all state-changing API routes (`test:csrf`)
- Security headers, including CSP without `unsafe-eval` (`test:headers`)
- Account deletion, cascading correctly across all tables + storage (`test:deletion`)
- Pro gating: already on every AI route and publish endpoint
- Secret scanning: gitleaks clean (`test:secrets`)

## Still genuinely open (not yet done, not blocking on external access)

- No CI workflow yet — run `npm run verify && npm run release:gate` manually before each deploy
- No error monitoring (Sentry or equivalent) wired up
- No health-check/kill-switch endpoints
- No accessibility or cross-device visual QA pass
