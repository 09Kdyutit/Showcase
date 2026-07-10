# Launch Checklist

For the detailed, continuously-updated release-readiness tracking, see
`security/EXECUTION_MANIFEST.md` and run `npm run release:gate` — that's the
source of truth. This file is the short human-readable version.

**Status as of 2026-07-09:** the paced-growth, ProofScore, lifecycle, referral,
Founding Member, and launch-security changes are implemented locally. Migrations
035–046, new provider webhooks, cron schedules, and production smoke tests are not
assumed live until a human applies and verifies them.

**Read-only production check, 2026-07-09:** `app.tryshowcase.ink` and `/api/health`
return 200, but `npm run growth:status` reports that `growth_controls` does not exist,
and the new retention and Founding routes return 404. The current production variable
list is also missing the Founding price, cost-rate/AI ceiling, delivery-webhook,
unsubscribe, postal-address, ProofScore salt, scorecard, and email-control settings.
This is an existing healthy app—not yet the reviewed growth release.

## Confirmed launch parameters

- **Scope:** web application only. Native iOS/Android apps and mobile-store distribution
  are not part of this release.
- **Identity:** Showcase; public founder Kumar Dyutit; support/privacy and inbound replies
  at `hello@tryshowcase.ink`; weekly scorecard to `kumar.dyutit09@gmail.com`.
- **Market:** English-speaking worldwide, with US-focused marketing and no US-only gate.
- **Pacing:** closed beta, starting at exactly 10 waitlist invites per day.
- **Cost ceiling:** AI operating budget of **$5/day and $100/month**. Convert this dollar
  ceiling into the finite request limit only after verifying the configured model rates.
- **Founding offer:** 10 spots at $99/year, enabled only after Stripe test-mode
  verification passes.
- **Distribution:** X `@Showcase_app1` through Buffer drafts; no LinkedIn channel.
  The first five partner drafts require founder approval before any submission.
- **Email blocker:** `EMAIL_POSTAL_ADDRESS` is unresolved. Keep
  `EMAILS_ENABLED=false` and `LIFECYCLE_EMAILS_ENABLED=false` until a valid physical
  postal address and the full delivery/suppression checks are complete.

## Critical (must do before launch)

- [x] **Rotate every credential ever pasted into a chat/terminal session**
  (Stripe keys, Supabase service-role key, DB password) in the Stripe and
  Supabase dashboards. Confirmed done by the account owner (P0-05 PASS).

- [ ] **Upgrade the Supabase project off the Free tier.** Confirmed directly
  against the project this session: Free tier has **zero automated backups and
  zero point-in-time recovery**. See `security/BACKUP_RESTORE.md` for the full
  finding and what tier to pick. Do not launch with real customer/payment data
  on a database with no backup coverage.

- [ ] **Set every new env var in the deployment environment**, including
  `LAUNCH_OPEN=false` for closed beta and `OPENAI_API_KEY` (not `AI_API_KEY` — the app uses
  OpenAI, not Anthropic), the three Stripe Price IDs, both Resend webhook secrets,
  cron/email controls, versioned AI cost rates, and a ProofScore IP salt. Reconcile
  production against `.env.example`; prior configuration predates this growth pass.
  Set `LAUNCH_OPEN=true` only after the beta exit gate is met.

- [x] **Use the real launch target — `showcase-app`
  (`https://app.tryshowcase.ink`), not the legacy project.**
  `casefile-ten.vercel.app` (Vercel project `showcase`) is a legacy backup
  deployment — do not deploy to it, point auth/webhooks at it, or use it for
  beta traffic. `showcase-app` is the single production project going
  forward; the local repo's `.vercel/project.json` is linked to it.

- [ ] **Update the production Stripe webhook** against
  `https://app.tryshowcase.ink/api/stripe/webhook`. Endpoint
  `we_1TkEgnRrWPEIfq2Mh8VT0W2r` is enabled with all 6 required events
  `checkout.session.completed`, `checkout.session.expired`,
  `customer.subscription.{created,updated,deleted}`, and `invoice.payment_failed`.
  Re-verify the signing secret after the new deployment.

