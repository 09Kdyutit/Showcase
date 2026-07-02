// Centralized model routing - every call site reads these instead of hardcoding a
// model ID, so an upstream change to the suggested defaults touches one file.

export function getAnalysisModel(): string {
  return process.env.GEMINI_ANALYSIS_MODEL ?? 'gemini-2.5-flash'
}

export function getLiveModel(): string {
  // gemini-3.1-flash-live-preview is verified (against the live key) to support
  // bidiGenerateContent on the v1alpha endpoint the edge function uses, and returns
  // setupComplete with this app's exact setup message. It's the newest half-cascade
  // Live model the key has access to — chosen for reliability over the native-audio
  // variants. (gemini-2.0-flash-live-001 does NOT exist for this key → 1008 close;
  // do not use it.) Override with GEMINI_LIVE_MODEL only to a model confirmed via
  // ListModels to support bidiGenerateContent.
  return process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.1-flash-live-preview'
}
