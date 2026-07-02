import 'server-only'
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set')
}

// Deliberately not shaped like a real Stripe key (no sk_test_/sk_live_ prefix) so secret
// scanners (gitleaks, etc.) never flag this fallback as a possible leaked credential.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'STRIPE_NOT_CONFIGURED', {
  apiVersion: '2026-05-27.dahlia',
  typescript: true,
})

export async function requireProUser(userId: string): Promise<boolean> {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = await createServiceClient()

  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .single()

  if (!data) return false

  const now = new Date()
  const periodEnd = data.current_period_end ? new Date(data.current_period_end) : null

  return data.status === 'active' || data.status === 'trialing'
    ? !periodEnd || periodEnd > now
    : false
}

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = await createServiceClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (sub?.stripe_customer_id) {
    // Verify the customer still exists in the current Stripe mode (test vs live IDs differ)
    try {
      await stripe.customers.retrieve(sub.stripe_customer_id)
      return sub.stripe_customer_id
    } catch {
      // Customer doesn't exist in this mode (e.g. test-mode ID used with live key) — fall through to create
    }
  }

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { supabase_user_id: userId },
  })

  await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_customer_id: customer.id,
      status: 'none',
    })

  return customer.id
}
