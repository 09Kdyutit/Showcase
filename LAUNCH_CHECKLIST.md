# Launch Checklist

For the detailed, continuously updated release-readiness tracking, see
`security/release-gate.json` and run `npm run release:gate` — those are the
source of truth. `security/EXECUTION_MANIFEST.md` is a dated historical record.
This file is the short human-readable version.

**Status as of 2026-07-10:** the authorized paired database/application rollout is
complete and remains dark. Production has the exact 48-record application ledger through
`20260710033047`; clean revision `f968af8b5b25167364f841b82b685af2cc39e236`
is live on `app.tryshowcase.ink`, `/api/health` reports a healthy database, and the root
redirects to `/waitlist`. Invites and Founding reservations remain paused at 10, while
email, AI, Gemini, checkout, jobs-provider calls, publishing, and Interview AI remain
disabled by explicit production controls.

**Production observations, 2026-07-10:** fresh pre-migration backup
`20260710T180210Z` restore-verified 2,008 rows and all 22 private Storage objects. The
history-only repair was limited to `033`–`037`, the pinned dry-run showed exactly
`038`–`047`, all 67 pre-existing object row counts remained unchanged, and negative
Stripe/Resend/cron probes failed closed. Machine-readable proof is in
`security/production-rollout-evidence.json`. This is a healthy closed-beta deployment,
not approval for a broad public launch.

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

- [ ] **Rotate every credential ever pasted into a chat/terminal session**
  (Stripe keys, Supabase service-role key, DB password) in the Stripe and
  Supabase dashboards. The owner confirmed the earlier keys were rotated, but the Resend
  API key was later exposed in a private diagnostic log and must still be revoked and
  replaced locally and in `showcase-app` before email or launch is enabled. The production
  database password also appeared in a private CLI dry-run log during this maintenance
  window; rotate it now that the migration is complete, then update Keychain and every
  operational `DATABASE_URL` without printing the replacement.

- [x] **Create and restore-verify a production database-plus-Storage backup.**
  Historical backup `20260710T152940Z` remains preserved, and fresh pre-migration backup
  `20260710T180210Z` contains one exported logical database snapshot plus all 22 private
  Storage objects. Its authenticated encrypted archives, 2,008-row inventory, normalized
  catalog, migration ledgers, file hashes, signup trigger on `auth.users`, and all nine
  application policies on `storage.objects` passed a network-disconnected disposable
  restore. The target and volumes were destroyed and no plaintext remains. Supabase Free
  still has no automated physical backup or PITR.

- [ ] **Complete the remaining production configuration.** Twenty-six fail-closed values
  were written and read back before the promoted build. The only required names still
  absent are `EMAIL_POSTAL_ADDRESS`, `RESEND_DELIVERY_WEBHOOK_SECRET`, and
  `STRIPE_PRICE_ID_FOUNDING_ANNUAL`. Keep `LAUNCH_OPEN=false`; do not enable email,
  checkout, or Founding until those real provider values and their end-to-end tests exist.

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

- [x] **Reset a clean local Supabase stack through
  `20260710033047_explicit_data_api_grants.sql` and run the no-secret credentialed suite.**
  The canonical 48-record reset and 380/380 credentialed assertions pass.
- [x] **Authorize and execute the paired application/database promotion.** The approved
  2026-07-10 window used clean, CI-verified revision `f968af8b5b25`, staged it unaliased,
  restore-verified a fresh backup, repaired only equivalent history `033`–`037`, required
  the pinned dry-run to show exactly `038`–`047`, and applied that batch. Read-only checks
  confirmed 48/latest `047`, unchanged row counts for all pre-existing objects, paused
  controls, and every RLS/ACL/index/constraint/trigger/data invariant. The staged build was
  then promoted without rebuild and passed only negative/read-only production probes.
  Preserve this sequence for future paired migrations; never run mutating credentialed
  suites against production.

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
