import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { weeklyDigestEmail, type DigestData } from '@/lib/email/digest-email'
import { enqueueEmailDeliveries, processEmailDeliveries, type EmailDeliveryInput } from '@/lib/email/outbox'
import { completedUtcWeek } from '@/lib/growth/scorecard'
import { configuredAppUrl } from '@/lib/app-url'

export const maxDuration = 60

const FOLLOW_UP_DAYS = 4
const BATCH_LIMIT = 400
const PAGE_SIZE = 100
const SEND_LIMIT = 100

interface DigestProfile {
  id: string
  email: string
  full_name: string | null
  unsubscribe_token: string
}
async function readProfiles(supabase: Awaited<ReturnType<typeof createServiceClient>>): Promise<DigestProfile[]> {
  const profiles: DigestProfile[] = []
  for (let from = 0; from < BATCH_LIMIT; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE - 1, BATCH_LIMIT - 1)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, unsubscribe_token')
      .eq('email_digest_enabled', true)
      .not('email', 'is', null)
      .not('unsubscribe_token', 'is', null)
      .order('id', { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    profiles.push(...((data ?? []) as DigestProfile[]))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }
  return profiles
}

async function buildDelivery(input: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>
  user: DigestProfile
  appUrl: string
  followUpCutoff: string
  weekKey: string
  postalAddress: string
}): Promise<{ delivery: EmailDeliveryInput | null; error: boolean }> {
  const { supabase, user, appUrl, followUpCutoff, weekKey, postalAddress } = input
  try {
    const [auditResult, jobsResult, evalResult] = await Promise.all([
      supabase.from('audits').select('overall_score, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(2),
      supabase.from('saved_jobs').select('status, updated_at').eq('user_id', user.id),
      supabase.from('interview_evaluations').select('readiness_band').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    ])
    const queryError = auditResult.error ?? jobsResult.error ?? evalResult.error
    if (queryError) throw new Error(queryError.message)

    const audits = auditResult.data ?? []
    const jobs = jobsResult.data ?? []
    const readinessBand = evalResult.data?.[0]?.readiness_band
      ? String(evalResult.data[0].readiness_band).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
      : null
    const proofScore = audits[0]?.overall_score ?? null
    const proofScoreDelta = audits.length >= 2
      && typeof audits[0].overall_score === 'number'
      && typeof audits[1].overall_score === 'number'
      ? audits[0].overall_score - audits[1].overall_score
      : null
    const data: DigestData = {
      firstName: user.full_name?.trim().split(/\s+/)[0] ?? null,
      appUrl,
      unsubscribeUrl: `${appUrl}/api/email/unsubscribe?kind=digest&token=${encodeURIComponent(user.unsubscribe_token)}`,
      proofScore,
      proofScoreDelta,
      pipelineCount: jobs.filter((job) => ['saved', 'tailoring', 'ready'].includes(job.status)).length,
      followUpCount: jobs.filter((job) => job.status === 'applied' && job.updated_at && job.updated_at < followUpCutoff).length,
      readinessBand,
      newInterviewSince: Boolean(readinessBand),
      postalAddress,
    }
    const email = weeklyDigestEmail(data)
    if (!email) return { delivery: null, error: false }
    return {
      error: false,
      delivery: {
        idempotencyKey: `weekly_digest_${weekKey}_${user.id}`,
        userId: user.id,
        recipientEmail: user.email,
        template: 'weekly_digest',
        subject: email.subject,
        html: email.html,
        text: email.text,
        metadata: { week: weekKey },
      },
    }
  } catch {
    return { delivery: null, error: true }
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const emailsEnabled = process.env.EMAILS_ENABLED === 'true'
  const resendKey = process.env.RESEND_API_KEY
  const postalAddress = process.env.EMAIL_POSTAL_ADDRESS?.trim()
  const appUrl = configuredAppUrl()
  const followUpCutoff = new Date(Date.now() - FOLLOW_UP_DAYS * 86400_000).toISOString()
  const weekKey = completedUtcWeek(new Date()).key
  const supabase = await createServiceClient()

  try {
    const users = await readProfiles(supabase)
    const results: Array<{ delivery: EmailDeliveryInput | null; error: boolean }> = []
    for (let index = 0; index < users.length; index += 10) {
      results.push(...await Promise.all(users.slice(index, index + 10).map((user) =>
        buildDelivery({ supabase, user, appUrl, followUpCutoff, weekKey, postalAddress: postalAddress ?? '' })
      )))
    }
    const deliveries = results.flatMap((result) => result.delivery ? [result.delivery] : [])
    const errors = results.filter((result) => result.error).length
    const canSend = !dryRun && emailsEnabled && Boolean(resendKey) && Boolean(postalAddress)
    let delivery = { attempted: 0, sent: 0, failed: 0 }
    if (canSend && resendKey) {
      await enqueueEmailDeliveries(supabase, deliveries)
      delivery = await processEmailDeliveries({
        supabase,
        resend: new Resend(resendKey),
        from: process.env.RESEND_FROM_EMAIL ?? 'Showcase <hello@tryshowcase.ink>',
        templates: ['weekly_digest'],
        limit: SEND_LIMIT,
      })
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      emailsEnabled,
      providerConfigured: Boolean(resendKey),
      considered: users.length,
      batchCapReached: users.length === BATCH_LIMIT,
      withSignal: deliveries.length,
      skippedNoSignal: results.filter((result) => !result.error && !result.delivery).length,
      errors,
      delivery,
      note: canSend ? undefined : 'Computed only; delivery requires EMAILS_ENABLED=true, a Resend key, EMAIL_POSTAL_ADDRESS, and a non-dry run.',
    })
  } catch (error) {
    console.error('[cron/weekly-digest]', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Weekly digest run failed' }, { status: 500 })
  }
}
