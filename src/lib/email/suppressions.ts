import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeEmailAddress } from '@/lib/email/webhook'

const LOOKUP_CHUNK_SIZE = 25

/**
 * Reads the server-owned suppression registry with exact normalized equality. Query errors
 * throw so every caller fails closed before handing a message to the provider.
 */
export async function findSuppressedEmails(
  supabase: SupabaseClient,
  addresses: string[],
): Promise<Set<string>> {
  const normalized = [...new Set(addresses
    .map(normalizeEmailAddress)
    .filter((email): email is string => Boolean(email)))]
  const suppressed = new Set<string>()

  for (let index = 0; index < normalized.length; index += LOOKUP_CHUNK_SIZE) {
    const chunk = normalized.slice(index, index + LOOKUP_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('email_suppressions')
      .select('normalized_email')
      .in('normalized_email', chunk)
    if (error) throw new Error(`Could not verify email suppression: ${error.message}`)
    for (const row of data ?? []) suppressed.add(row.normalized_email)
  }

  return suppressed
}

export async function isEmailSuppressed(
  supabase: SupabaseClient,
  address: string,
): Promise<boolean> {
  const normalized = normalizeEmailAddress(address)
  if (!normalized) return true
  return (await findSuppressedEmails(supabase, [normalized])).has(normalized)
}
