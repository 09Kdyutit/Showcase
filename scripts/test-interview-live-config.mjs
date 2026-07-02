#!/usr/bin/env node --experimental-strip-types
// Tests the Interview Lab's legal/cost/safety gate (src/lib/interviews/config.ts) in its
// default, unconfigured state — exactly the state every real environment is in today,
// since no human has confirmed paid Gemini billing or reviewed ToS in this session.
// "Production must fail closed" is the mission's own framing; this proves it directly
// against the actual config module, not a description of intended behavior.
//
// This file deliberately does NOT import src/lib/interviews/gemini/{analysis,client,live}.ts
// — those carry `import 'server-only'`, which throws immediately under plain Node (the
// same reason src/lib/ai/gemini.ts is never imported directly by a test script in this
// codebase; see scripts/test-multi-model-review.mjs's comment for precedent). Those
// modules' OWN gating (the `if (!isInterviewAnalysisEnabled()) throw` at the top of
// runInterviewAnalysis, and the equivalent in createLiveEphemeralToken) is proven by
// direct code reading here and will be proven end-to-end once the API routes exist
// (see test:interview-live-token, which exercises the real HTTP route).
import {
  isGeminiPaidProjectConfirmed, isGeminiInterviewEnabled, isInterviewLabRuntimeEnabled,
  isInterviewLiveEnabled, isInterviewAnalysisEnabled, isInterviewRecordingEnabled,
  isRawAudioRetentionAllowedPlatformWide, getMaxSessionMinutes,
  getMaxConcurrentSessions, getGlobalDailyBudgetUsd, getUserMonthlyBudgetUsd,
  isGeminiTermsCompatibilityConfirmed, isInterviewKillSwitchActive,
  getGlobalMonthlyBudgetUsd, getMaxReconnects, getMaxFollowUpsCeiling,
} from '../src/lib/interviews/config.ts'
import { readFileSync } from 'node:fs'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

// ── Default (unconfigured) state — what every real environment is in today ──
record('isGeminiPaidProjectConfirmed() is false by default', isGeminiPaidProjectConfirmed() === false)
record('isGeminiInterviewEnabled() is false by default', isGeminiInterviewEnabled() === false)
record('isInterviewLabRuntimeEnabled() is false by default (master gate)', isInterviewLabRuntimeEnabled() === false)
record('isInterviewLiveEnabled() is false by default', isInterviewLiveEnabled() === false)
record('isInterviewAnalysisEnabled() is false by default', isInterviewAnalysisEnabled() === false)
record('isInterviewRecordingEnabled() is false by default', isInterviewRecordingEnabled() === false)
record('isRawAudioRetentionAllowedPlatformWide() is false by default', isRawAudioRetentionAllowedPlatformWide() === false)
record('getMaxSessionMinutes() defaults to 30', getMaxSessionMinutes() === 30)
record('getMaxConcurrentSessions() defaults to 1', getMaxConcurrentSessions() === 1)
record('getGlobalDailyBudgetUsd() is null (not 0, not Infinity) when unconfigured', getGlobalDailyBudgetUsd() === null)
record('getUserMonthlyBudgetUsd() is null when unconfigured', getUserMonthlyBudgetUsd() === null)
record('getGlobalMonthlyBudgetUsd() is null when unconfigured', getGlobalMonthlyBudgetUsd() === null)
record('isGeminiTermsCompatibilityConfirmed() is false by default', isGeminiTermsCompatibilityConfirmed() === false)
record('isInterviewKillSwitchActive() is false by default', isInterviewKillSwitchActive() === false)
record('getMaxReconnects() defaults to 3', getMaxReconnects() === 3)
record('getMaxFollowUpsCeiling() defaults to 5', getMaxFollowUpsCeiling() === 5)

// ── Sub-flags require the master gate even if individually set ─────────────
process.env.INTERVIEW_LIVE_ENABLED = 'true'
record('INTERVIEW_LIVE_ENABLED=true alone (without the master gate) still does NOT enable Live', isInterviewLiveEnabled() === false)
delete process.env.INTERVIEW_LIVE_ENABLED

