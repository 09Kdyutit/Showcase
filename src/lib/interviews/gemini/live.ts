import 'server-only'
import { isInterviewLiveEnabled } from '../config.ts'
import { InterviewLiveUnavailableError } from './errors.ts'
import { getLiveModel } from './models.ts'

// Live voice is explicitly NOT implemented beyond this gated interface in this build.
// Reasons, all independently sufficient to stop here:
//   1. The legal gate (config.ts's isInterviewLiveEnabled) is false in every current
//      environment — no human in this session could confirm paid Gemini billing, a
//      ToS review, or a live age-gate/consent flow, all of which the mission requires
//      before this path may run for real users.
//   2. gemini-3.1-flash-live-preview is a PREVIEW model. The mission explicitly says
//      to isolate it behind a provider interface, add timeout/reconnect handling, and
//      provide a recorded-session fallback rather than build deep dependencies on
//      preview-specific behavior — exactly what this file does and nothing more.
//   3. A correct implementation needs real ephemeral-token issuance bound to session
//      constraints, WebSocket reconnect-with-grace-period handling, and barge-in/turn-
//      taking semantics that cannot be honestly verified without a live, billed
//      project to test against. Building that untested, with secrets that don't
//      exist, would produce code that looks complete but has never actually run —
//      precisely what the mission's "do not pretend it is launched" instruction
//      forbids.
// What IS real here: the shape every caller needs (so /api/interviews/sessions/[id]/
// live-token can call this today and get a correct, safe, typed rejection), and the
// exact set of checks a real implementation must pass before issuing a token.

export interface LiveTokenRequest {
  sessionId: string
  userId: string
  maxDurationSeconds: number
}

export interface LiveTokenResult {
  ephemeralToken: string
  expiresAt: string
  model: string
}

export async function createLiveEphemeralToken(request: LiveTokenRequest): Promise<LiveTokenResult> {
  if (!isInterviewLiveEnabled()) {
    throw new InterviewLiveUnavailableError(
      'Live voice interviews are not yet enabled. This requires GEMINI_PAID_PROJECT_CONFIRMED=true, ' +
      'GEMINI_INTERVIEW_ENABLED=true, and INTERVIEW_LIVE_ENABLED=true, all of which are human decisions ' +
      'requiring a reviewed Gemini billing/ToS state — see security/INTERVIEW_LAB_GATE.md. ' +
      'Use Text Mode or Recorded Mode instead.'
    )
  }
  // Unreachable today (the gate above always throws first in this build), but kept as
  // a typed reference to what a real implementation must do once the gate opens:
  // call client.authTokens.create() scoped to getLiveModel() and request.sessionId,
  // with an expiry tied to request.maxDurationSeconds, and never log the token value.
  void request
  throw new InterviewLiveUnavailableError(`Live voice provider not implemented (model: ${getLiveModel()})`)
}
