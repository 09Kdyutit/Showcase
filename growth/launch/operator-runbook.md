# Showcase launch operator runbook

This is the order of operations for a paced, zero-paid-ad launch. Code can prepare the
system; the founder must still apply migrations, configure providers, run paid-provider
smoke tests, approve content, and decide when to open each real capacity dial.

The approved scope is the Showcase web application only. The closed beta serves
English-speaking users worldwide with US-focused marketing; do not add a US-only gate or
native/mobile-store work to this runbook.

## 1. Ship dark

1. Keep `LAUNCH_OPEN=false`, email delivery disabled, waitlist invites paused, and Founding
   reservations paused.
2. Run `npm run test:local-supabase` against the disposable local stack. Before production,
   verify a database-plus-Storage backup and restore drill, reconcile the already-present
   `20260710033033`–`20260710033037` schema history, and require a dry-run showing only
   `20260710033038`–`20260710033047` pending. Never use a blind production `supabase db push`.
3. Deploy the application with every variable documented in `.env.example`.
4. Verify all new routes return expected auth failures before enabling any provider:
   Stripe webhook, Resend inbound/events, cron routes, Founding availability, and ProofScore.

## 2. Configure provider boundaries

- Stripe: create monthly `$15`, annual `$150`, and Founding `$99` recurring prices. Register
  `checkout.session.completed`, `checkout.session.expired`,
  `customer.subscription.created`, `.updated`, `.deleted`, and `invoice.payment_failed`.
- Resend: point inbound mail at `/api/email/inbound`; point delivery, bounce, and complaint
  events at `/api/email/events`. Use separate signing secrets. The confirmed support,
  privacy, and inbound reply address is `hello@tryshowcase.ink`; the weekly scorecard goes
  to `kumar.dyutit09@gmail.com`. `EMAIL_POSTAL_ADDRESS` is unresolved, so keep
  `EMAILS_ENABLED=false` and `LIFECYCLE_EMAILS_ENABLED=false` until a valid physical
  postal address is configured and every delivery/suppression smoke test passes.
- Vercel: set `CRON_SECRET`. The hourly lifecycle cron requires a paid/commercially suitable
  Vercel plan; Hobby only permits once-daily cron schedules.
- OpenAI: re-check the dated prices in `OPENAI_COST_RATES_JSON`, set a finite
  `AI_GLOBAL_DAILY_LIMIT` consistent with the approved **$5/day and $100/month** operating
  budget, configure the atomic general allocation at **$4/day and $80/month**, and keep
  `KILL_SWITCH_GEMINI=true` plus `INTERVIEW_KILL_SWITCH=true` until every Google path in the
  remaining **$1/day and $20/month** allocation is atomic and concurrency-tested. Keep the
  legacy Supabase Edge proxy's `INTERVIEW_LIVE_PROXY_ENABLED` secret unset/false as a second
  boundary. A request count is not a dollar budget; keep it as a separate abuse boundary
  and use provider budget controls as the second boundary.

The production `live-interview-ws` URL still answered as a deployed WebSocket function on
2026-07-09. Before launch, either remove its `GEMINI_API_KEY` secret or deploy this hardened
revision and leave `INTERVIEW_LIVE_PROXY_ENABLED` unset/false. A Vercel switch cannot disable
an independently deployed Supabase Edge Function.

## 3. Run the release gates

```bash
npm run test:launch-offline
npm run verify
npm run release:gate
```

The no-secret local database/browser proof is:

```bash
npm run test:local-supabase
```

Run provider tests that need credentials locally with Showcase test-mode Stripe keys. If a
separate cloud staging project is added later, `staging:preflight` remains available and
refuses production links, project-ref/URL mismatches, live Stripe mode, or unpaused launch
switches.

Do not run the automated Stripe checkout test against live keys. After test mode passes, perform one
small refundable live-mode transaction and verify webhook, entitlement, cancellation,
automatic unpublish, and refund operations end to end.

## 4. Enable in this order

1. Set `EMAILS_ENABLED=true` only after `EMAIL_POSTAL_ADDRESS` is resolved, dry-running
   lifecycle and scorecard routes, and sending one message to the founder.
2. Set `LIFECYCLE_EMAILS_ENABLED=true` after unsubscribe, bounce, and complaint suppression
   are verified in production.
3. Unpause the **10-spot Founding offer at $99/year** only after Stripe test-mode
   verification passes and the price and webhook events are live. The count must come from
   `/api/stripe/founding-availability`.
4. Keep invites paused until the full onboarding path passes. Start with exactly 10/day, never
   above the support and AI-cost ceiling shown by `npm run growth:status`.
5. Set `LAUNCH_OPEN=true` only when Gate 1 is met. The waitlist and ProofScore stay public
   while it is false, so traffic can arrive without granting product access.

## 5. Operate the first 30 days

- Monday: read the weekly scorecard; update the phase gates using trusted events.
- Daily: run `npm run growth:status`; inspect AI cost, queue length, invite sends, free-tool
  capacity, email failures, and Founding holds before changing a dial.
- Content: X `@Showcase_app1` is the only approved social channel. Approve real-evidence
  X rows in `growth/distribution/content-queue.json`, export them, and save Buffer imports
  as drafts before scheduling. The helpers reject non-X rows while no LinkedIn account/page
  exists.
- Partners: generate one five-organization review packet with `npm run growth:partners`.
  The founder must approve all five drafts before any submission. After approval, submit one
  personalized public form per organization; no scraped addresses or member lists and no
  agent-sent unreviewed outreach.
- Reddit/community: manual value-first participation only. Never automate comments or DMs.

## 6. Emergency controls

- AI cost/error spike: `KILL_SWITCH_AI=true`; set invite dial to `0` and pause invites.
- Checkout incident: `KILL_SWITCH_CHECKOUT=true`; existing subscribers retain access.
- Publication abuse: `KILL_SWITCH_PUBLISHING=true`; unpublishing remains available.
- Core-loop P0 or parse success below 90%: pause invites; keep waitlist intake open.
- Email complaint/bounce spike: `EMAILS_ENABLED=false`; suppression records remain intact.

Never launch paid ads, Product Hunt, or broad PR until the measured gates in
`growth/beta/phase-gate.md` are met. Traffic is not the goal; completed, retained, paid
portfolios at a controlled cost are.
