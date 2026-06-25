// Deterministic drill catalog + scoring. No Gemini call — "deterministic success
// criteria" per the mission, scored by objective textual checks (word count, sentence
// structure, presence of required markers), never by a model's judgment of quality.
// This is intentionally structural: it confirms an answer's mechanical shape and
// required elements, not whether the content is actually good. The UI must not present
// this as AI feedback or a quality judgment.

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function count(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text)
}

function wordCountCheck(text: string, min: number, max: number): { label: string; passed: boolean } {
  const n = wordCount(text)
  return { label: `Length within target range (${min}–${max} words) — currently ${n}`, passed: n >= min && n <= max }
}

function buildResult(checks: { label: string; passed: boolean }[]): DrillCheckResult {
  const passed = checks.filter((c) => c.passed).length
  const score = Math.round((passed / checks.length) * 100)
  return { passed: passed === checks.length, score, checks }
}

// First-person past-action verb: "I built", "I led", "I designed", etc.
// The long list ensures we don't penalise unusual but valid verbs.
const FIRST_PERSON_PAST_VERB = /\bI\s+(built|made|led|wrote|designed|created|handled|drove|managed|developed|launched|shipped|fixed|solved|implemented|decided|chose|reached|established|set up|ran|owned|delivered|negotiated|coordinated|reduced|increased|improved|cut|grew|saved|scaled|automated|refactored|architected|proposed|pitched|presented|prioritised|prioritized|identified|discovered|mentored|coached|deployed|migrated|restructured|realised|realized|understood|convinced|pushed|pulled|partnered|aligned|communicated|streamlined|simplified|eliminated|reworked|rebuilt|rewrote|introduced|removed|updated|reviewed|completed|handled|led|initiated|audited|tracked|monitored|outlined|planned|negotiated|resolved|mediated|facilitated|trained|supported|advised|integrated|tested|shipped|validated|iterated|scoped|estimated|owned|championed)\b/i

// Outcome: a measurable number next to an impact word, or an explicit result verb.
const OUTCOME_WITH_NUMBER = /(\d[\d,.]*\s*(x|times|%|percent|hours?|days?|weeks?|months?|users?|customers?|calls?|tickets?|dollars?|k|m|b|ms|seconds?))|((reduced|increased|improved|cut|grew|saved|generated|onboarded|retained|eliminated|shrank|shortened|sped up|halved|doubled|tripled)\b.{0,60}\d)/i

// Time/phase marker for narrative transitions.
const TIME_MARKER = /\b(at the time|at that point|when I|before that|previously|previously|initially|after that|eventually|by the end|in the end|as a result|going forward|since then|currently|at first|once I|once we|once this)\b/i

// Forward-looking phrase for self-intros.
const FORWARD_LOOKING = /\b(which is why|that'?s why|looking to|excited (about|to)|hoping to|what draws me|what attracted me|I'?m here because|interested in (joining|this|the role)|want to bring|this opportunity|next step)\b/i

// Resolution signal for conflict/disagreement drills.
const RESOLUTION_SIGNAL = /\b(we agreed|we decided|we resolved|worked (it )?out|found a middle|compromise|common ground|got (on )?the same page|aligned on|came to an agreement|ended up|we both|the outcome was)\b/i

// Empathy signal: shows the candidate acknowledged the other person's perspective.
const EMPATHY_SIGNAL = /\b(understood (their|her|his)|from their (perspective|side|point)|see where (they|she|he)|their concern|their view|what they meant|I listened|I asked them|why they felt|acknowledged)\b/i

// ── Catalog ──────────────────────────────────────────────────────────────────

