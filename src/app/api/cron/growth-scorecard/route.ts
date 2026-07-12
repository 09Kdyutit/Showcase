import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildGrowthScorecard,
  completedUtcWeek,
  growthScorecardEmail,
  isOrganicFirstTouch,
} from '@/lib/growth/scorecard'
import { enqueueEmailDeliveries, processEmailDeliveries } from '@/lib/email/outbox'

export const maxDuration = 60

const PAGE_SIZE = 500
const DAY = 86400_000
const MEANINGFUL_RETURN_EVENTS = new Set([
  'portfolio_preview_viewed', 'portfolio_completed', 'proofscore_viewed',
  'portfolio_published', 'checkout_completed', 'meaningful_return',
])

interface BudgetRow {
  status: 'reserved' | 'settled' | 'released'
  estimated_cost_nano_usd: number | string
  actual_cost_nano_usd: number | string | null
}

function committedBudgetNanoUsd(row: BudgetRow): number {
  if (row.status === 'released') return 0
  return Number(row.status === 'reserved' ? row.estimated_cost_nano_usd : row.actual_cost_nano_usd ?? 0)
}

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

function between(timestamp: string, start: Date, end: Date): boolean {
  const value = Date.parse(timestamp)
  return value >= start.getTime() && value < end.getTime()
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { start, end, key } = completedUtcWeek(new Date())
  const profileLookback = new Date(start.getTime() - 14 * DAY)
  const eventLookback = new Date(start.getTime() - 7 * DAY)
  const activationStart = new Date(start.getTime() - 3 * DAY)
  const activationEnd = new Date(end.getTime() - 3 * DAY)
  const d7Start = new Date(start.getTime() - 14 * DAY)
  const d7End = new Date(end.getTime() - 14 * DAY)
  const supabase = await createServiceClient()

  try {
    const [attributionRows, claimedAttributionRows, profileRows, referralRows, portfolioRows, eventRows, costRows, emailRows, referralShareRows] = await Promise.all([
      readPages<{ session_id: string; user_id: string | null; first_touch_utm_medium: string | null; first_seen_at: string }>((from, to) =>
        supabase.from('growth_attributions')
          .select('session_id, user_id, first_touch_utm_medium, first_seen_at')
          .gte('first_seen_at', start.toISOString()).lt('first_seen_at', end.toISOString())
          .order('session_id').range(from, to)
      ),
      readPages<{ user_id: string }>((from, to) =>
        supabase.from('growth_attributions')
          .select('user_id')
          .not('user_id', 'is', null)
          .order('session_id').range(from, to)
      ),
      readPages<{ id: string; created_at: string }>((from, to) =>
        supabase.from('profiles').select('id, created_at')
          .gte('created_at', profileLookback.toISOString()).lt('created_at', end.toISOString())
          .order('id').range(from, to)
      ),
      readPages<{ id: string; referral_credited_at: string }>((from, to) =>
        supabase.from('profiles').select('id, referral_credited_at')
          .gte('referral_credited_at', start.toISOString()).lt('referral_credited_at', end.toISOString())
          .order('id').range(from, to)
      ),
      readPages<{ id: string; user_id: string; ai_generated_at: string }>((from, to) =>
        supabase.from('portfolios').select('id, user_id, ai_generated_at')
          .not('ai_generated_at', 'is', null)
          .gte('ai_generated_at', start.toISOString()).lt('ai_generated_at', end.toISOString())
          .order('id').range(from, to)
      ),
      readPages<{ event_name: string; user_id: string | null; entity_id: string | null; occurred_at: string }>((from, to) =>
        supabase.from('trusted_events').select('event_name, user_id, entity_id, occurred_at')
          .gte('occurred_at', eventLookback.toISOString()).lt('occurred_at', end.toISOString())
          .order('id').range(from, to)
      ),
      readPages<BudgetRow>((from, to) =>
        supabase.from('general_ai_budget_reservations')
          .select('status, estimated_cost_nano_usd, actual_cost_nano_usd')
          .gte('reserved_at', start.toISOString()).lt('reserved_at', end.toISOString())
          .order('id').range(from, to)
      ),
      readPages<{ status: string }>((from, to) =>
        supabase.from('email_deliveries').select('status')
          .gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
          .order('id').range(from, to)
      ),
      readPages<{ user_id: string; created_at: string }>((from, to) =>
        supabase.from('usage_events').select('user_id, created_at')
          .eq('event_name', 'referral_invite_shared')
          .gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
          .order('id').range(from, to)
      ),
    ])

    const signups = profileRows.filter((profile) => between(profile.created_at, start, end))
    const signupIds = new Set(signups.map((profile) => profile.id))
    const attributedSignupIds = new Set(
      claimedAttributionRows.filter((row) => signupIds.has(row.user_id)).map((row) => row.user_id)
    )
    const periodEvents = eventRows.filter((event) => between(event.occurred_at, start, end))
    const completedUserIds = new Set(periodEvents
      .filter((event) => event.event_name === 'portfolio_completed' && event.user_id)
      .map((event) => event.user_id as string))
    const paywallUserIds = new Set(periodEvents
      .filter((event) => event.event_name === 'publish_paywall_viewed' && event.user_id)
      .map((event) => event.user_id as string))
    const convertedUserIds = new Set(periodEvents
      .filter((event) => event.event_name === 'checkout_completed' && event.user_id)
      .map((event) => event.user_id as string))
    const activationCohort = profileRows.filter((profile) => between(profile.created_at, activationStart, activationEnd))
    const activatedWithin72h = activationCohort.filter((profile) => {
      const created = Date.parse(profile.created_at)
      return eventRows.some((event) => event.user_id === profile.id
        && event.event_name === 'portfolio_completed'
        && Date.parse(event.occurred_at) >= created
        && Date.parse(event.occurred_at) <= created + 3 * DAY)
    }).length
    const d7Cohort = profileRows.filter((profile) => between(profile.created_at, d7Start, d7End))
    const d7Returns = d7Cohort.filter((profile) => {
      const created = Date.parse(profile.created_at)
      return eventRows.some((event) => event.user_id === profile.id
        && MEANINGFUL_RETURN_EVENTS.has(event.event_name)
        && Date.parse(event.occurred_at) >= created + 7 * DAY
        && Date.parse(event.occurred_at) < created + 14 * DAY)
    }).length

    const scorecard = buildGrowthScorecard({
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      anonymousSessions: attributionRows.length,
      organicSessions: attributionRows.filter((row) => isOrganicFirstTouch(row.first_touch_utm_medium)).length,
      signups: signups.length,
      attributedSignups: attributedSignupIds.size,
      proofscoreViews: periodEvents.filter((event) => event.event_name === 'proofscore_viewed').length,
      generatedPortfolios: portfolioRows.length,
      completedPortfolios: periodEvents.filter((event) => event.event_name === 'portfolio_completed').length,
      completedPortfolioUsers: completedUserIds.size,
      activationCohort: activationCohort.length,
      activatedWithin72h,
      d7Cohort: d7Cohort.length,
      d7MeaningfulReturns: d7Returns,
      proConversions: convertedUserIds.size,
      publishPaywallUsers: paywallUserIds.size,
      publishPaywallConversions: [...paywallUserIds].filter((userId) => convertedUserIds.has(userId)).length,
      referralShares: referralShareRows.length,
      referralSharers: new Set(referralShareRows.map((row) => row.user_id)).size,
      activatedReferrals: referralRows.length,
      aiCostEvents: costRows.filter((row) => row.status !== 'released').length,
      aiCostUsd: Number((costRows.reduce((sum, row) => sum + committedBudgetNanoUsd(row), 0) / 1_000_000_000).toFixed(8)),
      emailSent: emailRows.filter((row) => row.status === 'sent').length,
      emailFailed: emailRows.filter((row) => row.status === 'failed').length,
    })

    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
    const operatorEmail = process.env.GROWTH_SCORECARD_EMAIL?.trim()
    const resendKey = process.env.RESEND_API_KEY
    const canSend = !dryRun && process.env.EMAILS_ENABLED === 'true' && Boolean(operatorEmail) && Boolean(resendKey)
    let delivery = { attempted: 0, sent: 0, failed: 0 }
    if (canSend && operatorEmail && resendKey) {
      const email = growthScorecardEmail(scorecard)
      await enqueueEmailDeliveries(supabase, [{
        idempotencyKey: `growth_scorecard_${key}`,
        recipientEmail: operatorEmail,
        template: 'growth_scorecard',
        subject: email.subject,
        html: email.html,
        text: email.text,
        metadata: { week: key },
      }])
      delivery = await processEmailDeliveries({
        supabase,
        resend: new Resend(resendKey),
        from: process.env.RESEND_FROM_EMAIL ?? 'Showcase <hello@tryshowcase.ink>',
        templates: ['growth_scorecard'],
        limit: 1,
      })
    }

    return NextResponse.json({
      ok: true,
      scorecard,
      delivery,
      definitions: {
        activation72h: 'Portfolio completion recorded within 72 hours for the fully matured signup cohort.',
        d7MeaningfulReturn: 'Trusted meaningful event between day 7 and day 14 for a fully matured cohort.',
        attribution: 'Server-captured anonymous first touch claimed by an authenticated account.',
        gatesExclude: 'usage_events (historically browser-writable); gates use trusted_events and source tables.',
        aiCostCoverage: `${costRows.filter((row) => row.status !== 'released').length} OpenAI calls are accounted from the authoritative reservation ledger; live reservations remain at their conservative maximum and released calls count as zero. Gemini is launch-disabled.`,
      },
      note: canSend ? undefined : 'Report returned only; sending requires EMAILS_ENABLED, RESEND_API_KEY, and GROWTH_SCORECARD_EMAIL.',
    })
  } catch (error) {
    console.error('[cron/growth-scorecard]', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Growth scorecard failed' }, { status: 500 })
  }
}
