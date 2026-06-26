export type BehavioralCategory =
  | 'leadership'
  | 'teamwork'
  | 'conflict'
  | 'failure'
  | 'ownership'
  | 'ambiguity'
  | 'problem_solving'
  | 'communication'
  | 'prioritization'
  | 'customer_focus'
  | 'resilience'
  | 'innovation'

export interface BehavioralQuestion {
  id: string
  category: BehavioralCategory
  text: string
  followUp?: string
}

export const BEHAVIORAL_CATEGORIES: { id: BehavioralCategory; label: string }[] = [
  { id: 'leadership', label: 'Leadership' },
  { id: 'teamwork', label: 'Teamwork & Collaboration' },
  { id: 'conflict', label: 'Conflict & Disagreement' },
  { id: 'failure', label: 'Failure & Mistakes' },
  { id: 'ownership', label: 'Ownership & Initiative' },
  { id: 'ambiguity', label: 'Ambiguity & Adaptability' },
  { id: 'problem_solving', label: 'Problem Solving' },
  { id: 'communication', label: 'Communication & Influence' },
  { id: 'prioritization', label: 'Prioritization & Time Mgmt' },
  { id: 'customer_focus', label: 'Customer Focus' },
  { id: 'resilience', label: 'Resilience & Pressure' },
  { id: 'innovation', label: 'Innovation & Creativity' },
]

