import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { weeklyDigestEmail, type DigestData } from '@/lib/email/digest-email'
import { Resend } from 'resend'

export const maxDuration = 60

// Weekly re-engagement digest, run by Vercel Cron. Two independent gates so it can never
// fire accidentally or blast users before you're ready:
//   1. CRON_SECRET — the caller must present it (Vercel Cron sends it automatically).
//   2. EMAILS_ENABLED must be 'true' — otherwise it computes and reports counts but sends
//      nothing. Flip that flag deliberately when you've reviewed a dry run.
// Pass ?dryRun=1 to compute without sending even when emails are enabled.

const FOLLOW_UP_DAYS = 4
const BATCH_LIMIT = 400 // safety cap per run for a controlled launch

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const emailsEnabled = process.env.EMAILS_ENABLED === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://showcase-app-three.vercel.app'
  const resendKey = process.env.RESEND_API_KEY
  const resend = resendKey ? new Resend(resendKey) : null

  const supabase = await createServiceClient()
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, unsubscribe_token')
    .eq('email_digest_enabled', true)
    .not('email', 'is', null)
    .limit(BATCH_LIMIT)

  let considered = 0, withSignal = 0, sent = 0, skippedNoSignal = 0, errors = 0
  const followUpCutoff = new Date(Date.now() - FOLLOW_UP_DAYS * 86400_000).toISOString()

  for (const u of users ?? []) {
    considered++
    try {
      const [{ data: audits }, { data: savedJobs }, { data: evals }] = await Promise.all([
        supabase.from('audits').select('overall_score, created_at').eq('user_id', u.id).order('created_at', { ascending: false }).limit(2),
        supabase.from('saved_jobs').select('status, updated_at').eq('user_id', u.id),
        supabase.from('interview_evaluations').select('readiness_band').eq('user_id', u.id).order('created_at', { ascending: false }).limit(1),
      ])

      const proofScore = audits?.[0]?.overall_score ?? null
      const proofScoreDelta = audits && audits.length >= 2 && typeof audits[0].overall_score === 'number' && typeof audits[1].overall_score === 'number'
        ? audits[0].overall_score - audits[1].overall_score : null
      const jobs = savedJobs ?? []
      const pipelineCount = jobs.filter((j) => ['saved', 'tailoring', 'ready'].includes(j.status)).length
      const followUpCount = jobs.filter((j) => j.status === 'applied' && j.updated_at && j.updated_at < followUpCutoff).length
      const readinessBand = evals?.[0]?.readiness_band
        ? String(evals[0].readiness_band).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null

      const data: DigestData = {
        firstName: u.full_name?.trim().split(' ')[0] ?? null,
        appUrl,
        unsubscribeUrl: `${appUrl}/api/email/unsubscribe?token=${u.unsubscribe_token}`,
        proofScore, proofScoreDelta, pipelineCount, followUpCount, readinessBand,
        newInterviewSince: !!readinessBand,
      }

      const email = weeklyDigestEmail(data)
      if (!email) { skippedNoSignal++; continue }
      withSignal++

      if (!dryRun && emailsEnabled && resend && u.email) {
        await resend.emails.send({
          from: 'Showcase <hello@tryshowcase.ink>',
          to: u.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        })
        sent++
      }
    } catch {
      errors++
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    emailsEnabled,
    considered,
    withSignal,
    skippedNoSignal,
    sent,
    errors,
    note: emailsEnabled ? undefined : 'EMAILS_ENABLED is not "true" — computed only, nothing sent.',
  })
}
