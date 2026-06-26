/** True once any field has real content  -  an empty `{}` draft from portfolio creation isn't "real" content to protect. */
export function hasRealContent(content: unknown): boolean {
  if (!content || typeof content !== 'object') return false
  const c = content as Record<string, unknown>
  return Object.keys(c).length > 0 && Object.values(c).some((v) => v && (typeof v !== 'object' || Object.keys(v).length > 0))
}

/**
 * Decides whether generating again would silently overwrite real edits. ai_generated_at is
 * only set by a successful AI generation; updated_at also moves on every manual save. If
 * updated_at has moved meaningfully past ai_generated_at, something (a real edit, or even
 * just autosave re-persisting post-generation content) has happened since  -  safer to ask
 * before overwriting than to assume it's still the untouched AI draft.
 */
export function isEditedSinceGeneration(
  content: unknown,
  updatedAt: string,
  aiGeneratedAt: string | null
): boolean {
  if (!aiGeneratedAt) return hasRealContent(content)
  return new Date(updatedAt).getTime() > new Date(aiGeneratedAt).getTime() + 1000
}
