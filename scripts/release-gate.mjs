#!/usr/bin/env node
// Fails closed when a release requirement or its machine-readable deployment contract is
// missing, malformed, stale, or not PASS. This script intentionally checks the manifest,
// the source tree, and a revision fingerprint rather than trusting whichever rows happen
// to remain in the JSON file.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const gatePath = join(root, 'security', 'release-gate.json')
const gate = JSON.parse(readFileSync(gatePath, 'utf8'))
const printFingerprint = process.argv.includes('--print-fingerprint')
const contractOnly = process.argv.includes('--contract-only')

const allowedStatuses = new Set(['PASS', 'BLOCKED', 'FAIL', 'NOT_STARTED'])
const mustHaveRequirementIds = [
  'GROWTH-CODE',
  'GROWTH-MIGRATIONS',
  'GROWTH-PROD-CONFIG',
  'GROWTH-PROD-DEPLOY',
  'GROWTH-PROVIDER-E2E',
  'GROWTH-DISTRIBUTION-APPROVAL',
  'P0-RACE',
  'P1-GLOBAL-CEILING',
  'P0-01',
  'P0-02',
  'P0-08',
  'P0-RLS',
  'P1-01',
  'P1-13',
  'P1-16',
  'P1-19',
]
const expectedGrowthMigrations = [
  '20260710033035_referral_publish_credit.sql',
  '20260710033036_pending_parses.sql',
  '20260710033037_referral_completion_credit.sql',
  '20260710033038_growth_admission.sql',
  '20260710033039_growth_automation.sql',
  '20260710033040_proofscore_public_capacity.sql',
  '20260710033041_launch_security_and_webhooks.sql',
  '20260710033042_founding_member_slots.sql',
  '20260710033043_email_and_parse_hardening.sql',
  '20260710033044_atomic_subscription_state.sql',
  '20260710033045_referral_invite_pacing.sql',
  '20260710033046_referral_abuse_and_credit_hardening.sql',
  '20260710033047_explicit_data_api_grants.sql',
]
const expectedCrons = {
  '/api/cron/interview-retention': '0 5 * * *',
  '/api/cron/data-retention': '45 4 * * *',
  '/api/cron/invite-batch': '0 15 * * *',
  '/api/cron/lifecycle-email': '0 13 * * *',
  '/api/cron/weekly-digest': '0 14 * * 1',
  '/api/cron/growth-scorecard': '30 14 * * 1',
}
const requiredProductionEnvNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_PRO_MONTHLY',
  'STRIPE_PRICE_ID_PRO_ANNUAL',
  'STRIPE_PRICE_ID_FOUNDING_ANNUAL',
  'OPENAI_API_KEY',
  'OPENAI_COST_RATES_JSON',
  'OPENAI_GENERAL_DAILY_BUDGET_USD',
  'OPENAI_GENERAL_MONTHLY_BUDGET_USD',
  'AI_GLOBAL_DAILY_LIMIT',
  'INTERVIEW_GLOBAL_DAILY_BUDGET_USD',
  'INTERVIEW_GLOBAL_MONTHLY_BUDGET_USD',
  'INTERVIEW_KILL_SWITCH',
  'KILL_SWITCH_AI',
  'KILL_SWITCH_GEMINI',
  'KILL_SWITCH_CHECKOUT',
  'KILL_SWITCH_JOBS_PROVIDER',
  'KILL_SWITCH_PUBLISHING',
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
  'INBOUND_FORWARD_TO',
  'RESEND_DELIVERY_WEBHOOK_SECRET',
  'UNSUBSCRIBE_SIGNING_SECRET',
  'RESEND_FROM_EMAIL',
  'EMAIL_POSTAL_ADDRESS',
  'EMAILS_ENABLED',
  'LIFECYCLE_EMAILS_ENABLED',
  'GROWTH_SCORECARD_EMAIL',
  'PROOFSCORE_IP_HASH_SALT',
  'LAUNCH_OPEN',
]
const optionalProductionEnvNames = [
  'ERROR_WEBHOOK_URL',
  'INVITE_EXCLUDE',
  'BUFFER_API_KEY',
  'BUFFER_ORGANIZATION_ID',
  'FOUNDER_NAME',
]

const contractFailures = []
const failContract = (message) => contractFailures.push(message)
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const sortedUnique = (values) => [...new Set(values)].sort()

