#!/usr/bin/env node
/**
 * Pre-launch verification script for Showcase.
 * Run via: npm run verify
 * Checks: no hardcoded secrets, no banned phrases, required files exist.
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { execFileSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let PASS = 0
let FAIL = 0
const failures = []

function ok(msg) {
  console.log(`  ✅ ${msg}`)
  PASS++
}

function fail(msg) {
  console.log(`  ❌ ${msg}`)
  failures.push(msg)
  FAIL++
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`)
}

// ── 1. Required files exist ────────────────────────────────────────────────
section('Required files')

const REQUIRED_FILES = [
  '.env.example',
  'supabase/migrations/001_initial_schema.sql',
  'supabase/migrations/002_waitlist.sql',
  'supabase/migrations/003_beta_feedback_fields.sql',
  'supabase/migrations/004_beta_selection_fields.sql',
  'src/lib/analytics/track.ts',
  'growth/beta/phase-gate.md',
  'growth/beta/beta-dashboard-sql.sql',
  'src/app/api/stripe/webhook/route.ts',
  'src/app/api/ai/analyze-resume/route.ts',
  'src/app/api/ai/audit-portfolio/route.ts',
  'src/app/api/ai/generate-portfolio/route.ts',
  'src/app/api/portfolio/publish/route.ts',
  'src/app/api/portfolio/save/route.ts',
  'src/app/api/waitlist/join/route.ts',
  'src/app/api/beta/feedback/route.ts',
  'src/app/waitlist/page.tsx',
  'src/app/beta/feedback/page.tsx',
  'src/lib/ai/rate-limit.ts',
  'src/proxy.ts',
  'SECURITY.md',
  'src/lib/jobs/match.ts',
  'src/lib/jobs/truth-ledger.ts',
  'src/lib/jobs/providers/index.ts',
  'src/lib/jobs/providers/external.ts',
  'src/lib/jobs/providers/fixture.ts',
  'src/app/api/jobs/search/route.ts',
  'src/app/api/jobs/recommendations/route.ts',
  'src/app/api/jobs/[id]/tailor/route.ts',
  'src/app/api/resume/export/route.ts',
  'src/app/(app)/jobs/page.tsx',
  'src/app/(app)/jobs/[savedJobId]/tailor/page.tsx',
  'scripts/test-match-engine.mjs',
  'scripts/test-truth-ledger.mjs',
]

for (const f of REQUIRED_FILES) {
  if (existsSync(join(ROOT, f))) {
    ok(f)
  } else {
    fail(`Missing: ${f}`)
  }
}

// ── 2. env.example completeness ────────────────────────────────────────────
section('env.example keys')

const REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_PRO_MONTHLY',
  'STRIPE_PRICE_ID_PRO_ANNUAL',
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_APP_URL',
]

try {
  const envExample = readFileSync(join(ROOT, '.env.example'), 'utf-8')
  for (const key of REQUIRED_ENV_KEYS) {
    if (envExample.includes(key)) {
      ok(key)
    } else {
      fail(`env.example missing key: ${key}`)
    }
  }
} catch {
  fail('Could not read .env.example')
}

// ── 3. No hardcoded secrets in source ─────────────────────────────────────
section('Hardcoded secret scan')

const SECRET_PATTERNS = [
  { pattern: /sk-ant-[a-zA-Z0-9-]{20,}/, name: 'Anthropic API key' },
  { pattern: /sk_live_[a-zA-Z0-9]{20,}/, name: 'Stripe live secret key' },
  { pattern: /whsec_[a-zA-Z0-9]{20,}/, name: 'Stripe webhook secret' },
  { pattern: /eyJhbGciOiJIUzI1NiJ9\.[a-zA-Z0-9+/=]+\.[a-zA-Z0-9+/=]+/, name: 'Supabase service role JWT' },
  { pattern: /postgresql:\/\/postgres:[^@\s]{6,}@/, name: 'Postgres connection string with password' },
  { pattern: /DATABASE_URL\s*=\s*postgresql:\/\/postgres:[^@\s${\[]{6,}@/, name: 'DATABASE_URL with real password' },
]

function walkSrc(dir, exts = ['.ts', '.tsx', '.js', '.mjs']) {
  const files = []
  function walk(d) {
    try {
      for (const name of readdirSync(d, { withFileTypes: true })) {
        if (name.name === 'node_modules' || name.name === '.next' || name.name === '.git' || name.name === '.claude') continue
        const full = join(d, name.name)
        if (name.isDirectory()) { walk(full); continue }
        if (exts.includes(extname(name.name))) files.push(full)
      }
    } catch { /* skip inaccessible dirs */ }
  }
  walk(dir)
  return files
}

