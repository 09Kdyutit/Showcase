// Mirrors src/lib/ai/gemini.ts's error taxonomy — distinct, typed errors so a caller
// (and a route's error handler) can tell "not configured" from "model refused" from
// "provider is down" without parsing message strings, and so a raw provider error
// (which can embed request internals) never reaches a route's JSON response.

export class InterviewGeminiDisabledError extends Error {
  constructor(reason: string) {
    super(`Interview Lab Gemini features are disabled: ${reason}`)
  }
}

export class InterviewGeminiNotConfiguredError extends Error {
  constructor(reason: string) {
    super(`Interview Lab Gemini is not configured: ${reason}`)
  }
}

export class InterviewGeminiSchemaError extends Error {
  constructor(detail: string) {
    super(`Interview analysis response failed schema validation: ${detail}`)
  }
}

export class InterviewGeminiTimeoutError extends Error {
  constructor() {
    super('Interview analysis timed out')
  }
}

export class InterviewGeminiProviderError extends Error {
  constructor() {
    super('Interview analysis provider error')
  }
}

export class InterviewLiveUnavailableError extends Error {
  constructor(reason: string) {
    super(`Interview Live voice is unavailable: ${reason}`)
  }
}