if (gate.schema_version !== 1) failContract('schema_version must equal 1')
if (typeof gate.release_target !== 'string' || !gate.release_target.trim()) {
  failContract('release_target must be a non-empty string')
}
if (!Array.isArray(gate.requirements) || gate.requirements.length === 0) {
  failContract('requirements must be a non-empty array')
}

const ids = new Set()
for (const [index, req] of (gate.requirements ?? []).entries()) {
  const label = typeof req?.id === 'string' && req.id ? req.id : `row ${index}`
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(req?.id ?? '')) failContract(`${label}: invalid id`)
  if (ids.has(req?.id)) failContract(`${label}: duplicate id`)
  ids.add(req?.id)
  if (typeof req?.area !== 'string' || !req.area.trim()) failContract(`${label}: area is required`)
  if (typeof req?.description !== 'string' || !req.description.trim()) failContract(`${label}: description is required`)
  if (!allowedStatuses.has(req?.status)) failContract(`${label}: invalid status ${String(req?.status)}`)
  if (typeof req?.release_blocking !== 'boolean') failContract(`${label}: release_blocking must be boolean`)
  if (req?.status === 'PASS' && (typeof req?.evidence !== 'string' || req.evidence.trim().length < 20)) {
    failContract(`${label}: PASS requires substantive evidence`)
  }
  if (req?.status !== 'PASS' && (typeof req?.blocker !== 'string' || !req.blocker.trim())) {
    failContract(`${label}: open requirements must state a blocker/next action`)
  }
}
for (const id of mustHaveRequirementIds) {
  if (!ids.has(id)) failContract(`required requirement is missing: ${id}`)
}

const contracts = gate.contracts ?? {}
if (!sameJson(sortedUnique(contracts.required_requirement_ids ?? []), sortedUnique(mustHaveRequirementIds))) {
  failContract('required requirement ID contract does not match the checker')
}
if (!sameJson(contracts.growth_migrations, expectedGrowthMigrations)) {
  failContract('growth migration contract does not match canonical migrations 035-047')
}
if (!sameJson(contracts.crons, expectedCrons)) failContract('cron contract does not match the checker')
if (!sameJson(contracts.required_production_env_names, requiredProductionEnvNames)) {
  failContract('required production env contract does not match the checker')
}
if (!sameJson(contracts.optional_production_env_names, optionalProductionEnvNames)) {
  failContract('optional production env contract does not match the checker')
}

const migrationDir = join(root, 'supabase', 'migrations')
const actualGrowthMigrations = readdirSync(migrationDir)
  .filter((name) => /^202607100330(?:3[5-9]|4[0-7])_/.test(name))
  .sort()
if (!sameJson(actualGrowthMigrations, expectedGrowthMigrations)) {
  failContract(`growth migration files differ: ${actualGrowthMigrations.join(', ')}`)
}

const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const actualCrons = Object.fromEntries((vercel.crons ?? []).map((cron) => [cron.path, cron.schedule]))
if ((vercel.crons ?? []).length !== Object.keys(actualCrons).length) failContract('duplicate cron paths found')
if (!sameJson(actualCrons, expectedCrons)) failContract('vercel.json cron paths/schedules differ from the release contract')

const envExample = readFileSync(join(root, '.env.example'), 'utf8')
const declaredEnvNames = new Set(
  [...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1])
)
for (const name of [...requiredProductionEnvNames, ...optionalProductionEnvNames]) {
  if (!declaredEnvNames.has(name)) failContract(`.env.example is missing ${name}`)
}

let sourceFingerprint = ''
const evidenceBaseGitHead = gate.verification?.evidence_base_git_head ?? ''
if (!/^[0-9a-f]{40}$/.test(evidenceBaseGitHead)) {
  failContract('verification.evidence_base_git_head must be a full Git SHA')
}
if (typeof gate.verification?.verified_at !== 'string' || !gate.verification.verified_at) {
  failContract('verification.verified_at is required')
}

