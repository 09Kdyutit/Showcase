// Single source of truth for Showcase's public-facing positioning. Every marketing
// page (/, /pricing, /waitlist, /for-career-services, /proofscore) should pull
// headline territory, audience language, and trust copy from here rather than
// re-deriving it — the point is that a visitor reading any two pages back-to-back
// never hits a contradiction.
//
// This is a content/copy module, not a design system. It does not import React.

export const BRAND = {
  name: 'Showcase',
  tagline: 'Turn your experience into evidence.',
  belief: 'Evidence over embellishment.',
  enemy:
    'Generic claims, empty templates, fabricated AI copy, and career materials that say what someone did without proving why it mattered.',
  position:
    'Showcase is the evidence layer between a résumé and a hiring decision. It takes real career material, structures it into proof, identifies what is still missing, and helps the user present it clearly without inventing anything.',
} as const

// ── Primary ICP (B2C) ──────────────────────────────────────────────────────────
// The root homepage, hero, and waitlist page speak to this person and only this
// person. Secondary segments get their own page (/for-career-services) rather
// than sharing the hero.

export const PRIMARY_ICP = {
  label: 'Students, new graduates, and early-career professionals',
  situation:
    'They have real projects or experience but no compelling way to prove what they can do. Their résumé reads like a list of claims, their projects are scattered across GitHub/Notion/Drive links, and they do not know what evidence recruiters actually need.',
  fears: [
    'I’ll spend hours making another generic portfolio that still does not prove anything.',
    'AI-generated material will sound generic or, worse, say something about me that is not true.',
    'I do not know why my applications are being ignored.',
  ],
  aspiration: 'I want recruiters to understand my value quickly and trust what they see.',
  transformation: [
    'Upload the résumé you already have.',
    'Receive a professional portfolio draft built from it.',
    'Discover exactly what evidence is missing.',
    'Improve the highest-impact gaps first.',
    'Tailor materials for a specific role.',
    'Publish or export something you feel confident sharing.',
  ],
} as const

// ── Secondary segments — own pages, never the homepage hero ────────────────────

export const SECONDARY_SEGMENTS = [
  { id: 'career-switcher', label: 'Career switchers', href: '/waitlist?segment=career-switcher' },
  { id: 'portfolio-heavy', label: 'Portfolio-heavy professionals (design, writing, research)', href: '/waitlist?segment=portfolio-heavy' },
  { id: 'freelancer', label: 'Freelancers and independent professionals', href: '/waitlist?segment=freelancer' },
  { id: 'career-services', label: 'University career-services teams', href: '/for-career-services' },
] as const

// ── Headline territory (Phase 4) ────────────────────────────────────────────────
// Selected: territory 2, adapted for the early-career ICP. Chosen over territory 1
// (more abstract, less concrete in 5 seconds) and territory 3 (slightly longer,
// reads more like a subheadline than a hero line). "Lists claims" / "turns them
// into evidence" names the exact anxiety (a résumé is just assertions) and the
// exact resolution (evidence) in one breath, and reads correctly on mobile at the
// hero font size without wrapping awkwardly.

export const HERO = {
  headline: 'Your résumé lists claims. Showcase turns them into evidence.',
  subheadline:
    'Upload your résumé and Showcase turns your real experience into a professional portfolio, scores the strength of its evidence, and tells you exactly what to improve — without inventing a thing.',
  primaryCta: { live: 'Build my portfolio', waitlist: 'Join the private beta' },
  secondaryCta: 'See a real example',
} as const

// ── Feature → benefit translation (Phase 4) ─────────────────────────────────────
// Lead with the left column in any above-the-fold or first-screen copy. The
// right column (the actual mechanism) belongs in supporting sections only, after
// the benefit has already landed.

export const FEATURE_BENEFITS = [
  { feature: 'AI portfolio generation', benefit: 'Go from résumé to a shareable portfolio without starting from a blank page.' },
  { feature: 'ProofScore', benefit: 'Know what weakens your application before a recruiter sees it.' },
  { feature: 'Evidence Gap Finder', benefit: 'See exactly which claims still need proof.' },
  { feature: 'Truth Ledger', benefit: 'Trust every generated statement because it traces back to your real experience.' },
  { feature: 'Tailor Studio', benefit: 'Create role-specific materials without rewriting your career history from zero.' },
  { feature: 'Role-content matching', benefit: 'Focus on roles your documented experience genuinely supports.' },
  { feature: 'ATS readiness checks', benefit: 'Catch common formatting and keyword-support risks before exporting.' },
  { feature: 'Portfolio themes', benefit: 'Publish professional work without becoming a web designer.' },
] as const

// ── Approved trust language (Phase 9) — use verbatim, do not paraphrase into a
// stronger claim. ──────────────────────────────────────────────────────────────

export const TRUST_COPY = [
  'We never invent experience.',
  'Missing proof is flagged, not auto-filled.',
  'Your résumé is private by default.',
  'Nothing becomes public until you publish it.',
  'You can edit or reject every generated statement.',
  'You can delete your account and associated data.',
  'Showcase does not guarantee employment outcomes.',
] as const

// ── Banned claims (Phase 19) — if new copy contains language matching these
// patterns, it must be rewritten before shipping, regardless of how persuasive it
// reads. Checked by scripts/test-marketing-truthfulness.mjs. ────────────────────

export const BANNED_CLAIM_PATTERNS = [
  /guarantee.*(job|interview|hire|offer)/i,
  /passes? every ats/i,
  /undetectable\s*(by\s*)?ai/i,
  /\d+%\s*of\s*(recruiters|hiring managers|startups)/i, // unverified stat
  /\d+,?\d*\+?\s*(users|customers|portfolios published)/i, // fake usage count, pre-traction
  /rated?\s*\d(\.\d)?\s*\/\s*5/i, // fake rating
  /as seen (in|on)/i, // fake press mention
  /trusted by/i, // fake logo wall framing without verified relationships
] as const

// ── Comparison framework (Phase 8) — mechanism-based, never "only platform" ────

export const COMPARISON = [
  { alternative: 'Résumé template', does: 'Formats claims. Does not check whether they are supported.' },
  { alternative: 'Website builder', does: 'Displays what you already know how to write — you still start from a blank page.' },
  { alternative: 'Generic AI chat', does: 'Produces text but has no persistent evidence structure, no publishing workflow, and no safeguard against inventing a metric you never had.' },
  { alternative: 'Showcase', does: 'Structures your real career evidence, flags what is missing, preserves source truth, and publishes a professional result.', isShowcase: true },
] as const
