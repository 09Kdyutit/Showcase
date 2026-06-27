// Deterministic prohibited-question filtering - regex/keyword based, NOT a model call.
// The mission is explicit: this must be deterministic. A model-based safety check would
// itself need a safety check (and could be prompt-injected), so the gate that actually
// blocks a question from reaching a user must not depend on Gemini being well-behaved.
// This runs against every question before it is shown: static question-bank templates,
// Gemini-personalized wording, and Gemini-generated adaptive follow-ups alike.

export interface QuestionSafetyResult {
  safe: boolean
  category: string | null
  matchedPhrase: string | null
}

interface ProhibitedCategory {
  category: string
  patterns: RegExp[]
}

// Each pattern targets the question ASKING ABOUT or trying to INFER the protected
// characteristic - not every mention of a related word. "Are you legally authorized to
// work" must stay allowed even though it is adjacent to "citizenship" topics; that
// exact carve-out is enforced by the ALLOWLIST_PATTERNS below, checked first.
const PROHIBITED_CATEGORIES: ProhibitedCategory[] = [
  {
    category: 'age',
    patterns: [
      /how old are you/i, /what(?:'s| is) your age/i, /when (?:were you born|did you graduate high school)/i,
      /what year were you born/i, /your date of birth/i,
    ],
  },
  {
    category: 'race_ethnicity',
    patterns: [
      /what(?:'s| is) your (?:race|ethnicity|ethnic background|nationality)\b/i,
      /where (?:are you|is your family) (?:originally )?from\b.*(?:ethnic|race|nation)/i,
      /what(?:'s| is) your (?:native|first) language\b.*(?:race|ethnic|ancestry)/i,
    ],
  },
  {
    category: 'religion',
    patterns: [/what(?:'s| is) your religion\b/i, /do you (?:practice|attend) (?:a religion|church|temple|mosque|synagogue)/i, /what religious holidays/i],
  },
  {
    category: 'pregnancy_family_plans',
    patterns: [
      /are you pregnant/i, /do you plan(?:s|ning)? (?:to have|on having) (?:kids|children)/i,
      /how many children do you have/i, /are you planning a family/i, /do you have (?:young )?kids at home/i,
    ],
  },
  {
    category: 'marital_status',
    patterns: [/are you married/i, /what(?:'s| is) your marital status/i, /do you have a (?:spouse|husband|wife|partner)/i],
  },
  {
    category: 'disability_medical',
    patterns: [
      /do you have (?:a |any )?disabilit(?:y|ies)/i, /what(?:'s| is) your medical history/i,
      /are you (?:currently )?taking (?:any )?medication/i, /do you have (?:a |any )?(?:mental|physical|medical) (?:illness|condition)\b(?!.*accommodat)/i,
    ],
  },
  {
    category: 'sexual_orientation',
    patterns: [/what(?:'s| is) your sexual orientation/i, /are you (?:gay|straight|bisexual|lgbtq)/i],
  },
  {
    category: 'citizenship_beyond_work_authorization',
    patterns: [
      /what(?:'s| is) your citizenship status/i, /are you a (?:u\.?s\.?|american) citizen/i,
      /what country are you a citizen of/i,
    ],
  },
  {
    category: 'genetic_information',
    patterns: [/family medical history/i, /genetic (?:test|condition|information)/i, /history of illness in your family/i],
  },
  {
    category: 'political_union_status',
    patterns: [/who did you vote for/i, /what(?:'s| is) your political (?:affiliation|party)/i, /are you (?:a member of|in) a union/i],
  },
  {
    category: 'salary_history',
    patterns: [/what (?:is|was) your (?:current|previous|last) salary/i, /how much (?:do|did) you (?:currently )?(?:make|earn)/i],
  },
]

// Neutral, job-relevant questions that are adjacent in wording to a prohibited
// category but are explicitly allowed by the mission. Checked first - if a question
// matches an allowlist pattern, it is safe regardless of any prohibited-pattern match.
const ALLOWLIST_PATTERNS: RegExp[] = [
  /are you legally authorized to work/i,
  /do you require (?:visa )?sponsorship/i,
  /are you able to meet the (?:role'?s )?(?:stated )?(?:schedule|travel|on-call) requirements/i,
  /are you able to work the hours (?:required|listed) for this role/i,
  /are you willing to relocate/i,
]

export function checkQuestionSafety(questionText: string): QuestionSafetyResult {
  for (const pattern of ALLOWLIST_PATTERNS) {
    if (pattern.test(questionText)) return { safe: true, category: null, matchedPhrase: null }
  }

  for (const { category, patterns } of PROHIBITED_CATEGORIES) {
    for (const pattern of patterns) {
      const match = questionText.match(pattern)
      if (match) return { safe: false, category, matchedPhrase: match[0] }
    }
  }

  return { safe: true, category: null, matchedPhrase: null }
}

/** Filters a batch of question texts, returning only the safe ones plus a report of
 *  what was blocked - used by the plan builder so an unsafe question can never reach
 *  storage or a user, and by callers that want visibility into what was filtered. */
export function filterUnsafeQuestions<T extends { questionText: string }>(
  questions: T[]
): { safeQuestions: T[]; blocked: { question: T; result: QuestionSafetyResult }[] } {
  const safeQuestions: T[] = []
  const blocked: { question: T; result: QuestionSafetyResult }[] = []
  for (const q of questions) {
    const result = checkQuestionSafety(q.questionText)
    if (result.safe) safeQuestions.push(q)
    else blocked.push({ question: q, result })
  }
  return { safeQuestions, blocked }
}
