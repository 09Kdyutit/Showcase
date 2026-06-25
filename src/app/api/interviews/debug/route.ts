import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isInterviewAnalysisEnabled, isInterviewLabRuntimeEnabled, isGeminiPaidProjectConfirmed, isGeminiInterviewEnabled, isGeminiTermsCompatibilityConfirmed, isInterviewKillSwitchActive } from '@/lib/interviews/config'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    flags: {
      GEMINI_PAID_PROJECT_CONFIRMED: process.env.GEMINI_PAID_PROJECT_CONFIRMED,
      GEMINI_INTERVIEW_ENABLED: process.env.GEMINI_INTERVIEW_ENABLED,
      GEMINI_TERMS_COMPATIBILITY_CONFIRMED: process.env.GEMINI_TERMS_COMPATIBILITY_CONFIRMED,
      INTERVIEW_KILL_SWITCH: process.env.INTERVIEW_KILL_SWITCH,
      INTERVIEW_ANALYSIS_ENABLED: process.env.INTERVIEW_ANALYSIS_ENABLED,
      GEMINI_API_KEY_SET: !!process.env.GEMINI_API_KEY,
    },
    computed: {
      isGeminiPaidProjectConfirmed: isGeminiPaidProjectConfirmed(),
      isGeminiInterviewEnabled: isGeminiInterviewEnabled(),
      isGeminiTermsCompatibilityConfirmed: isGeminiTermsCompatibilityConfirmed(),
      isInterviewKillSwitchActive: isInterviewKillSwitchActive(),
      isInterviewLabRuntimeEnabled: isInterviewLabRuntimeEnabled(),
      isInterviewAnalysisEnabled: isInterviewAnalysisEnabled(),
    },
  })
}
