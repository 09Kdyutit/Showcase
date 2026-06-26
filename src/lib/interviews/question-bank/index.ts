import type { SessionType, Difficulty } from '../schemas.ts'

export const QUESTION_BANK_VERSION = '2026-06-25.1'

export interface QuestionTemplate {
  id: string
  sessionType: SessionType
  competency: string
  /** May contain {{targetRole}} / {{targetCompany}} placeholders, substituted by the
   *  plan builder. Gemini may further personalize wording around this template but
   *  must preserve the question's actual intent  -  see src/lib/interviews/prompts. */
  promptTemplate: string
  /** Spoken version for live voice sessions  -  shorter, natural verbal phrasing.
   *  Falls back to promptTemplate if absent. */
  voicePromptTemplate?: string
  applicableRoles: 'any' | string[]
  difficulty: Difficulty
  expectedEvidence: string
}

// Deliberately a curated, versioned set rather than an exhaustive one  -  the mission is
// explicit that quality matters more than count ("do not fill the bank with low-quality
// repetitive questions merely to claim a high count"). Covers all 10 session types
// modeled in the schema/rubric layers (see rubrics.ts's RUBRIC_PROFILES, which already
// defined weights for all 10 before this bank had templates to back them).
export const QUESTION_BANK: QuestionTemplate[] = [
  // ── Recruiter Screen ──────────────────────────────────────────────────────
  {
    id: 'rs-001', sessionType: 'recruiter_screen', competency: 'background_summary',
    promptTemplate: 'Walk me through your background and what brought you to apply for {{targetRole}} roles.',
    voicePromptTemplate: 'So to start  -  walk me through your background and what drew you to {{targetRole}} roles.',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A coherent narrative connecting past experience to the target role, not a verbatim resume readout.',
  },
  {
    id: 'rs-002', sessionType: 'recruiter_screen', competency: 'motivation',
    promptTemplate: "What's drawing you to this kind of role right now?",
    voicePromptTemplate: "What's pulling you toward this kind of work right now?",
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific, credible reason tied to the candidate\'s actual trajectory, not a generic "I love challenges" answer.',
  },
  {
    id: 'rs-003', sessionType: 'recruiter_screen', competency: 'role_fit',
    promptTemplate: 'Which parts of the {{targetRole}} role do you think will come most naturally to you, and which will stretch you?',
    voicePromptTemplate: 'Which parts of a {{targetRole}} role come naturally to you  -  and where do you think you\'ll be stretched?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'Honest self-assessment referencing concrete skills or experiences, not pure platitude.',
  },
  {
    id: 'rs-004', sessionType: 'recruiter_screen', competency: 'availability_logistics',
    promptTemplate: 'Are you able to meet the role\'s stated schedule and any travel requirements?',
    voicePromptTemplate: 'Any concerns on your end about schedule or travel requirements?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A direct yes/no/conditional answer  -  this is a logistics question, not a behavioral one.',
  },
  {
    id: 'rs-005', sessionType: 'recruiter_screen', competency: 'career_transition',
    promptTemplate: 'What made you decide to look for something new at this point in your career?',
    voicePromptTemplate: 'What made this the right time to look for something new?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A reason that is candid and forward-looking, without disparaging a past employer.',
  },
  {
    id: 'rs-006', sessionType: 'recruiter_screen', competency: 'high_level_experience',
    promptTemplate: 'In two or three sentences, what is the work you are most known for in your current or most recent role?',
    voicePromptTemplate: 'In two or three sentences  -  what are you most known for in your current or most recent role?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A concise, specific summary  -  tests concision and self-framing in a single short answer.',
  },

  // ── Behavioral ────────────────────────────────────────────────────────────
  {
    id: 'be-001', sessionType: 'behavioral', competency: 'conflict',
    promptTemplate: 'Tell me about a time you disagreed with a teammate or manager about how to approach something. What happened?',
    voicePromptTemplate: 'Tell me about a time you disagreed with your manager or a teammate. What happened?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A real disagreement with the candidate\'s specific position, how it was resolved, and what changed (or didn\'t).',
  },
  {
    id: 'be-002', sessionType: 'behavioral', competency: 'failure',
    promptTemplate: 'Describe a project or decision that did not go the way you expected. What did you learn?',
    voicePromptTemplate: 'Walk me through a project or decision that didn\'t go the way you expected. What did you take away from it?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A genuine setback (not a thinly-disguised humble-brag), the candidate\'s specific role in it, and a real lesson applied afterward.',
  },
  {
    id: 'be-003', sessionType: 'behavioral', competency: 'ownership',
    promptTemplate: 'Tell me about a time you took ownership of something that wasn\'t explicitly your responsibility.',
    voicePromptTemplate: 'Tell me about a time you stepped up for something that wasn\'t technically your job.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A specific gap the candidate noticed and acted on, with a clear personal (not team) action.',
  },
  {
    id: 'be-004', sessionType: 'behavioral', competency: 'ambiguity',
    promptTemplate: 'Describe a situation where you had to make progress without complete information or clear direction.',
    voicePromptTemplate: 'Tell me about a time you had to keep moving without having all the information or direction you needed.',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'How the candidate structured their approach under uncertainty  -  assumptions made, how they validated them.',
  },
  {
    id: 'be-005', sessionType: 'behavioral', competency: 'collaboration',
    promptTemplate: 'Tell me about a project where you depended heavily on people outside your immediate team. How did you keep things moving?',
    voicePromptTemplate: 'Tell me about a project where you really had to depend on people outside your team. How did you keep things moving?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'Specific coordination mechanisms or relationship-building actions, not a vague "we communicated well."',
  },
  {
    id: 'be-006', sessionType: 'behavioral', competency: 'leadership',
    promptTemplate: 'Describe a time you had to influence a decision without having formal authority over the outcome.',
    voicePromptTemplate: 'Tell me about a time you had to influence a decision without having any formal authority over it.',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A concrete persuasion approach and what ultimately happened, including pushback faced.',
  },
  {
    id: 'be-007', sessionType: 'behavioral', competency: 'learning',
    promptTemplate: 'Tell me about a time you had to quickly get up to speed on something unfamiliar to do your job.',
    voicePromptTemplate: 'Tell me about a time you had to get up to speed on something completely unfamiliar, pretty fast.',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific learning approach and how quickly the candidate became effective, not just "I read the docs."',
  },
  {
    id: 'be-008', sessionType: 'behavioral', competency: 'prioritization',
    promptTemplate: 'Describe a time you had multiple competing priorities and had to decide what to focus on first.',
    voicePromptTemplate: 'Walk me through a time you had too many things competing for your attention. How did you decide what to focus on?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'The actual tradeoff reasoning used, and what was deliberately set aside.',
  },

  // ── Portfolio Walkthrough ─────────────────────────────────────────────────
  {
    id: 'pw-001', sessionType: 'portfolio_walkthrough', competency: 'project_selection',
    promptTemplate: 'Of the projects in your portfolio, which one are you most proud of, and why that one specifically?',
    voicePromptTemplate: 'Looking at your portfolio  -  which project are you most proud of, and why that one?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific project (matched against the candidate\'s real portfolio data) with a substantive reason, not just "it was fun."',
  },
  {
    id: 'pw-002', sessionType: 'portfolio_walkthrough', competency: 'problem_context',
    promptTemplate: 'Walk me through the problem this project was solving  -  who had the problem, and why did it matter?',
    voicePromptTemplate: 'Walk me through the problem this project was solving. Who had it, and why did it matter?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A clear problem statement grounded in a real user or business need from the portfolio project description.',
  },
  {
    id: 'pw-003', sessionType: 'portfolio_walkthrough', competency: 'personal_contribution',
    promptTemplate: 'What specifically did you personally do on this project, versus the rest of the team?',
    voicePromptTemplate: 'What did you personally do on this project  -  as opposed to the rest of the team?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A clear delineation of individual contribution distinct from team output  -  directly checked against the project\'s stated role.',
  },
  {
    id: 'pw-004', sessionType: 'portfolio_walkthrough', competency: 'decisions_constraints',
    promptTemplate: 'What were the biggest constraints you were working within, and what tradeoffs did those force?',
    voicePromptTemplate: 'What were the biggest constraints on this project, and what did those force you to give up?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A real constraint (time, resources, technical, organizational) and a specific decision it shaped.',
  },
  {
    id: 'pw-005', sessionType: 'portfolio_walkthrough', competency: 'outcome',
    promptTemplate: 'What was the actual outcome, and how do you know it worked?',
    voicePromptTemplate: 'What was the actual result  -  and how do you know it worked?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A result tied to the project\'s stated metrics where they exist  -  do not require a number the candidate never claimed.',
  },
  {
    id: 'pw-006', sessionType: 'portfolio_walkthrough', competency: 'reflection',
    promptTemplate: 'If you were starting this project again today, what would you do differently?',
    voicePromptTemplate: 'If you were starting this project over today, what would you do differently?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A genuine, specific reflection rather than a deflecting "nothing, it went great."',
  },

  // ── Hiring Manager ────────────────────────────────────────────────────────
  {
    id: 'hm-001', sessionType: 'hiring_manager', competency: 'role_motivation',
    promptTemplate: 'Why this {{targetRole}} role specifically, and what makes you confident you\'d be effective in it?',
    voicePromptTemplate: 'Why this {{targetRole}} role  -  and what makes you confident you\'d be effective in it?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A reason grounded in the candidate\'s actual experience and the role\'s real demands, not a generic pitch.',
  },
  {
    id: 'hm-002', sessionType: 'hiring_manager', competency: 'technical_judgment',
    promptTemplate: 'Tell me about a decision you made that you\'d defend even though not everyone agreed with it.',
    voicePromptTemplate: 'Tell me about a call you made that you\'d still stand behind, even though not everyone agreed.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A specific decision, the reasoning behind it, who disagreed and why, and the actual outcome.',
  },
  {
    id: 'hm-003', sessionType: 'hiring_manager', competency: 'team_leadership',
    promptTemplate: 'Describe how you\'ve handled a direct report or teammate who was underperforming.',
    voicePromptTemplate: 'How have you handled a situation where someone on your team wasn\'t performing?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A concrete intervention, what was communicated, and the measurable result  -  not a platitude about "coaching."',
  },
  {
    id: 'hm-004', sessionType: 'hiring_manager', competency: 'conflict_resolution',
    promptTemplate: 'Tell me about the most significant disagreement you\'ve had with your manager. How did you handle it?',
    voicePromptTemplate: 'What\'s the most significant disagreement you\'ve had with a manager, and how did you handle it?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A real disagreement with the candidate\'s actual position and how it was ultimately resolved.',
  },
  {
    id: 'hm-005', sessionType: 'hiring_manager', competency: 'decision_making',
    promptTemplate: 'Walk me through how you decide what to prioritize when everything feels urgent.',
    voicePromptTemplate: 'How do you decide what to focus on when everything feels equally urgent?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A specific, repeatable approach with a real example, not an abstract framework recited from memory.',
  },
  {
    id: 'hm-006', sessionType: 'hiring_manager', competency: 'growth_potential',
    promptTemplate: 'What is the biggest gap in your skills right now, and what are you actually doing about it?',
    voicePromptTemplate: 'What\'s the biggest gap in your skills right now  -  and what are you actually doing about it?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'Genuine self-awareness and a concrete, current action  -  not a rehearsed "weakness that\'s actually a strength."',
  },

  // ── Project Deep Dive ─────────────────────────────────────────────────────
  {
    id: 'pd-001', sessionType: 'project_deep_dive', competency: 'technical_architecture',
    promptTemplate: 'Pick a project you know deeply and walk me through how it was architected, end to end.',
    voicePromptTemplate: 'Pick a project you know really well and walk me through how it was built, end to end.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A coherent system-level explanation with real components and how they connected  -  checked against the candidate\'s actual project evidence where available.',
  },
  {
    id: 'pd-002', sessionType: 'project_deep_dive', competency: 'tradeoffs',
    promptTemplate: 'What was the hardest technical tradeoff you made on that project, and what did you give up?',
    voicePromptTemplate: 'What was the hardest technical tradeoff you made on that project?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A specific tradeoff with both sides named and a defensible reason for the choice made.',
  },
  {
    id: 'pd-003', sessionType: 'project_deep_dive', competency: 'scaling_challenges',
    promptTemplate: 'Did this project ever hit a limit  -  performance, scale, or otherwise? What happened and what did you do?',
    voicePromptTemplate: 'Did this project ever hit a wall  -  performance, scale, anything like that? What happened?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A concrete failure or limit encountered, diagnosis steps taken, and the actual fix or mitigation.',
  },
  {
    id: 'pd-004', sessionType: 'project_deep_dive', competency: 'debugging_process',
    promptTemplate: 'Tell me about the most difficult bug or issue you tracked down on this project.',
    voicePromptTemplate: 'Tell me about the most difficult bug you tracked down on this project.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A specific symptom, the investigation process, and the root cause  -  not just "we fixed it."',
  },
  {
    id: 'pd-005', sessionType: 'project_deep_dive', competency: 'collaboration_handoffs',
    promptTemplate: 'Who else did this project depend on, and where did your work hand off to theirs?',
    voicePromptTemplate: 'Who else did this project depend on, and where did your work hand off to theirs?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A clear boundary between the candidate\'s contribution and others\', with specifics on the interface between them.',
  },
  {
    id: 'pd-006', sessionType: 'project_deep_dive', competency: 'technical_ownership',
    promptTemplate: 'What part of this project\'s technical direction did you personally drive, versus follow?',
    voicePromptTemplate: 'What part of the technical direction did you personally own  -  versus following someone else\'s lead?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific decision or direction the candidate personally owned, distinguishable from work assigned to them.',
  },

  // ── Technical Concept ─────────────────────────────────────────────────────
  {
    id: 'tc-001', sessionType: 'technical_concept', competency: 'concept_explanation',
    promptTemplate: 'Explain a core technical concept from your field to someone who is smart but not a specialist in it.',
    voicePromptTemplate: 'Explain a core concept from your field to someone who\'s smart but not a specialist.',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A correct, clear explanation that builds from fundamentals without relying on unexplained jargon.',
  },
  {
    id: 'tc-002', sessionType: 'technical_concept', competency: 'system_design_tradeoffs',
    promptTemplate: 'When would you choose one common technical approach over another in your field, and why?',
    voicePromptTemplate: 'When would you choose one common approach over another in your field? Walk me through the tradeoff.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A real tradeoff comparison naming concrete conditions under which each choice wins.',
  },
  {
    id: 'tc-003', sessionType: 'technical_concept', competency: 'debugging_reasoning',
    promptTemplate: 'Walk me through how you would investigate a problem you\'ve never seen before in a system you\'re unfamiliar with.',
    voicePromptTemplate: 'Walk me through how you\'d investigate a problem you\'ve never seen, in a system you\'re unfamiliar with.',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A structured investigation method  -  narrowing scope, forming hypotheses, testing them  -  not a guess-and-check description.',
  },
  {
    id: 'tc-004', sessionType: 'technical_concept', competency: 'performance_optimization',
    promptTemplate: 'How would you approach making something measurably faster or more efficient without knowing in advance where the bottleneck is?',
    voicePromptTemplate: 'How do you approach making something faster when you don\'t yet know where the bottleneck is?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A measurement-first approach: how to identify the actual bottleneck before proposing a fix.',
  },
  {
    id: 'tc-005', sessionType: 'technical_concept', competency: 'technical_communication',
    promptTemplate: 'Explain why a fundamental concept in your field matters in practice, not just in theory.',
    voicePromptTemplate: 'Explain why a fundamental concept in your field actually matters in practice  -  not just in theory.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A grounded, practical connection between theory and a real consequence of getting it wrong.',
  },
  {
    id: 'tc-006', sessionType: 'technical_concept', competency: 'concept_explanation',
    promptTemplate: 'What is a concept in your field that is commonly misunderstood, and what is the correct way to think about it?',
    voicePromptTemplate: 'What\'s a concept in your field that\'s commonly misunderstood  -  and what\'s the right way to think about it?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'An accurate correction of a real, common misconception with a clear explanation of the right model.',
  },

  // ── Case / Problem Solving ────────────────────────────────────────────────
  {
    id: 'cp-001', sessionType: 'case_problem_solving', competency: 'clarification',
    promptTemplate: 'A key metric for {{targetCompany}} dropped 20% last week with no obvious cause. How would you start investigating?',
    voicePromptTemplate: 'A key metric at {{targetCompany}} dropped 20% last week with no obvious cause. Where do you start?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'Clarifying questions asked before jumping to conclusions, and a structured first step.',
  },
  {
    id: 'cp-002', sessionType: 'case_problem_solving', competency: 'structured_reasoning',
    promptTemplate: 'Walk me through how you\'d break down an ambiguous, open-ended problem into something actionable.',
    voicePromptTemplate: 'How do you take a vague, open-ended problem and turn it into something you can actually act on?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A visible reasoning framework  -  decomposition, prioritization, hypothesis testing  -  applied to a concrete scenario.',
  },
  {
    id: 'cp-003', sessionType: 'case_problem_solving', competency: 'prioritization',
    promptTemplate: 'You have three plausible causes for a problem and limited time to investigate. How do you decide where to look first?',
    voicePromptTemplate: 'You have three possible causes for a problem and limited time. How do you decide where to look first?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A reasoned prioritization based on likelihood, cost of investigation, or impact  -  not an arbitrary pick.',
  },
  {
    id: 'cp-004', sessionType: 'case_problem_solving', competency: 'estimation',
    promptTemplate: 'How would you estimate the scale of a problem when you don\'t have exact data available?',
    voicePromptTemplate: 'How do you estimate the scale of a problem when you don\'t have exact data?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A defensible estimation approach with explicit assumptions stated, not a number pulled from nowhere.',
  },
  {
    id: 'cp-005', sessionType: 'case_problem_solving', competency: 'recommendation',
    promptTemplate: 'Having investigated the problem, how would you decide what to actually recommend doing about it?',
    voicePromptTemplate: 'After investigating a problem, how do you decide what to actually recommend?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A recommendation tied directly back to the stated reasoning, including tradeoffs of the chosen path.',
  },
  {
    id: 'cp-006', sessionType: 'case_problem_solving', competency: 'structured_reasoning',
    promptTemplate: 'Talk me through a time you solved a problem that initially seemed too vague to even start on.',
    voicePromptTemplate: 'Tell me about a time you solved a problem that was so vague you didn\'t even know where to start.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'How the candidate turned ambiguity into a concrete first step, with a real example.',
  },

  // ── Presentation Defense ──────────────────────────────────────────────────
  {
    id: 'pde-001', sessionType: 'presentation_defense', competency: 'summarizing_clearly',
    promptTemplate: 'In two minutes, summarize the work you\'re about to defend and why it matters.',
    voicePromptTemplate: 'In about two minutes  -  summarize what you\'re defending and why it matters.',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A concise, structured summary that a non-expert could follow, within a reasonable time.',
  },
  {
    id: 'pde-002', sessionType: 'presentation_defense', competency: 'defending_decisions',
    promptTemplate: 'Why did you choose this approach instead of the most obvious alternative?',
    voicePromptTemplate: 'Why did you go with this approach instead of the most obvious alternative?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A specific alternative named and a substantive reason for rejecting it, not just restating the chosen approach.',
  },
  {
    id: 'pde-003', sessionType: 'presentation_defense', competency: 'handling_pushback',
    promptTemplate: 'Suppose someone on the panel strongly disagrees with your core recommendation. How do you respond?',
    voicePromptTemplate: 'Suppose someone on the panel strongly disagrees with your recommendation. How do you respond?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A response that engages with the substance of the disagreement rather than dismissing or capitulating immediately.',
  },
  {
    id: 'pde-004', sessionType: 'presentation_defense', competency: 'audience_adaptation',
    promptTemplate: 'How would your explanation change if you were presenting this to someone with no technical background at all?',
    voicePromptTemplate: 'How would you explain this to someone with no technical background?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A genuinely simplified explanation that preserves accuracy, not just a shorter version of the same jargon.',
  },
  {
    id: 'pde-005', sessionType: 'presentation_defense', competency: 'recommendation_confidence',
    promptTemplate: 'What is the part of your recommendation you are least confident about, and why?',
    voicePromptTemplate: 'What\'s the part of your recommendation you\'re least confident about?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'Genuine, specific uncertainty acknowledged  -  not false confidence or a deflecting non-answer.',
  },
  {
    id: 'pde-006', sessionType: 'presentation_defense', competency: 'defending_decisions',
    promptTemplate: 'What would have to be true for your recommendation to be wrong?',
    voicePromptTemplate: 'What would have to be true for your recommendation to be wrong?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A real falsifying condition identified, showing the candidate has stress-tested their own conclusion.',
  },

  // ── Job-Specific Full Loop ────────────────────────────────────────────────
  {
    id: 'jf-001', sessionType: 'job_specific_full_loop', competency: 'requirement_alignment',
    promptTemplate: 'Looking at the requirements for this {{targetRole}} role, which one do you feel most prepared for, and why?',
    voicePromptTemplate: 'Looking at what this {{targetRole}} role actually needs  -  which requirement do you feel most ready for?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific job requirement matched against a real, specific piece of the candidate\'s experience.',
  },
  {
    id: 'jf-002', sessionType: 'job_specific_full_loop', competency: 'role_fit_evidence',
    promptTemplate: 'Which requirement for this role are you least prepared for today, and how would you close that gap?',
    voicePromptTemplate: 'Which requirement are you least prepared for right now  -  and how would you close that gap?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'Honest acknowledgment of a real gap plus a credible, concrete plan to address it.',
  },
  {
    id: 'jf-003', sessionType: 'job_specific_full_loop', competency: 'motivation_for_company',
    promptTemplate: 'What about {{targetCompany}} specifically, beyond the role itself, makes you want to work there?',
    voicePromptTemplate: 'What about {{targetCompany}} specifically  -  beyond just the role  -  makes you want to be there?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A specific, researched reason tied to the company\'s actual work, not a generic compliment.',
  },
  {
    id: 'jf-004', sessionType: 'job_specific_full_loop', competency: 'technical_match',
    promptTemplate: 'Walk me through the piece of your experience that maps most directly onto the core responsibilities listed for this role.',
    voicePromptTemplate: 'Walk me through the part of your experience that maps most directly to what this role needs.',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A direct, specific mapping between a stated job responsibility and a real example from the candidate\'s history.',
  },
  {
    id: 'jf-005', sessionType: 'job_specific_full_loop', competency: 'growth_trajectory',
    promptTemplate: 'How does this role fit into where you actually want to be in a few years?',
    voicePromptTemplate: 'How does this role fit into where you\'re trying to go over the next few years?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A coherent trajectory connecting past experience, this role, and a credible future direction.',
  },
  {
    id: 'jf-006', sessionType: 'job_specific_full_loop', competency: 'requirement_alignment',
    promptTemplate: 'If you got this role, what would you focus on first in the opening weeks, based on what the role actually needs?',
    voicePromptTemplate: 'If you got this job, what would your first few weeks actually look like?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A prioritized, specific plan grounded in the role\'s real stated requirements, not generic "build relationships" answers.',
  },

  // ── Rapid-Fire Drill ──────────────────────────────────────────────────────
  // Deliberately short, single-sentence prompts  -  this session type is scored almost
  // entirely on answer_relevance/concision/answer_structure (see rubrics.ts), so
  // questions favor breadth and speed over depth.
  {
    id: 'rf-001', sessionType: 'rapid_fire_drill', competency: 'quick_thinking',
    promptTemplate: 'In one sentence: what is your single biggest professional strength?',
    voicePromptTemplate: 'Real quick  -  what\'s your single biggest professional strength?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A direct, specific answer in roughly one sentence  -  penalize rambling, not the content itself.',
  },
  {
    id: 'rf-002', sessionType: 'rapid_fire_drill', competency: 'concise_framing',
    promptTemplate: 'Quickly: what is one thing you\'re actively working to improve about how you work?',
    voicePromptTemplate: 'What\'s one thing you\'re actively working on improving about how you work?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific, real improvement area stated concisely without padding.',
  },
  {
    id: 'rf-003', sessionType: 'rapid_fire_drill', competency: 'prioritized_answer',
    promptTemplate: 'If you only had time to mention one accomplishment from last year, which would it be?',
    voicePromptTemplate: 'If you could only mention one accomplishment from the past year, what would it be?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A genuine prioritization decision, not a hedge that lists several things anyway.',
  },
  {
    id: 'rf-004', sessionType: 'rapid_fire_drill', competency: 'quick_thinking',
    promptTemplate: 'In a few words: what kind of work environment helps you do your best work?',
    voicePromptTemplate: 'What kind of work environment brings out your best?',
    applicableRoles: 'any', difficulty: 'foundational',
    expectedEvidence: 'A specific preference stated briefly, not a long explanation.',
  },
  {
    id: 'rf-005', sessionType: 'rapid_fire_drill', competency: 'concise_framing',
    promptTemplate: 'Quickly: what is the most useful piece of feedback you\'ve ever received?',
    voicePromptTemplate: 'What\'s the most useful piece of feedback you\'ve ever gotten?',
    applicableRoles: 'any', difficulty: 'standard',
    expectedEvidence: 'A specific piece of feedback named directly, without a long preamble.',
  },
  {
    id: 'rf-006', sessionType: 'rapid_fire_drill', competency: 'prioritized_answer',
    promptTemplate: 'In one sentence: what makes you different from other candidates for this kind of role?',
    voicePromptTemplate: 'What makes you different from other candidates for this kind of role?',
    applicableRoles: 'any', difficulty: 'challenging',
    expectedEvidence: 'A specific, credible differentiator rather than a generic claim like "I work hard."',
  },
]

export function getQuestionsForSessionType(sessionType: SessionType): QuestionTemplate[] {
  return QUESTION_BANK.filter((q) => q.sessionType === sessionType)
}
