import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInterviewMinimumAge } from '@/lib/interviews/config'
import { z } from 'zod'

const CURRENT_TERMS_VERSION = '2026-06-23'

const confirmSchema = z.object({
  ageEligibilityConfirmed: z.literal(true),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('interview_profiles')
      .select('age_eligibility_confirmed, age_confirmed_at, terms_version_confirmed, raw_audio_retention_enabled, transcript_retention_days')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      data: data ?? {
        age_eligibility_confirmed: false, age_confirmed_at: null, terms_version_confirmed: null,
        raw_audio_retention_enabled: false, transcript_retention_days: 30,
      },
      minimumAge: getInterviewMinimumAge(),
    })
  } catch (err) {
    console.error('[interviews/profile GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load interview profile.' }, { status: 500 })
  }
}

/**
 * Records ONLY age-eligibility confirmation + a timestamp + the terms version shown —
 * never a date of birth (mission: "do not store date of birth unless absolutely
 * necessary"). The request schema only accepts the literal `true`; there is no way to
 * submit "confirmed: false" through this endpoint because un-confirming isn't a thing
 * a client should ever need to do (a user under 18 simply never confirms).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'ageEligibilityConfirmed must be true' }, { status: 400 })
    }

    const { error } = await supabase
      .from('interview_profiles')
      .upsert({
        user_id: user.id,
        age_eligibility_confirmed: true,
        age_confirmed_at: new Date().toISOString(),
        terms_version_confirmed: CURRENT_TERMS_VERSION,
      }, { onConflict: 'user_id' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[interviews/profile POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to confirm eligibility. Please try again.' }, { status: 500 })
  }
}
