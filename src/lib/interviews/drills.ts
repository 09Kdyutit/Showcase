// Deterministic drill catalog + scoring. No Gemini call — "deterministic success
// criteria" per the mission, scored by objective textual checks (word count, presence
// of structural markers), never by a model's judgment of quality. This is intentionally
// blunt: it can confirm a drill's mechanical shape (length, presence of a number,
// presence of a contrast word) but says nothing about whether the content is actually
// good. The UI must not present this as AI feedback or a quality judgment.

export type DrillType =
  | 'intro_60s' | 'tell_me_about_yourself' | 'star_structure' | 'context_no_rambling'
  | 'personal_ownership' | 'quantify_impact' | 'explain_tradeoffs' | 'clarify_question'
  | 'follow_up_handling' | 'technical_explanation' | 'portfolio_opening'
  | 'failure_reflection' | 'conflict_no_blame' | 'closing_questions' | 'time_boxed_answer'

export interface DrillCheckResult {
  passed: boolean
  score: number // 0-100, deterministic — never AI-assigned
  checks: { label: string; passed: boolean }[]
}

export interface DrillDefinition {
  id: DrillType
  label: string
  competency: string
  objective: string
  instructions: string
  prompt: string
  timeLimitSeconds: number
  minWords: number
  maxWords: number
  check: (text: string) => DrillCheckResult
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length
}

function wordCountCheck(text: string, min: number, max: number): { label: string; passed: boolean } {
  const n = wordCount(text)
  return { label: `Length is within the target range (${min}-${max} words)`, passed: n >= min && n <= max }
}

function buildResult(checks: { label: string; passed: boolean }[]): DrillCheckResult {
  const passedCount = checks.filter((c) => c.passed).length
  const score = Math.round((passedCount / checks.length) * 100)
  return { passed: passedCount === checks.length, score, checks }
}

