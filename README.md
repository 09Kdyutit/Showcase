# Showcase

AI portfolio builder and career-readiness analyzer. Turns resumes, projects, and work history into professional proof-of-work portfolios with a ProofScore that shows exactly where you stand.

## What it does

- Parses resumes with AI to extract skills, experience, weak bullets, and missing proof
- Generates structured case study portfolios targeting specific roles
- Runs ProofScore audits across 11 categories with specific, actionable fixes
- Publishes professional public portfolios at `/p/your-name`
- Stripe-gated Pro tier ($15/month) for AI generation, full audits, and public publishing

## Tech stack

- **Next.js 16** (App Router, Proxy/middleware, async params)
- **Supabase** (Auth, Postgres, Storage, RLS on every table)
- **Stripe** (Subscriptions, webhooks, customer portal)
- **Anthropic Claude** (AI parsing, generation, auditing)
- **Tailwind CSS v4** (CSS-based config, `@theme` tokens)
- **Radix UI** (Accessible primitives)

## Quick start

### 1. Clone and install

```bash
git clone <your-repo>
cd casefile
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in your keys — see SUPABASE_SETUP.md, STRIPE_SETUP.md, AI_SETUP.md
```

### 3. Apply Supabase migration

```bash
supabase login
supabase link --project-ref yogwhfrjhcbnvoxitcay
supabase db push
```

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for full setup including storage buckets and RLS verification.

### 4. Run locally

```bash
npm run dev
```

App runs at `http://localhost:3000`. If `AI_API_KEY` is not set, the app runs in **mock mode** — AI routes return sample data so you can develop without burning API credits.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint |

## Project structure

```
src/
  app/
    (app)/          # Authenticated pages (dashboard, builder, audit, resume, settings, billing)
    (auth)/         # Auth pages (login, signup, callback)
    api/
      ai/           # AI routes (analyze-resume, audit-portfolio, generate-portfolio, etc.)
      stripe/       # Stripe routes (checkout, portal, webhook)
      portfolio/    # Portfolio management (save, publish)
    p/[slug]/       # Public portfolio pages
    page.tsx        # Landing page
  components/
    ui/             # Base UI components (Button, Badge, ProofScoreRing, etc.)
    shared/         # Navbar, Footer
    dashboard/      # Sidebar
  lib/
    ai/             # AI client, prompts, rate limiter
    stripe/         # Stripe client, subscription helpers
    supabase/       # Server + browser Supabase clients
  types/            # TypeScript types for all DB tables
supabase/
  migrations/       # SQL migrations (run these in order)
```

## Security

See [SECURITY.md](./SECURITY.md). Key guarantees:

- AI routes rate-limited server-side (free: 3 analyses/day, pro: 25/day)
- Subscription status verified server-side on every Pro-gated action
- Portfolio publish gated server-side — not trusted from frontend
- Stripe webhook signatures verified before any state change
- RLS enabled on every Supabase table
- Service role key never used in browser code
- No secrets hardcoded — everything via env vars

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md).

## Before going live

See [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md). Critical: rotate the Supabase database password before production.

## Legal

Showcase does not guarantee employment, interviews, salary, or hiring outcomes. The ProofScore is an AI-powered analysis tool, not a prediction of recruiter decisions.
