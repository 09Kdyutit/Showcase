// Deterministic comparison between an original answer and a retry. No AI, no score —
// "never claim improvement when deterministic metrics didn't improve" (mission). Every
// observation below is either objectively true of the text or it isn't; there is no
// fabricated "your answer got better" framing.

export interface RetryObservation {
  label: string
  changed: boolean
}

export interface RetryComparison {
  originalWordCount: number
  retryWordCount: number
  wordCountDelta: number
  observations: RetryObservation[]
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function hasNumber(text: string): boolean {
  return /\d/.test(text)
}

function firstPersonCount(text: string): number {
  return (text.match(/\bI\b/g) ?? []).length
}

function hasOutcomeLanguage(text: string): boolean {
  return /\b(result|resulted|outcome|so |which led|ended up|in the end)\b/i.test(text)
}

export function compareAttempts(original: string, retry: string): RetryComparison {
  const originalWordCount = wordCount(original)
  const retryWordCount = wordCount(retry)

  const observations: RetryObservation[] = [
    { label: hasNumber(retry) && !hasNumber(original) ? 'Added a specific number or metric that wasn\'t in the original answer' : 'No new number or metric added', changed: hasNumber(retry) && !hasNumber(original) },
    { label: firstPersonCount(retry) > firstPersonCount(original) ? 'Used more direct personal language ("I") than the original' : 'Personal language ("I") did not increase', changed: firstPersonCount(retry) > firstPersonCount(original) },
    { label: hasOutcomeLanguage(retry) && !hasOutcomeLanguage(original) ? 'Added language stating a result or outcome that the original lacked' : 'No new outcome language added', changed: hasOutcomeLanguage(retry) && !hasOutcomeLanguage(original) },
    { label: retryWordCount < originalWordCount ? 'Retry is more concise than the original' : retryWordCount > originalWordCount ? 'Retry is longer than the original' : 'Length is unchanged', changed: retryWordCount !== originalWordCount },
  ]

  return {
    originalWordCount,
    retryWordCount,
    wordCountDelta: retryWordCount - originalWordCount,
    observations,
  }
}