export const DRILL_CATALOG: DrillDefinition[] = [
  {
    id: 'intro_60s', label: '60-Second Introduction', competency: 'self_presentation',
    objective: 'Deliver a tight, role-relevant introduction that fits in about 60 seconds spoken.',
    instructions: 'In about 60 seconds (roughly 120-160 words), introduce yourself for an interview: who you are, what you do, and why you\'re interviewing.',
    prompt: 'Introduce yourself as you would to open an interview.',
    timeLimitSeconds: 60, minWords: 80, maxWords: 180,
    check: (text) => buildResult([
      wordCountCheck(text, 80, 180),
      { label: 'Refers to yourself directly ("I")', passed: countMatches(text, /\bI\b/gi) >= 2 },
    ]),
  },
  {
    id: 'tell_me_about_yourself', label: 'Tell Me About Yourself', competency: 'self_presentation',
    objective: 'Answer the most common opener with a structured, role-relevant narrative, not a resume readout.',
    instructions: 'Answer "tell me about yourself" in under 90 seconds (roughly 150-280 words) — connect your background to the role without reciting your resume line by line.',
    prompt: 'Tell me about yourself.',
    timeLimitSeconds: 90, minWords: 150, maxWords: 280,
    check: (text) => buildResult([
      wordCountCheck(text, 150, 280),
      { label: 'Connects to a role or direction ("role", "looking for", "interested in")', passed: /\b(role|looking for|interested in|next step)\b/i.test(text) },
    ]),
  },
  {
    id: 'star_structure', label: 'STAR Structure', competency: 'answer_structure',
    objective: 'Practice the Situation-Task-Action-Result shape on a real example.',
    instructions: 'Tell a short story with a clear situation, what needed to happen, what you did, and the result.',
    prompt: 'Tell me about a time you solved a problem under a tight deadline.',
    timeLimitSeconds: 120, minWords: 80, maxWords: 250,
    check: (text) => buildResult([
      wordCountCheck(text, 80, 250),
      { label: 'States a personal action ("I")', passed: countMatches(text, /\bI\b/gi) >= 2 },
      { label: 'States an outcome or result', passed: /\b(result|resulted|outcome|so |which led|ended up|in the end)\b/i.test(text) },
    ]),
  },
  {
    id: 'context_no_rambling', label: 'Context Without Rambling', competency: 'concision',
    objective: 'Set up a situation concisely instead of over-explaining.',
    instructions: 'In under 120 words, set up the context for a project you worked on — just enough for a stranger to follow, no more.',
    prompt: 'Briefly set up the context for a recent project, in one tight paragraph.',
    timeLimitSeconds: 45, minWords: 20, maxWords: 120,
    check: (text) => buildResult([wordCountCheck(text, 20, 120)]),
  },
  {
    id: 'personal_ownership', label: 'Personal Ownership', competency: 'personal_ownership',
    objective: 'Make your own contribution clear, distinct from the team\'s.',
    instructions: 'Describe a project, being explicit about what you personally did versus what the team did.',
    prompt: 'What did you personally do on the last project you\'re proud of?',
    timeLimitSeconds: 90, minWords: 60, maxWords: 220,
    check: (text) => buildResult([
      wordCountCheck(text, 60, 220),
      { label: 'Uses "I" at least as often as "we"', passed: countMatches(text, /\bI\b/gi) >= countMatches(text, /\bwe\b/gi) },
    ]),
  },
  {
    id: 'quantify_impact', label: 'Quantifying Impact', competency: 'outcome_and_impact',
    objective: 'State a result with a real, specific number wherever one genuinely exists.',
    instructions: 'Describe a result you achieved and include at least one concrete number, percentage, or measurable outcome.',
    prompt: 'Describe a result from your work that you can put a number on.',
    timeLimitSeconds: 60, minWords: 30, maxWords: 150,
    check: (text) => buildResult([
      wordCountCheck(text, 30, 150),
      { label: 'Includes a number, percentage, or measurable amount', passed: /\d/.test(text) },
    ]),
  },
  {
    id: 'explain_tradeoffs', label: 'Explaining Tradeoffs', competency: 'problem_solving_process',
    objective: 'Name both sides of a real tradeoff, not just the choice you made.',
    instructions: 'Describe a decision where you had to weigh two real options against each other.',
    prompt: 'Describe a tradeoff you had to make and what you gave up by choosing one path.',
    timeLimitSeconds: 90, minWords: 40, maxWords: 200,
    check: (text) => buildResult([
      wordCountCheck(text, 40, 200),
      { label: 'Uses a contrast word (but / however / whereas / instead / trade-off)', passed: /\b(but|however|whereas|instead|trade-?off|versus|vs\.?)\b/i.test(text) },
    ]),
  },
  {
    id: 'clarify_question', label: 'Clarifying the Question', competency: 'problem_solving_process',
    objective: 'Ask a real clarifying question before answering an ambiguous prompt.',
    instructions: 'Before answering, ask at least one clarifying question about what\'s actually being asked.',
    prompt: 'A stakeholder asks you to "make the product faster." How do you respond?',
    timeLimitSeconds: 60, minWords: 20, maxWords: 150,
    check: (text) => buildResult([
      wordCountCheck(text, 20, 150),
      { label: 'Asks a clarifying question', passed: /\?/.test(text) || /\b(to (confirm|clarify)|just checking|when you say)\b/i.test(text) },
    ]),
  },
  {
    id: 'follow_up_handling', label: 'Follow-Up Handling', competency: 'follow_up_handling',
    objective: 'Answer a direct challenge head-on instead of deflecting.',
    instructions: 'Respond directly to a follow-up that pushes back on your reasoning.',
    prompt: 'Someone says: "I don\'t think that approach would have actually worked." How do you respond?',
    timeLimitSeconds: 60, minWords: 30, maxWords: 180,
    check: (text) => buildResult([
      wordCountCheck(text, 30, 180),
      { label: 'Does not open with a hedge ("well, that\'s a good question")', passed: !/^\s*(well,?\s*)?that'?s a (great|good) (question|point)/i.test(text.trim()) },
    ]),
  },
  {
    id: 'technical_explanation', label: 'Technical Concept Explanation', competency: 'role_technical_depth',
    objective: 'Explain a technical concept clearly, ideally with an analogy.',
    instructions: 'Explain a technical concept from your field to a smart non-specialist, using a comparison if it helps.',
    prompt: 'Explain a core technical concept from your field as if to someone outside it.',
    timeLimitSeconds: 90, minWords: 50, maxWords: 220,
    check: (text) => buildResult([
      wordCountCheck(text, 50, 220),
      { label: 'Uses an analogy or comparison ("like", "similar to", "think of it as")', passed: /\b(like|similar to|think of it as|analogous to|imagine)\b/i.test(text) },
    ]),
  },
  {
    id: 'portfolio_opening', label: 'Portfolio Project Opening', competency: 'context_clarity',
    objective: 'Open a project walkthrough by naming the real problem and who had it.',
    instructions: 'Open a project walkthrough by naming the actual problem and who it affected, before describing your solution.',
    prompt: 'Open your walkthrough of a portfolio project — what problem were you solving, and for whom?',
    timeLimitSeconds: 60, minWords: 30, maxWords: 150,
    check: (text) => buildResult([
      wordCountCheck(text, 30, 150),
      { label: 'Names a problem, user, or need', passed: /\b(problem|user|users|customer|need|pain point|issue)\b/i.test(text) },
    ]),
  },
  {
    id: 'failure_reflection', label: 'Failure and Reflection', competency: 'outcome_and_impact',
    objective: 'Describe a real setback with a genuine, specific lesson — not a deflection.',
    instructions: 'Describe something that didn\'t go as planned, and what you actually learned from it.',
    prompt: 'Tell me about something that did not go the way you wanted, and what you took from it.',
    timeLimitSeconds: 90, minWords: 50, maxWords: 220,
    check: (text) => buildResult([
      wordCountCheck(text, 50, 220),
      { label: 'States a specific lesson ("learned", "differently", "since then")', passed: /\b(learned|learnt|differently|since then|next time|going forward)\b/i.test(text) },
    ]),
  },
  {
    id: 'conflict_no_blame', label: 'Conflict Without Blame', competency: 'personal_ownership',
    objective: 'Describe a disagreement without putting the other person at fault.',
    instructions: 'Describe a disagreement and how it was resolved, without framing the other person as wrong or at fault.',
    prompt: 'Tell me about a disagreement with a teammate and how you resolved it.',
    timeLimitSeconds: 90, minWords: 50, maxWords: 220,
    check: (text) => buildResult([
      wordCountCheck(text, 50, 220),
      { label: 'Does not frame the other person as at fault ("their fault", "they were wrong")', passed: !/\b(their fault|they were wrong|he was wrong|she was wrong)\b/i.test(text) },
      { label: 'Mentions a resolution', passed: /\b(resolved|agreed|compromise|we decided|worked out)\b/i.test(text) },
    ]),
  },
  {
    id: 'closing_questions', label: 'Closing Questions', competency: 'answer_relevance',
    objective: 'Ask a genuine, specific question at the end of an interview, not a generic one.',
    instructions: 'Write the question you would actually ask at the end of an interview for this kind of role.',
    prompt: 'What would you ask the interviewer at the end of this conversation?',
    timeLimitSeconds: 45, minWords: 10, maxWords: 100,
    check: (text) => buildResult([
      wordCountCheck(text, 10, 100),
      { label: 'Is phrased as a question', passed: /\?/.test(text) },
    ]),
  },
  {
    id: 'time_boxed_answer', label: 'Time-Boxed Answer', competency: 'concision',
    objective: 'Answer fully within a tight word budget — practice cutting to the point.',
    instructions: 'Answer in 100 words or fewer — practice saying only what matters.',
    prompt: 'In 100 words or fewer: why should this company hire you?',
    timeLimitSeconds: 45, minWords: 15, maxWords: 100,
    check: (text) => buildResult([wordCountCheck(text, 15, 100)]),
  },
]

export function getDrillDefinition(id: string): DrillDefinition | undefined {
  return DRILL_CATALOG.find((d) => d.id === id)
}

/** Recommends drills tied to a user's actual observed weaknesses (low-scoring
 *  dimensions from recent evaluations), never to inflate engagement — mission's
 *  explicit "recommended from actual session weaknesses" requirement. Falls back to
 *  foundational drills only when there is no real weakness data yet. */
export function recommendDrillsForDimensions(weakDimensionIds: string[], limit = 3): DrillDefinition[] {
  const matched = DRILL_CATALOG.filter((d) => weakDimensionIds.includes(d.competency))
  if (matched.length > 0) return matched.slice(0, limit)
  return DRILL_CATALOG.filter((d) => d.id === 'star_structure' || d.id === 'intro_60s' || d.id === 'quantify_impact').slice(0, limit)
}