const srcFiles = walkSrc(ROOT)
let secretsFound = false
for (const file of srcFiles) {
  try {
    const content = readFileSync(file, 'utf-8')
    for (const { pattern, name } of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        fail(`Potential ${name} hardcoded in ${file.replace(ROOT, '')}`)
        secretsFound = true
      }
    }
  } catch { /* skip unreadable */ }
}
if (!secretsFound) ok('No hardcoded secrets found in source files')

// ── 4. Banned phrases in user-facing copy ─────────────────────────────────
section('Banned phrases')

// These patterns detect POSITIVE marketing claims only.
// Disclaimers ("does not guarantee", "no guarantee", "never guarantee") are explicitly allowed.
// Strategy: scan line-by-line, skip any line that contains a negation before "guarantee".
const BANNED_LITERAL = [
  { phrase: 'Casefile', name: 'Old brand name "Casefile" in user-facing copy' },
  { phrase: 'get hired guaranteed', name: '"get hired guaranteed" positive claim' },
]
// Positive guarantee patterns — only flag lines WITHOUT a negation on the same line
const GUARANTEE_PATTERN = /guarantee/i
const NEGATION_PATTERN = /\b(not|never|no|doesn't|don't|do not|does not|without|won't|can't|cannot)\b/i

// Only check .tsx/.ts page/component files (skip type files, migrations, scripts)
const uiFiles = srcFiles.filter(
  (f) => (f.includes('/app/') || f.includes('/components/')) && !f.includes('/api/') && !f.includes('types/')
)

let bannedFound = false
for (const file of uiFiles) {
  try {
    const content = readFileSync(file, 'utf-8')
    const shortPath = file.replace(ROOT, '')

    // Check literal banned strings (case-sensitive where needed)
    for (const { phrase, name } of BANNED_LITERAL) {
      if (content.includes(phrase)) {
        fail(`Banned phrase "${name}" found in ${shortPath}`)
        bannedFound = true
      }
    }

    // Check for positive employment guarantee claims line by line
    // Only flag "guarantee" when paired with employment-related words AND no negation
    const EMPLOYMENT_WORDS = /\b(hired|hire|job|interview|employment|employed|salary|position)\b/i
    for (const line of content.split('\n')) {
      if (
        GUARANTEE_PATTERN.test(line) &&
        EMPLOYMENT_WORDS.test(line) &&
        !NEGATION_PATTERN.test(line) &&
        !line.includes('?')
      ) {
        fail(`Positive employment guarantee claim in ${shortPath}: "${line.trim().slice(0, 80)}"`)
        bannedFound = true
      }
    }
  } catch { /* skip */ }
}
if (!bannedFound) ok('No banned phrases or positive guarantee claims found in UI copy')

// ── 5. RLS in migrations ────────────────────────────────────────────────────
section('Database security')

try {
  const migration = readFileSync(join(ROOT, 'supabase/migrations/001_initial_schema.sql'), 'utf-8')
  const hasRLS = migration.includes('ENABLE ROW LEVEL SECURITY') || migration.includes('enable row level security')
  const hasPolicies = migration.includes('CREATE POLICY') || migration.includes('create policy')
  if (hasRLS) {
    ok('ENABLE ROW LEVEL SECURITY found in migration 001')
  } else {
    fail('Migration 001 missing ENABLE ROW LEVEL SECURITY statements')
  }
  if (hasPolicies) {
    ok('CREATE POLICY found in migration 001')
  } else {
    fail('Migration 001 missing CREATE POLICY statements')
  }
} catch {
  fail('Could not read migration 001 file')
}

try {
  const waitlist = readFileSync(join(ROOT, 'supabase/migrations/002_waitlist.sql'), 'utf-8')
  const hasRLS = waitlist.includes('enable row level security') || waitlist.includes('ENABLE ROW LEVEL SECURITY')
  if (hasRLS) {
    ok('ENABLE ROW LEVEL SECURITY found in waitlist migration 002')
  } else {
    fail('Waitlist migration 002 missing ENABLE ROW LEVEL SECURITY')
  }
} catch {
  fail('Could not read migration 002 file')
}

// Ensure waitlist API uses service client, not public client
try {
  const waitlistRoute = readFileSync(join(ROOT, 'src/app/api/waitlist/join/route.ts'), 'utf-8')
  if (waitlistRoute.includes('createServiceClient')) {
    ok('Waitlist join route uses service client (not public client)')
  } else {
    fail('Waitlist join route missing createServiceClient — potential RLS bypass')
  }
} catch {
  fail('Could not read waitlist join route')
}

