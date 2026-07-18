#!/usr/bin/env node
// Phase 19 truthfulness sweep — scans every public-facing page/component source file
// for the banned claim patterns defined in src/lib/marketing/positioning.ts. This is
// a real, repeatable gate: a pattern match here means rewrite the copy before
// shipping, not "looks fine to me." Run via: npm run test:marketing-truthfulness
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC_DIRS = [
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/waitlist',
  'src/app/pricing',
  'src/app/privacy',
  'src/app/terms',
  'src/app/refund',
  'src/app/for-career-services',
  'src/app/resume-to-portfolio',
  'src/app/(app)/billing',
  'src/app/(app)/audit',
  'src/app/(app)/settings',
  'src/app/(app)/builder',
  'src/app/(app)/jobs',
  'src/app/(app)/interviews',
  'src/app/(app)/resume',
  'src/app/demo/(app)/billing',
  'src/app/demo/(app)/audit',
  'src/app/proof',
  'src/app/api/career-packet/route.ts',
  'src/app/opengraph-image.tsx',
  'src/components/landing',
  'src/components/auth',
  'src/components/billing',
  'src/components/onboarding',
  'src/components/resume',
  'src/components/referrals',
  'src/components/shared/navbar.tsx',
  'src/components/shared/footer.tsx',
  'src/lib/email/invite-email.ts',
  'growth/waitlist/beta-invite-email.md',
]

// Mirrors BANNED_CLAIM_PATTERNS in src/lib/marketing/positioning.ts. Kept as a plain
// array here (not imported) so this script can run with plain Node — see that file's
// comment for why each pattern exists.
const BANNED_CLAIM_PATTERNS = [
  { label: 'guarantees a hiring outcome', pattern: /guarantee.{0,80}\b(job|interview|hire|offer)\b/i },
  { label: '"passes every ATS" claim', pattern: /passes? every ats/i },
  { label: '"undetectable AI" claim', pattern: /undetectable\s*(by\s*)?ai/i },
  { label: 'unverified recruiter/hiring-manager statistic', pattern: /\d+%\s*of\s*(recruiters|hiring managers|startups)/i },
  { label: 'fake usage count', pattern: /\d+,?\d*\+?\s*(users|customers|portfolios published)/i },
  { label: 'fake star rating', pattern: /rated?\s*\d(\.\d)?\s*\/\s*5/i },
  { label: 'fake press mention', pattern: /as seen (in|on)/i },
  { label: 'fake logo-wall framing', pattern: /trusted by/i },
  { label: 'unverified popularity badge', pattern: /most popular/i },
  { label: 'parked legacy domain', pattern: /showcase\.app/i },
]

function collectFiles(path) {
  const stat = statSync(path)
  if (stat.isFile()) return [path]
  const files = []
  for (const entry of readdirSync(path)) {
    const full = join(path, entry)
    if (statSync(full).isDirectory()) files.push(...collectFiles(full))
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) files.push(full)
  }
  return files
}

