import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')
const migration = read('supabase/migrations/20260710033041_launch_security_and_webhooks.sql')
const currentRoleGuards = migration.match(/current_user <> 'authenticated'/g) ?? []
assert.equal(currentRoleGuards.length, 2, 'profile and portfolio triggers must guard authenticated PostgREST writes')
assert.ok(!migration.includes("current_setting('request.jwt.claim.role'"), 'legacy PostgREST JWT GUC must not control authority guards')
assert.match(migration, /revoke insert, update, delete on public\.audits from anon, authenticated/i)
assert.match(migration, /create or replace function public\.claim_webhook_event/i)
assert.match(migration, /create or replace function public\.run_interview_retention/i)

const publish = read('src/app/api/portfolio/publish/route.ts')
assert.match(publish, /createServiceClient/)
assert.match(publish, /eventName: 'publish_paywall_viewed'/)

const auditShare = read('src/app/api/audit/share/route.ts')
assert.match(auditShare, /randomBytes\(32\)/, 'share tokens must carry 256 bits of entropy')
assert.match(auditShare, /share_token_expires_at/)
assert.match(auditShare, /share_token_revoked_at/)

const inboundEmail = read('src/app/api/email/inbound/route.ts')
assert.match(inboundEmail, /RESEND_WEBHOOK_SECRET/)
assert.match(inboundEmail, /claim_webhook_event/)
assert.match(inboundEmail, /timestamp/i)

const pdfVision = read('src/lib/ai/pdf-vision.ts')
assert.match(pdfVision, /GEMINI_PRIVATE_DATA_ENABLED/)

const imageUpload = read('src/app/api/portfolio/upload-image/route.ts')
assert.ok(imageUpload.includes('project-\\d{1,3}'), 'storage slot names must not accept path separators')

const rlsTest = read('scripts/test-rls.mjs')
assert.match(rlsTest, /(?:referral|bonus) credits/i)
assert.match(rlsTest, /forg(?:e|ed).*audit/i)
assert.match(rlsTest, /publish/i)

const retentionRoute = read('src/app/api/cron/data-retention/route.ts')
assert.match(retentionRoute, /CRON_SECRET/, 'retention cleanup must require cron authentication')
assert.match(retentionRoute, /from\('pending_parses'\).*delete/s, 'expired anonymous resume parses must be purged')
assert.match(retentionRoute, /from\('proofscore_reservations'\).*delete/s, 'expired reservation emails must be purged')
assert.match(retentionRoute, /from\('rate_limit_counters'\).*delete/s, 'old abuse counters must be purged')
assert.match(retentionRoute, /from\('email_deliveries'\).*attempts.*3/s, 'exhausted email payloads must be purged')
assert.match(retentionRoute, /90 \* 86400_000/, 'terminal email records must have a bounded retention window')

const growthMigration = read('supabase/migrations/20260710033039_growth_automation.sql')
for (const retentionIndex of [
  'email_deliveries_terminal_retention_idx',
  'email_deliveries_exhausted_retention_idx',
  'email_provider_events_retention_idx',
  'rate_limit_counters_retention_idx',
]) {
  assert.ok(growthMigration.includes(retentionIndex), `missing retention index: ${retentionIndex}`)
}

const vercel = JSON.parse(read('vercel.json'))
assert.equal(
  vercel.git?.deploymentEnabled,
  false,
  'Git pushes must not deploy before staging and required checks pass'
)
assert.ok(
  vercel.crons.some((cron) => cron.path === '/api/cron/data-retention' && cron.schedule === '45 * * * *'),
  'the hourly retention job must be deployed with the app'
)

const privacyPage = read('src/app/privacy/page.tsx')
assert.doesNotMatch(privacyPage, /Uploaded-file cleanup is retried/, 'privacy copy must not promise a retry queue that does not exist')
assert.match(
  privacyPage,
  /cleanup cannot complete, deletion returns an error and keeps the account/,
  'privacy copy must describe fail-closed Storage cleanup accurately',
)
const accountDeletion = read('src/app/api/account/delete/route.ts')
assert.match(accountDeletion, /storage\.listBuckets\(\)/, 'account deletion must discover every current Storage bucket')
assert.ok(
  accountDeletion.indexOf('await removeStoragePrefix') < accountDeletion.indexOf('auth.admin.deleteUser'),
  'all Storage cleanup must finish before Auth deletion',
)

const releaseGate = read('scripts/release-gate.mjs')
for (const failClosedSignal of [
  'mustHaveRequirementIds',
  'expectedGrowthMigrations',
  'expectedCrons',
  'requiredProductionEnvNames',
  'allowedStatuses',
  'duplicate id',
  'source_fingerprint_sha256',
]) {
  assert.ok(releaseGate.includes(failClosedSignal), `release gate is missing: ${failClosedSignal}`)
}
assert.match(releaseGate, /--contract-only/, 'CI needs a contract-only attestation mode')
assert.match(releaseGate, /release verification requires a clean Git working tree/)
assert.match(releaseGate, /computeHeadFingerprint/, 'normal verification must hash committed blobs')
const releaseManifest = JSON.parse(read('security/release-gate.json'))
assert.equal(releaseManifest.schema_version, 1)
assert.equal(releaseManifest.contracts.growth_migrations.length, 13)
assert.equal(Object.keys(releaseManifest.contracts.crons).length, 6)

