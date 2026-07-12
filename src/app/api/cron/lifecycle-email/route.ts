import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import {
  deriveLifecycleCandidates,
  LIFECYCLE_TEMPLATES,
  type LifecycleFact,
  type LifecyclePortfolio,
  type LifecycleProfile,
} from '@/lib/growth/lifecycle'
import { lifecycleEmail } from '@/lib/email/lifecycle-email'
import { enqueueEmailDeliveries, processEmailDeliveries } from '@/lib/email/outbox'
import { configuredAppUrl } from '@/lib/app-url'

export const maxDuration = 60

const PAGE_SIZE = 500
const SEND_LIMIT = 100

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

async function readPages<T>(loader: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loader(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() - 14 * 86400_000).toISOString()
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const emailsEnabled = process.env.EMAILS_ENABLED === 'true'
    && process.env.LIFECYCLE_EMAILS_ENABLED !== 'false'
  const resendKey = process.env.RESEND_API_KEY
  const postalAddress = process.env.EMAIL_POSTAL_ADDRESS?.trim()
  const supabase = await createServiceClient()

  try {
    const [profileRows, portfolioRows, factRows] = await Promise.all([
      readPages<{ id: string; email: string; full_name: string | null; created_at: string; unsubscribe_token: string | null }>((from, to) =>
        supabase.from('profiles')
          .select('id, email, full_name, created_at, unsubscribe_token')
          .eq('lifecycle_email_enabled', true)
          .not('email', 'is', null)
          .order('id', { ascending: true })
          .range(from, to)
      ),
      readPages<{ id: string; user_id: string; ai_generated_at: string }>((from, to) =>
        supabase.from('portfolios')
          .select('id, user_id, ai_generated_at')
          .not('ai_generated_at', 'is', null)
          .gte('ai_generated_at', cutoff)
          .order('id', { ascending: true })
          .range(from, to)
      ),
      readPages<{ event_name: LifecycleFact['eventName']; user_id: string | null; entity_id: string | null; occurred_at: string }>((from, to) =>
        supabase.from('trusted_events')
          .select('event_name, user_id, entity_id, occurred_at')
          .in('event_name', ['portfolio_preview_viewed', 'portfolio_completed'])
          .gte('occurred_at', cutoff)
          .order('id', { ascending: true })
          .range(from, to)
      ),
    ])

    const profiles: LifecycleProfile[] = profileRows.map((row) => ({
      id: row.id, email: row.email, fullName: row.full_name, createdAt: row.created_at,
    }))
    const portfolios: LifecyclePortfolio[] = portfolioRows.map((row) => ({
      id: row.id, userId: row.user_id, generatedAt: row.ai_generated_at,
    }))
    const facts: LifecycleFact[] = factRows.map((row) => ({
      eventName: row.event_name, userId: row.user_id, entityId: row.entity_id, occurredAt: row.occurred_at,
    }))
    const candidates = deriveLifecycleCandidates({ now, profiles, portfolios, facts })
    const unsubscribeTokenByUser = new Map(profileRows.map((profile) => [profile.id, profile.unsubscribe_token]))

    let delivery = { attempted: 0, sent: 0, failed: 0 }
    const canSend = !dryRun && emailsEnabled && Boolean(resendKey) && Boolean(postalAddress)
    if (canSend) {
      const appUrl = configuredAppUrl()
      await enqueueEmailDeliveries(supabase, candidates.flatMap((candidate) => {
        const unsubscribeToken = unsubscribeTokenByUser.get(candidate.userId)
        if (!unsubscribeToken) return []
        const email = lifecycleEmail({
          template: candidate.template,
          firstName: candidate.firstName,
          appUrl,
          unsubscribeUrl: `${appUrl}/api/email/unsubscribe?kind=lifecycle&token=${encodeURIComponent(unsubscribeToken)}`,
          portfolioId: candidate.portfolioId,
          postalAddress: postalAddress!,
        })
        return [{
          idempotencyKey: candidate.idempotencyKey,
          userId: candidate.userId,
          recipientEmail: candidate.email,
          template: candidate.template,
          subject: email.subject,
          html: email.html,
          text: email.text,
          scheduledAt: candidate.dueAt,
          metadata: { portfolio_id: candidate.portfolioId },
        }]
      }))
      delivery = await processEmailDeliveries({
        supabase,
        resend: new Resend(resendKey!),
        from: process.env.RESEND_FROM_EMAIL ?? 'Showcase <hello@tryshowcase.ink>',
        templates: [...LIFECYCLE_TEMPLATES],
        limit: SEND_LIMIT,
      })
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      emailsEnabled,
      providerConfigured: Boolean(resendKey),
      consideredProfiles: profiles.length,
      eligible: candidates.length,
      byTemplate: Object.fromEntries(LIFECYCLE_TEMPLATES.map((template) => [
        template, candidates.filter((candidate) => candidate.template === template).length,
      ])),
      delivery,
      note: canSend ? undefined : 'Computed only; delivery requires EMAILS_ENABLED=true, a Resend key, EMAIL_POSTAL_ADDRESS, and a non-dry run.',
    })
  } catch (error) {
    console.error('[cron/lifecycle-email]', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Lifecycle email run failed' }, { status: 500 })
  }
}
