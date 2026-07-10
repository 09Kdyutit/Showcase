export interface GrowthScorecardRaw {
  periodStart: string
  periodEnd: string
  anonymousSessions: number
  organicSessions: number
  signups: number
  attributedSignups: number
  proofscoreViews: number
  generatedPortfolios: number
  completedPortfolios: number
  completedPortfolioUsers: number
  activationCohort: number
  activatedWithin72h: number
  d7Cohort: number
  d7MeaningfulReturns: number
  proConversions: number
  publishPaywallUsers: number
  publishPaywallConversions: number
  referralShares: number
  referralSharers: number
  activatedReferrals: number
  aiCostEvents: number
  aiCostUsd: number
  emailSent: number
  emailFailed: number
}

export interface GrowthScorecard extends GrowthScorecardRaw {
  visitorToSignupRate: number | null
  signupToCompletionRate: number | null
  attributionCoverageRate: number | null
  activation72hRate: number | null
  d7ReturnRate: number | null
  proConversionRate: number | null
  publishPaywallConversionRate: number | null
  referralShareRate: number | null
  costPerCompletionUsd: number | null
  emailFailureRate: number | null
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null
}

export function buildGrowthScorecard(raw: GrowthScorecardRaw): GrowthScorecard {
  return {
    ...raw,
    visitorToSignupRate: ratio(raw.signups, raw.anonymousSessions),
    signupToCompletionRate: ratio(raw.completedPortfolios, raw.signups),
    attributionCoverageRate: ratio(raw.attributedSignups, raw.signups),
    activation72hRate: ratio(raw.activatedWithin72h, raw.activationCohort),
    d7ReturnRate: ratio(raw.d7MeaningfulReturns, raw.d7Cohort),
    proConversionRate: ratio(raw.proConversions, raw.signups),
    publishPaywallConversionRate: ratio(raw.publishPaywallConversions, raw.publishPaywallUsers),
    referralShareRate: ratio(raw.referralSharers, raw.completedPortfolioUsers),
    costPerCompletionUsd: raw.completedPortfolios > 0
      ? Number((raw.aiCostUsd / raw.completedPortfolios).toFixed(4))
      : null,
    emailFailureRate: ratio(raw.emailFailed, raw.emailSent + raw.emailFailed),
  }
}

const PAID_MEDIA = new Set(['cpc', 'ppc', 'paid', 'paid_social', 'paid-social', 'display', 'retargeting'])

export function isOrganicFirstTouch(utmMedium: string | null): boolean {
  return !PAID_MEDIA.has((utmMedium ?? '').trim().toLowerCase())
}

export function completedUtcWeek(now: Date): { start: Date; end: Date; key: string } {
  const end = new Date(now)
  end.setUTCHours(0, 0, 0, 0)
  const daysSinceMonday = (end.getUTCDay() + 6) % 7
  end.setUTCDate(end.getUTCDate() - daysSinceMonday)
  const start = new Date(end.getTime() - 7 * 86400_000)
  return { start, end, key: start.toISOString().slice(0, 10) }
}

function formatRate(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`
}

export function growthScorecardEmail(scorecard: GrowthScorecard): { subject: string; html: string; text: string } {
  const lines = [
    ['Anonymous sessions', String(scorecard.anonymousSessions)],
    ['Organic sessions', String(scorecard.organicSessions)],
    ['Signups', `${scorecard.signups} (${formatRate(scorecard.visitorToSignupRate)} of sessions)`],
    ['Attribution coverage', formatRate(scorecard.attributionCoverageRate)],
    ['ProofScore views', String(scorecard.proofscoreViews)],
    ['Generated portfolios', String(scorecard.generatedPortfolios)],
    ['Completed portfolios', String(scorecard.completedPortfolios)],
    ['Unique completers', String(scorecard.completedPortfolioUsers)],
    ['72h activation', `${scorecard.activatedWithin72h}/${scorecard.activationCohort} (${formatRate(scorecard.activation72hRate)})`],
    ['D7 meaningful return', `${scorecard.d7MeaningfulReturns}/${scorecard.d7Cohort} (${formatRate(scorecard.d7ReturnRate)})`],
    ['Pro conversions', String(scorecard.proConversions)],
    ['Publish paywall → Pro', `${scorecard.publishPaywallConversions}/${scorecard.publishPaywallUsers} (${formatRate(scorecard.publishPaywallConversionRate)})`],
    ['Referral share actions', `${scorecard.referralShares} from ${scorecard.referralSharers} users (${formatRate(scorecard.referralShareRate)} of completers)`],
    ['Activated referrals', String(scorecard.activatedReferrals)],
    ['OpenAI calls accounted', String(scorecard.aiCostEvents)],
    ['Committed OpenAI cost', `$${scorecard.aiCostUsd.toFixed(4)}`],
    ['Cost / completion', scorecard.costPerCompletionUsd === null ? 'n/a' : `$${scorecard.costPerCompletionUsd.toFixed(4)}`],
    ['Email delivery failures', `${scorecard.emailFailed} (${formatRate(scorecard.emailFailureRate)})`],
  ] as const
  const period = `${scorecard.periodStart.slice(0, 10)} → ${scorecard.periodEnd.slice(0, 10)}`
  const rows = lines.map(([label, value]) => `<tr><td style="padding:8px 12px;color:#a1a1aa">${label}</td><td style="padding:8px 12px;color:#fafafa;font-weight:600">${value}</td></tr>`).join('')
  const html = `<!doctype html><html><body style="background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px"><div style="max-width:640px;margin:auto;background:#0f0f13;border:1px solid #27272a;border-radius:16px;padding:28px"><h1 style="color:#fafafa;margin:0">Showcase growth scorecard</h1><p style="color:#71717a">${period}</p><table style="width:100%;border-collapse:collapse">${rows}</table><p style="color:#52525b;font-size:12px">Gate metrics use trusted_events or source-of-truth product tables, never browser-writable analytics rows.</p></div></body></html>`
  const text = [`Showcase growth scorecard — ${period}`, '', ...lines.map(([label, value]) => `${label}: ${value}`)].join('\n')
  return { subject: `Showcase growth scorecard — ${scorecard.periodStart.slice(0, 10)}`, html, text }
}