try {
  if (printFingerprint) {
    // This is the deliberate pre-commit path: hash the prospective source tree after all
    // reviewed edits, including untracked files that will be added and excluding deletions.
    sourceFingerprint = computeWorkingTreeFingerprint()
  } else {
    const dirty = execFileSync(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      { cwd: root, encoding: 'utf8' },
    ).trim()
    if (dirty) failContract('release verification requires a clean Git working tree')

    if (/^[0-9a-f]{40}$/.test(evidenceBaseGitHead)) {
      execFileSync('git', ['cat-file', '-e', `${evidenceBaseGitHead}^{commit}`], { cwd: root })
      execFileSync('git', ['merge-base', '--is-ancestor', evidenceBaseGitHead, 'HEAD'], { cwd: root })
    }

    // CI and normal release checks bind evidence to committed blobs, never to mutable
    // working-tree contents. The pre-commit generator above must reproduce this value.
    sourceFingerprint = computeHeadFingerprint()
  }

  if (gate.verification?.source_fingerprint_sha256 !== sourceFingerprint) {
    if (!printFingerprint) failContract('source fingerprint changed since release evidence was recorded')
  }
} catch (error) {
  failContract(`could not verify source revision: ${error instanceof Error ? error.message : String(error)}`)
}

if (printFingerprint) {
  if (contractFailures.length > 0) {
    for (const failure of contractFailures) console.error(`release contract: ${failure}`)
    process.exit(1)
  }
  console.log(sourceFingerprint)
  process.exit(0)
}

let blockingFailures = contractFailures.length
let nonBlockingOpen = 0

console.log(`\n  Release gate — target: ${gate.release_target}\n`)
for (const failure of contractFailures) console.log(`  ❌ CONTRACT [BLOCKING] ${failure}`)
if (contractFailures.length) console.log('')

for (const req of gate.requirements ?? []) {
  const isOk = req.status === 'PASS'
  const icon = isOk ? '✅' : req.status === 'BLOCKED' ? '🚧' : req.status === 'FAIL' ? '❌' : '⬜'
  const tag = req.release_blocking ? '[BLOCKING]' : '[non-blocking]'
  console.log(`  ${icon} ${req.id} ${tag} ${req.area} — ${req.description} (${req.status})`)
  if (req.blocker) console.log(`      blocker: ${req.blocker}`)

  if (!isOk && !contractOnly) {
    if (req.release_blocking) blockingFailures++
    else nonBlockingOpen++
  }
}

console.log(`\n  ${blockingFailures} release-blocking requirement(s) not PASS, ${nonBlockingOpen} non-blocking open.\n`)

if (blockingFailures > 0) {
  console.log('  ❌ RELEASE GATE: NOT READY\n')
  process.exit(1)
}
if (contractOnly) {
  console.log('  ✅ RELEASE CONTRACT: PASS (open launch requirements reported but not gated)\n')
  process.exit(0)
}
console.log('  ✅ RELEASE GATE: PASS\n')

function computeWorkingTreeFingerprint() {
  const paths = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  )
    .split('\0')
    .filter(Boolean)
    .filter((path) => path !== 'security/release-gate.json')
    .filter((path) => existsSync(join(root, path)))
    .sort()

  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(path)
    hash.update('\0')
    hash.update(readFileSync(join(root, path)))
    hash.update('\0')
  }

  hashNormalizedGate(hash, gate)
  return hash.digest('hex')
}

function computeHeadFingerprint() {
  const paths = execFileSync(
    'git',
    ['ls-tree', '-r', '--name-only', '-z', 'HEAD'],
    { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  )
    .split('\0')
    .filter(Boolean)
    .filter((path) => path !== 'security/release-gate.json')
    .sort()

  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(path)
    hash.update('\0')
    hash.update(execFileSync('git', ['show', `HEAD:${path}`], {
      cwd: root,
      maxBuffer: 20 * 1024 * 1024,
    }))
    hash.update('\0')
  }

  const headGate = JSON.parse(execFileSync(
    'git',
    ['show', 'HEAD:security/release-gate.json'],
    { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  ))
  hashNormalizedGate(hash, headGate)
  return hash.digest('hex')
}

function hashNormalizedGate(hash, releaseGate) {
  // Include release evidence without a self-referential hash. Any changed status,
  // evidence, contract, base revision, or timestamp invalidates verification; only the
  // stored fingerprint value itself is normalized.
  const normalizedGate = structuredClone(releaseGate)
  normalizedGate.verification.source_fingerprint_sha256 = '__SELF__'
  hash.update('security/release-gate.json')
  hash.update('\0')
  hash.update(JSON.stringify(normalizedGate))
  hash.update('\0')
}