export const DRILL_CATALOG: DrillDefinition[] = [
  {
    id: 'intro_60s',
    label: '60-Second Introduction',
    competency: 'self_presentation',
    objective: 'Deliver a structured, role-relevant introduction with a clear present, past, and "why this role" thread — not a résumé summary.',
    instructions: `Write a 60-second spoken introduction (100–165 words) as you would open a real interview.
A strong intro has three parts:
1. Present — what you do or your current area (one sentence max)
2. Past — one or two specific highlights that make you interesting (NOT a chronological CV walkthrough)
3. Why here — why you're interviewing for this type of role now

Do NOT: open with "My name is…", list every job title, end without a forward-looking statement, or use the word "passionate" or "enthusiastic" as a crutch.`,
    prompt: 'Introduce yourself as you would to open an interview.',
    timeLimitSeconds: 60, minWords: 100, maxWords: 165,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 100, 165),
        {
          label: 'Uses "I" in at least 4 sentences (this is your story, not a role description)',
          passed: count(text, /\bI\b/g) >= 4,
        },
        {
          label: 'References something specific from your background (role, project, domain, or technology)',
          passed: has(lower, /\b(built|led|worked on|focused on|specialise|specialize|shipped|designed|developed|managed|started|joined|launched|ran|owned|drove)\b/),
        },
        {
          label: 'Contains a forward-looking or "why this role" statement',
          passed: has(text, FORWARD_LOOKING),
        },
        {
          label: 'Does not open with "My name is" (interviewers already know — start with what you do)',
          passed: !/^\s*my name is/i.test(text.trim()),
        },
        {
          label: 'Does not lean on vague filler adjectives ("passionate", "enthusiastic", "hardworking", "team player")',
          passed: !has(lower, /\b(passionate about|enthusiastic|hardworking|team player|go.getter|self.starter|results.driven|detail.oriented)\b/),
        },
      ])
    },
  },

  {
    id: 'tell_me_about_yourself',
    label: 'Tell Me About Yourself',
    competency: 'self_presentation',
    objective: 'Answer the most common opener with a past → present → future arc. Show narrative control — not a résumé read-out.',
    instructions: `Write 150–260 words as a TMAY answer. Strong answers follow this exact arc:
• Past — one specific thing from your background that is directly relevant (a role, decision, or project — not a list)
• Present — what you're doing or focused on right now
• Future / why here — why you're talking to this company/role today

Rules:
- Every sentence must advance the story. Cut anything that could be copy-pasted from a résumé.
- Include at least one number or concrete detail (team size, scope, metric, technology).
- Do NOT say "passionate" or "excited to learn" without substance behind it.
- The answer must end with something about why you're here, not where you studied.`,
    prompt: 'Tell me about yourself.',
    timeLimitSeconds: 90, minWords: 150, maxWords: 260,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 150, 260),
        {
          label: 'Uses "I" at least 6 times (this is a first-person narrative)',
          passed: count(text, /\bI\b/g) >= 6,
        },
        {
          label: 'Contains a time or transition marker (signals past → present → future arc)',
          passed: has(text, TIME_MARKER),
        },
        {
          label: 'Includes a concrete detail — a number, named technology, scope, or team size',
          passed: has(text, /\d/) || has(lower, /\b(team of|worked with|stack|codebase|product|users?|customers?|startup|enterprise|scale|millions?|thousands?|[a-z]+js|python|react|sql|api|ml|ai)\b/),
        },
        {
          label: 'Contains a forward-looking statement connecting your background to this opportunity',
          passed: has(text, FORWARD_LOOKING),
        },
        {
          label: 'Does not use "passionate", "enthusiastic", or "team player" as empty filler',
          passed: !has(lower, /\b(passionate|enthusiastic|team player|go-getter|self-starter)\b/),
        },
        {
          label: 'Does not mention where you studied as the ending or closing point',
          passed: !/\b(graduated|degree|university|college|studied)\b.{0,60}$/i.test(text.trim()),
        },
      ])
    },
  },

  {
    id: 'star_structure',
    label: 'STAR Structure',
    competency: 'answer_structure',
    objective: 'Tell a complete Situation → Task → Action → Result story with all four beats clearly present.',
    instructions: `Answer in 100–230 words with a complete STAR structure. Every beat must be explicit:

S — Situation: one sentence of context. When, where, what was happening.
T — Task: what needed to happen, or what you were responsible for.
A — Action: what YOU personally did. Use first-person verbs (I decided, I built, I reached out).
   The action section should be the longest. At least 2 specific actions.
R — Result: a concrete outcome. Numbers are best, but a named change is acceptable.

Common failures this drill is designed to catch:
- Opening with what you built instead of the situation
- Using "we" throughout with no "I" statements in the action
- Ending without a stated result
- Describing your role but not your specific decision or action`,
    prompt: 'Tell me about a time you had to solve a problem under time or resource pressure.',
    timeLimitSeconds: 120, minWords: 100, maxWords: 230,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 100, 230),
        {
          label: 'Uses "I" at least 4 times (the Action beat requires first-person ownership)',
          passed: count(text, /\bI\b/g) >= 4,
        },
        {
          label: 'Contains a situation marker (when/where/context — the S in STAR)',
          passed: has(lower, /\b(was working|at the time|at that point|the project|the team was|we were|I was|when I|there was|context was|background)\b/),
        },
        {
          label: 'Contains a clear first-person past-action verb (the A in STAR: "I built", "I led", "I designed"…)',
          passed: has(text, FIRST_PERSON_PAST_VERB),
        },
        {
          label: 'Contains an explicit result or outcome statement (the R in STAR)',
          passed: has(lower, /\b(result|resulted in|the outcome|which meant|we ended up|in the end|ultimately|this led to|saved|reduced|increased|improved|launched|shipped|resolved)\b/),
        },
        {
          label: 'Includes a specific detail — a number, named tool, person, or timeline',
          passed: has(text, /\d/) || has(lower, /\b(team|stakeholder|ceo|cto|pm|product manager|customer|client|sprint|deadline|days?|weeks?|months?)\b/),
        },
      ])
    },
  },

  {
    id: 'context_no_rambling',
    label: 'Context Without Rambling',
    competency: 'concision',
    objective: 'Set up a situation in exactly enough words — not more. Practice cutting filler, repeated phrases, and over-explanation.',
    instructions: `Write a 35–100 word context-setter for a project or situation. Think of this as the S+T of a STAR — just enough for a stranger to understand the stakes, nothing more.

What strong context looks like:
"At [Company], I was leading [X]. The challenge was [specific constraint or problem]. [What was at stake or why it mattered]."

What fails:
- Starting with "So basically…" or "To be honest…"
- Repeating the same point in different words
- More than 4 sentences
- Mentioning your team structure when it's irrelevant to the story`,
    prompt: 'In under 100 words, set the context for a situation where you had to make a difficult decision.',
    timeLimitSeconds: 45, minWords: 35, maxWords: 100,
    check: (text) => {
      const lower = text.toLowerCase()
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 3)
      return buildResult([
        wordCountCheck(text, 35, 100),
        {
          label: 'No more than 4 sentences (concise framing, not a full story)',
          passed: sentences.length <= 4,
        },
        {
          label: 'Does not open with a filler phrase ("So,", "Basically,", "Essentially,", "To be honest,")',
          passed: !has(lower.trim(), /^(so,?\s+|basically,?\s+|essentially,?\s+|to be honest,?\s+|you know,?\s+)/),
        },
        {
          label: 'Uses "and" fewer than 4 times (many "ands" signal run-on or list-based rambling)',
          passed: count(lower, /\band\b/g) < 4,
        },
        {
          label: 'Mentions what was at stake, constrained, or needed (not just what happened)',
          passed: has(lower, /\b(needed to|had to|required|challenge|problem|pressure|deadline|risk|goal|objective|decision|constraint)\b/),
        },
      ])
    },
  },

  {
    id: 'personal_ownership',
    label: 'Personal Ownership',
    competency: 'personal_ownership',
    objective: 'Make your individual contribution unmistakably clear — what you personally decided, built, or changed, separate from what the team did.',
    instructions: `Write 70–200 words describing a specific contribution. The test: if you removed your name from this answer, would it be obvious this was you specifically, not just "someone on the team"?

Requirements:
- Name at least 2 things you personally did (I + past-action verb)
- Explicitly contrast your role with the team's role OR describe a moment you took initiative
- Include at least one decision you made (not just a task you completed)
- Say what happened because of your specific action`,
    prompt: 'What was the most significant individual contribution you made in your last role or project?',
    timeLimitSeconds: 90, minWords: 70, maxWords: 200,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 70, 200),
        {
          label: '"I" appears at least as often as "we" (your personal role, not team role)',
          passed: count(text, /\bI\b/g) >= count(text, /\bwe\b/gi),
        },
        {
          label: 'Contains at least 2 distinct first-person past-action verbs (e.g. "I built… I decided…")',
          passed: count(text, FIRST_PERSON_PAST_VERB) >= 2,
        },
        {
          label: 'Mentions a decision you personally made (not just a task)',
          passed: has(lower, /\bI\s+(decided|chose|determined|proposed|pushed for|recommended|suggested|insisted|opted|picked|made the call)\b/),
        },
        {
          label: 'States what changed or happened because of your specific action',
          passed: has(lower, /\b(which meant|as a result|because of (this|that)|this led to|that allowed|enabled|so (that|we)|this (helped|saved|reduced|gave|created))\b/),
        },
      ])
    },
  },

  {
    id: 'quantify_impact',
    label: 'Quantifying Impact',
    competency: 'outcome_and_impact',
    objective: 'State a result with a real, meaningful number — not a year, not an age, not a count of meetings. A metric that shows actual change.',
    instructions: `Write 40–150 words describing a result from your work that includes a genuine impact metric.

What counts:
- A percentage or ratio showing before/after change ("reduced churn by 18%")
- A volume that shows scale ("handled 40,000 monthly active users")
- A time saved or time reduced ("cut deployment time from 4 hours to 20 minutes")
- A revenue, cost, or efficiency number

What does NOT count:
- Years of experience ("5 years in product")
- A date or version number
- A team size that wasn't your result

After stating the number, explain WHY it mattered — context makes numbers meaningful.`,
    prompt: 'Describe a result from your work that you can put a real number on — and explain why that number mattered.',
    timeLimitSeconds: 60, minWords: 40, maxWords: 150,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 40, 150),
        {
          label: 'Contains a number adjacent to an outcome (%, x, time unit, or volume)',
          passed: has(text, OUTCOME_WITH_NUMBER),
        },
        {
          label: 'Includes an impact verb (reduced, increased, improved, cut, grew, saved, etc.)',
          passed: has(lower, /\b(reduced|increased|improved|cut|grew|saved|generated|eliminated|shortened|sped up|halved|doubled|tripled|scaled|onboarded|retained|launched)\b/),
        },
        {
          label: 'Uses first-person ownership — this is YOUR result, not the team\'s',
          passed: has(text, /\bI\b/),
        },
        {
          label: 'Explains WHY the number mattered (context, not just the raw figure)',
          passed: has(lower, /\b(because|which meant|which (helped|allowed|enabled)|so that|this (gave|meant|allowed|saved)|the (impact|reason|significance|effect)|mattered because|important because)\b/),
        },
      ])
    },
  },

  {
    id: 'explain_tradeoffs',
    label: 'Explaining Tradeoffs',
    competency: 'problem_solving_process',
    objective: 'Name both sides of a real tradeoff, show you understood what you were giving up, and explain the reasoning — not just the conclusion.',
    instructions: `Write 60–200 words describing a decision where you weighed two real options.

A strong tradeoff answer has:
1. Option A and what it offered
2. Option B and what it offered
3. What you gave up by choosing one over the other
4. Why you made the call you did (the reasoning, not just the outcome)

Weak answers: "We chose X because it was better." You haven't named the tradeoff.
Strong answers: "We chose X, which gave us [thing]. We gave up [thing Y would have given]. I chose X because [specific reason], even though [acknowledged cost]."`,
    prompt: 'Describe a technical or strategic decision where you had to give something up. What were the two real options and why did you choose one?',
    timeLimitSeconds: 90, minWords: 60, maxWords: 200,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 60, 200),
        {
          label: 'Names two distinct options or paths (uses "either/or", "Option A/B", "one vs the other", names both alternatives)',
          passed: has(lower, /\b(either|option [a-z1-2]|approach [a-z1-2]|one option|another option|alternative|instead of|rather than|versus|vs\.?|two (options|approaches|paths|ways))\b/),
        },
        {
          label: 'Uses a contrast word to show the tradeoff (but, however, whereas, while, though, although)',
          passed: has(lower, /\b(but|however|whereas|while|though|although|on the other hand|trade-?off|gave up|sacrificed|at the cost of|at the expense of)\b/),
        },
        {
          label: 'Explicitly names what was given up or not chosen ("we gave up", "we lost", "downside was", "the cost was")',
          passed: has(lower, /\b(gave up|lost|sacrificed|downside|cost was|the risk|trade-?off was|we accepted|we knew we|couldn'?t|wouldn'?t have)\b/),
        },
        {
          label: 'States the reasoning behind the final choice (not just the conclusion)',
          passed: has(lower, /\b(because|reason was|rationale|priority was|mattered more|valued|at the time|given (that|the)|in (our|this) context|the key factor|what drove)\b/),
        },
      ])
    },
  },

  {
    id: 'clarify_question',
    label: 'Clarifying the Question',
    competency: 'problem_solving_process',
    objective: 'Before jumping to a solution, ask a specific, genuine clarifying question — and explain why you need that information.',
    instructions: `Write 30–150 words responding to the prompt below. Do NOT start with a solution.

Requirements:
1. Ask at least one clarifying question (ending in ?)
2. The question must be specific — it should reference something in the prompt, not be a generic "can you tell me more?"
3. Briefly explain WHY you need that information before jumping in
4. If you want to briefly outline what your answer might look like with different assumptions, that's fine — but a clarifying question must come first

Weak: "Can you tell me more about what you mean?"
Strong: "Before I dive in — by 'faster', do you mean page load time, API response time, or something users perceive as slow? The fix would be completely different for each."`,
    prompt: 'A stakeholder messages you: "The product feels slow. Can you look into it and fix it this week?" How do you respond?',
    timeLimitSeconds: 60, minWords: 30, maxWords: 150,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 30, 150),
        {
          label: 'Contains at least one question mark (asks, doesn\'t just tell)',
          passed: has(text, /\?/),
        },
        {
          label: 'Asks something specific about the prompt (references speed, the request, what "slow" means, priority, or scope)',
          passed: has(lower, /\b(slow|faster|speed|performance|load|page|api|which|specific|by that do you|when you say|what do you mean|what kind|what (aspect|part)|how (slow|often|much)|who|user|stakeholder|priority|this week|deadline|scope|what would)\b/),
        },
        {
          label: 'Does NOT open with an answer or solution before clarifying',
          passed: !has(lower.trim(), /^(i'?d|i would|first i'?ll|to fix|the fix|i can|i'?ll start|my approach|the solution|what i'?d do)/),
        },
        {
          label: 'Brief explanation of why the clarification matters (not just "can you tell me more")',
          passed: has(lower, /\b(because|would help|need to know|depends on|different|might|could|without knowing|to make sure|so (i|we)|to understand|to narrow)\b/),
        },
      ])
    },
  },

  {
    id: 'follow_up_handling',
    label: 'Handling Direct Pushback',
    competency: 'follow_up_handling',
    objective: 'Respond to a challenge directly — acknowledge the concern, hold your position with reasoning, or update your view if the challenge is valid.',
    instructions: `Write 40–180 words responding to a direct pushback on something you said.

A strong response:
1. Does NOT open with "That's a great question" or "I understand where you're coming from" as an empty opener
2. Directly addresses the specific concern raised
3. Either defends your position with new reasoning/evidence OR genuinely updates your view
4. Never deflects ("it depends"), never just restates the original point

Strong openings: "The concern is fair — here's why I still think…" / "That's actually something I considered. The reason I went with X is…" / "You're right that Y is a risk. What I didn't mention is…"`,
    prompt: 'You just described a technical decision you made. The interviewer pushes back: "That approach sounds overengineered for the problem size. Why not just use a simpler solution?" Respond.',
    timeLimitSeconds: 60, minWords: 40, maxWords: 180,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 40, 180),
        {
          label: 'Does NOT open with an empty validation ("that\'s a great/good question", "absolutely", "great point")',
          passed: !has(lower.trim(), /^(that'?s a (great|good|fair|interesting|valid) (question|point|challenge|concern)|absolutely|totally|definitely|of course|sure|yes,? (of course|absolutely)|you'?re (totally|absolutely) right)/),
        },
        {
          label: 'Directly addresses the "overengineered" concern (references complexity, simplicity, scale, or the tradeoff)',
          passed: has(lower, /\b(simple|simpler|complex|complex|overengineered|scale|size|scope|overhead|maintainability|trade.?off|the reason|reason for|chose this|why (I|we)|the decision)\b/),
        },
        {
          label: 'Provides a specific reason for the original choice OR explicitly updates the position',
          passed: has(lower, /\b(because|reason (was|is)|given (that|the)|at the time|in hindsight|you'?re right (that|about)|i (now|would|might)|looking back|the factor|what drove|considered|anticipat)\b/),
        },
        {
          label: 'Does not end by deflecting with "it depends" without explaining what it depends on',
          passed: !has(lower.trim(), /it depends\.?\s*$/),
        },
      ])
    },
  },

  {
    id: 'technical_explanation',
    label: 'Technical Concept Explanation',
    competency: 'role_technical_depth',
    objective: 'Explain a technical concept in plain terms — leading with what it does and why it matters, not how it works internally.',
    instructions: `Write 60–220 words explaining a technical concept from your field to a smart non-technical person.

Rules for this drill:
1. Lead with WHAT it is and WHY it exists (problem it solves) — not HOW it works
2. Use at least one analogy or real-world comparison
3. Avoid unexplained jargon — if you use a technical term, define it inline
4. End with why someone who doesn't know this concept should care

Wrong order: "X is implemented using Y and Z protocol, which enables A and B…"
Right order: "X solves the problem of [thing]. Think of it like [analogy]. In practice, it means [consequence a real person would notice]."`,
    prompt: 'Explain a core technical concept from your field — something you use regularly — to a smart colleague from a non-technical department.',
    timeLimitSeconds: 90, minWords: 60, maxWords: 220,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 60, 220),
        {
          label: 'Uses an analogy or real-world comparison ("like", "similar to", "think of it as", "imagine", "the same way")',
          passed: has(lower, /\b(like [a-z]|similar to|think of it as|analogous to|imagine|the same way|just like|kind of like|it'?s (like|similar)|compare it to|works like)\b/),
        },
        {
          label: 'Mentions WHY the concept exists or what problem it solves',
          passed: has(lower, /\b(problem (is|was|it solves)|solves|the reason|exists to|designed to|purpose is|helps (with|you|prevent|avoid)|without (it|this)|before (this|it)|used to have|used (for|to))\b/),
        },
        {
          label: 'Addresses the non-technical audience directly ("you", "your", "someone who", "in your world")',
          passed: has(lower, /\byou\b/) || has(lower, /\b(your|someone|people|non-technical|in practice|what this means|the effect|the result is)\b/),
        },
        {
          label: 'Does not open with a dictionary-style definition ("X is a technology that…", "X is a system that…")',
          passed: !has(lower.trim(), /^[a-z\s]+is an? (technology|system|protocol|tool|framework|platform|method|process|approach) that/),
        },
      ])
    },
  },

  {
    id: 'portfolio_opening',
    label: 'Portfolio Project Opening',
    competency: 'context_clarity',
    objective: 'Open a project walkthrough by establishing the PROBLEM and who had it — before mentioning any solution or technology.',
    instructions: `Write 35–150 words as the opening of a portfolio project walkthrough. You are setting up what problem you solved and for whom.

This is the frame that makes everything else in your walkthrough meaningful. Without a strong opening, your solution is just a list of features.

Strong opening structure:
"[Audience/user] was facing [specific problem]. [Why it mattered / what was at stake]. That's what [project] was built to solve."

What fails:
- Opening with "I built a [tech] app that…" — leads with solution, not problem
- "This project was for [company]" — context, not problem
- Mentioning the tech stack before the problem`,
    prompt: 'Open your walkthrough of a portfolio project — what problem were you solving, and for whom?',
    timeLimitSeconds: 60, minWords: 35, maxWords: 150,
    check: (text) => {
      const lower = text.toLowerCase()
      const firstSentence = text.split(/[.!?]/)[0].toLowerCase()
      return buildResult([
        wordCountCheck(text, 35, 150),
        {
          label: 'Names a specific problem, pain point, or gap (not a feature)',
          passed: has(lower, /\b(problem|pain point|challenge|gap|struggle|friction|inefficiency|difficult|hard to|couldn'?t|no way to|lacked|missing|frustrated|tedious|manual|broken|slow)\b/),
        },
        {
          label: 'Names who had the problem (a specific audience — users, customers, team, role)',
          passed: has(lower, /\b(users?|customers?|team|clients?|companies|businesses|developers?|designers?|managers?|students?|patients?|freelancers?|founders?|people (who|that))\b/),
        },
        {
          label: 'Does NOT open the first sentence with the solution or technology',
          passed: !has(firstSentence, /^(i built|i created|i designed|i made|i developed|this (is|was) a|my (project|app|tool|site))/),
        },
        {
          label: 'States why the problem mattered (stakes, consequences, or scale)',
          passed: has(lower, /\b(matter|important|significant|cost|waste|time|money|risk|impact|every (day|week|month)|frequently|often|common|major|critical|painful)\b/),
        },
      ])
    },
  },

  {
    id: 'failure_reflection',
    label: 'Failure and Reflection',
    competency: 'outcome_and_impact',
    objective: 'Describe a real setback with genuine personal ownership and a specific, earned lesson — not a deflection or a humble-brag.',
    instructions: `Write 60–220 words about something that didn't go as planned.

What separates strong answers from weak ones:
- Strong: you are the subject — "I misjudged", "I didn't push back early enough", "I underestimated"
- Weak: circumstance is the subject — "The project ran into issues", "Things didn't work out"

Requirements:
1. Name what specifically went wrong (not "things didn't go as planned")
2. Own your role in it — use first person in the failure, not passive voice
3. State a concrete, specific lesson (not "I learned the importance of communication")
4. Mention something you did differently after — not just something you'd do differently`,
    prompt: 'Tell me about something that went wrong on a project and what you personally took from it.',
    timeLimitSeconds: 90, minWords: 60, maxWords: 220,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 60, 220),
        {
          label: 'Names what specifically went wrong (not just "things were challenging")',
          passed: has(lower, /\b(misjudged|underestimated|missed|failed to|didn'?t (see|realise|realize|anticipate|communicate|push|ask|check|test|catch|flag)|too (late|slow|confident|optimistic)|assumed|over-?looked|neglected)\b/),
        },
        {
          label: 'Uses first-person ownership in the failure (not passive voice or circumstance-as-subject)',
          passed: has(lower, /\bI\s+(misjudged|underestimated|failed|missed|didn'?t|made|assumed|was (too|wrong|overconfident|late)|should have|could have)\b/),
        },
        {
          label: 'States a specific lesson (more than "I learned communication is important")',
          passed: has(lower, /\b(since then|after that|going forward|now I|I (now|always|make sure to|started|began|stopped|ask|check|flag|test|verify|communicate|surface|push back)|next time|changed how|do differently)\b/),
        },
        {
          label: 'Mentions something you ACTUALLY changed or did differently — not just in theory',
          passed: has(lower, /\b(since then|after that|from then on|now I|started doing|changed (my|how|the)|began|the (next|following)|stopped|made it a habit|put in place|implemented)\b/),
        },
      ])
    },
  },

  {
    id: 'conflict_no_blame',
    label: 'Conflict Without Blame',
    competency: 'personal_ownership',
    objective: 'Describe a disagreement without making the other person the villain — show you understood their perspective and focused on resolution.',
    instructions: `Write 60–220 words about a disagreement with a colleague. This drill specifically tests whether you can describe conflict without framing the other person as wrong.

Structure for strong answers:
1. What the disagreement was about (topic, not personality)
2. What the other person's position was and why it made sense from their perspective
3. What you personally did to work toward resolution
4. How it was resolved

Red flags that will fail this drill:
- Describing the other person's character negatively ("they were stubborn", "they refused to listen")
- Blaming the outcome on them ("if they had just listened", "they were wrong and eventually agreed")
- A resolution where you simply won and they came around`,
    prompt: 'Tell me about a disagreement with a colleague or stakeholder — what it was about, how you handled it, and how it was resolved.',
    timeLimitSeconds: 90, minWords: 60, maxWords: 220,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 60, 220),
        {
          label: 'Does not frame the other person as wrong, stubborn, or difficult',
          passed: !has(lower, /\b(their fault|they were wrong|he was wrong|she was wrong|refused to (listen|see|understand|budge)|just wouldn'?t|too stubborn|unreasonable|kept insisting incorrectly)\b/),
        },
        {
          label: 'Shows understanding of the other person\'s perspective ("from their side", "I understood why", "their concern was")',
          passed: has(text, EMPATHY_SIGNAL) || has(lower, /\b(from their (perspective|point|side)|their concern|i (understood|could see|appreciated|recognised|recognized) (why|that|their)|where they were coming from|why they felt)\b/),
        },
        {
          label: 'Names what YOU personally did to move toward resolution',
          passed: has(text, FIRST_PERSON_PAST_VERB) || has(lower, /\bI\s+(suggested|proposed|asked|listened|scheduled|set up|reached out|initiated|brought|offered|tried|worked)\b/),
        },
        {
          label: 'States a resolution — even a partial one',
          passed: has(text, RESOLUTION_SIGNAL),
        },
      ])
    },
  },

  {
    id: 'closing_questions',
    label: 'Meaningful Closing Questions',
    competency: 'answer_relevance',
    objective: 'Ask a specific, substantive question that reveals curiosity and preparation — not a generic or salary-related question.',
    instructions: `Write 15–120 words containing one or more genuine closing questions you would ask at the end of this type of interview.

Strong closing questions:
- Are specific to the role, team, or company (not Google-able)
- Ask about something that would affect whether you'd want to join (real curiosity)
- Show you've thought about the role's real challenges
- Could not be answered from the job description alone

Weak closing questions:
- "What does a typical day look like?" (generic)
- "What are the growth opportunities?" (generic)
- "What's the team culture like?" (too vague)
- "What's the salary?" (wait for an offer)`,
    prompt: 'What would you genuinely ask the interviewer at the end of this conversation?',
    timeLimitSeconds: 45, minWords: 15, maxWords: 120,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 15, 120),
        {
          label: 'Contains at least one question mark',
          passed: has(text, /\?/),
        },
        {
          label: 'Question is substantive — more than 10 words before the question mark',
          passed: has(text, /\b.{10,}\?/),
        },
        {
          label: 'Does not ask about salary, compensation, or benefits',
          passed: !has(lower, /\b(salary|compensation|pay|benefits|equity|stock|bonus|raise|how much|total package)\b/),
        },
        {
          label: 'Asks about something specific: team dynamics, challenges, the role\'s success definition, the product, or the company direction',
          passed: has(lower, /\b(biggest (challenge|problem|priority)|what (does success|would success)|how does the team|what the team|current challenges|how do you|what'?s it like|what are you (working on|focused on|most excited)|how (is|are)|roadmap|direction|decision.making|how decisions|technical (debt|direction|priorities)|what matters|hard part|difficult (about|part))\b/),
        },
      ])
    },
  },

  {
    id: 'time_boxed_answer',
    label: 'Time-Boxed Answer',
    competency: 'concision',
    objective: 'Make a compelling, specific case in 100 words or fewer — no padding, every sentence earns its place.',
    instructions: `Answer in exactly 100 words or fewer. Every word must count.

What fails this drill:
- Generic filler ("I'm a hard worker", "I'm passionate about this field")
- Restating the question
- Vague superlatives ("I'm one of the best…")

What passes:
- A specific claim about what you bring, with one concrete example to back it up
- "Because" — you need to tell them why, not just what
- A clear, direct close that shows you know what you're asking for`,
    prompt: 'In 100 words or fewer: why should this company hire you specifically?',
    timeLimitSeconds: 45, minWords: 20, maxWords: 100,
    check: (text) => {
      const lower = text.toLowerCase()
      return buildResult([
        wordCountCheck(text, 20, 100),
        {
          label: 'Stays at or under 100 words (the whole point of this drill)',
          passed: wordCount(text) <= 100,
        },
        {
          label: 'Makes a specific claim about your background or skillset (not just "I work hard")',
          passed: has(lower, /\b(built|shipped|led|managed|reduced|increased|improved|designed|created|developed|launched|solved|owned|delivered)\b/),
        },
        {
          label: 'Contains a "because" or reasoning connector (shows why, not just what)',
          passed: has(lower, /\b(because|which means|which (gives|allows)|so that|which is why|the reason|that'?s why|this (means|gives|allows)|proven (by|through|with)|evidenced)\b/),
        },
        {
          label: 'Does not rely on vague adjectives ("passionate", "dedicated", "hardworking", "team player")',
          passed: !has(lower, /\b(passionate about|dedicated|hardworking|team player|go-getter|self-starter|results-driven|detail-oriented|quick learner)\b/),
        },
      ])
    },
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
