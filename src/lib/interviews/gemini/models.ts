// Centralized model routing - every call site reads these instead of hardcoding a
// model ID, so an upstream change to the suggested defaults touches one file.

export function getAnalysisModel(): string {
  return process.env.GEMINI_ANALYSIS_MODEL ?? 'gemini-2.5-flash'
}

export function getLiveModel(): string {
  return process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.5-flash-native-audio-latest'
}
