type DatabaseError = { message?: string } | null

/**
 * A PostgREST update can complete without an explicit error while matching zero
 * rows. Critical user-flow writes must return the row they claim to have saved;
 * otherwise the UI could navigate on a success that never became authoritative.
 */
export function requirePersistedRow<T>(
  result: { data: T | null; error: DatabaseError },
  message: string
): T {
  if (result.error || !result.data) throw new Error(message)
  return result.data
}
