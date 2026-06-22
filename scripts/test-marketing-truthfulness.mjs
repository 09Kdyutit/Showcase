#!/usr/bin/env node
// Phase 19 truthfulness sweep — scans every public-facing page/component source file
// for the banned claim patterns defined in src/lib/marketing/positioning.ts. This is
// a real, repeatable gate: a pattern match here means rewrite the copy before
// shipping, not "looks fine to me." Run via: npm run test:marketing-truthfulness
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC_DIRS = [
  'src/app/page.tsx',
  'src/app/waitlist',
  'src/app/pricing',
  'src/app/privacy',
  'src/app/terms',
  'src/app/refund',
  'src/app/proofscore',
  'src/app/for-career-services',
  'src/app/opengraph-image.tsx',
  'src/components/landing',
  'src/components/shared/navbar.tsx',
  'src/components/shared/footer.tsx',
]

// Mirrors BANNED_CLAIM_PATTERNS in src/lib/marketing/positioning.ts. Kept as a plain
// array here (not imported) so this script can run with plain Node — see that file's
// comment for why each pattern exists.
const BANNED_CLAIM_PATTERNS = [
  { label: 'guarantees a hiring outcome', pattern: /guarantee.*(job|interview|hire|offer)/i },
  { label: '"passes every ATS" claim', pattern: /passes? every ats/i },
  { label: '"undetectable AI" claim', pattern: /undetectable\s*(by\s*)?ai/i },
  { label: 'unverified recruiter/hiring-manager statistic', pattern: /\d+%\s*of\s*(recruiters|hiring managers|startups)/i },
  { label: 'fake usage count', pattern: /\d+,?\d*\+?\s*(users|customers|portfolios published)/i },
  { label: 'fake star rating', pattern: /rated?\s*\d(\.\d)?\s*\/\s*5/i },
  { label: 'fake press mention', pattern: /as seen (in|on)/i },
  { label: 'fake logo-wall framing', pattern: /trusted by/i },
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
  const after = content.slice(matchIndex + matchLength, matchIndex + matchLength + 8)
  return /^[a-z']{0,4}\?/i.test(after)
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

if (violations === 0) {
  console.log('  ✅ No banned claim patterns found across all public-facing files.')
} else {
  console.log(`\n  ${violations} violation(s) found. Rewrite before shipping.`)
}

process.exit(violations > 0 ? 1 : 0)
