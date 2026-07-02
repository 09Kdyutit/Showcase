import { DIMENSION_IDS, SESSION_TYPES, type DimensionId, type SessionType } from './schemas.ts'

export const RUBRIC_REGISTRY_VERSION = '2026-06-29.1'

export interface DimensionDefinition {
  id: DimensionId
  label: string
  definition: string
  evidenceRequirements: string
  scoringAnchors: { low: string; mid: string; high: string }
  minTranscriptEvidence: number
  appliesTo: readonly SessionType[]
}

// Six high-level categories scored on EVERY interview, so the candidate always gets a
// complete, consistent picture (matching a professional interview scorecard) instead of a
// sparse, type-dependent subset. Per-answer coaching (answerAssessments) stays granular and
// is produced separately; these six are the top-level scorecard. Each carries its own
// definition/evidence-requirements/anchors so the analysis prompt and the results UI both
// read from one source.
export const DIMENSION_REGISTRY: Record<DimensionId, DimensionDefinition> = {
  technical: {
    id: 'technical', label: 'Technical',
    definition: 'Depth, correctness, and sophistication of technical or role-specific knowledge relative to the target level.',
    evidenceRequirements: 'Judge against the depth a strong candidate at the stated level would show; cite specific technical claims, decisions, or reasoning from the transcript.',
    scoringAnchors: { low: 'Surface-level or incorrect; no real depth for the level.', mid: 'Solid fundamentals but missing some expected nuance or rigor.', high: 'Deep, correct, and nuanced — explains tradeoffs and edge cases a strong candidate would.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
  communication: {
    id: 'communication', label: 'Communication',
    definition: 'How clearly, naturally, and persuasively the candidate conveys their ideas.',
    evidenceRequirements: 'Assessed across the whole conversation: pacing, word economy, and whether ideas land on first listen. Never penalize accent or accommodations.',
    scoringAnchors: { low: 'Hard to follow; rambling, vague, or unpersuasive.', mid: 'Generally clear with occasional lapses or filler.', high: 'Articulate, well-paced, and persuasive throughout.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
  competency: {
    id: 'competency', label: 'Competency',
    definition: 'Demonstrated ability through real decisions, personal ownership, and credible, measurable outcomes.',
    evidenceRequirements: 'Look for what the candidate personally did, the decisions they made, and the results — not team credit or a list of responsibilities.',
    scoringAnchors: { low: 'No clear personal contribution, decisions, or results.', mid: 'Some ownership and outcomes, partly vague or unquantified.', high: 'Clear decisions, unmistakable ownership, and credible impact tied to their own actions.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
  clarity: {
    id: 'clarity', label: 'Clarity',
    definition: 'How well-organized and easy to follow each answer is — setup, action, and result in a logical order.',
    evidenceRequirements: 'A listener unfamiliar with the situation should be able to follow it from the answer alone.',
    scoringAnchors: { low: 'Disorganized; the situation or sequence is confusing.', mid: 'Mostly ordered with some gaps or backtracking.', high: 'Clear, logical structure that is easy to follow throughout.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
  authenticity: {
    id: 'authenticity', label: 'Authenticity & Originality',
    definition: 'Whether answers feel genuine, specific, and first-hand versus generic, templated, or rehearsed.',
    evidenceRequirements: 'Reward concrete, personal, verifiable detail; penalize generic claims that could apply to anyone or sound fabricated.',
    scoringAnchors: { low: 'Generic and templated — could be anyone; no concrete first-hand detail.', mid: 'Some genuine specifics mixed with generic filler.', high: 'Vivid, specific, and unmistakably their own experience.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
  behaviour: {
    id: 'behaviour', label: 'Behaviour & Attitude',
    definition: 'Professionalism, collaboration, self-awareness, and growth mindset shown in how the candidate engages.',
    evidenceRequirements: 'Assessed from how they handle challenge, credit others, discuss conflict, and reflect — never from personality, accent, or demographics.',
    scoringAnchors: { low: 'Defensive, dismissive, blames others, or disengaged.', mid: 'Professional but limited self-awareness or collaboration signal.', high: 'Collaborative, self-aware, and handles pressure or disagreement with maturity.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
}

export interface RubricProfile {
  id: string
  version: string
  sessionType: SessionType
  weights: Partial<Record<DimensionId, number>> // sums to 1.0 for the dimensions present
}

function profile(sessionType: SessionType, weights: Partial<Record<DimensionId, number>>): RubricProfile {
  const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0)
  if (Math.abs(total - 1) > 0.001) {
    throw new Error(`Rubric profile for ${sessionType} weights sum to ${total}, not 1.0`)
  }
  return { id: `rubric-${sessionType}`, version: RUBRIC_REGISTRY_VERSION, sessionType, weights }
}

// All six categories are scored on every session; the weights only shift the emphasis the
// overall score puts on each, per interview type. Every profile sums to exactly 1.0 —
// enforced at module load by profile() so a typo fails the build, not production.
export const RUBRIC_PROFILES: Record<SessionType, RubricProfile> = {
  recruiter_screen: profile('recruiter_screen', {
    communication: 0.25, clarity: 0.25, competency: 0.20, authenticity: 0.15, behaviour: 0.10, technical: 0.05,
  }),
  behavioral: profile('behavioral', {
    competency: 0.25, authenticity: 0.20, clarity: 0.15, communication: 0.15, behaviour: 0.15, technical: 0.10,
  }),
  hiring_manager: profile('hiring_manager', {
    competency: 0.25, technical: 0.20, communication: 0.15, clarity: 0.15, behaviour: 0.15, authenticity: 0.10,
  }),
  portfolio_walkthrough: profile('portfolio_walkthrough', {
    competency: 0.25, authenticity: 0.20, clarity: 0.20, technical: 0.15, communication: 0.15, behaviour: 0.05,
  }),
  project_deep_dive: profile('project_deep_dive', {
    technical: 0.25, competency: 0.25, clarity: 0.15, communication: 0.15, authenticity: 0.15, behaviour: 0.05,
  }),
  technical_concept: profile('technical_concept', {
    technical: 0.40, clarity: 0.20, communication: 0.20, competency: 0.10, authenticity: 0.05, behaviour: 0.05,
  }),
  case_problem_solving: profile('case_problem_solving', {
    technical: 0.25, competency: 0.25, clarity: 0.20, communication: 0.20, behaviour: 0.05, authenticity: 0.05,
  }),
  presentation_defense: profile('presentation_defense', {
    communication: 0.25, technical: 0.20, competency: 0.20, clarity: 0.15, behaviour: 0.15, authenticity: 0.05,
  }),
  job_specific_full_loop: profile('job_specific_full_loop', {
    competency: 0.20, technical: 0.18, communication: 0.16, clarity: 0.16, authenticity: 0.15, behaviour: 0.15,
  }),
  rapid_fire_drill: profile('rapid_fire_drill', {
    communication: 0.30, clarity: 0.30, competency: 0.20, technical: 0.10, authenticity: 0.05, behaviour: 0.05,
  }),
}

export function getRubricProfile(sessionType: SessionType): RubricProfile {
  return RUBRIC_PROFILES[sessionType]
}

// Fail the build/test immediately if a profile or the registry references a dimension id
// that has drifted out of sync with the canonical DIMENSION_IDS list in schemas.ts.
for (const dimId of Object.keys(DIMENSION_REGISTRY)) {
  if (!DIMENSION_IDS.includes(dimId as DimensionId)) {
    throw new Error(`DIMENSION_REGISTRY contains "${dimId}" which is not in DIMENSION_IDS`)
  }
}
for (const prof of Object.values(RUBRIC_PROFILES)) {
  for (const dimId of Object.keys(prof.weights)) {
    if (!DIMENSION_IDS.includes(dimId as DimensionId)) {
      throw new Error(`Rubric profile "${prof.id}" references unknown dimension "${dimId}"`)
    }
  }
}

export function scoreToBand(score: number): 'starting' | 'building' | 'practicing' | 'interview_ready' | 'strong' {
  if (score < 35) return 'starting'
  if (score < 55) return 'building'
  if (score < 70) return 'practicing'
  if (score < 85) return 'interview_ready'
  return 'strong'
}