process.env.GEMINI_INTERVIEW_ENABLED = 'true'
record('GEMINI_INTERVIEW_ENABLED=true alone (without paid-project confirmation) still does NOT enable the runtime', isInterviewLabRuntimeEnabled() === false)
delete process.env.GEMINI_INTERVIEW_ENABLED

process.env.GEMINI_PAID_PROJECT_CONFIRMED = 'true'
record('GEMINI_PAID_PROJECT_CONFIRMED=true alone (without interview-enabled) still does NOT enable the runtime', isInterviewLabRuntimeEnabled() === false)
delete process.env.GEMINI_PAID_PROJECT_CONFIRMED

// ── All three master flags true → runtime enabled, but sub-flags still independently gate ─
process.env.GEMINI_PAID_PROJECT_CONFIRMED = 'true'
process.env.GEMINI_INTERVIEW_ENABLED = 'true'
record('Only 2 of 3 master flags true (terms-compatibility still unset) → runtime stays false', isInterviewLabRuntimeEnabled() === false)
process.env.GEMINI_TERMS_COMPATIBILITY_CONFIRMED = 'true'
record('All 3 master flags true → isInterviewLabRuntimeEnabled() is true', isInterviewLabRuntimeEnabled() === true)
record('...but isInterviewLiveEnabled() is still false without INTERVIEW_LIVE_ENABLED', isInterviewLiveEnabled() === false)
process.env.INTERVIEW_LIVE_ENABLED = 'true'
record('...and becomes true only once INTERVIEW_LIVE_ENABLED is also set', isInterviewLiveEnabled() === true)

// ── The kill switch overrides everything else, even with all flags otherwise true ──
process.env.INTERVIEW_KILL_SWITCH = 'true'
record('INTERVIEW_KILL_SWITCH=true disables the runtime even with every other flag true', isInterviewLabRuntimeEnabled() === false)
record('...and isInterviewLiveEnabled() too, transitively', isInterviewLiveEnabled() === false)
delete process.env.INTERVIEW_KILL_SWITCH

delete process.env.GEMINI_PAID_PROJECT_CONFIRMED
delete process.env.GEMINI_INTERVIEW_ENABLED
delete process.env.GEMINI_TERMS_COMPATIBILITY_CONFIRMED
delete process.env.INTERVIEW_LIVE_ENABLED

// ── Max session minutes has a hard ceiling no env can exceed ────────────────
process.env.INTERVIEW_MAX_SESSION_MINUTES = '999'
record('INTERVIEW_MAX_SESSION_MINUTES=999 is clamped to the 30-minute hard ceiling', getMaxSessionMinutes() === 30)
delete process.env.INTERVIEW_MAX_SESSION_MINUTES

// ── Verify the .env.example documents every flag this module reads ─────────
const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
const expectedVars = [
  'GEMINI_ANALYSIS_MODEL', 'GEMINI_LIVE_MODEL', 'GEMINI_PAID_PROJECT_CONFIRMED', 'GEMINI_INTERVIEW_ENABLED',
  'GEMINI_TERMS_COMPATIBILITY_CONFIRMED', 'INTERVIEW_KILL_SWITCH',
  'INTERVIEW_LIVE_ENABLED', 'INTERVIEW_ANALYSIS_ENABLED', 'INTERVIEW_RECORDING_ENABLED',
  'INTERVIEW_RAW_AUDIO_RETENTION', 'INTERVIEW_MAX_SESSION_MINUTES', 'INTERVIEW_MAX_CONCURRENT_SESSIONS',
  'INTERVIEW_MAX_RECONNECTS', 'INTERVIEW_MAX_FOLLOW_UPS',
  'INTERVIEW_GLOBAL_DAILY_BUDGET_USD', 'INTERVIEW_GLOBAL_MONTHLY_BUDGET_USD', 'INTERVIEW_USER_MONTHLY_BUDGET_USD',
]
for (const v of expectedVars) {
  record(`.env.example documents ${v}`, example.includes(v))
}

console.log(`\n  Interview Live/Gemini config gate test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
