import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isCheckoutEnabled } from '@/lib/feature-flags'

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

interface FoundingAvailability {
  reservations_paused: boolean
  slot_limit: number
  claimed_count: number
  remaining_count: number
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })
  }

  if (!process.env.STRIPE_PRICE_ID_FOUNDING_ANNUAL || !isCheckoutEnabled()) {
    return NextResponse.json(
      { configured: false, available: false, remaining: null },
      { headers: NO_STORE_HEADERS }
    )
  }

  const service = await createServiceClient()
  const { data, error } = await service.rpc('get_founding_member_availability')
  if (error) {
    console.error('[founding-availability]', error.message)
    return NextResponse.json(
      { error: 'Founding Member availability is temporarily unavailable' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  const availability = ((data ?? []) as FoundingAvailability[])[0] ?? null
  if (!availability || availability.reservations_paused) {
    return NextResponse.json(
      { configured: false, available: false, remaining: null },
      { headers: NO_STORE_HEADERS }
    )
  }

  return NextResponse.json(
    {
      configured: true,
      available: availability.remaining_count > 0,
      remaining: availability.remaining_count,
      limit: availability.slot_limit,
    },
    { headers: NO_STORE_HEADERS }
  )
}
