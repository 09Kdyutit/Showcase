import { DIMENSION_IDS, SESSION_TYPES, type DimensionId, type SessionType } from './schemas.ts'

export const RUBRIC_REGISTRY_VERSION = '2026-06-23.1'

export interface DimensionDefinition {
  id: DimensionId
  label: string
  definition: string
  evidenceRequirements: string
  scoringAnchors: { low: string; mid: string; high: string }
  minTranscriptEvidence: number
  appliesTo: readonly SessionType[]
}

// Twelve dimensions exactly as specified by the mission. Each carries its own
// definition/evidence-requirements/anchors so the analysis prompt (analysis.ts) and
// the results UI can both read from one source instead of re-describing dimensions
// in prose at each call site.
export const DIMENSION_REGISTRY: Record<DimensionId, DimensionDefinition> = {
  answer_relevance: {
    id: 'answer_relevance', label: 'Answer Relevance',
    definition: 'Did the answer address the actual question asked?',
    evidenceRequirements: 'The cited segment must respond to the specific question, not a tangential or rehearsed answer.',
    scoringAnchors: { low: 'Answer is about a different topic than what was asked.', mid: 'Answer is on-topic but partially addresses the question.', high: 'Answer directly and completely addresses the question.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
  evidence_specificity: {
    id: 'evidence_specificity', label: 'Evidence Specificity',
    definition: 'Did the candidate provide concrete details rather than generic claims?',
    evidenceRequirements: 'Concrete nouns, numbers, names, or specific events cited from the transcript  -  not abstractions like "I worked hard."',
    scoringAnchors: { low: 'Entirely generic, no concrete detail.', mid: 'Some specifics, mixed with vague claims.', high: 'Consistently concrete and specific.' },
    minTranscriptEvidence: 1,
    appliesTo: ['behavioral', 'hiring_manager', 'portfolio_walkthrough', 'project_deep_dive', 'job_specific_full_loop'],
  },
  context_clarity: {
    id: 'context_clarity', label: 'Context Clarity',
    definition: 'Was the situation or problem understandable to someone outside the room?',
    evidenceRequirements: 'A reader unfamiliar with the candidate\'s workplace could follow the setup from the cited segment alone.',
    scoringAnchors: { low: 'Situation is confusing or assumes unexplained context.', mid: 'Situation is mostly clear with some gaps.', high: 'Situation is immediately clear.' },
    minTranscriptEvidence: 1,
    appliesTo: ['behavioral', 'hiring_manager', 'portfolio_walkthrough', 'project_deep_dive', 'case_problem_solving', 'job_specific_full_loop'],
  },
  personal_ownership: {
    id: 'personal_ownership', label: 'Personal Ownership',
    definition: "Was the candidate's own contribution clear, distinct from the team's?",
    evidenceRequirements: 'First-person, specific actions attributable to the candidate, not "we" used to obscure individual contribution.',
    scoringAnchors: { low: 'Cannot tell what the candidate personally did.', mid: 'Some personal contribution visible, blended with team credit.', high: "Candidate's specific role and decisions are unambiguous." },
    minTranscriptEvidence: 1,
    appliesTo: ['behavioral', 'hiring_manager', 'portfolio_walkthrough', 'project_deep_dive', 'job_specific_full_loop'],
  },
  action_quality: {
    id: 'action_quality', label: 'Action Quality',
    definition: 'Were actions, decisions, and tradeoffs explained?',
    evidenceRequirements: 'The cited segment names a decision point and the reasoning behind it, not just an outcome.',
    scoringAnchors: { low: 'No decisions or reasoning described.', mid: 'Actions described, limited reasoning.', high: 'Clear decisions with explained tradeoffs.' },
    minTranscriptEvidence: 1,
    appliesTo: ['behavioral', 'hiring_manager', 'portfolio_walkthrough', 'project_deep_dive', 'technical_concept', 'case_problem_solving', 'presentation_defense', 'job_specific_full_loop'],
  },
  outcome_and_impact: {
    id: 'outcome_and_impact', label: 'Outcome and Impact',
    definition: 'Was the result clear and supported?',
    evidenceRequirements: 'A stated result tied to the action  -  quantified where the candidate has real metrics, qualitative otherwise. Do not require a number that the candidate never claimed.',
    scoringAnchors: { low: 'No result stated.', mid: 'Result stated but vague or unsupported.', high: 'Clear, credible result tied directly to the actions described.' },
    minTranscriptEvidence: 1,
    appliesTo: ['behavioral', 'hiring_manager', 'portfolio_walkthrough', 'project_deep_dive', 'job_specific_full_loop'],
  },
  answer_structure: {
    id: 'answer_structure', label: 'Answer Structure',
    definition: 'Was the response organized and easy to follow?',
    evidenceRequirements: 'Evaluate organization (e.g., situation before action before result), not vocabulary or accent.',
    scoringAnchors: { low: 'Disorganized, hard to follow the sequence of events.', mid: 'Mostly ordered, some jumping around.', high: 'Clear, logical progression throughout.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
  role_technical_depth: {
    id: 'role_technical_depth', label: 'Role / Technical Depth',
    definition: 'Did the answer demonstrate appropriate depth for the role and level?',
    evidenceRequirements: 'Depth judged against the stated target role/seniority in the session plan, not a generic bar.',
    scoringAnchors: { low: 'Surface-level, no depth for the stated level.', mid: 'Adequate depth, missing some expected nuance.', high: 'Depth appropriate to or exceeding the stated level.' },
    minTranscriptEvidence: 1,
    appliesTo: ['hiring_manager', 'technical_concept', 'case_problem_solving', 'project_deep_dive', 'presentation_defense', 'job_specific_full_loop'],
  },
  problem_solving_process: {
    id: 'problem_solving_process', label: 'Problem-Solving Process',
    definition: 'Did the candidate clarify, reason, prioritize, and evaluate tradeoffs?',
    evidenceRequirements: 'Visible reasoning steps in the transcript: a clarifying question, a stated assumption, a prioritization, or a tradeoff comparison.',
    scoringAnchors: { low: 'Jumped to an answer with no visible reasoning.', mid: 'Some reasoning steps shown.', high: 'Clear, structured reasoning process.' },
    minTranscriptEvidence: 1,
    appliesTo: ['case_problem_solving', 'technical_concept'],
  },
  follow_up_handling: {
    id: 'follow_up_handling', label: 'Follow-Up Handling',
    definition: 'Did the candidate respond directly to challenges and clarifying questions?',
    evidenceRequirements: 'Only scored when at least one follow-up was actually asked in the session; the cited segment must be a response to a follow-up turn.',
    scoringAnchors: { low: 'Deflected or ignored the follow-up.', mid: 'Partially addressed the follow-up.', high: 'Directly and substantively addressed the follow-up.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
  concision: {
    id: 'concision', label: 'Concision',
    definition: 'Was the response appropriately detailed without excessive wandering?',
    evidenceRequirements: 'Judge relative to the question\'s scope, not an absolute word count.',
    scoringAnchors: { low: 'Rambling, loses the point.', mid: 'Mostly focused, some excess detail.', high: 'Appropriately detailed, no wasted words.' },
    minTranscriptEvidence: 1,
    appliesTo: SESSION_TYPES,
  },
  delivery_mechanics: {
    id: 'delivery_mechanics', label: 'Delivery Mechanics',
    definition: 'Objective, deterministic counts only when audio is available: speaking pace, filler-word count, long pauses, interruption counts. Never confidence, emotion, or accent.',
    evidenceRequirements: 'Computed deterministically from audio/transcript timing metadata, not inferred by the model. Skipped entirely in text mode and never penalizes accommodations.',
    scoringAnchors: { low: 'Metrics far outside the typical range for the answer length.', mid: 'Some metrics outside typical range.', high: 'Metrics within typical range.' },
    minTranscriptEvidence: 0,
    appliesTo: ['behavioral', 'hiring_manager', 'recruiter_screen', 'portfolio_walkthrough', 'project_deep_dive', 'technical_concept', 'case_problem_solving', 'presentation_defense', 'job_specific_full_loop'],
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

// Every profile's weights sum to exactly 1.0  -  enforced at module load via the
// assertion in profile() above, so a typo here fails the build/test immediately
// rather than silently producing a skewed overall score in production.
export const RUBRIC_PROFILES: Record<SessionType, RubricProfile> = {
  recruiter_screen: profile('recruiter_screen', {
    answer_relevance: 0.30, answer_structure: 0.25, concision: 0.25, follow_up_handling: 0.20,
  }),
  behavioral: profile('behavioral', {
    answer_relevance: 0.12, evidence_specificity: 0.18, context_clarity: 0.10, personal_ownership: 0.15,
    action_quality: 0.15, outcome_and_impact: 0.15, answer_structure: 0.10, follow_up_handling: 0.05,
  }),
  hiring_manager: profile('hiring_manager', {
    answer_relevance: 0.10, evidence_specificity: 0.12, personal_ownership: 0.13, action_quality: 0.15,
    outcome_and_impact: 0.15, role_technical_depth: 0.20, follow_up_handling: 0.15,
  }),
  portfolio_walkthrough: profile('portfolio_walkthrough', {
    context_clarity: 0.15, personal_ownership: 0.20, action_quality: 0.20, outcome_and_impact: 0.20,
    evidence_specificity: 0.15, answer_structure: 0.10,
  }),
  project_deep_dive: profile('project_deep_dive', {
    context_clarity: 0.12, personal_ownership: 0.15, action_quality: 0.18, outcome_and_impact: 0.15,
    role_technical_depth: 0.25, follow_up_handling: 0.15,
  }),
  technical_concept: profile('technical_concept', {
    answer_relevance: 0.15, role_technical_depth: 0.30, problem_solving_process: 0.25,
    answer_structure: 0.15, follow_up_handling: 0.15,
  }),
  case_problem_solving: profile('case_problem_solving', {
    context_clarity: 0.10, problem_solving_process: 0.35, role_technical_depth: 0.15,
    action_quality: 0.15, answer_structure: 0.10, follow_up_handling: 0.15,
  }),
  presentation_defense: profile('presentation_defense', {
    answer_relevance: 0.20, role_technical_depth: 0.20, action_quality: 0.20,
    follow_up_handling: 0.25, concision: 0.15,
  }),
  job_specific_full_loop: profile('job_specific_full_loop', {
    answer_relevance: 0.10, evidence_specificity: 0.12, personal_ownership: 0.13, action_quality: 0.13,
    outcome_and_impact: 0.13, role_technical_depth: 0.14, follow_up_handling: 0.13, answer_structure: 0.12,
  }),
  rapid_fire_drill: profile('rapid_fire_drill', {
    answer_relevance: 0.40, concision: 0.35, answer_structure: 0.25,
  }),
}

export function getRubricProfile(sessionType: SessionType): RubricProfile {
  return RUBRIC_PROFILES[sessionType]
}

// Fails the build/test immediately if a profile or the registry ever references a
// dimension id that has drifted out of sync with the canonical DIMENSION_IDS list in
// schemas.ts  -  same "fail closed on a typo" reasoning as the weight-sum assertion in
// profile() above.
for (const dimId of Object.keys(DIMENSION_REGISTRY)) {
  if (!DIMENSION_IDS.includes(dimId as DimensionId)) {
    throw new Error(`DIMENSION_REGISTRY contains "${dimId}" which is not in DIMENSION_IDS`)
  }
}
for (const profile of Object.values(RUBRIC_PROFILES)) {
  for (const dimId of Object.keys(profile.weights)) {
    if (!DIMENSION_IDS.includes(dimId as DimensionId)) {
      throw new Error(`Rubric profile "${profile.id}" references unknown dimension "${dimId}"`)
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