const backupEvidence = JSON.parse(read('security/production-backup-evidence.json'))
assert.equal(backupEvidence.project_ref, 'yogwhfrjhcbnvoxitcay')
assert.equal(backupEvidence.storage.status, 'RESTORE_VERIFIED')
assert.equal(backupEvidence.storage.restore_verified, true)
assert.equal(backupEvidence.storage.plaintext_retained, false)
assert.equal(backupEvidence.database.status, 'BLOCKED')
assert.match(
  backupEvidence.storage.encrypted_archive_sha256,
  /^[a-f0-9]{64}$/,
  'the encrypted Storage archive must have a complete SHA-256 checksum',
)
for (const [label, value] of Object.entries({
  bucket_count: backupEvidence.storage.bucket_count,
  object_count: backupEvidence.storage.object_count,
  total_bytes: backupEvidence.storage.total_bytes,
  encrypted_archive_bytes: backupEvidence.storage.encrypted_archive_bytes,
})) {
  assert.ok(Number.isSafeInteger(value) && value > 0, `${label} must be a positive integer`)
}
const storageInventory = backupEvidence.production_storage_inventory
const orphanedBucketTotal = Object.values(storageInventory.orphaned_by_bucket)
  .reduce((total, count) => total + count, 0)
assert.equal(
  orphanedBucketTotal,
  storageInventory.orphaned_user_prefix_objects,
  'per-bucket orphan counts must equal the recorded orphan total',
)
assert.ok(
  storageInventory.orphaned_user_prefix_objects <= backupEvidence.storage.object_count,
  'orphan objects cannot exceed the total backed-up object count',
)
assert.ok(
  storageInventory.orphaned_user_prefix_bytes <= backupEvidence.storage.total_bytes,
  'orphan bytes cannot exceed the total backed-up byte count',
)
for (const id of ['GROWTH-MIGRATIONS', 'P1-13', 'P1-19']) {
  const requirement = releaseManifest.requirements.find((row) => row.id === id)
  assert.equal(requirement?.status, 'BLOCKED', `${id} must remain blocked by incomplete production work`)
  assert.equal(requirement?.release_blocking, true, `${id} must remain release-blocking`)
}
for (const id of ['GROWTH-MIGRATIONS', 'P1-13']) {
  const requirement = releaseManifest.requirements.find((row) => row.id === id)
  assert.match(
    requirement?.blocker ?? '',
    /database|roles\/schema\/data/i,
    `${id} must still require the production database backup`,
  )
}
assert.ok(releaseManifest.contracts.required_production_env_names.includes('INBOUND_FORWARD_TO'))
assert.ok(releaseManifest.contracts.optional_production_env_names.includes('ERROR_WEBHOOK_URL'))
assert.equal(
  releaseManifest.requirements.some((requirement) => requirement.id === 'MOBILE-STORE-READINESS'),
  false,
  'web-only launch must not be blocked by native store requirements'
)

const envExample = read('.env.example')
assert.match(envExample, /^OPENAI_GENERAL_DAILY_BUDGET_USD=4$/m)
assert.match(envExample, /^OPENAI_GENERAL_MONTHLY_BUDGET_USD=80$/m)
assert.match(envExample, /^EMAILS_ENABLED=false$/m)
assert.match(envExample, /^LIFECYCLE_EMAILS_ENABLED=false$/m)
assert.match(envExample, /^INTERVIEW_KILL_SWITCH=true$/m)
assert.match(envExample, /^KILL_SWITCH_GEMINI=true$/m)

const securityWorkflow = read('.github/workflows/security.yml')
for (const workflowGuard of [
  'environment: staging',
  "github.ref == 'refs/heads/main'",
  'Stripe secret must be test mode',
  'yogwhfrjhcbnvoxitcay',
  'node scripts/release-gate.mjs --contract-only',
  'EXPECT_PROD=1 npm run test:headers',
  'concurrency:',
]) {
  assert.ok(securityWorkflow.includes(workflowGuard), `CI staging guard is missing: ${workflowGuard}`)
}

const stagingPreflight = read('scripts/assert-staging-env.mjs')
assert.match(stagingPreflight, /yogwhfrjhcbnvoxitcay/)
assert.match(stagingPreflight, /sk_test_/)
assert.match(stagingPreflight, /this worktree is linked to production/)
assert.match(stagingPreflight, /INTERVIEW_KILL_SWITCH/)

const featureFlags = read('src/lib/feature-flags.ts')
assert.match(featureFlags, /process\.env\.KILL_SWITCH_GEMINI === 'false'/,
  'Gemini must fail closed unless explicitly enabled')
for (const geminiBoundary of [
  'src/lib/ai/pdf-vision.ts',
  'src/app/api/resume/extract-text/route.ts',
  'src/app/api/interviews/companies/prep/route.ts',
  'src/lib/ai/gemini.ts',
  'src/lib/interviews/config.ts',
  'src/lib/interviews/gemini/client.ts',
]) {
  assert.match(read(geminiBoundary), /isGeminiEnabled/,
    `${geminiBoundary} must honor the fail-closed Gemini switch`)
}
assert.match(read('supabase/functions/live-interview-ws/index.ts'),
  /INTERVIEW_LIVE_PROXY_ENABLED.*=== 'true'/s,
  'the legacy live proxy must default disabled')

console.log('launch security invariants passed')
