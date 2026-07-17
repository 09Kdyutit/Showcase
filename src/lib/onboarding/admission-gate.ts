export const INVITE_STORAGE_KEY = 'showcase_invite'
export const REFERRAL_STORAGE_KEY = 'showcase_ref'

export type PendingAdmission =
  | { kind: 'none' }
  | { kind: 'invite'; token: string }
  | { kind: 'referral'; code: string }
  | { kind: 'invalid'; source: 'invite' | 'referral' }

export type AdmissionAttempt =
  | { kind: 'ready' }
  | { kind: 'granted'; storageKey: typeof INVITE_STORAGE_KEY | typeof REFERRAL_STORAGE_KEY }
  | { kind: 'rejected'; storageKey: typeof INVITE_STORAGE_KEY | typeof REFERRAL_STORAGE_KEY; message: string }
  | { kind: 'retry'; message: string }

type AdmissionDependencies = {
  redeemInvite: (token: string) => Promise<{ ok: boolean; status: number }>
  claimReferral: (code: string) => Promise<{ ok: boolean; status: number; claimed: boolean }>
}

export function selectPendingAdmission(
  search: string,
  storedInvite: string | null,
  storedReferral: string | null,
): PendingAdmission {
  const params = new URLSearchParams(search)

  // An explicit callback is newer authority than fallback browser storage. Within
  // the same callback, the email-bound invite still wins so a referral is never
  // spent for the account that is redeeming that invite.
  if (params.has('invite')) {
    const invite = params.get('invite')?.trim().toLowerCase() ?? ''
    return /^[a-f0-9]{48}$/.test(invite)
      ? { kind: 'invite', token: invite }
      : { kind: 'invalid', source: 'invite' }
  }

  if (params.has('ref')) {
    const referral = params.get('ref')?.trim().toUpperCase() ?? ''
    return /^[A-F0-9]{32}$/.test(referral)
      ? { kind: 'referral', code: referral }
      : { kind: 'invalid', source: 'referral' }
  }

  if (storedInvite !== null) {
    const invite = storedInvite.trim().toLowerCase()
    return /^[a-f0-9]{48}$/.test(invite)
      ? { kind: 'invite', token: invite }
      : { kind: 'invalid', source: 'invite' }
  }

  if (storedReferral !== null) {
    const referral = storedReferral.trim().toUpperCase()
    return /^[A-F0-9]{32}$/.test(referral)
      ? { kind: 'referral', code: referral }
      : { kind: 'invalid', source: 'referral' }
  }

  return { kind: 'none' }
}

export async function redeemPendingAdmission(
  pending: PendingAdmission,
  dependencies: AdmissionDependencies,
): Promise<AdmissionAttempt> {
  if (pending.kind === 'none') return { kind: 'ready' }

  if (pending.kind === 'invalid') {
    return pending.source === 'invite'
      ? {
          kind: 'rejected',
          storageKey: INVITE_STORAGE_KEY,
          message: 'This invite is expired, already used, or belongs to another email address.',
        }
      : {
          kind: 'rejected',
          storageKey: REFERRAL_STORAGE_KEY,
          message: 'This referral invite is no longer available. Join the waitlist for access.',
        }
  }

  try {
    if (pending.kind === 'invite') {
      const response = await dependencies.redeemInvite(pending.token)
      if (response.ok) return { kind: 'granted', storageKey: INVITE_STORAGE_KEY }
      if (response.status === 400 || response.status === 403) {
        return {
          kind: 'rejected',
          storageKey: INVITE_STORAGE_KEY,
          message: 'This invite is expired, already used, or belongs to another email address.',
        }
      }
      return { kind: 'retry', message: 'We could not confirm your access. No résumé was submitted. Try again.' }
    }

    const response = await dependencies.claimReferral(pending.code)
    if (response.ok && response.claimed) return { kind: 'granted', storageKey: REFERRAL_STORAGE_KEY }
    if (response.status === 400 || response.status === 403 || response.status === 409) {
      return {
        kind: 'rejected',
        storageKey: REFERRAL_STORAGE_KEY,
        message: 'This referral invite is no longer available. Join the waitlist for access.',
      }
    }
    return { kind: 'retry', message: 'We could not confirm your access. No résumé was submitted. Try again.' }
  } catch {
    return { kind: 'retry', message: 'We could not confirm your access. No résumé was submitted. Try again.' }
  }
}
