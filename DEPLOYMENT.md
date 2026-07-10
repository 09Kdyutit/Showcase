# Deployment

> **Production project: `showcase-app` (canonical app domain `https://app.tryshowcase.ink`;
> Vercel fallback `https://showcase-app-three.vercel.app`).**
> This is the single production project. `.vercel/project.json` is linked to it.
> Showcase is a web application only; native app/store deployment is outside product scope.
>
> **Legacy backup deployment — do not use for beta traffic:** the Vercel project
> `showcase` (`https://casefile-ten.vercel.app`) is a pre-consolidation backup.
> Do not deploy to it, copy production secrets into it, or point Supabase auth
> or Stripe webhooks at it.

## Deploying to Vercel (recommended)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial Showcase deployment"
git remote add origin https://github.com/your-org/showcase
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select your repo
3. Framework: Next.js (auto-detected)
4. Root directory: `.` (default)

### 3. Set environment variables in Vercel

In Vercel project settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=         # From Supabase project settings → API
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # Anon key from Supabase
SUPABASE_SERVICE_ROLE_KEY=        # Service role key — keep secret
DATABASE_URL=                     # Direct Postgres URL for migration/operational tooling
STRIPE_SECRET_KEY=                # From Stripe dashboard → API keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=   # Stripe publishable key
STRIPE_WEBHOOK_SECRET=            # From Stripe webhook settings (see below)
STRIPE_PRICE_ID_PRO_MONTHLY=      # Price ID for your Pro monthly plan
STRIPE_PRICE_ID_PRO_ANNUAL=       # Price ID for your Pro annual plan
STRIPE_PRICE_ID_FOUNDING_ANNUAL=  # Separate $99/year recurring Founding price
OPENAI_API_KEY=                   # OpenAI API key — the app uses the OpenAI SDK, not Anthropic
OPENAI_COST_RATES_JSON=           # Versioned rates; copy and re-verify .env.example
OPENAI_GENERAL_DAILY_BUDGET_USD=4
OPENAI_GENERAL_MONTHLY_BUDGET_USD=80
AI_GLOBAL_DAILY_LIMIT=            # Derive request count from the $5/day, $100/month budget
INTERVIEW_GLOBAL_DAILY_BUDGET_USD=1
INTERVIEW_GLOBAL_MONTHLY_BUDGET_USD=20
INTERVIEW_KILL_SWITCH=true        # Keep Interview Lab off until its budget path is atomic
KILL_SWITCH_AI=true               # Dark rollout: enable only after production smoke tests
KILL_SWITCH_GEMINI=true            # Fail closed until all Google spend is atomic
KILL_SWITCH_CHECKOUT=true
KILL_SWITCH_JOBS_PROVIDER=true
KILL_SWITCH_PUBLISHING=true
NEXT_PUBLIC_APP_URL=              # Your production URL (e.g. https://app.tryshowcase.ink)
ERROR_WEBHOOK_URL=                # Optional JSON error-alert sink; logs work without it
CRON_SECRET=                      # Long random value; Vercel sends it as Bearer auth
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=            # /api/email/inbound
INBOUND_FORWARD_TO=hello@tryshowcase.ink
RESEND_DELIVERY_WEBHOOK_SECRET=   # /api/email/events
UNSUBSCRIBE_SIGNING_SECRET=       # Long HMAC secret for confirmation forms
RESEND_FROM_EMAIL=
EMAIL_POSTAL_ADDRESS=             # UNRESOLVED: valid physical sender address required
EMAILS_ENABLED=false              # Do not enable while EMAIL_POSTAL_ADDRESS is unresolved
LIFECYCLE_EMAILS_ENABLED=false
GROWTH_SCORECARD_EMAIL=kumar.dyutit09@gmail.com
PROOFSCORE_IP_HASH_SALT=
LAUNCH_OPEN=false                 # Closed beta; admitted users retain access
                                   # Set to "true" only after the beta exit gate to lift
                                   # waitlist admission for everyone.
FOUNDER_NAME="Kumar Dyutit"

# Optional — distributed rate limiting (falls back to a Postgres-backed atomic
# counter if omitted; see src/lib/rate-limit/. Not required for correctness, only
# for lower latency at high traffic.)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Confirmed public identity: legal/business name `Showcase`, support and privacy email
`hello@tryshowcase.ink`. The market is English-speaking worldwide with US-focused
marketing; deployment must not introduce a US-only gate.

The Founding offer is capped at 10 spots at $99/year and must stay unavailable until its
Stripe test-mode checkout, webhook, reservation, expiry, and 11th-attempt refusal pass.

The dollar budget is an operating decision, not automatically enforced by
`AI_GLOBAL_DAILY_LIMIT`, which counts requests. Re-check `OPENAI_COST_RATES_JSON`, derive
a conservative request ceiling from the most expensive allowed path, and configure the
provider account limit/alerts so both $5/day and $100/month are respected.

`DATABASE_URL` is required for migration and operational tooling, but the running web app
uses Supabase client libraries rather than opening a direct Postgres connection. Keep the
URL server-only and out of browser-exposed variables.

### 4. Set up Stripe webhook

After deploy, get your production URL. In Stripe Dashboard → Webhooks → Add endpoint:

