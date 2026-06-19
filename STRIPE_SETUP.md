# Stripe Setup

## 1. Create account

[stripe.com](https://stripe.com). Use test mode during development.

## 2. Create product and price

Stripe Dashboard → Products → Add product:

- Name: `Showcase Pro`
- Pricing: Recurring, $15/month
- Copy the price ID (starts with `price_`) → `STRIPE_PRICE_ID_PRO_MONTHLY`

## 3. Get API keys

Stripe Dashboard → Developers → API keys:

| Key | Env var | Notes |
|-----|---------|-------|
| Publishable key | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public, safe to expose |
| Secret key | `STRIPE_SECRET_KEY` | **Secret — never expose** |

## 4. Set up webhook

### Development (local testing)

Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This outputs a webhook signing secret like `whsec_...`. Set as `STRIPE_WEBHOOK_SECRET`.

### Production

Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **Endpoint URL**: `https://your-domain.com/api/stripe/webhook`
- **Events to listen for**:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `checkout.session.completed`

Copy the signing secret → `STRIPE_WEBHOOK_SECRET` in your deployment environment.

## 5. Test cards

| Card number | What it tests |
|-------------|---------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 9995` | Card declined |
| `4000 0025 0000 3155` | 3D Secure required |

Use any future expiry date and any 3-digit CVC.

## 6. Test the full flow locally

```bash
# Terminal 1: Run app
npm run dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

1. Log in → billing page → Upgrade to Pro
2. Use test card `4242 4242 4242 4242`
3. Check terminal 2 for webhook events
4. Verify `subscriptions` table in Supabase has `status = 'active'`
5. Verify dashboard shows "Pro" badge

## 7. Customer portal

The customer portal is configured automatically. Users go to `/billing` → Manage subscription → Stripe portal.

To customize the portal (cancel flow, etc.): Stripe Dashboard → Settings → Customer portal.

## What NOT to do

- Never log the `STRIPE_SECRET_KEY`
- Never pass `STRIPE_SECRET_KEY` to the frontend
- Never trust subscription status from the frontend — always verify server-side
- Never skip webhook signature verification
