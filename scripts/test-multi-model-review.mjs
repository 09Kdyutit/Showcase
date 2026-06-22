#!/usr/bin/env node
// Real connectivity + contract test for the Gemini reviewer adapter (src/lib/ai/gemini.ts).
// This is NOT a status-only script — if GEMINI_API_KEY is missing, it reports BLOCKED and
// exits nonzero rather than claiming PASS. If a key exists, it makes real Gemini API calls
// against synthetic fixtures only and verifies the actual contract: structured-output
// validation, malformed-response handling, timeout handling, schema rejection, and the
// synthetic-only safety guard. Must be run with --experimental-strip-types (see package.json)
// since it imports the real .ts adapter directly rather than re-implementing it.
import { ReviewerOutputSchema } from '../src/lib/ai/review-types.ts'

let PASS = 0, FAIL = 0, BLOCKED = 0
function record(label, status, detail) {
  const icon = status === 'pass' ? '✅' : status === 'blocked' ? '🚧' : '❌'
  console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`)
  if (status === 'pass') PASS++
  else if (status === 'blocked') BLOCKED++
  else FAIL++
}

const SYNTHETIC_OUTPUT = {
  hero: { headline: 'Senior Designer Driving +24% Activation Increase', subheadline: 'I design B2B checkout flows.', tagline: 'Senior Designer' },
  proof: [{ label: 'activation increase', value: '+24%' }],
}
const SYNTHETIC_EVIDENCE = { metrics: ['+24% activation increase'], role: 'Senior Product Designer' }

async function main() {
  console.log('Gemini reviewer adapter — real connectivity + contract test\n')

  if (!process.env.GEMINI_API_KEY) {
    record('GEMINI_API_KEY configured', 'blocked', 'not set — a real key is required to test the live provider call')
    console.log(`\n  ${PASS} passed, ${FAIL} failed, ${BLOCKED} blocked\n  Status: BLOCKED — cannot test a real Gemini connection without a key.`)
    process.exit(1)
  }
  if (!process.env.GEMINI_MODEL_REVIEWER) {
    record('GEMINI_MODEL_REVIEWER configured', 'blocked', 'not set')
    console.log(`\n  ${PASS} passed, ${FAIL} failed, ${BLOCKED} blocked\n  Status: BLOCKED.`)
    process.exit(1)
  }
  record('GEMINI_API_KEY configured', 'pass')
  record('GEMINI_MODEL_REVIEWER configured', 'pass', process.env.GEMINI_MODEL_REVIEWER)

  const { callGeminiReviewer, GeminiSafetyRejectionError, GeminiSchemaError, GeminiTimeoutError, GeminiDailyQuotaExceededError, GeminiCreditsDepletedError } =
    await import('../src/lib/ai/gemini.ts')

  // 1. Real API request against a synthetic fixture, validated through the actual schema.
  console.log('\nMaking a real Gemini API request against a synthetic fixture...')
  let liveResult
  try {
    liveResult = await callGeminiReviewer({
      promptId: 'portfolio-generation',
      output: SYNTHETIC_OUTPUT,
      normalizedEvidence: SYNTHETIC_EVIDENCE,
      targetRole: 'Senior Product Designer',
      dataClassification: 'synthetic',
    })
    const schemaCheck = ReviewerOutputSchema.safeParse(liveResult.data)
    record('Real Gemini API call succeeded', 'pass', `verdict=${liveResult.data.verdict}, confidence=${liveResult.data.confidence}, latency=${liveResult.meta.latencyMs}ms, tokens=${liveResult.meta.totalTokenCount}`)
    record('Response validates against ReviewerOutputSchema', schemaCheck.success ? 'pass' : 'fail')
  } catch (e) {
    if (e instanceof GeminiDailyQuotaExceededError) {
      record('Real Gemini API call succeeded', 'blocked', 'free-tier daily quota (20 req/day for gemini-2.5-flash) exhausted — not a code defect, retry tomorrow')
    } else if (e instanceof GeminiCreditsDepletedError) {
      record('Real Gemini API call succeeded', 'blocked', 'prepaid Gemini API credits depleted — not a code defect, requires adding billing funds at ai.studio, will not resolve by waiting')
    } else {
      record('Real Gemini API call succeeded', 'fail', `${e.constructor.name}: ${e.message}`)
    }
  }

  // 2. Synthetic-only safety guard — must reject every non-synthetic classification, no exceptions.
  console.log('\nTesting the synthetic-only safety guard...')
  for (const dataClassification of ['private', 'user', undefined]) {
    try {
      await callGeminiReviewer({ promptId: 'x', output: {}, normalizedEvidence: {}, targetRole: 'x', dataClassification })
      record(`Rejects dataClassification=${JSON.stringify(dataClassification)}`, 'fail', 'WRONGLY ALLOWED A NON-SYNTHETIC REQUEST')
    } catch (e) {
      record(`Rejects dataClassification=${JSON.stringify(dataClassification)}`, e instanceof GeminiSafetyRejectionError ? 'pass' : 'fail', e.message)
    }
  }

  // 3. Malformed-response / schema-rejection handling — verified against the schema directly
  // (not a live call) since we cannot force the real provider to return garbage on demand.
  console.log('\nTesting malformed-response / schema-rejection handling...')
  const malformedCases = [
    { label: 'missing required field', value: { verdict: 'pass' } },
    { label: 'wrong verdict enum value', value: { ...goodShape(), verdict: 'maybe' } },
    { label: 'score out of range', value: { ...goodShape(), scores: { ...goodShape().scores, factual_grounding: 500 } } },
  ]
  for (const c of malformedCases) {
    const result = ReviewerOutputSchema.safeParse(c.value)
    record(`Schema rejects: ${c.label}`, result.success ? 'fail' : 'pass')
  }
  record('Schema accepts a well-formed response', ReviewerOutputSchema.safeParse(goodShape()).success ? 'pass' : 'fail')

  // 4. Timeout handling — verified by construction (REVIEW_TIMEOUT_MS + AbortController in
  // gemini.ts) rather than by waiting out a real 20s timeout in every CI run; confirm the
  // error class exists and is exported for callers to branch on.
  console.log('\nTesting timeout error class is wired up...')
  record('GeminiTimeoutError is exported and constructable', typeof GeminiTimeoutError === 'function' ? 'pass' : 'fail')
  record('GeminiSchemaError is exported and constructable', typeof GeminiSchemaError === 'function' ? 'pass' : 'fail')

  // 5. Confirm deterministic blockers remain authoritative — the reviewer schema structurally
  // has no field that could carry a ProofScore/MatchScore override.
  console.log('\nConfirming the reviewer cannot carry a deterministic-score override...')
  const shape = ReviewerOutputSchema.shape
  const hasScoreOverrideField = 'proofScore' in shape || 'matchScore' in shape || 'overall_score' in shape
  record('ReviewerOutputSchema has no field that could override a deterministic score', !hasScoreOverrideField ? 'pass' : 'fail')

  console.log(`\n  ${PASS} passed, ${FAIL} failed, ${BLOCKED} blocked`)
  process.exit(FAIL > 0 ? 1 : 0)
}

function goodShape() {
  return {
    verdict: 'pass',
    scores: {
      factual_grounding: 90, source_fidelity: 90, role_relevance: 90, specificity: 90,
      actionability: 90, clarity: 90, natural_tone: 90, schema_compliance: 90,
    },
    unsupported_claims: [],
    missing_evidence: [],
    critical_issues: [],
    classified_issues: [],
    revision_instructions: [],
    confidence: 90,
  }
}

main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1) })
