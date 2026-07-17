export type InterviewPlanTier = 'free' | 'pro'

export interface InterviewRetryUpgradeIntent {
  kind: 'retry'
  sessionId: string
  questionId: string
  answerText: string
}

export const INTERVIEW_UPGRADE_INTENT_STORAGE_KEY = 'showcase:interview-upgrade-intent'
export const INTERVIEW_RETRY_CHECKOUT_ORIGIN_STORAGE_KEY = 'showcase:interview-retry-checkout-origin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function serializeInterviewRetryUpgradeIntent(intent: InterviewRetryUpgradeIntent): string {
  return JSON.stringify(intent)
}

export function parseInterviewRetryUpgradeIntent(raw: string | null): InterviewRetryUpgradeIntent | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<InterviewRetryUpgradeIntent>
    if (
      value.kind !== 'retry' ||
      typeof value.sessionId !== 'string' ||
      !UUID_PATTERN.test(value.sessionId) ||
      typeof value.questionId !== 'string' ||
      !UUID_PATTERN.test(value.questionId) ||
      typeof value.answerText !== 'string' ||
      value.answerText.length < 1 ||
      value.answerText.length > 10_000
    ) {
      return null
    }
    return {
      kind: 'retry',
      sessionId: value.sessionId,
      questionId: value.questionId,
      answerText: value.answerText,
    }
  } catch {
    return null
  }
}

export function interviewRetryCheckoutOriginValue(intent: InterviewRetryUpgradeIntent): string {
  return `${intent.sessionId}:${intent.questionId}`
}

export function hasMatchingInterviewRetryCheckoutOrigin(
  raw: string | null,
  intent: InterviewRetryUpgradeIntent | null,
): boolean {
  return !!intent && raw === interviewRetryCheckoutOriginValue(intent)
}

export function shouldOfferInterviewUpgrade(input: {
  status: number
  tier: unknown
  code: unknown
  allowedCodes: readonly string[]
}): boolean {
  return input.status === 403 &&
    input.tier === 'free' &&
    typeof input.code === 'string' &&
    input.allowedCodes.includes(input.code)
}
