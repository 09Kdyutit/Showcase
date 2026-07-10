import { randomBytes } from 'node:crypto'

export const ADMISSION_TOKEN_HEX_LENGTH = 48
export const ADMISSION_TOKEN_PATTERN = /^[a-f0-9]{48}$/

export function generateAdmissionToken(): string {
  return randomBytes(ADMISSION_TOKEN_HEX_LENGTH / 2).toString('hex')
}

export function generateWaitlistReferralCode(): string {
  return randomBytes(6).toString('hex').toUpperCase()
}

export function normalizeAdmissionToken(value: string | null | undefined): string | null {
  const token = value?.trim().toLowerCase() ?? ''
  return ADMISSION_TOKEN_PATTERN.test(token) ? token : null
}

export function buildInviteSignupUrl(appUrl: string, token: string): string {
  const normalized = normalizeAdmissionToken(token)
  if (!normalized) throw new Error('Invalid admission token')

  const url = new URL('/signup', appUrl)
  url.searchParams.set('invite', normalized)
  return url.toString()
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return 'your invited email address'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`
}
