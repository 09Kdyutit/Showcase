import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { absoluteUrl } from '@/lib/utils'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: absoluteUrl('/billing'),
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const stripeErr = err as { type?: string; code?: string; message?: string }
    if (stripeErr?.code === 'resource_missing' || stripeErr?.message?.includes('No such customer')) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }
    console.error('[create-portal-session]', err)
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 })
  }
}
