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
  'src/app/(app)/billing',
  'src/app/(app)/settings',
  'src/app/(app)/builder',
  'src/app/(app)/jobs',
  'src/app/demo/(app)/billing',
  'src/app/opengraph-image.tsx',
  'src/components/landing',
  'src/components/auth',
  'src/components/billing',
  'src/components/referrals',
  'src/components/shared/navbar.tsx',
  'src/components/shared/footer.tsx',
  'src/lib/email/invite-email.ts',
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

// Positioning contract: truthfulness is not only the absence of hype. The public
// surface must continue to describe the actual connected product instead of
// collapsing Showcase back into a single audit/score feature.
const positioningSurface = [
  'src/lib/marketing/positioning.ts',
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/waitlist/layout.tsx',
  'src/app/waitlist/page.tsx',
  'src/app/pricing/page.tsx',
  'src/components/landing/hero-section.tsx',
  'src/components/landing/product-showcase.tsx',
  'src/components/landing/feature-bento.tsx',
  'src/components/landing/how-it-works.tsx',
  'src/components/landing/faq-accordion.tsx',
  'src/components/landing/trust-section.tsx',
].map((file) => readFileSync(file, 'utf8')).join('\n')

const REQUIRED_POSITIONING = [
  { label: 'connected job-search category', pattern: /whole job search, connected/i },
  { label: 'PDF and DOCX resume inputs', pattern: /PDF.{0,50}DOCX/is },
  { label: 'pasted resume input', pattern: /paste(?:d|\s+text)/i },
  { label: 'editable portfolio', pattern: /editable.{0,80}portfolio|portfolio.{0,80}editable/is },
  { label: 'Evidence Audit as a product feature', pattern: /Evidence Audit/i },
  { label: '0-100 audit range', pattern: /0\s*[–-]\s*100|0-100/i },
  { label: 'Pro 11-category audit', pattern: /Pro.{0,100}11-category|11-category.{0,100}Pro/is },
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
  { label: 'monthly Pro price', pattern: /\$15\s*\/\s*month/i },
  { label: 'annual Pro price', pattern: /\$150\s*\/\s*year/i },
  { label: 'Pro-only live publishing', pattern: /Pro.{0,100}publish|publish.{0,100}Pro/is },
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
  { label: 'AI-infallibility claim', pattern: /cannot invent anything|can(?:not|'t) invent anything/i },
  { label: 'false Free full-audit entitlement', pattern: /Free[^.\n]{0,120}(?:includes?|gets?|unlocks?)[^.\n]{0,80}(?:full|complete) 11-category audit/is },
]) {
  if (pattern.test(positioningSurface)) {
    console.log(`  ❌ positioning contract — found ${label}`)
    violations++
  }
}

if (violations === 0) {
  console.log('  ✅ No banned claims found, and the connected-product positioning contract is intact.')
} else {
  console.log(`\n  ${violations} violation(s) found. Rewrite before shipping.`)
}

process.exit(violations > 0 ? 1 : 0)