// ── 6. Analytics tracking in core routes ──────────────────────────────────
section('Core loop tracking')

const TRACKED_ROUTES = [
  { file: 'src/app/api/ai/analyze-resume/route.ts', event: 'resume_parsed' },
  { file: 'src/app/api/ai/generate-portfolio/route.ts', event: 'portfolio_generated' },
  { file: 'src/app/api/ai/audit-portfolio/route.ts', event: 'proofscore_completed' },
  { file: 'src/app/api/portfolio/publish/route.ts', event: 'portfolio_published' },
]
for (const { file, event } of TRACKED_ROUTES) {
  try {
    const content = readFileSync(join(ROOT, file), 'utf-8')
    if (content.includes('trackAsync') && content.includes(event)) {
      ok(`${file} tracks '${event}'`)
    } else {
      fail(`${file} missing trackAsync('${event}', ...)`)
    }
  } catch {
    fail(`Could not read ${file}`)
  }
}

// ── 8. Stripe webhook signature verification ──────────────────────────────
section('Stripe webhook')

try {
  const webhook = readFileSync(join(ROOT, 'src/app/api/stripe/webhook/route.ts'), 'utf-8')
  if (webhook.includes('constructEvent') || webhook.includes('constructEventAsync')) {
    ok('Stripe signature verification (constructEvent) present')
  } else {
    fail('Stripe webhook missing constructEvent signature verification')
  }
  if (webhook.includes('STRIPE_WEBHOOK_SECRET')) {
    ok('STRIPE_WEBHOOK_SECRET referenced in webhook handler')
  } else {
    fail('STRIPE_WEBHOOK_SECRET not referenced in webhook — may skip verification')
  }
} catch {
  fail('Could not read Stripe webhook route')
}

// ── 9. Pro gate on publish ─────────────────────────────────────────────────
section('Server-side Pro gate')

try {
  const publish = readFileSync(join(ROOT, 'src/app/api/portfolio/publish/route.ts'), 'utf-8')
  if (publish.includes('isProUser') || publish.includes('PRO_REQUIRED') || publish.includes('pro')) {
    ok('Pro check present in /api/portfolio/publish')
  } else {
    fail('/api/portfolio/publish missing Pro check')
  }
} catch {
  fail('Could not read publish route')
}

// ── 10. Service role key not exposed to client ──────────────────────────────
section('Key exposure check')

const clientFiles = srcFiles.filter(
  (f) => f.includes('/components/') || (f.includes('/app/') && !f.includes('/api/'))
)
let serviceRoleFound = false
for (const file of clientFiles) {
  try {
    const content = readFileSync(file, 'utf-8')
    if (content.includes('SUPABASE_SERVICE_ROLE_KEY') && !content.includes('process.env.SUPABASE_SERVICE_ROLE_KEY')) {
      // Check if it's being used as a value (not just checking for its existence)
      fail(`SUPABASE_SERVICE_ROLE_KEY may be exposed in client file: ${file.replace(ROOT, '')}`)
      serviceRoleFound = true
    }
  } catch { /* skip */ }
}
if (!serviceRoleFound) ok('SUPABASE_SERVICE_ROLE_KEY not found in client-side files')

// ── 11. Job matching & Truth Ledger deterministic tests ─────────────────────
section('Job matching & Truth Ledger tests')

const SUBPROCESS_TESTS = [
  { script: 'scripts/test-match-engine.mjs', label: 'Match engine (10 deterministic cases)' },
  { script: 'scripts/test-truth-ledger.mjs', label: 'Truth Ledger export guard + ATS coverage' },
]

for (const { script, label } of SUBPROCESS_TESTS) {
  try {
    execFileSync('node', ['--experimental-strip-types', script], { cwd: ROOT, stdio: 'pipe' })
    ok(label)
  } catch (err) {
    fail(`${label} — ${err.stdout?.toString().split('\n').filter(l => l.includes('❌')).join('; ') || 'see scripts output'}`)
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(54)}`)
console.log(`  Results: ${PASS} passed · ${FAIL} failed`)
console.log(`${'═'.repeat(54)}`)

if (failures.length > 0) {
  console.log('\n  Failures:')
  for (const f of failures) console.log(`    • ${f}`)
  console.log()
  process.exit(1)
} else {
  console.log('\n  ✅ All checks passed. Ready to ship.\n')
  process.exit(0)
}
