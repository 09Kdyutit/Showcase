export const LIFECYCLE_TEMPLATES = [
  'signup_not_generated_24h',
  'generated_not_previewed_2h',
  'generated_not_previewed_68h',
  'portfolio_completion',
] as const

export type LifecycleTemplate = (typeof LIFECYCLE_TEMPLATES)[number]

export interface LifecycleProfile {
  id: string
  email: string
  fullName: string | null
  createdAt: string
}
export interface LifecyclePortfolio {
  id: string
  userId: string
  generatedAt: string
}

export interface LifecycleFact {
  eventName: 'portfolio_preview_viewed' | 'portfolio_completed'
  userId: string | null
  entityId: string | null
  occurredAt: string
}

export interface LifecycleCandidate {
  idempotencyKey: string
  template: LifecycleTemplate
  userId: string
  email: string
  firstName: string | null
  portfolioId: string | null
  dueAt: string
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function ageInMs(nowMs: number, timestamp: string): number | null {
  const then = Date.parse(timestamp)
  if (!Number.isFinite(then) || then > nowMs) return null
  return nowMs - then
}

function firstName(fullName: string | null): string | null {
  return fullName?.trim().split(/\s+/)[0] || null
}

export function lifecycleDeliveryKey(
  template: LifecycleTemplate,
  userId: string,
  portfolioId?: string | null
): string {
  return `lifecycle_${template}_${userId}${portfolioId ? `_${portfolioId}` : ''}`
}

/** Pure eligibility logic; database/provider idempotency is enforced by the delivery key. */
export function deriveLifecycleCandidates(input: {
  now: Date
  profiles: LifecycleProfile[]
  portfolios: LifecyclePortfolio[]
  facts: LifecycleFact[]
}): LifecycleCandidate[] {
  const nowMs = input.now.getTime()
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]))
  const portfoliosByUser = new Map<string, LifecyclePortfolio[]>()
  for (const portfolio of input.portfolios) {
    const current = portfoliosByUser.get(portfolio.userId) ?? []
    current.push(portfolio)
    portfoliosByUser.set(portfolio.userId, current)
  }

  const previewed = new Set(
    input.facts
      .filter((fact) => fact.entityId && (fact.eventName === 'portfolio_preview_viewed' || fact.eventName === 'portfolio_completed'))
      .map((fact) => fact.entityId as string)
  )
  const candidates: LifecycleCandidate[] = []

  for (const profile of input.profiles) {
    const signupAge = ageInMs(nowMs, profile.createdAt)
    const generated = portfoliosByUser.get(profile.id) ?? []
    if (signupAge !== null && signupAge >= DAY && signupAge < 7 * DAY && generated.length === 0) {
      candidates.push({
        idempotencyKey: lifecycleDeliveryKey('signup_not_generated_24h', profile.id),
        template: 'signup_not_generated_24h',
        userId: profile.id,
        email: profile.email,
        firstName: firstName(profile.fullName),
        portfolioId: null,
        dueAt: new Date(Date.parse(profile.createdAt) + DAY).toISOString(),
      })
    }

    for (const portfolio of generated) {
      if (previewed.has(portfolio.id)) continue
      const generatedAge = ageInMs(nowMs, portfolio.generatedAt)
      if (generatedAge === null) continue
      const template: LifecycleTemplate | null = generatedAge >= 68 * HOUR && generatedAge < 7 * DAY
        ? 'generated_not_previewed_68h'
        : generatedAge >= 2 * HOUR && generatedAge < 68 * HOUR
          ? 'generated_not_previewed_2h'
          : null
      if (!template) continue
      const dueHours = template === 'generated_not_previewed_2h' ? 2 : 68
      candidates.push({
        idempotencyKey: lifecycleDeliveryKey(template, profile.id, portfolio.id),
        template,
        userId: profile.id,
        email: profile.email,
        firstName: firstName(profile.fullName),
        portfolioId: portfolio.id,
        dueAt: new Date(Date.parse(portfolio.generatedAt) + dueHours * HOUR).toISOString(),
      })
    }
  }

  for (const fact of input.facts) {
    if (fact.eventName !== 'portfolio_completed' || !fact.userId || !fact.entityId) continue
    const profile = profileById.get(fact.userId)
    const completionAge = ageInMs(nowMs, fact.occurredAt)
    if (!profile || completionAge === null || completionAge >= 14 * DAY) continue
    candidates.push({
      idempotencyKey: lifecycleDeliveryKey('portfolio_completion', profile.id, fact.entityId),
      template: 'portfolio_completion',
      userId: profile.id,
      email: profile.email,
      firstName: firstName(profile.fullName),
      portfolioId: fact.entityId,
      dueAt: fact.occurredAt,
    })
  }

  return candidates.sort((a, b) => a.dueAt.localeCompare(b.dueAt))
}
