// Single source of truth for Showcase's public-facing positioning. Public pages
// should pull headline territory, audience language, and trust copy from here so
// the product is described consistently as one connected job-search workspace.
//
// Evidence Audit is an important trust and improvement feature, not the product
// category. Lead with the complete journey: resume -> portfolio -> roles and
// applications -> interview practice -> publishing.

export const BRAND = {
  name: 'Showcase',
  tagline: 'Your whole job search, connected.',
  belief: 'Your real experience should power every step of your job search.',
  enemy:
    'Disconnected resume tools, generic AI output, scattered application work, and career materials that drift away from what someone has actually done.',
  position:
    'Showcase is a connected AI job-search workspace. It turns a real resume into an editable portfolio, helps users find and pursue relevant roles, prepares them for interviews, and lets Pro users publish their work - while keeping generated claims grounded in source material they can review.',
} as const

// Primary ICP (B2C). Secondary audiences get dedicated pages rather than sharing
// the homepage hero.
export const PRIMARY_ICP = {
  label: 'Students, new graduates, and early-career professionals',
  situation:
    'They have a resume and real projects or experience, but their portfolio, job search, applications, and interview preparation live in separate tools. Repeating the same context wastes time, and generic AI output can make their story less trustworthy instead of more useful.',
  fears: [
    'I will spend hours rebuilding the same career story in disconnected tools.',
    'AI-generated material will sound generic or claim something I never did.',
    'I do not know which roles fit my actual experience or how to prepare for them.',
  ],
  aspiration:
    'I want one place that turns what I have already done into a strong portfolio, focused applications, and better interview preparation.',
  transformation: [
    'Upload a PDF or DOCX resume, or paste the text you already have.',
    'Generate a portfolio draft and edit the writing, images, and theme.',
    'See specific portfolio gaps through Evidence Audit.',
    'Find roles and compare them with the experience already in Showcase.',
    'Tailor application materials and practice role-specific interviews.',
    'Publish a live portfolio with Pro when it is ready to share.',
  ],
} as const

export const SECONDARY_SEGMENTS = [
  { id: 'career-switcher', label: 'Career switchers', href: '/signup?segment=career-switcher' },
  { id: 'portfolio-heavy', label: 'Portfolio-heavy professionals', href: '/signup?segment=portfolio-heavy' },
  { id: 'freelancer', label: 'Freelancers and independent professionals', href: '/signup?segment=freelancer' },
  { id: 'career-services', label: 'University career-services teams', href: '/for-career-services' },
] as const

export const HERO = {
  headline: 'One résumé. Your whole job search, connected.',
  subheadline:
    'Turn your real experience into an editable portfolio, matched roles and application materials, and interview practice. Review every AI-assisted claim, then publish your portfolio with Pro when it is ready.',
  primaryCta: { live: 'Build my portfolio free', waitlist: 'Join the waitlist' },
  secondaryCta: 'See the full workflow',
} as const

export const PLAN_OFFER = {
  free:
    'Free requires no card and includes one complete 11-dimension Evidence Audit every 24 hours, alongside resume import, the first AI portfolio generation, editing, and private preview.',
  pro:
    'Pro is $15/month or $150/year and adds live publishing, portfolio regeneration, 10 complete 11-dimension Evidence Audits every 24 hours, and higher limits across the workspace.',
} as const

// Benefit-first descriptions for public marketing surfaces. The mechanism stays
// explicit enough that each promise can be checked against the product.
export const FEATURE_BENEFITS = [
  {
    feature: 'Resume import and AI parsing',
    benefit: 'Bring in a PDF or DOCX resume, or paste text, without retyping your career history.',
  },
  {
    feature: 'AI portfolio generation and editor',
    benefit: 'Start with scannable case studies, then edit the copy, images, theme, and structure yourself.',
  },
  {
    feature: 'Evidence Audit',
    benefit: 'Get a complete 0-100 review across 11 dimensions with concrete fixes once every 24 hours on Free; Pro raises the audit limit to 10 every 24 hours.',
  },
  {
    feature: 'Job search and matching',
    benefit: 'Compare roles with the experience already in Showcase instead of relying on keyword guesses alone.',
  },
  {
    feature: 'Application tools',
    benefit: 'Create role-specific application materials from one consistent source of career context.',
  },
  {
    feature: 'ATS checks and resume export',
    benefit: 'Review common compatibility risks and export a resume as PDF or DOCX.',
  },
  {
    feature: 'Written interview practice',
    benefit: 'Practice role- and company-aware questions when context is available, with per-answer coaching and drills.',
  },
  {
    feature: 'Opportunities feed',
    benefit: 'Find hackathons, competitions, and other ways to build experience you can add later.',
  },
  {
    feature: 'Pro portfolio publishing',
    benefit: 'Publish a live portfolio with a shareable link and preview card when it is ready.',
  },
] as const

// Approved trust language. Do not paraphrase these into stronger promises.
export const TRUST_COPY = [
  'AI-assisted claims stay grounded in information you provide.',
  'Missing support is flagged, not auto-filled.',
  'Your resume and portfolio drafts are private by default.',
  'Nothing becomes public until you choose to publish it.',
  'You can edit or reject generated material.',
  'You can export a career packet or delete your account.',
  'Showcase does not guarantee employment outcomes.',
] as const

// Banned claims. scripts/test-marketing-truthfulness.mjs mirrors these patterns.
export const BANNED_CLAIM_PATTERNS = [
  /guarantee.*(job|interview|hire|offer)/i,
  /passes? every ats/i,
  /undetectable\s*(by\s*)?ai/i,
  /\d+%\s*of\s*(recruiters|hiring managers|startups)/i,
  /\d+,?\d*\+?\s*(users|customers|portfolios published)/i,
  /rated?\s*\d(\.\d)?\s*\/\s*5/i,
  /as seen (in|on)/i,
  /trusted by/i,
] as const

// Mechanism-based comparison only; never claim Showcase is the only product that
// can perform any individual task.
export const COMPARISON = [
  {
    alternative: 'Resume or portfolio builder',
    does: 'Creates one career asset, but usually stops before the job search, applications, and interview practice.',
  },
  {
    alternative: 'Job board',
    does: 'Shows listings, but does not carry one reviewed version of your experience through the rest of the process.',
  },
  {
    alternative: 'Generic AI chat',
    does: 'Produces text, but requires you to re-explain your background and review every response for unsupported details.',
  },
  {
    alternative: 'Showcase',
    does: 'Connects your resume, portfolio, role matching, application work, interview practice, and Pro publishing in one workspace.',
    isShowcase: true,
  },
] as const