- **URL**: `https://your-domain.com/api/stripe/webhook`
- **Events to listen**:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `checkout.session.completed`
  - `checkout.session.expired`

Copy the webhook signing secret → paste into `STRIPE_WEBHOOK_SECRET` in Vercel.

Redeploy after adding the webhook secret.

### 5. Apply Supabase migrations safely

```bash
npm run test:local-supabase:safety
npm run test:local-supabase
```

The approved no-cost path uses the pinned, disposable local Supabase stack rather than a
second cloud project. It applies the complete canonical repository history in filename
order, from `001_initial_schema.sql` through
`20260710033047_explicit_data_api_grants.sql`, runs credentialed/adversarial tests without
provider secrets, and cleans up its synthetic data. A separate cloud staging project may be
added later, but it is not required for the current closed-beta path.

Historical backup `20260710T152940Z` remains preserved. Fresh pre-migration backup
`20260710T180210Z` also passed authenticated database-plus-Storage restore verification:
67 database objects, 2,008 rows, the normalized public catalog, all three migration
ledgers, the Auth signup trigger, nine Storage policies, and all 22 private Storage file
hashes matched in a network-disconnected disposable target. The target was destroyed and
no plaintext remains.

The authorized 2026-07-10 paired rollout is complete. Production now has the canonical
48-record application ledger through `20260710033047`, and clean revision
`f968af8b5b25167364f841b82b685af2cc39e236` is live on canonical `showcase-app`.
Invites and Founding reservations remain paused, the root redirects to `/waitlist`, and
all provider/cost controls remain fail-closed. Exact proof lives in
`security/production-rollout-evidence.json`.

For future authority-boundary migrations, reuse the completed sequence:

1. Configure every required production variable in its fail-closed state. Vercel variable
   changes do not change the already-running deployment.
2. Build the reviewed compatible revision for the canonical `showcase-app` project without
   changing its domain alias: `vercel deploy --prod --skip-domain`.
3. Enter the explicitly authorized maintenance window. Repair migration history only when
   a restored-data rehearsal proves the canonical SQL is already equivalent; do not execute
   equivalent SQL again.
4. Require the pinned `supabase db push --dry-run` to show exactly the reviewed pending
   files. Stop if it asks for `--include-all`, shows any unexpected migration, or differs
   from the approved list.
5. Apply the ten migrations and verify ledgers, row-count invariants, RLS, ACLs, triggers,
   constraints, indexes, admission, attribution, referral state, and paused controls using
   read-only SQL.
6. Immediately promote the prepared compatible deployment, then run negative/read-only
   route probes and `/api/health` checks.

Never point the credentialed database/browser suites at production. `npm run growth:status`
and the Founding-availability endpoint can expire reservation rows, so neither is a
read-only smoke test. Do not enable invites, Founding reservations, email, AI, checkout,
jobs-provider calls, or publishing until the matching schema/application deployment and
their separately authorized end-to-end tests pass.

### 5b. Configure Resend webhooks and Vercel cron

- Inbound/reply events: `https://your-domain.com/api/email/inbound`
- Delivery events (`email.delivered`, `email.bounced`, `email.complained`):
  `https://your-domain.com/api/email/events`
- `vercel.json` registers invite, lifecycle, daily data retention, interview retention,
  digest, and scorecard jobs. The closed beta uses once-daily schedules so it remains
  deployable on Vercel Hobby without another bill. Upgrade to a commercially suitable plan
  before increasing either cleanup or lifecycle delivery above Hobby's daily limit.

Verify RLS is active — see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

### 6. Pre-deploy verification (run locally before pushing)

```bash
npm run verify           # 60 checks: RLS, banned phrases, key exposure, webhook signature presence
npm run release:gate     # fails closed on any unmet release-blocking requirement
npm run test:secrets     # gitleaks scan
```

See `security/EXECUTION_MANIFEST.md` for the full release-readiness checklist and
`security/release-gate.json` for the machine-readable source of truth.

### 7. Test in production

- [ ] Sign up → verify email → complete onboarding
- [ ] Paste a resume → analyze
- [ ] Run a ProofScore audit
- [ ] Go to billing → click Upgrade → complete checkout with test card `4242 4242 4242 4242`
- [ ] Verify Pro subscription appears in dashboard
- [ ] Generate portfolio with AI (Pro)
- [ ] Publish portfolio → visit public URL
- [ ] Cancel subscription via billing portal → verify access removed after period end
- [ ] Delete a test account → confirm it can no longer log in (real account-deletion flow)
- [ ] Confirm `curl -I https://your-domain.com` shows the expected security headers
      (Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, etc.)

## Environment-specific behavior

| Behavior | Development | Production |
|----------|-------------|------------|
| AI API missing | Mock mode (sample data) | Error shown to user |
| Stripe missing | Warning in console | Error on billing page |
| Mock mode | `OPENAI_API_KEY` not set | Always uses real AI |

## Custom domain

1. In Vercel project → Domains → Add domain
2. Point DNS to Vercel nameservers or add CNAME/A record
3. Update `NEXT_PUBLIC_APP_URL` to match your domain
4. Update Stripe checkout `success_url` if needed (it reads from `NEXT_PUBLIC_APP_URL`)

## Supabase Auth redirect URL

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/callback`
