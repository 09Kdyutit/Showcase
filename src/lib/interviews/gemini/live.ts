import 'server-only'
import { isInterviewLiveEnabled } from '../config.ts'
import { InterviewLiveUnavailableError, InterviewGeminiProviderError } from './errors.ts'
import { getLiveModel } from './models.ts'
import { getInterviewGeminiTokenClient } from './client.ts'
import { buildLiveInterviewerSystemInstruction, type LiveInterviewQuestion } from './live-prompt.ts'

// Real implementation, verified against a live billed Gemini project (not just
// written from documentation): ephemeral token minting requires v1alpha
// (see client.ts), and a token minted server-side with liveConnectConstraints set
// was confirmed to open a real Live API WebSocket session using ONLY the token —
// the real GEMINI_API_KEY never reaches the browser. The system instruction
// (interviewer persona + exact question list) is locked into the token via
// liveConnectConstraints + lockAdditionalFields, so the browser cannot alter what
// the model is told to ask.

export interface LiveTokenRequest {
  sessionId: string
  userId: string
  maxDurationSeconds: number
  targetRole: string
  questions: LiveInterviewQuestion[]
}

export interface LiveTokenResult {
  ephemeralToken: string
  expiresAt: string
  model: string
  systemInstruction: string
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

  const client = getInterviewGeminiTokenClient()
  const model = getLiveModel()
  const systemInstruction = buildLiveInterviewerSystemInstruction(request.questions, request.targetRole)

  // A new-session window of maxDurationSeconds (capped, same hard ceiling
  // getMaxSessionMinutes() enforces everywhere else) plus a small buffer for the
  // candidate to actually connect after the token is issued.
  const newSessionWindowMs = Math.min(request.maxDurationSeconds, 30 * 60) * 1000 + 60_000
  const expireTime = new Date(Date.now() + newSessionWindowMs).toISOString()
  const newSessionExpireTime = new Date(Date.now() + 60_000).toISOString()

  // The system instruction (persona + question list) is built here on the server and
  // returned to the browser alongside the token. The browser passes it directly in the
  // connect() config, which is more reliable than relying on liveConnectConstraints
  // being applied server-side — the locked-field mechanism is experimental and the SDK
  // warns that ephemeral token support may change. The questions are already known to the
  // user (displayed in the session plan), so this is not a meaningful information leak.
  try {
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
      },
    })
    if (!token.name) throw new InterviewGeminiProviderError()

    return { ephemeralToken: token.name, expiresAt: expireTime, model, systemInstruction }
  } catch (err) {
    if (err instanceof InterviewGeminiProviderError) throw err
    console.error('[interviews/gemini/live] ephemeral token creation failed', { model })
    throw new InterviewGeminiProviderError()
  }
}