export const BEHAVIORAL_QUESTIONS: BehavioralQuestion[] = [
  // Leadership
  {
    id: 'l-001',
    category: 'leadership',
    text: 'Tell me about a time you led a project or initiative without being asked. What drove you to step up?',
    followUp: 'What would have happened if you had not stepped up?',
  },
  {
    id: 'l-002',
    category: 'leadership',
    text: 'Describe a situation where you had to lead a team through significant uncertainty or change. How did you keep people aligned?',
    followUp: 'How did the team feel about the change afterward?',
  },
  {
    id: 'l-003',
    category: 'leadership',
    text: 'Tell me about a time you had to make a difficult decision that the rest of the team disagreed with. What happened and what did you learn?',
  },
  {
    id: 'l-004',
    category: 'leadership',
    text: 'Describe a time you mentored or coached someone and it made a meaningful difference in their performance or career.',
    followUp: 'How did you tailor your approach specifically to that person?',
  },
  {
    id: 'l-005',
    category: 'leadership',
    text: 'Tell me about a time you had to motivate a team that was losing momentum or morale. What was your specific approach?',
  },
  {
    id: 'l-006',
    category: 'leadership',
    text: 'Give me an example of when you had to influence a strategic direction without having the authority to mandate it.',
    followUp: 'What would have changed if you had formal authority in that situation?',
  },

  // Teamwork
  {
    id: 't-001',
    category: 'teamwork',
    text: 'Tell me about the most difficult teammate you have worked with. How did you make the collaboration work?',
    followUp: 'Would you work with that person again given the choice?',
  },
  {
    id: 't-002',
    category: 'teamwork',
    text: 'Describe a project that succeeded specifically because of how the team worked together. What was your role in creating that dynamic?',
  },
  {
    id: 't-003',
    category: 'teamwork',
    text: 'Tell me about a time you had to step outside your defined role to help the team succeed. What did you sacrifice to do it?',
  },
  {
    id: 't-004',
    category: 'teamwork',
    text: 'Describe a time when a team member was struggling and it was starting to affect the team\'s delivery. What did you do?',
    followUp: 'Did you involve management, or handle it directly?',
  },
  {
    id: 't-005',
    category: 'teamwork',
    text: 'Tell me about a time you gave difficult, honest feedback to a peer. How did you approach it and what was the outcome?',
  },
  {
    id: 't-006',
    category: 'teamwork',
    text: 'Describe a time you joined a team or project that was already in progress. How did you get up to speed and add value quickly?',
    followUp: 'What did you learn about onboarding effectively from that experience?',
  },

  // Conflict
  {
    id: 'c-001',
    category: 'conflict',
    text: 'Tell me about a time you strongly disagreed with your manager\'s decision. How did you handle it?',
    followUp: 'In hindsight, were you right or were they?',
  },
  {
    id: 'c-002',
    category: 'conflict',
    text: 'Describe a conflict with a coworker that went beyond a simple disagreement and required real effort to resolve.',
    followUp: 'How is your relationship with that person now?',
  },
  {
    id: 'c-003',
    category: 'conflict',
    text: 'Tell me about a time you had to push back on a stakeholder request that you believed was wrong or harmful. What did you do?',
  },
  {
    id: 'c-004',
    category: 'conflict',
    text: 'Describe a situation where two senior stakeholders wanted completely different things from the same project. How did you navigate that?',
  },
  {
    id: 'c-005',
    category: 'conflict',
    text: 'Tell me about a time you were in a disagreement and ultimately realized you were wrong. What made you change your position?',
    followUp: 'How did you handle admitting it to the other person?',
  },
  {
    id: 'c-006',
    category: 'conflict',
    text: 'Describe a time you had to deliver an unpopular decision or message to a group of people. How did you prepare and what was the reaction?',
  },

  // Failure
  {
    id: 'f-001',
    category: 'failure',
    text: 'Tell me about a significant failure in your career -- one that actually had consequences. What was your specific role in the failure?',
    followUp: 'What would you do differently today, knowing what you know?',
  },
  {
    id: 'f-002',
    category: 'failure',
    text: 'Describe a mistake you made that affected other people on your team. How did you handle the fallout?',
  },
  {
    id: 'f-003',
    category: 'failure',
    text: 'Tell me about a project you led that did not achieve its goals. What went wrong and what was your accountability in that?',
  },
  {
    id: 'f-004',
    category: 'failure',
    text: 'Describe a time you missed a critical deadline. What caused it and what did you put in place afterward to prevent recurrence?',
    followUp: 'Did you see it coming in advance? Why or why not?',
  },
  {
    id: 'f-005',
    category: 'failure',
    text: 'Tell me about the harshest piece of feedback you ever received. Was it fair? What did you do with it?',
  },
  {
    id: 'f-006',
    category: 'failure',
    text: 'Describe a time you took a calculated risk that did not pay off. What was your reasoning and what did you learn?',
    followUp: 'Would you take that risk again with the same information you had at the time?',
  },

  // Ownership
  {
    id: 'o-001',
    category: 'ownership',
    text: 'Tell me about a time you identified a serious problem that nobody else had noticed or was willing to own. What did you do?',
  },
  {
    id: 'o-002',
    category: 'ownership',
    text: 'Describe a situation where you took responsibility for an outcome end-to-end -- from identifying the problem through delivering the solution.',
    followUp: 'What was the hardest part of maintaining ownership throughout the process?',
  },
  {
    id: 'o-003',
    category: 'ownership',
    text: 'Tell me about a time you went significantly beyond what was expected of you. What drove that decision?',
  },
  {
    id: 'o-004',
    category: 'ownership',
    text: 'Describe a time you kept pushing on something despite facing real obstacles or having no one support it. How did it turn out?',
    followUp: 'At what point, if any, would you have given up?',
  },
  {
    id: 'o-005',
    category: 'ownership',
    text: 'Tell me about a process or system you improved on your own initiative. What did it take to get others to adopt it?',
  },
  {
    id: 'o-006',
    category: 'ownership',
    text: 'Describe a time you chose the long-term right answer over the short-term easy one. What did you give up?',
  },

  // Ambiguity
  {
    id: 'a-001',
    category: 'ambiguity',
    text: 'Tell me about a time you had to start a project with very unclear requirements or direction. How did you make progress?',
    followUp: 'How did you know when you had enough clarity to proceed?',
  },
  {
    id: 'a-002',
    category: 'ambiguity',
    text: 'Describe a time when the priorities or goals of your project changed suddenly mid-execution. How did you adapt?',
  },
  {
    id: 'a-003',
    category: 'ambiguity',
    text: 'Tell me about a significant decision you had to make without all the information you needed. How did you approach it?',
    followUp: 'What would you have done differently with perfect information?',
  },
  {
    id: 'a-004',
    category: 'ambiguity',
    text: 'Describe a situation where you were working on something with no clear precedent or playbook. How did you figure out what to do?',
  },
  {
    id: 'a-005',
    category: 'ambiguity',
    text: 'Tell me about a time you had to rapidly learn something completely new and then apply it under pressure. How did you manage?',
    followUp: 'What does your approach to fast learning look like?',
  },
  {
    id: 'a-006',
    category: 'ambiguity',
    text: 'Describe a time when the definition of success for your project kept shifting. How did you keep the team focused?',
  },

  // Problem Solving
  {
    id: 'ps-001',
    category: 'problem_solving',
    text: 'Tell me about the most technically complex or ambiguous problem you have solved. Walk me through your actual reasoning process.',
    followUp: 'What alternatives did you consider and reject?',
  },
  {
    id: 'ps-002',
    category: 'problem_solving',
    text: 'Describe a time you debugged or diagnosed a particularly stubborn issue. What made it so hard and how did you finally crack it?',
  },
  {
    id: 'ps-003',
    category: 'problem_solving',
    text: 'Tell me about a time you used data to make a significant decision. What data did you have, what was missing, and how did you handle the gaps?',
    followUp: 'How confident were you in the decision, and were you right?',
  },
  {
    id: 'ps-004',
    category: 'problem_solving',
    text: 'Describe a time you identified the root cause of a recurring problem that others had been treating as symptoms. What did you find?',
  },
  {
    id: 'ps-005',
    category: 'problem_solving',
    text: 'Tell me about a time you significantly simplified something that had become overly complex. What was the impact?',
  },
  {
    id: 'ps-006',
    category: 'problem_solving',
    text: 'Describe a situation where you had multiple viable approaches to a problem and had to choose. What framework did you use to decide?',
    followUp: 'What would you do if your chosen approach started failing partway through?',
  },

  // Communication
  {
    id: 'cm-001',
    category: 'communication',
    text: 'Tell me about a time you had to explain something highly technical to a non-technical audience and it actually worked.',
    followUp: 'What do you usually get wrong the first time you try this kind of explanation?',
  },
  {
    id: 'cm-002',
    category: 'communication',
    text: 'Describe a time you influenced a major decision without having the authority to make it. What was your strategy?',
  },
  {
    id: 'cm-003',
    category: 'communication',
    text: 'Tell me about a time you had to get genuine buy-in for an idea that faced real resistance. What did you do differently than just repeating your argument?',
  },
  {
    id: 'cm-004',
    category: 'communication',
    text: 'Describe a significant miscommunication that caused a real problem. What was the root of it and how did you repair the situation?',
    followUp: 'How did you change your communication style afterward?',
  },
  {
    id: 'cm-005',
    category: 'communication',
    text: 'Tell me about a time you had to present a recommendation to senior leadership with incomplete data. How did you handle it?',
  },
  {
    id: 'cm-006',
    category: 'communication',
    text: 'Describe a time you changed someone\'s entrenched position. What made the difference between failing and succeeding?',
    followUp: 'What do you think would NOT have worked?',
  },

  // Prioritization
  {
    id: 'p-001',
    category: 'prioritization',
    text: 'Tell me about a time when you had significantly more work than you could complete. What did you actually cut, and how did you decide?',
    followUp: 'Was anyone unhappy with what you deprioritized?',
  },
  {
    id: 'p-002',
    category: 'prioritization',
    text: 'Describe a time you had to abandon or pause something you had invested significant time in to focus on a higher priority. How did you handle that?',
  },
  {
    id: 'p-003',
    category: 'prioritization',
    text: 'Tell me about a time you were managing multiple deadlines simultaneously with real stakes attached to each. Walk me through your approach.',
  },
  {
    id: 'p-004',
    category: 'prioritization',
    text: 'Describe how you handled a situation where two different stakeholders gave you competing urgent priorities. What was the outcome?',
    followUp: 'How did you communicate the tradeoff to both sides?',
  },
  {
    id: 'p-005',
    category: 'prioritization',
    text: 'Tell me about a time you said no to a request in order to protect a more important commitment. How did you frame that no?',
  },
  {
    id: 'p-006',
    category: 'prioritization',
    text: 'Describe a time when an unexpected event forced you to completely replan your work under a tight timeline. What did you do first?',
    followUp: 'What did you give up and what did you protect?',
  },

  // Customer Focus
  {
    id: 'cf-001',
    category: 'customer_focus',
    text: 'Tell me about a time you went significantly out of your way for a user or customer -- beyond what your role required.',
    followUp: 'Would you do the same thing again? Was it worth it?',
  },
  {
    id: 'cf-002',
    category: 'customer_focus',
    text: 'Describe a time specific customer feedback fundamentally changed what you were building. What did you have to undo?',
  },
  {
    id: 'cf-003',
    category: 'customer_focus',
    text: 'Tell me about a time you had to advocate for the user against internal pressure to cut features or change direction. What happened?',
  },
  {
    id: 'cf-004',
    category: 'customer_focus',
    text: 'Describe a time you discovered that what a customer asked for was not what they actually needed. How did you navigate that?',
    followUp: 'How did the customer react when you redirected them?',
  },
  {
    id: 'cf-005',
    category: 'customer_focus',
    text: 'Tell me about a time you used real usage data or customer behavior to make a product or process better. What did you find and what changed?',
  },
  {
    id: 'cf-006',
    category: 'customer_focus',
    text: 'Describe a time you had to balance a legitimate customer request against what was technically or commercially feasible. How did you handle both sides?',
  },

  // Resilience
  {
    id: 'r-001',
    category: 'resilience',
    text: 'Tell me about a time you were under extreme pressure and how you specifically managed to stay effective. What did you actually do?',
    followUp: 'What were the signs you were nearing your limit, and how did you recognize them?',
  },
  {
    id: 'r-002',
    category: 'resilience',
    text: 'Describe the highest-stakes situation you have faced in your career. What made it feel high-stakes and what did you do?',
  },
  {
    id: 'r-003',
    category: 'resilience',
    text: 'Tell me about a time you dealt with a production outage, critical incident, or other emergency. Walk me through your exact response.',
    followUp: 'What did you learn about yourself under pressure from that incident?',
  },
  {
    id: 'r-004',
    category: 'resilience',
    text: 'Describe a period of sustained stress or difficulty at work -- not a single event but a stretch of time. How did you manage it?',
  },
  {
    id: 'r-005',
    category: 'resilience',
    text: 'Tell me about a time you had an extremely compressed timeline for something that mattered. What did you do and what were the tradeoffs?',
  },
  {
    id: 'r-006',
    category: 'resilience',
    text: 'Describe a major setback that threatened a project or goal you cared about. What kept you going and what did you actually do next?',
    followUp: 'What would have made you give up on it?',
  },

  // Innovation
  {
    id: 'i-001',
    category: 'innovation',
    text: 'Tell me about something creative or non-obvious you built or invented that you are genuinely proud of. What sparked the idea?',
    followUp: 'What stopped someone from doing this earlier?',
  },
  {
    id: 'i-002',
    category: 'innovation',
    text: 'Describe a time you challenged a long-established process or way of doing things. How did you convince others to try something new?',
  },
  {
    id: 'i-003',
    category: 'innovation',
    text: 'Tell me about a time you found a completely non-obvious way to solve a problem that saved significant time, money, or effort.',
    followUp: 'How did you discover this solution?',
  },
  {
    id: 'i-004',
    category: 'innovation',
    text: 'Describe a time you ran an experiment that did not work. What did you learn, and how did you apply those learnings?',
  },
  {
    id: 'i-005',
    category: 'innovation',
    text: 'Tell me about an idea you proposed that initially got rejected but eventually became the right answer. What changed?',
  },
  {
    id: 'i-006',
    category: 'innovation',
    text: 'Describe a time you looked at a problem from a completely different angle than everyone else on the team. How did you arrive at that perspective?',
    followUp: 'What biases do you think your colleagues had that you did not?',
  },
]
