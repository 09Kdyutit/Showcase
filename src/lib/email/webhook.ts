export const RESEND_DELIVERY_EVENTS = [
  'email.delivered',
  'email.bounced',
  'email.complained',
] as const

export type ResendDeliveryEventType = (typeof RESEND_DELIVERY_EVENTS)[number]

export function isFreshWebhookTimestamp(
  timestamp: string | null,
  nowMs = Date.now(),
  toleranceSeconds = 300
): boolean {
  if (!timestamp || !/^\d{9,12}$/.test(timestamp)) return false
  const seconds = Number(timestamp)
  return Number.isFinite(seconds)
    && Math.abs(nowMs / 1000 - seconds) <= toleranceSeconds
}
export function normalizeEmailAddress(value: string): string | null {
  const bracketed = value.match(/<([^<>]+)>\s*$/)?.[1]
  const email = (bracketed ?? value).trim().toLowerCase()
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}
