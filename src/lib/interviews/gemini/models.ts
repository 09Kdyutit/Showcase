// Centralized model routing — every call site reads these instead of hardcoding a
// model ID, so an upstream change to the suggested defaults touches one file.

export function getAnalysisModel(): string {
  return process.env.GEMINI_ANALYSIS_MODEL ?? 'gemini-3.5-flash'
}

/** The Live model is a preview model. live.ts isolates it behind a provider
 *  interface specifically so the rest of this module never depends on preview
 *  behavior — see src/lib/interviews/gemini/live.ts for why it is not implemented
 *  beyond that interface in this build. */
export function getLiveModel(): string {
  return process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.1-flash-live-preview'
}