// A pattern match preceded closely by a negation word is a denial ("we will never
// guarantee a job"), not the banned claim itself ("Showcase guarantees a job"). Trust
// language is FULL of exactly these denials by design (see TRUST_COPY), so the scanner
// must not flag them — it should only catch an actual affirmative claim.
const NEGATION_WINDOW = 60
const NEGATION_WORDS = /\b(no|not|never|won't|will not|does not|doesn't|cannot|can't|without)\b/i

function isNegated(content, matchIndex) {
  const windowStart = Math.max(0, matchIndex - NEGATION_WINDOW)
  const window = content.slice(windowStart, matchIndex)
  return NEGATION_WORDS.test(window)
}

// "Does Showcase guarantee an interview?" is a question (often an FAQ prompt whose
// denial lives in a separate answer field/string the scanner can't see) — not an
// affirmative claim. If the match is followed shortly by a "?", it's rhetorical.
function isRhetoricalQuestion(content, matchIndex, matchLength) {
  // The greedy alternation can stop short of a plural ("interview" within
  // "interviews?"), leaving a few trailing letters before the "?" — so this checks
  // for a "?" appearing soon after, not necessarily as the very next character.
  const after = content.slice(matchIndex + matchLength, matchIndex + matchLength + 24)
  return /^[a-z' -]{0,20}\?/i.test(after)
}

let violations = 0
const files = PUBLIC_DIRS.flatMap((d) => {
  try {
    return collectFiles(d)
  } catch {
    return []
  }
})

console.log(`Scanning ${files.length} public-facing files for banned claim patterns...\n`)

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  for (const { label, pattern } of BANNED_CLAIM_PATTERNS) {
    const match = content.match(pattern)
    if (
      match &&
      typeof match.index === 'number' &&
      !isNegated(content, match.index) &&
      !isRhetoricalQuestion(content, match.index, match[0].length)
    ) {
      console.log(`  ❌ ${file} — ${label}: "${match[0]}"`)
      violations++
    }
  }
}

// Evidence Audit surfaces may diagnose evidence clarity, but they must not turn the
// diagnostic into a hiring prediction or outcome verdict. Job-match screens use
// "match" in their separate product sense, so keep this guard narrowly scoped.
for (const file of [
  'src/app/(app)/audit/page.tsx',
  'src/app/demo/(app)/audit/page.tsx',
  'src/app/proof/[token]/page.tsx',
  'src/app/proof/[token]/opengraph-image.tsx',
  'src/app/api/career-packet/route.ts',
]) {
  const content = readFileSync(file, 'utf8')
  const match = content.match(/\bhiring[- ]read(?:y|iness)\b|\b(?:ready to apply|costing you interviews|hiring risk gaps|strong match|role fit|confidence:\s*high|elite territory|rough estimates work)\b|competitive for [^\n.]{0,80} roles/i)
  if (match) {
    console.log(`  ❌ ${file} — Evidence Audit hiring prediction: "${match[0]}"`)
    violations++
  }
}

// AI limitations are unusual: an absolute claim such as "will never fabricate"
// contains a negation word but is still unsafe. Scan these without the generic
// negation exemption, including the future distribution queue and product context.
const AI_INFALLIBILITY_PATTERN = /(?:cannot|can't|will never|never|no)\s+(?:\w+\s+){0,4}(?:fabricat(?:e|es|ed|ing|ion)?|invent(?:s|ed|ing)?)(?:\s+(?:facts?|evidence|claims?|experience|wins?|details?|anything|content))?/i
for (const file of [...new Set([...files, '.agents/product-marketing.md', 'growth/distribution/content-queue.json'])]) {
  const content = readFileSync(file, 'utf8')
  const match = content.match(AI_INFALLIBILITY_PATTERN)
  if (match) {
    console.log(`  ❌ ${file} — AI-infallibility claim: "${match[0]}"`)
    violations++
  }
}

// Positioning contract: truthfulness is not only the absence of hype. The public
// surface must continue to describe the actual connected product instead of
// collapsing Showcase back into a single audit/score feature.
const positioningSurface = [
  '.agents/product-marketing.md',
  'growth/distribution/content-queue.json',
  'src/lib/marketing/positioning.ts',
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/waitlist/layout.tsx',
  'src/app/waitlist/page.tsx',
  'src/app/pricing/page.tsx',
  'src/app/resume-to-portfolio/page.tsx',
  'src/components/landing/hero-section.tsx',
  'src/components/landing/product-showcase.tsx',
  'src/components/landing/feature-bento.tsx',
  'src/components/landing/how-it-works.tsx',
  'src/components/landing/faq-accordion.tsx',
  'src/components/landing/trust-section.tsx',
  'src/components/onboarding/walkthrough.tsx',
  'src/components/billing/publish-paywall-dialog.tsx',
].map((file) => readFileSync(file, 'utf8')).join('\n')

// Fictional demonstrations may remain in source for internal design work, but the
// production landing entry points must never mount them as testimonials or make the
// retired claims-to-evidence animation the hero centerpiece.
const landingEntry = readFileSync('src/app/page.tsx', 'utf8')
const heroEntry = readFileSync('src/components/landing/hero-section.tsx', 'utf8')
const signupEntry = readFileSync('src/app/(auth)/signup/page.tsx', 'utf8')
for (const { label, content, pattern } of [
  { label: 'fictional testimonial carousel', content: landingEntry, pattern: /VoicesSection|StaggerTestimonials/ },
  { label: 'retired Evidence Field hero animation', content: heroEntry, pattern: /EvidenceField/ },
  { label: 'retired Proof Assembly hero animation', content: heroEntry, pattern: /ProofAssembly/ },
]) {
  if (pattern.test(content)) {
    console.log(`  ❌ landing entry point — mounts ${label}`)
    violations++
  }
}

for (const { label, pattern } of [
  { label: 'free-portfolio signup headline', pattern: /Build your portfolio free/i },
  { label: 'resume-import next step', pattern: /upload a PDF\/DOCX résumé or paste the text/i },
  { label: 'private editable draft expectation', pattern: /private, editable portfolio draft/i },
  { label: 'all-viewport no-card reassurance', pattern: /No credit card required/i },
  { label: 'truthful free-account CTA', pattern: /Create free account/i },
  { label: 'audience-neutral email label', pattern: /<Label htmlFor="email">Email address<\/Label>/i },
]) {
  if (!pattern.test(signupEntry)) {
    console.log(`  ❌ signup entry point — missing ${label}`)
    violations++
  }
}

if (/No credit card required[\s\S]{0,80}lg:hidden|lg:hidden[\s\S]{0,80}No credit card required/i.test(signupEntry)) {
  console.log('  ❌ signup entry point — hides the no-card reassurance on desktop')
  violations++
}

if (/<Label htmlFor="email">Work email<\/Label>/i.test(signupEntry)) {
  console.log('  ❌ signup entry point — still requires a work-email framing')
  violations++
}

const REQUIRED_POSITIONING = [
  { label: 'connected job-search category', pattern: /whole job search, connected/i },
  { label: 'PDF and DOCX resume inputs', pattern: /PDF.{0,50}DOCX/is },
  { label: 'pasted resume input', pattern: /paste(?:d|\s+text)/i },
  { label: 'editable portfolio', pattern: /editable.{0,80}portfolio|portfolio.{0,80}editable/is },
  { label: 'Evidence Audit as a product feature', pattern: /Evidence Audit/i },
  { label: '0-100 audit range', pattern: /0\s*[–-]\s*100|0-100/i },
  { label: 'complete 11-dimension Audit on Free', pattern: /Free.{0,180}(?:one|1).{0,80}complete 11-dimension Evidence Audit/is },
  { label: 'Free 24-hour Audit cadence', pattern: /Free.{0,220}(?:Evidence )?Audit.{0,80}(?:every|per) 24 hours/is },
  { label: 'Pro 10-Audit 24-hour limit', pattern: /Pro.{0,220}10.{0,100}(?:Evidence )?Audits?.{0,80}(?:every|per) 24 hours/is },
  { label: 'application kit', pattern: /application kit/i },
  { label: 'ATS readiness tooling', pattern: /ATS/i },
  { label: 'written interview practice', pattern: /written.{0,80}interview|interview.{0,80}written/is },
  { label: 'voice feature qualification', pattern: /voice.{0,60}when enabled/is },
  { label: 'opportunities breadth', pattern: /hackathons?.{0,80}CTF/is },
  { label: 'referral invites', pattern: /referral invites|friend invites|member invites/i },
  { label: 'token-protected sharing', pattern: /token-protected/i },
  { label: 'career-packet export scope', pattern: /career packet/i },
  { label: 'account deletion control', pattern: /account deletion|delete your account/i },
  { label: 'Free no-card plan', pattern: /Free.{0,120}(?:no card|no credit card)|(?:no card|no credit card).{0,120}Free/is },
  { label: 'monthly Pro price', pattern: /\$15[\s\S]{0,160}\/month/i },
  { label: 'annual Pro price', pattern: /\$150[\s\S]{0,160}\/year/i },
  { label: 'Pro-only live publishing', pattern: /Pro.{0,100}publish|publish.{0,100}Pro/is },
  { label: 'Pro portfolio regeneration', pattern: /Pro.{0,180}regeneration|regeneration.{0,180}Pro/is },
  { label: 'Pro higher limits', pattern: /Pro.{0,180}higher limits|higher limits.{0,180}Pro/is },
]

for (const { label, pattern } of REQUIRED_POSITIONING) {
  if (!pattern.test(positioningSurface)) {
    console.log(`  ❌ positioning contract — missing ${label}`)
    violations++
  }
}

for (const { label, pattern } of [
  { label: 'retired claims-to-evidence hero', pattern: /Your résumé lists claims/i },
  { label: 'retired proof-engine category', pattern: /proof engine/i },
  { label: 'stale core-only Free Audit copy', pattern: /Free[^.\n]{0,180}(?:(?:4|four) core|core (?:categor(?:y|ies)|feedback))/is },
  { label: 'stale Pro-only complete Audit copy', pattern: /Pro[^.\n]{0,180}unlocks?[^.\n]{0,100}(?:full|complete) 11-(?:category|dimension) (?:Evidence )?Audit/is },
  { label: 'paused legacy-plan promotion', pattern: /Founding(?: member| membership| plan)?|\$99\s*\/\s*year/i },
]) {
  if (pattern.test(positioningSurface)) {
    console.log(`  ❌ positioning contract — found ${label}`)
    violations++
  }
}

// Every plan-bearing marketing surface must state the same complete offer. This
// prevents one page from silently restoring the old four-category Free teaser or
// omitting the 24-hour limit while the joined positioning contract still passes.
const OFFER_SURFACES = [
  '.agents/product-marketing.md',
  'growth/distribution/content-queue.json',
  'src/lib/marketing/positioning.ts',
  'src/app/page.tsx',
  'src/app/pricing/page.tsx',
  'src/app/resume-to-portfolio/page.tsx',
  'src/app/waitlist/page.tsx',
]

for (const file of OFFER_SURFACES) {
  const content = readFileSync(file, 'utf8')
  for (const { label, pattern } of [
    { label: 'Free complete 11-dimension Audit', pattern: /(?:one|1) complete 11-dimension Evidence Audit every 24 hours/i },
    { label: 'Pro 10-Audit 24-hour limit', pattern: /10 (?:complete 11-dimension Evidence )?Audits? every 24 hours/i },
    { label: 'monthly Pro price', pattern: /\$15[\s\S]{0,160}\/month/i },
    { label: 'annual Pro price', pattern: /\$150[\s\S]{0,160}\/year/i },
  ]) {
    if (!pattern.test(content)) {
      console.log(`  ❌ ${file} — missing authoritative offer: ${label}`)
      violations++
    }
  }
}

if (violations === 0) {
  console.log('  ✅ No banned claims found, and the connected-product positioning contract is intact.')
} else {
  console.log(`\n  ${violations} violation(s) found. Rewrite before shipping.`)
}

process.exit(violations > 0 ? 1 : 0)
