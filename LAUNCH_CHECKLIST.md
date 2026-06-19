# Launch Checklist

Only unavoidable human actions. Everything else is already done.

## Critical (must do before launch)

- [ ] **Rotate Supabase database password**  
  The database password was exposed in development. Go to Supabase Dashboard → Settings → Database → Reset database password before pointing production traffic at it.

- [ ] **Set all env vars in your deployment environment**  
  Copy from `.env.example`. None of these are in the code. See [DEPLOYMENT.md](./DEPLOYMENT.md).

- [ ] **Apply Supabase migration**  
  ```bash
  supabase link --project-ref yogwhfrjhcbnvoxitcay
  supabase db push
  ```
  Verify RLS is on every table — run the verification SQL in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

- [ ] **Create Stripe product and price**  
  Stripe Dashboard → Products → Create product → Add price: $15/month recurring.  
  Copy the price ID (starts with `price_`) → set as `STRIPE_PRICE_ID_PRO_MONTHLY`.

- [ ] **Create and configure Stripe webhook**  
  See [STRIPE_SETUP.md](./STRIPE_SETUP.md). Add the signing secret as `STRIPE_WEBHOOK_SECRET`.

- [ ] **Deploy to Vercel**  
  See [DEPLOYMENT.md](./DEPLOYMENT.md).

## Verification (must test before announcing)

- [ ] Sign up with a real email → verify email → complete onboarding
- [ ] Paste a resume → run AI analysis → verify results make sense
- [ ] Run a ProofScore audit → verify 11 categories appear
- [ ] Use Stripe test card `4242 4242 4242 4242` → complete checkout → verify Pro status
- [ ] Generate a portfolio with AI (requires Pro)
- [ ] Publish portfolio → visit `/p/your-slug` → verify it loads publicly
- [ ] Open billing portal → cancel subscription → verify downgrade at period end
- [ ] Try to publish as a free user → verify 403 error

## Before announcing to users

- [ ] Read privacy policy — update company name and contact email
- [ ] Read terms of service — update company name and contact email  
- [ ] Confirm you have a refund email address
- [ ] Confirm Supabase Auth redirect URL is set correctly for production domain
- [ ] Test auth callback: `/callback` must work for magic links

## What does NOT need to be done

- Rate limiting: already enforced server-side
- RLS: already in the migration
- Webhook signature verification: already in the webhook handler
- Security headers: already in `next.config.ts`
- Pro gating: already on every AI route and publish endpoint
