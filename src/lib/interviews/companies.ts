export type CompanyCategory = 'FAANG' | 'Growth' | 'Enterprise'

export interface CompanyQuestion {
  id: string
  text: string
  category: string
  tip: string
}

export interface CompanyData {
  id: string
  name: string
  initials: string
  category: CompanyCategory
  interviewStyle: string
  keyFocus: string[]
  uniqueTips: string[]
  questions: CompanyQuestion[]
}

export const COMPANIES: CompanyData[] = [
  {
    id: 'google',
    name: 'Google',
    initials: 'G',
    category: 'FAANG',
    interviewStyle:
      'Google interviews focus heavily on Googleyness -- a mix of intellectual humility, collaboration, and comfort with ambiguity. Behavioral rounds assess leadership and role-related knowledge. They use structured scoring (1-4 scale) and look for candidates who push back thoughtfully, admit gaps, and frame problems clearly.',
    keyFocus: [
      'Cognitive ability -- how you think through problems, not just the answer',
      'General cognitive humility -- saying "I don\'t know" and reasoning through it',
      'Googleyness -- collaborative, low-ego, comfortable with ambiguity',
      'Leadership -- at Google this means influencing without authority',
      'Role-specific expertise calibrated to level (L4-L7)',
    ],
    uniqueTips: [
      'Google values the reasoning process more than the answer -- narrate your thinking out loud',
      'Expect follow-up Socratic probing on every answer -- prepare to defend and pivot',
      'Googleyness is explicitly scored -- show genuine intellectual curiosity and humility',
      'Use Google\'s Leadership Attributes framework in your answers: they look for "emergent leadership" not assigned leadership',
    ],
    questions: [
      {
        id: 'g-001',
        text: 'Tell me about a time you had to convince a group of skeptical engineers or cross-functional partners to adopt your approach.',
        category: 'Influence',
        tip: 'Google wants to see low-ego influence. Show you listened, addressed real objections, and built consensus rather than forcing a decision.',
      },
      {
        id: 'g-002',
        text: 'Describe a technically complex project you worked on. What made it complex and how did you navigate that complexity?',
        category: 'Technical Depth',
        tip: 'Demonstrate layered thinking. Google interviewers will probe deeper -- have 2-3 levels of technical detail ready.',
      },
      {
        id: 'g-003',
        text: 'Tell me about a time you had to make a decision with incomplete data and significant ambiguity. How did you approach it?',
        category: 'Ambiguity',
        tip: 'Show systematic reasoning. Google wants to see you define what\'s knowable, what the risk of inaction is, and how you framed the decision.',
      },
      {
        id: 'g-004',
        text: 'Give me an example of a time you disagreed with a technical decision that had already been made. What did you do?',
        category: 'Conflict',
        tip: 'Googleyness includes respectful disagreement. Show you escalated through data and argument, not politics.',
      },
      {
        id: 'g-005',
        text: 'Describe a time you had a significant positive impact on the people around you -- your team, your org, or people outside your team.',
        category: 'Leadership',
        tip: 'This is a Googleyness question. Show genuine care for people\'s growth, not just output.',
      },
      {
        id: 'g-006',
        text: 'Tell me about a time you took a long-term view when the short-term incentives pointed in a different direction.',
        category: 'Judgment',
        tip: 'Google values long-term thinking. Explain the tradeoff explicitly and why you chose what you did.',
      },
      {
        id: 'g-007',
        text: 'Describe a project that failed or underdelivered despite being well-resourced. What happened?',
        category: 'Failure',
        tip: 'Intellectual honesty is core to Google culture. Own the failure clearly and show what you learned.',
      },
      {
        id: 'g-008',
        text: 'Tell me about a time you had to learn a new domain or technology quickly to deliver something important.',
        category: 'Learning Agility',
        tip: 'Show the process of rapid skill acquisition -- what you did, how you validated you knew enough, and what gaps you accepted.',
      },
    ],
  },
  {
    id: 'meta',
    name: 'Meta',
    initials: 'M',
    category: 'FAANG',
    interviewStyle:
      'Meta\'s behavioral interviews focus on impact and scale. Every answer should tie back to measurable outcomes and the people it affected. Meta is explicit: they want to hear "move fast" thinking, willingness to build-break-fix cycles, and comfort with large-scale decisions under uncertainty.',
    keyFocus: [
      'Impact and scale -- how big was the effect and how did you measure it?',
      'Speed and decisiveness -- move fast, then iterate',
      'Cross-functional collaboration -- Meta is matrix-heavy',
      'Pushing boundaries of what\'s possible with limited data',
      'Authentic communication -- they penalize people-pleasing answers',
    ],
    uniqueTips: [
      'Meta interviewers explicitly score against "impact" -- every answer must end with a concrete metric',
      'Don\'t hedge. Meta culture rewards decisive action followed by fast course-correction',
      'Meta interviews are structured with forced-choice follow-ups -- prepare for "but what would you have done if X?"',
      'Research Meta\'s core values explicitly (Move Fast, Be Bold, Focus on Long-Term Impact, Be Open, Build Social Value) and tie answers to them',
    ],
    questions: [
      {
        id: 'meta-001',
        text: 'Tell me about the most impactful project you have worked on. How did you measure the impact?',
        category: 'Impact',
        tip: 'Meta will reject answers without numbers. Know your metrics: DAU, revenue, latency, conversion -- whatever applies.',
      },
      {
        id: 'meta-002',
        text: 'Describe a time you shipped something fast that wasn\'t perfect. What tradeoffs did you make?',
        category: 'Move Fast',
        tip: 'Meta loves this. Show you made a conscious tradeoff decision, not that you were just sloppy.',
      },
      {
        id: 'meta-003',
        text: 'Tell me about a time you had to navigate competing priorities from multiple stakeholders across different teams.',
        category: 'Cross-Functional',
        tip: 'Meta is heavy on cross-functional alignment. Show how you synthesized different needs without becoming a bottleneck.',
      },
      {
        id: 'meta-004',
        text: 'Describe a situation where you proposed something bold that others were afraid to do. What made you push for it?',
        category: 'Be Bold',
        tip: 'Meta wants candidates who take bold bets with data backing. Show you calculated the risk, not just ignored it.',
      },
      {
        id: 'meta-005',
        text: 'Tell me about a time a decision you made turned out to be wrong. How quickly did you recognize it and what did you do?',
        category: 'Learning',
        tip: 'Meta values "move fast" which requires fast recognition of failure. Show speed of detection as a skill.',
      },
      {
        id: 'meta-006',
        text: 'Describe a time you scaled something beyond what you originally designed it for. What broke and how did you handle it?',
        category: 'Scale',
        tip: 'Scale is core to Meta. Show you understand systems under load and can rethink architecture under pressure.',
      },
      {
        id: 'meta-007',
        text: 'Tell me about a time you had to give critical feedback to someone more senior than you.',
        category: 'Directness',
        tip: 'Meta values directness and intellectual honesty. Show you gave it clearly, data-backed, and without political hedging.',
      },
      {
        id: 'meta-008',
        text: 'Describe the longest-horizon decision you have made. How far out were you thinking?',
        category: 'Long-Term Thinking',
        tip: 'Meta\'s "Focus on Long-Term Impact" principle. Show you trade short-term metrics for lasting structural value.',
      },
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon',
    initials: 'A',
    category: 'FAANG',
    interviewStyle:
      'Amazon interviews are the most structured in tech. Every behavioral question is explicitly mapped to one of the 16 Leadership Principles. A Bar Raiser attends most loops to maintain hiring standards. Answers MUST be in STAR format with specific measurable outcomes. Vague answers are explicitly penalized on the scoring rubric.',
    keyFocus: [
      'Leadership Principles -- every answer must connect to at least one LP',
      'Ownership -- "what did YOU personally do?" (not the team)',
      'Data-driven decisions -- know your metrics cold',
      'Customer obsession -- bring everything back to customer impact',
      'Dive deep -- be ready for extreme technical or operational detail',
    ],
    uniqueTips: [
      'Prepare 2-3 STAR stories per LP -- interviewers often probe multiple LPs with one question',
      'NEVER say "we" without immediately clarifying "my specific role was..." -- Amazon penalizes vague ownership',
      'Every answer should end with a measurable result: %, time saved, revenue, retention, etc.',
      'Know all 16 Leadership Principles by name and have a story ready for each of the most-tested ones (Ownership, Bias for Action, Customer Obsession, Dive Deep, Earn Trust)',
    ],
    questions: [
      {
        id: 'amz-001',
        text: 'Tell me about a time you took on something significantly outside your defined responsibility. What drove that decision?',
        category: 'Ownership',
        tip: 'Own LP: show you saw a gap, took personal accountability, and saw it through without being asked.',
      },
      {
        id: 'amz-002',
        text: 'Describe a time you used data to completely change your perspective or approach mid-project.',
        category: 'Dive Deep',
        tip: 'Amazon wants to see you get into data personally, not delegate the analysis. Show specific numbers you uncovered.',
      },
      {
        id: 'amz-003',
        text: 'Tell me about a time you made a decision that the team pushed back on but you moved forward anyway. What happened?',
        category: 'Bias for Action',
        tip: 'Show calculated speed: you had data, you moved, you were accountable for the outcome -- good or bad.',
      },
      {
        id: 'amz-004',
        text: 'Describe the most customer-obsessed thing you have done in your career.',
        category: 'Customer Obsession',
        tip: 'The customer obsession LP is tested in almost every loop. Have a specific, concrete story ready.',
      },
      {
        id: 'amz-005',
        text: 'Tell me about a time you had to deliver more with fewer resources. What did you cut and what did you protect?',
        category: 'Frugality',
        tip: 'Amazon\'s Frugality LP: show resource constraint as a creative forcing function, not just a hardship.',
      },
      {
        id: 'amz-006',
        text: 'Describe a time you had to convince a skeptical senior leader using data and logic alone.',
        category: 'Earn Trust',
        tip: 'Earn Trust LP: show you built credibility through data, transparency, and follow-through -- not charisma.',
      },
      {
        id: 'amz-007',
        text: 'Tell me about a time you had to make a high-stakes decision quickly without being able to get alignment from all stakeholders.',
        category: 'Bias for Action',
        tip: 'Two-way vs one-way door decisions. Show you identified which type this was and acted accordingly.',
      },
      {
        id: 'amz-008',
        text: 'Describe a time you significantly raised the bar for your team\'s quality, speed, or thinking.',
        category: 'Insist on High Standards',
        tip: 'Show you codified the standard, not just improved once. What did the team absorb permanently?',
      },
    ],
  },
  {
    id: 'apple',
    name: 'Apple',
    initials: 'Ap',
    category: 'FAANG',
    interviewStyle:
      'Apple interviews are detail-oriented and design-centric. They ask deep follow-ups on every claim. Apple cares about craft -- the specific reasons behind every decision. Collaboration and humility matter but the interviewer will specifically probe the depth of your individual contribution.',
    keyFocus: [
      'Craft and attention to detail -- specifics of HOW you made decisions',
      'Taste -- can you recognize what good looks like?',
      'Collaboration across a secretive, siloed org',
      'Ownership of quality under pressure',
      'Humility combined with strong conviction',
    ],
    uniqueTips: [
      'Apple interviewers will go extremely deep on specifics -- be ready to discuss decisions at 4 levels of depth',
      '"Why did you choose X over Y?" is asked for almost every decision. Prepare explicit tradeoff reasoning',
      'Apple values builders who know their craft cold -- show pride of work without arrogance',
      'Never oversell: Apple interviewers probe exaggeration and value precision',
    ],
    questions: [
      { id: 'aapl-001', text: 'Tell me about a product or feature you built that you are genuinely proud of. What specific decisions made it great?', category: 'Craft', tip: 'Go deep on the decisions -- Apple interviews reward specificity about WHY, not just what.' },
      { id: 'aapl-002', text: 'Describe a time you had to ship something and the quality wasn\'t where you wanted it. What did you do?', category: 'Quality', tip: 'Apple cares about craft. Show you had standards, felt the gap, and were explicit about the tradeoff.' },
      { id: 'aapl-003', text: 'Tell me about a time you worked across teams at Apple-like levels of confidentiality and complexity. How did you coordinate?', category: 'Collaboration', tip: 'Show you can collaborate across silos without leaking or politicizing.' },
      { id: 'aapl-004', text: 'Describe a decision where you pushed back against a timeline or scope cut because you believed it would harm the user experience.', category: 'Conviction', tip: 'Apple wants people who push for quality. Show you had data and conviction, not just feelings.' },
      { id: 'aapl-005', text: 'Tell me about something you made that looked simple but was incredibly hard to get right.', category: 'Simplicity', tip: '"Simple is hard" is Apple\'s core design principle. Show you understand the difference between simple and simplistic.' },
      { id: 'aapl-006', text: 'Describe a time you disagreed with a design or product direction from someone more senior. How did you handle it?', category: 'Conflict', tip: 'Apple values design conviction. Show you presented your case with data and examples, then respected the outcome.' },
    ],
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    initials: 'Ms',
    category: 'FAANG',
    interviewStyle:
      'Microsoft interviews heavily emphasize growth mindset and collaboration. They have shifted significantly post-Nadella to reward learning orientation, cross-team partnership, and customer empathy. Technical depth is assessed but so is how you learn from failure and how you bring others along.',
    keyFocus: [
      'Growth mindset -- learning from failure is explicitly evaluated',
      'Collaboration and cross-team impact at scale',
      'Customer empathy -- Microsoft serves huge enterprise customers',
      'Clarity of thinking and communication',
      'Technical depth appropriate to role level',
    ],
    uniqueTips: [
      'Microsoft explicitly evaluates "growth mindset" (Dweck) -- show you sought feedback, changed based on it, and grew',
      'Research Microsoft\'s Cultural Attributes: Model-Coach-Care and its connection to growth mindset',
      'Enterprise customer empathy matters here more than at consumer-focused companies',
      'Behavioral interviews often ask "what would you do differently" -- have honest self-reflection ready',
    ],
    questions: [
      { id: 'msft-001', text: 'Tell me about a time you received feedback that fundamentally changed how you work. What did you change?', category: 'Growth Mindset', tip: 'Growth mindset is the #1 cultural filter at Microsoft. Show the before-feedback and after-feedback gap clearly.' },
      { id: 'msft-002', text: 'Describe a time you helped a teammate develop a skill they were struggling with. What was your approach?', category: 'Coach', tip: 'Microsoft\'s Model-Coach-Care framework -- show patience, specificity, and genuine investment in the other person.' },
      { id: 'msft-003', text: 'Tell me about a time you had to deliver to a large enterprise customer with very specific and complex requirements.', category: 'Customer Empathy', tip: 'Enterprise empathy is key. Show you understood the customer\'s actual operational constraints, not just their stated requirements.' },
      { id: 'msft-004', text: 'Describe a time you partnered across organizational boundaries to ship something neither team could have done alone.', category: 'Cross-Org Collaboration', tip: 'Show relationship-building across teams with different incentives and timelines.' },
      { id: 'msft-005', text: 'Tell me about a time you set a high standard for your team and what you did when someone fell short.', category: 'Model', tip: 'Show you modeled the behavior first, then coached -- rather than just calling out the gap.' },
      { id: 'msft-006', text: 'Describe a time you made a mistake and how you used it as a learning opportunity for yourself and your team.', category: 'Learning', tip: 'Microsoft actively rewards transparency about failure. Show vulnerability combined with action.' },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    initials: 'St',
    category: 'Growth',
    interviewStyle:
      'Stripe is famous for extremely rigorous written interviews -- many rounds are written before any live conversation. They deeply value precision of thought, clear writing, and the ability to navigate genuine technical complexity. Stripe interviewers are demanding and direct. They look for people who think in systems.',
    keyFocus: [
      'Precision of thought -- ambiguous answers are penalized explicitly',
      'Systems thinking -- how do edge cases, failure modes, and scale interact?',
      'Written communication (Stripe is a writing-first culture)',
      'Extreme ownership and integrity',
      'Comfort with the unglamorous details of building reliable systems',
    ],
    uniqueTips: [
      'Stripe often sends a written prompt before live rounds -- treat it like a technical writing challenge, not a cover letter',
      'They will probe edge cases: "What breaks at 10x scale?" "What\'s the failure mode if X?"',
      'Stripe values structured thinking. Use numbered lists and clear logic in answers, not narrative rambling',
      'Know what Stripe actually does at depth -- payment rails, fraud, regulatory complexity. Generic "fintech" knowledge will not impress',
    ],
    questions: [
      { id: 'str-001', text: 'Describe a system you designed or contributed to that had to be extremely reliable. What failure modes did you anticipate and how?', category: 'Systems Thinking', tip: 'Stripe builds critical financial infrastructure. Show you think about reliability as a first-class concern.' },
      { id: 'str-002', text: 'Tell me about a time you had to write a complex technical document that changed how your organization approached a problem.', category: 'Written Communication', tip: 'Stripe is writing-first. Show you can structure a complex argument in writing and drive decisions with it.' },
      { id: 'str-003', text: 'Describe a time you had to make a decision that had integrity implications. How did you navigate it?', category: 'Integrity', tip: 'Stripe handles payments -- integrity is non-negotiable. Show you elevated concerns even when inconvenient.' },
      { id: 'str-004', text: 'Tell me about the most complex tradeoff you have had to make in a technical design. What did the space look like and how did you decide?', category: 'Technical Judgment', tip: 'Go deep on the tradeoff structure. Stripe expects you to articulate the option space, not just your choice.' },
      { id: 'str-005', text: 'Describe a time you dug into the details of something that others considered "solved" and found a real problem.', category: 'Depth', tip: 'Stripe rewards curiosity and skepticism. Show you question assumptions and verify things yourself.' },
      { id: 'str-006', text: 'Tell me about a time you had to coordinate across teams to fix a systemic issue that no single team owned.', category: 'Ownership', tip: 'Stripe values extreme ownership. Show you kept pushing until the systemic issue was actually resolved.' },
    ],
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    initials: 'Ab',
    category: 'Growth',
    interviewStyle:
      'Airbnb interviews center around belonging and cross-cultural empathy. They specifically evaluate culture fit through a dedicated "Core Values" round. Interviewers look for people who build trust across communities, navigate ambiguity with empathy, and can articulate the emotional dimension of their work.',
    keyFocus: [
      'Core Values alignment (Champion the Mission, Be a Host, Embrace Adventure, Be Yourself)',
      'Cross-cultural empathy and community-building',
      'Comfort with navigating emotional and ambiguous situations',
      'Building trust across diverse stakeholder groups',
      'Long-term thinking vs. short-term metrics',
    ],
    uniqueTips: [
      'Airbnb has a dedicated "Core Values" interview -- research their 4 core values and prepare stories for each',
      'Show genuine passion for the Airbnb mission, not just the business. They filter hard on mission alignment',
      '"Belong anywhere" should be reflected in your answers -- empathy for different people and perspectives',
      'Be ready to discuss how you\'ve handled emotionally charged situations, not just technical or strategic ones',
    ],
    questions: [
      { id: 'ab-001', text: 'Tell me about a time you went out of your way to make someone feel genuinely welcome or included.', category: 'Be a Host', tip: 'Airbnb\'s "Be a Host" value. Show warmth and intentionality, not just politeness.' },
      { id: 'ab-002', text: 'Describe a time you had to navigate a genuinely ambiguous situation where the right answer was unclear and emotional dynamics were involved.', category: 'Embrace Adventure', tip: 'Show comfort with the emotional and interpersonal complexity of ambiguity, not just the analytical kind.' },
      { id: 'ab-003', text: 'Tell me about a time you advocated for a user or community that was underrepresented in a product or business decision.', category: 'Mission', tip: 'Airbnb serves diverse global communities. Show you\'ve considered people unlike yourself in your decisions.' },
      { id: 'ab-004', text: 'Describe a time you were authentic in a professional setting in a way that surprised or changed how people perceived you.', category: 'Be Yourself', tip: 'Authenticity is core to Airbnb culture. Show a moment of genuine self-expression at work.' },
      { id: 'ab-005', text: 'Tell me about a decision you made that was right for the long-term mission even though it hurt a short-term metric.', category: 'Mission Over Metrics', tip: 'Airbnb explicitly values mission alignment over growth hacking. Show you\'ve made this tradeoff consciously.' },
      { id: 'ab-006', text: 'Describe a time you built trust with a community or group of people who were initially skeptical of you or your organization.', category: 'Trust Building', tip: 'Show you understand how trust is built incrementally, not declared.' },
    ],
  },
  {
    id: 'uber',
    name: 'Uber',
    initials: 'U',
    category: 'Growth',
    interviewStyle:
      'Uber interviews are highly operational and metrics-focused. They move fast and expect candidates who can operate at scale, navigate complex marketplace dynamics, and make decisions with real-time data. Expect deep dives on how you\'ve handled operational complexity and cross-functional ambiguity at speed.',
    keyFocus: [
      'Operational excellence at massive scale',
      'Data-driven decision making in real-time',
      'Cross-functional alignment across markets',
      'Comfort with complexity and fast pivots',
      'Driver and rider empathy (two-sided marketplace thinking)',
    ],
    uniqueTips: [
      'Know Uber\'s marketplace model: supply (drivers) and demand (riders) have different levers. Bring this framing to answers',
      'Uber values people who can move from strategy to execution fast -- show both in the same story',
      'Metrics literacy is essential. Know your unit economics, conversion rates, and retention numbers',
      'Operational grit matters as much as strategy here -- show you can get into the details of a complex rollout',
    ],
    questions: [
      { id: 'uber-001', text: 'Tell me about a time you had to make a fast decision that affected operations at scale. What was the decision and how did you make it?', category: 'Operational Speed', tip: 'Show speed + quality of judgment. Uber moves fast -- show you can too without sacrificing rigor.' },
      { id: 'uber-002', text: 'Describe a time you had to balance the needs of two very different user groups who had conflicting incentives.', category: 'Marketplace Thinking', tip: 'Two-sided marketplace thinking is core to Uber. Show you understand supply and demand dynamics.' },
      { id: 'uber-003', text: 'Tell me about a time you identified a metric that was misleading and discovered the real signal beneath it.', category: 'Data Depth', tip: 'Show analytical skepticism -- Uber values people who question metrics, not just report them.' },
      { id: 'uber-004', text: 'Describe a complex global launch you supported or led. How did you handle local variation while maintaining consistency?', category: 'Global Scale', tip: 'Uber operates in 70+ countries. Show you\'ve thought about localization vs. standardization tradeoffs.' },
      { id: 'uber-005', text: 'Tell me about a time you had to realign a team after a major strategic pivot. What did you do first?', category: 'Change Management', tip: 'Uber has pivoted multiple times (from rideshare to delivery to freight). Show comfort with strategic ambiguity.' },
      { id: 'uber-006', text: 'Describe a time you had to improve a process that was creating friction for customers or drivers. How did you identify and fix it?', category: 'Operational Improvement', tip: 'Show you start with the user experience of the operational friction, not just the internal process.' },
    ],
  },
  {
    id: 'figma',
    name: 'Figma',
    initials: 'Fi',
    category: 'Growth',
    interviewStyle:
      'Figma interviews are craft-forward and collaborative. They specifically evaluate how you think about user experience and product quality at a detailed level. Expect deep questions about specific design or product decisions you\'ve made. The culture values directness, genuine curiosity, and a bias for making things simpler.',
    keyFocus: [
      'Deep product and design sensibility',
      'Collaboration with design, engineering, and research',
      'Genuine care about user experience at a fine-grained level',
      'Simplicity -- removing complexity is harder than adding it',
      'Craft and intentionality in every decision',
    ],
    uniqueTips: [
      'Figma will expect you to describe specific product decisions at the level of "why this interaction vs. that one"',
      'Show you use Figma or design tools yourself -- surface-level answers about design process won\'t work',
      'Collaboration in product and design is messy. Show you can navigate ambiguity between design, eng, and PM',
      'Simplicity is a core value. Be able to articulate times you chose to remove something rather than add',
    ],
    questions: [
      { id: 'fig-001', text: 'Tell me about a product decision you made that was simple on the surface but extremely hard to get right. What made it hard?', category: 'Craft', tip: 'Figma deeply values simplicity as a discipline. Show the complexity behind the simple outcome.' },
      { id: 'fig-002', text: 'Describe a time you had to advocate for the user against an engineering or business constraint that would have harmed the experience.', category: 'User Empathy', tip: 'Show you held the line for user experience even when it created internal friction.' },
      { id: 'fig-003', text: 'Tell me about a time you worked closely with designers and discovered a fundamental disagreement about how something should work. How did you resolve it?', category: 'Design Collaboration', tip: 'Figma is a design tool -- understanding how designers think is essential.' },
      { id: 'fig-004', text: 'Describe a feature or experience you shipped that you are not proud of. What would you do differently?', category: 'Intellectual Honesty', tip: 'Figma values honest self-reflection on craft. Show you have a clear quality standard and recognize when you fell short.' },
      { id: 'fig-005', text: 'Tell me about a time you removed complexity from something rather than adding to it. What did that process look like?', category: 'Simplicity', tip: 'Show the discipline of subtraction. What did you have to say no to?' },
      { id: 'fig-006', text: 'Describe a time you used data from user research to fundamentally change something you had already built or decided.', category: 'Research-Driven', tip: 'Figma values research as a core input. Show you actually changed course based on user signal, not just acknowledged it.' },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    initials: 'N',
    category: 'Growth',
    interviewStyle:
      'Notion is a small team with massive product scope. Interviews evaluate extreme ownership, product taste, and the ability to work autonomously with high ambiguity. They look for "founders in disguise" -- people who take full responsibility for outcomes and build products they would genuinely want to use.',
    keyFocus: [
      'Product taste -- do you have strong opinions about what makes software good?',
      'Autonomy and self-direction in ambiguous environments',
      'End-to-end ownership without needing oversight',
      'Genuine passion for tools and productivity software',
      'Writing and async communication (Notion is docs-first)',
    ],
    uniqueTips: [
      'Use Notion -- have specific opinions about what works and what doesn\'t. Surface-level interest will fail',
      'Notion runs lean. Show you have operated with extreme autonomy and delivered without needing much process',
      'Product taste matters enormously here. Be ready to critique existing products including Notion itself',
      'Notion is docs-first. Show strong writing and async communication skills',
    ],
    questions: [
      { id: 'not-001', text: 'Tell me about a product or feature you built that you would use yourself every day. Why does it matter to you personally?', category: 'Product Taste', tip: 'Notion values genuine user empathy from personal experience. Show you build things you care about.' },
      { id: 'not-002', text: 'Describe a time you operated completely autonomously on a problem -- no one gave you direction, structure, or check-ins. What did you ship?', category: 'Autonomy', tip: 'Notion is extremely lean. Show you thrive with zero hand-holding.' },
      { id: 'not-003', text: 'Tell me about something in software -- a tool, interaction, or experience -- that you think is done poorly and how you would fix it.', category: 'Craft Critique', tip: 'Notion wants people with taste and conviction. Have a specific, well-reasoned critique ready.' },
      { id: 'not-004', text: 'Describe a time you had to decide what NOT to build. What was the process and what did you say no to?', category: 'Prioritization', tip: 'Notion ships deliberately. Show the discipline of saying no and the reasoning behind it.' },
      { id: 'not-005', text: 'Tell me about something you built or wrote that became a reference document or go-to resource for others.', category: 'Knowledge Sharing', tip: 'Notion is a knowledge tool. Show you create reusable, clear knowledge artifacts.' },
      { id: 'not-006', text: 'Describe a time you had to balance extreme attention to detail with the need to ship fast.', category: 'Craft vs Speed', tip: 'Show you have quality standards AND the judgment to know when "good enough" is right.' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    initials: 'An',
    category: 'Growth',
    interviewStyle:
      'Anthropic interviews are intellectually rigorous and mission-focused. They care deeply about AI safety, careful reasoning, and the ability to hold complexity without oversimplifying. Candidates should expect deep discussions about tradeoffs, edge cases, and long-term implications. Intellectual honesty and comfort with uncertainty are essential.',
    keyFocus: [
      'Genuine care about AI safety and beneficial AI development',
      'Intellectual rigor and precision of reasoning',
      'Comfort with uncertainty and complex tradeoffs',
      'Collaborative truth-seeking -- updating based on new information',
      'Long-term impact thinking over short-term gains',
    ],
    uniqueTips: [
      'Anthropic will test for genuine intellectual humility -- saying "I\'m not sure" and reasoning through it is better than confident wrong answers',
      'Know the AI safety landscape: alignment, interpretability, RLHF, constitutional AI -- surface-level AI interest will not impress',
      'Anthropic\'s mission is the responsible development of AI for the long-term benefit of humanity. Show you understand the tension in that',
      'Be ready for deep-dive philosophical or technical discussions about tradeoffs in AI development',
    ],
    questions: [
      { id: 'anth-001', text: 'Tell me about a time you had to make a decision with significant ethical or societal implications. How did you think through it?', category: 'Ethics', tip: 'Anthropic cares deeply about responsible decision-making. Show careful reasoning, not just good intentions.' },
      { id: 'anth-002', text: 'Describe a time you changed your strongly-held position because of new evidence or a compelling argument. What made you update?', category: 'Intellectual Honesty', tip: 'Anthropic values collaborative truth-seeking. Show the update was genuine and grounded.' },
      { id: 'anth-003', text: 'Tell me about a time you had to navigate a genuinely hard tradeoff between near-term and long-term outcomes.', category: 'Long-Term Thinking', tip: 'Anthropic thinks in decades. Show you can hold long timelines without losing near-term execution.' },
      { id: 'anth-004', text: 'Describe a time you worked on something where the right answer was genuinely unclear and the stakes were high. How did you proceed?', category: 'Uncertainty', tip: 'Comfort with irreducible uncertainty is core to Anthropic. Show you can act carefully without paralysis.' },
      { id: 'anth-005', text: 'Tell me about something you built or researched that you now think could be harmful in ways you didn\'t anticipate. What do you think about that now?', category: 'Reflection', tip: 'Honest reflection on unintended consequences is deeply valued at Anthropic.' },
      { id: 'anth-006', text: 'Describe how you would explain a complex AI safety concept to someone with no technical background. Walk me through it.', category: 'Communication', tip: 'Show you understand these ideas deeply enough to explain them simply.' },
    ],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    initials: 'Sf',
    category: 'Enterprise',
    interviewStyle:
      'Salesforce interviews blend enterprise customer focus with their core V2MOM (Vision, Values, Methods, Obstacles, Measures) framework. Behavioral questions assess how you build customer relationships at scale, navigate enterprise complexity, and align to Salesforce\'s "Ohana" (family) culture values.',
    keyFocus: [
      'Customer success at enterprise scale',
      'V2MOM alignment and structured goal-setting',
      'Ohana culture: trust, customer success, innovation, equality',
      'Cross-functional collaboration with sales, professional services, and product',
      'Ability to handle long, complex sales or implementation cycles',
    ],
    uniqueTips: [
      'Research Salesforce\'s V2MOM framework and reference it in strategic answers',
      'Salesforce is famous for customer success orientation -- every answer should connect back to customer outcomes',
      'Ohana culture values trust and collaboration -- show you are a team builder, not a lone star',
      '"Trailblazer" mindset is part of the brand -- show you chart new paths and bring others along',
    ],
    questions: [
      { id: 'sf-001', text: 'Tell me about a complex, long-cycle customer relationship you managed or contributed to. How did you maintain momentum over months or years?', category: 'Customer Success', tip: 'Enterprise relationships require sustained trust. Show patience, consistency, and deep customer understanding.' },
      { id: 'sf-002', text: 'Describe a time you had to align multiple internal teams to deliver on a major customer commitment.', category: 'Cross-Functional', tip: 'Salesforce delivers through ecosystems. Show you can coordinate across sales, professional services, product, and support.' },
      { id: 'sf-003', text: 'Tell me about a time you went significantly above and beyond for a customer to turn around a difficult relationship.', category: 'Customer Obsession', tip: 'Show the specific actions you took and the outcome for the customer relationship.' },
      { id: 'sf-004', text: 'Describe a time you advocated for equality or inclusion in a way that changed how your team or project worked.', category: 'Equality', tip: 'Equality is a core Salesforce value -- show you operationalize it, not just endorse it.' },
      { id: 'sf-005', text: 'Tell me about a time you drove innovation in how your organization served customers.', category: 'Innovation', tip: 'Salesforce Trailblazer mindset: show you find new paths and inspire others to follow.' },
      { id: 'sf-006', text: 'Describe how you have built a culture of trust within a team or with customers.', category: 'Trust', tip: 'Ohana is about trust as a foundation. Show specific actions that built psychological safety or customer confidence.' },
    ],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    initials: 'Sh',
    category: 'Enterprise',
    interviewStyle:
      'Shopify interviews evaluate impact orientation and founder mindset. They look for people who think like owners, have a bias toward making things happen, and deeply understand the merchant experience. Shopify runs lean, moves fast, and values people who are comfortable with extreme autonomy.',
    keyFocus: [
      'Merchant empathy -- deep understanding of small and medium business needs',
      'Founder mindset -- think like an owner, act with urgency',
      'Bias toward shipping over planning',
      'Data-informed decisions on a fast cycle',
      'Comfort operating with minimal hierarchy or process',
    ],
    uniqueTips: [
      'Shopify\'s mission is commerce for everyone -- show genuine empathy for merchants, especially small business owners',
      'Shopify runs with minimal management layers. Show you self-direct and make decisions without escalating',
      '"Default to action" is a core Shopify principle -- show you bias toward shipping and learning',
      'Know Shopify\'s product deeply: storefronts, checkout, Shopify Plus, POS, Hydrogen. Generic ecommerce knowledge won\'t work',
    ],
    questions: [
      { id: 'sho-001', text: 'Tell me about a time you operated with maximum autonomy and minimal process. What did you ship?', category: 'Founder Mindset', tip: 'Shopify runs lean. Show you don\'t need structure or permission to deliver.' },
      { id: 'sho-002', text: 'Describe a time you deeply understood the real operational pain of a business customer and built something that solved it.', category: 'Merchant Empathy', tip: 'Show you went beyond surface feature requests to understand the actual business problem.' },
      { id: 'sho-003', text: 'Tell me about a time you chose to ship something imperfect in order to learn from real merchants quickly. What did you learn?', category: 'Bias for Action', tip: '"Build, ship, learn" is Shopify\'s cadence. Show you value real feedback over internal debate.' },
      { id: 'sho-004', text: 'Describe a time you had to make a significant decision without being able to get approval or alignment from leadership.', category: 'Autonomy', tip: 'Shopify values self-directed leaders. Show you make good calls independently and communicate them clearly.' },
      { id: 'sho-005', text: 'Tell me about a time you helped a customer (or merchant) succeed in a way that went far beyond your job description.', category: 'Customer Success', tip: 'Show genuine care for merchant success beyond the product -- operational, strategic, or personal support.' },
      { id: 'sho-006', text: 'Describe a time you disagreed with a strategic direction but still executed effectively. How did you manage that tension?', category: 'Disagree and Commit', tip: 'Shopify moves fast. Show you can voice disagreement clearly, commit to the decision, and execute without half-hearted effort.' },
    ],
  },
]
