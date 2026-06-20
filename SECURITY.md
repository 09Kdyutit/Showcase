# Security

This document covers the security model for Showcase.

## What is protected

### Authentication
- All `/dashboard`, `/builder`, `/audit`, `/resume`, `/settings`, `/billing`, `/onboarding` routes require authentication
- Authentication is handled server-side in `src/proxy.ts` using Supabase SSR sessions
- Auth tokens are stored in cookies, not localStorage

### Subscription gating
- **All** Pro-gated features are checked server-side using the `isProUser()` function from `src/lib/ai/rate-limit.ts`
- This checks the `subscriptions` table directly — the frontend cannot bypass it
- Never trust subscription state passed from the client

### AI route security
- Every AI route (`/api/ai/*`) checks authentication before any processing
- Rate limits enforced server-side per user per 24-hour window:
  - Free tier: 3 resume analyses, 1 audit, 5 bullet improvements, 2 role matches per day
  - Pro tier: 25 analyses, 10 audits, 50 improvements, 20 role matches per day
- Input length validated with Zod (max 15,000 chars for resume text)
- AI generation (portfolio) requires active Pro subscription

### Portfolio publish
- Publish/unpublish goes through `/api/portfolio/publish` — server-side Pro check
- Free users cannot publish portfolios — even if they call the API directly
- Public portfolio pages (`/p/[slug]`) only return `status = 'published'` rows

### Stripe
- Checkout sessions created server-side
- Customer portal sessions created server-side
- Webhook signature verified with `stripe.webhooks.constructEvent()` before any processing
- Subscription status only updated from verified webhook events — never from frontend

### Database
- Row Level Security (RLS) enabled on every table
- Each table has policies that restrict access to the authenticated user's own rows
- Public portfolios readable by anyone, but only when `status = 'published'`
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) only used in:
  - `src/app/api/stripe/webhook/route.ts` (webhook handler)
  - `src/lib/ai/rate-limit.ts` (rate limit checks use service client to bypass RLS for counting)
  - `src/lib/supabase/server.ts` (createServiceClient, only imported server-side)

### Security headers
- `X-Frame-Options: SAMEORIGIN` (prevents clickjacking)
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy` (restricts script/connect sources)
- `Referrer-Policy: strict-origin-when-cross-origin`

## What to audit before production

- [ ] Rotate Supabase database password (it may have been exposed in development)
- [ ] Verify all env vars are set in your deployment environment — none hardcoded
- [ ] Verify `.env.local` is in `.gitignore` (it is: `.env*` is already listed)
- [ ] Run `supabase db push` with the current migration and verify RLS is active
- [ ] Test Stripe webhook with `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- [ ] Confirm Pro-gating works: log in as free user, attempt AI generation, expect 403
- [ ] Confirm rate limiting works: exhaust free quota, expect 429
- [ ] Confirm public portfolio only shows published portfolios

## Secrets management

**Never put these in frontend code or version control:**
- `SUPABASE_SERVICE_ROLE_KEY` — gives full database access, bypasses RLS
- `DATABASE_URL` — direct Postgres connection string
- `STRIPE_SECRET_KEY` — can charge customers
- `STRIPE_WEBHOOK_SECRET` — used to verify webhook authenticity
- `OPENAI_API_KEY` — OpenAI API key, costs money per request

**Safe to expose in frontend:**
- `NEXT_PUBLIC_SUPABASE_URL` — public Supabase URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — anon/publishable key (RLS enforced on it)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key
- `NEXT_PUBLIC_APP_URL` — your deployment URL

## Reporting a vulnerability

If you find a security issue, do not open a public GitHub issue. Contact the maintainer directly.
