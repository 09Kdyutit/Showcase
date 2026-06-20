# Deployment

> **Do not reuse the existing Vercel project linked in `.vercel/project.json`
> (`casefile-ten.vercel.app`).** It is reserved for the waitlist landing page only
> per explicit instruction. A real launch needs its own, separate Vercel project
> (or other host) — get that decision from the project owner before deploying.

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
STRIPE_SECRET_KEY=                # From Stripe dashboard → API keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=   # Stripe publishable key
STRIPE_WEBHOOK_SECRET=            # From Stripe webhook settings (see below)
STRIPE_PRICE_ID_PRO_MONTHLY=      # Price ID for your Pro monthly plan
STRIPE_PRICE_ID_PRO_ANNUAL=       # Price ID for your Pro annual plan
OPENAI_API_KEY=                   # OpenAI API key — the app uses the OpenAI SDK, not Anthropic
NEXT_PUBLIC_APP_URL=              # Your production URL (e.g. https://showcase.app)
LAUNCH_OPEN=                      # MUST be set to the literal string "true" to lift the
                                   # pre-launch lockdown — without it, every route except
                                   # /waitlist and the legal pages redirects to /waitlist.
                                   # This is almost certainly NOT what you want on a real
                                   # launch deploy; only omit it for a waitlist-only deploy.

# Optional — distributed rate limiting (falls back to a Postgres-backed atomic
# counter if omitted; see src/lib/rate-limit/. Not required for correctness, only
# for lower latency at high traffic.)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Do NOT include `DATABASE_URL` unless you're using Supabase's direct connection for something — the app uses Supabase JS client only.

### 4. Set up Stripe webhook

After deploy, get your production URL. In Stripe Dashboard → Webhooks → Add endpoint:

- **URL**: `https://your-domain.com/api/stripe/webhook`
- **Events to listen**:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `checkout.session.completed`

Copy the webhook signing secret → paste into `STRIPE_WEBHOOK_SECRET` in Vercel.

Redeploy after adding the webhook secret.

### 5. Apply Supabase migration

```bash
supabase login
supabase link --project-ref yogwhfrjhcbnvoxitcay
supabase db push
```

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
| Mock mode | `AI_API_KEY` not set | Always uses real AI |

## Custom domain

1. In Vercel project → Domains → Add domain
2. Point DNS to Vercel nameservers or add CNAME/A record
3. Update `NEXT_PUBLIC_APP_URL` to match your domain
4. Update Stripe checkout `success_url` if needed (it reads from `NEXT_PUBLIC_APP_URL`)

## Supabase Auth redirect URL

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/callback`
