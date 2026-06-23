import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('interview_profiles')
      .select('raw_audio_retention_enabled, transcript_retention_days')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      data: data ?? { raw_audio_retention_enabled: false, transcript_retention_days: 30 },
    })
  } catch (err) {
    console.error('[interviews/profile GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load interview profile.' }, { status: 500 })
  }
}