- [ ] **Create clean staging and apply migrations 001–046 in numeric order.** A blank
  project needs the complete dependency chain. Then reconcile the production migration
  ledger with its already-present schema before promoting reviewed migrations 035–046;
  never run a blind production `supabase db push`. The new migrations include
  authority triggers, atomic Stripe state, paced invites, attribution, email
  suppression, public ProofScore capacity, Founding Member reservations, and
  completion-earned referral admission, high-entropy claim tokens, and consumable credits.

- [ ] **Configure Resend webhooks and cron delivery.** Inbound mail uses
  `/api/email/inbound`; delivered/bounced/complained events use `/api/email/events`.
  Dry-run lifecycle and scorecard routes before setting `EMAILS_ENABLED=true`.

## Verification (must test before announcing)

- [ ] Sign up with a real email → verify email → complete onboarding
- [ ] Paste a resume → run AI analysis → verify results make sense
- [ ] Run a ProofScore audit → verify 11 categories appear
- [ ] Use Stripe test card `4242 4242 4242 4242` → complete checkout → verify Pro status
- [ ] Generate the first portfolio on Free; verify regeneration requires Pro
- [ ] Publish portfolio → visit `/p/your-slug` → verify it loads publicly
- [ ] Open billing portal → cancel subscription → verify downgrade at period end
- [ ] Try to publish as a free user → verify the honest preview paywall and 403 authority boundary
- [ ] Complete a Founding checkout in Stripe test mode → verify a real slot activates and the 11th concurrent reservation is refused
- [ ] Expire/cancel a Founding checkout → verify its temporary hold releases but an active slot never regresses
- [ ] Send to Resend's safe `bounced@resend.dev` and `complained@resend.dev` test
  addresses → verify signed webhook suppression across lifecycle, waitlist, invite, and
  ProofScore emails
- [ ] Delete a test account → confirm it can no longer log in
- [ ] Run a real Stripe **live-mode** transaction once (small/refundable) before
  announcing — everything to date has only been verified against test-mode keys

## Before announcing to users

- [ ] Verify privacy policy displays `Showcase` and `hello@tryshowcase.ink`
- [ ] Verify terms of service displays `Showcase` and `hello@tryshowcase.ink`
- [ ] Verify the public founder name is `Kumar Dyutit` wherever a founder name appears
- [ ] Resolve `EMAIL_POSTAL_ADDRESS`; outgoing commercial/lifecycle email stays disabled
  until this is done
- [ ] Verify inbound replies reach `hello@tryshowcase.ink` and weekly scorecards reach
  `kumar.dyutit09@gmail.com`
- [ ] Confirm Supabase Auth redirect URL is set correctly for production domain
- [ ] Test auth callback: `/callback` must work for magic links

## What does NOT need to be done (verified this session, see manifest for evidence)

- Rate limiting: Postgres-backed, atomic, proven under real concurrent load (`test:abuse`)
- RLS: cross-user isolation proven via real adversarial two-account tests (`test:rls`)
- API ownership checks: all 21 routes audited, zero gaps (`test:authorization`)
- Webhook signature verification, retry claims, and atomic out-of-order protection are implemented locally (`test:stripe`); production verification is still required
- CSRF/Origin enforcement on all state-changing API routes (`test:csrf`)
- Security headers, including CSP without `unsafe-eval` (`test:headers`)
- Account deletion, cascading correctly across all tables + storage (`test:deletion`)
- Pro publishing authority and higher-limit gating are enforced server-side; the first portfolio generation and one full daily ProofScore remain Free by design
- Secret scanning: gitleaks clean (`test:secrets`)

## Still genuinely open (requires production/external verification)

- Connect the existing GitHub Actions release workflow to the production repository and add its test secrets.
- Set `ERROR_WEBHOOK_URL` (or connect a dedicated error-monitoring sink) and an uptime monitor to `/api/health`.
- Run the existing accessibility suite plus real cross-device visual QA against the deployed build.
