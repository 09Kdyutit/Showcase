import type { SessionType, Difficulty } from '../schemas.ts'

export const QUESTION_BANK_VERSION = '2026-06-23.1'

export interface QuestionTemplate {
  id: string
  sessionType: SessionType
  competency: string
  /** May contain {{targetRole}} / {{targetCompany}} placeholders, substituted by the
   *  plan builder. Gemini may further personalize wording around this template but
   *  must preserve the question's actual intent — see src/lib/interviews/prompts. */
  promptTemplate: string
  applicableRoles: 'any' | string[]
  difficulty: Difficulty
  expectedEvidence: string
}

// Deliberately a curated, versioned set rather than an exhaustive one — the mission is
// explicit that quality matters more than count ("do not fill the bank with low-quality
// repetitive questions merely to claim a high count"). Covers the three session types
// this build's UI actually exercises end to end (recruiter_screen, behavioral,
// portfolio_walkthrough); the remaining session types are modeled in the schema/rubric
// layers but do not yet have curated templates — adding them is mechanical once a
// product decision is made about which to prioritize next.
export const QUESTION_BANK: QuestionTemplate[] = [
  // ── Recruiter Screen ──────────────────────────────────────────────────────
  {
    id: 'rs-001', sessionType: 'recruiter_screen', competency: 'background_summary',
    promptTemplate: 'Walk me through your background and what brought you to apply for {{targetRole}} roles.',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A coherent narrative connecting past experience to the target role, not a verbatim resume readout.',
  },
  {
    id: 'rs-002', sessionType: 'recruiter_screen', competency: 'motivation',
    promptTemplate: "What's drawing you to this kind of role right now?",
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific, credible reason tied to the candidate\'s actual trajectory, not a generic "I love challenges" answer.',
  },
  {
    id: 'rs-003', sessionType: 'recruiter_screen', competency: 'role_fit',
    promptTemplate: 'Which parts of the {{targetRole}} role do you think will come most naturally to you, and which will stretch you?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'Honest self-assessment referencing concrete skills or experiences, not pure platitude.',
  },
  {
    id: 'rs-004', sessionType: 'recruiter_screen', competency: 'availability_logistics',
    promptTemplate: 'Are you able to meet the role\'s stated schedule and any travel requirements?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A direct yes/no/conditional answer — this is a logistics question, not a behavioral one.',
  },
  {
    id: 'rs-005', sessionType: 'recruiter_screen', competency: 'career_transition',
    promptTemplate: 'What made you decide to look for something new at this point in your career?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A reason that is candid and forward-looking, without disparaging a past employer.',
  },
  {
    id: 'rs-006', sessionType: 'recruiter_screen', competency: 'high_level_experience',
    promptTemplate: 'In two or three sentences, what is the work you are most known for in your current or most recent role?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A concise, specific summary — tests concision and self-framing in a single short answer.',
  },

  // ── Behavioral ────────────────────────────────────────────────────────────
  {
    id: 'be-001', sessionType: 'behavioral', competency: 'conflict',
    promptTemplate: 'Tell me about a time you disagreed with a teammate or manager about how to approach something. What happened?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A real disagreement with the candidate\'s specific position, how it was resolved, and what changed (or didn\'t).',
  },
  {
    id: 'be-002', sessionType: 'behavioral', competency: 'failure',
    promptTemplate: 'Describe a project or decision that did not go the way you expected. What did you learn?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A genuine setback (not a thinly-disguised humble-brag), the candidate\'s specific role in it, and a real lesson applied afterward.',
  },
  {
    id: 'be-003', sessionType: 'behavioral', competency: 'ownership',
    promptTemplate: 'Tell me about a time you took ownership of something that wasn\'t explicitly your responsibility.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A specific gap the candidate noticed and acted on, with a clear personal (not team) action.',
  },
  {
    id: 'be-004', sessionType: 'behavioral', competency: 'ambiguity',
    promptTemplate: 'Describe a situation where you had to make progress without complete information or clear direction.',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'How the candidate structured their approach under uncertainty — assumptions made, how they validated them.',
  },
  {
    id: 'be-005', sessionType: 'behavioral', competency: 'collaboration',
    promptTemplate: 'Tell me about a project where you depended heavily on people outside your immediate team. How did you keep things moving?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'Specific coordination mechanisms or relationship-building actions, not a vague "we communicated well."',
  },
  {
    id: 'be-006', sessionType: 'behavioral', competency: 'leadership',
    promptTemplate: 'Describe a time you had to influence a decision without having formal authority over the outcome.',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A concrete persuasion approach and what ultimately happened, including pushback faced.',
  },
  {
    id: 'be-007', sessionType: 'behavioral', competency: 'learning',
    promptTemplate: 'Tell me about a time you had to quickly get up to speed on something unfamiliar to do your job.',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific learning approach and how quickly the candidate became effective, not just "I read the docs."',
  },
  {
    id: 'be-008', sessionType: 'behavioral', competency: 'prioritization',
    promptTemplate: 'Describe a time you had multiple competing priorities and had to decide what to focus on first.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'The actual tradeoff reasoning used, and what was deliberately set aside.',
  },

  // ── Portfolio Walkthrough ─────────────────────────────────────────────────
  {
    id: 'pw-001', sessionType: 'portfolio_walkthrough', competency: 'project_selection',
    promptTemplate: 'Of the projects in your portfolio, which one are you most proud of, and why that one specifically?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific project (matched against the candidate\'s real portfolio data) with a substantive reason, not just "it was fun."',
  },
  {
    id: 'pw-002', sessionType: 'portfolio_walkthrough', competency: 'problem_context',
    promptTemplate: 'Walk me through the problem this project was solving — who had the problem, and why did it matter?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A clear problem statement grounded in a real user or business need from the portfolio project description.',
  },
  {
    id: 'pw-003', sessionType: 'portfolio_walkthrough', competency: 'personal_contribution',
    promptTemplate: 'What specifically did you personally do on this project, versus the rest of the team?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A clear delineation of individual contribution distinct from team output — directly checked against the project\'s stated role.',
  },
  {
    id: 'pw-004', sessionType: 'portfolio_walkthrough', competency: 'decisions_constraints',
    promptTemplate: 'What were the biggest constraints you were working within, and what tradeoffs did those force?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A real constraint (time, resources, technical, organizational) and a specific decision it shaped.',
  },
  {
    id: 'pw-005', sessionType: 'portfolio_walkthrough', competency: 'outcome',
    promptTemplate: 'What was the actual outcome, and how do you know it worked?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A result tied to the project\'s stated metrics where they exist — do not require a number the candidate never claimed.',
  },
  {
    id: 'pw-006', sessionType: 'portfolio_walkthrough', competency: 'reflection',
    promptTemplate: 'If you were starting this project again today, what would you do differently?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A genuine, specific reflection rather than a deflecting "nothing, it went great."',
  },
]

export function getQuestionsForSessionType(sessionType: SessionType): QuestionTemplate[] {
  return QUESTION_BANK.filter((q) => q.sessionType === sessionType)
}
