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

for (const migrationPath of [
  'supabase/migrations/20260710033038_growth_admission.sql',
  'supabase/migrations/20260710033041_launch_security_and_webhooks.sql',
  'supabase/migrations/20260710033045_referral_invite_pacing.sql',
  'supabase/migrations/20260710033046_referral_abuse_and_credit_hardening.sql',
]) {
  const pendingMigration = read(migrationPath)
  assert.doesNotMatch(
    pendingMigration,
    /(?<!extensions\.)gen_random_bytes\s*\(/i,
    `${migrationPath} must schema-qualify pgcrypto functions for restricted search paths`,
  )
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
assert.equal(backupEvidence.schema_version, 2)
assert.equal(backupEvidence.project_ref, 'yogwhfrjhcbnvoxitcay')
assert.equal(backupEvidence.backup_id, '20260710T152940Z')
assert.equal(backupEvidence.backup_type, 'logical_database_and_storage')
assert.equal(backupEvidence.storage.status, 'RESTORE_VERIFIED')
assert.equal(backupEvidence.storage.restore_verified, true)
assert.equal(backupEvidence.storage.plaintext_retained, false)
assert.equal(backupEvidence.storage.all_buckets_private, true)
assert.equal(backupEvidence.storage.database_inventory_exact, true)
assert.equal(backupEvidence.storage.file_sizes_exact, true)
assert.equal(backupEvidence.storage.file_sha256_exact, true)
assert.equal(backupEvidence.database.status, 'RESTORE_VERIFIED')
assert.equal(backupEvidence.database.restore_verified, true)
assert.equal(backupEvidence.database.plaintext_retained, false)
assert.equal(backupEvidence.database.single_exported_snapshot, true)
assert.equal(backupEvidence.database.inventory_exact, true)
assert.equal(backupEvidence.database.normalized_public_catalog_exact, true)
assert.equal(backupEvidence.database.disabled_public_trigger_count, 0)
assert.deepEqual(
  {
    object_count: backupEvidence.database.object_count,
    table_count: backupEvidence.database.table_count,
    sequence_count: backupEvidence.database.sequence_count,
    total_table_rows: backupEvidence.database.total_table_rows,
  },
  { object_count: 67, table_count: 66, sequence_count: 1, total_table_rows: 1911 },
)
assert.deepEqual(backupEvidence.database.migration_counts, {
  application: 33,
  latest_application_version: '20260703190040',
  auth: 77,
  storage: 61,
})
assert.equal(backupEvidence.encryption.cipher, 'AES-256-GCM')
assert.equal(backupEvidence.encryption.authenticated, true)
assert.equal(backupEvidence.encryption.kdf, 'PBKDF2-HMAC-SHA256')
assert.equal(backupEvidence.encryption.iterations, 600000)
for (const [label, checksum] of Object.entries({
  database_ciphertext: backupEvidence.database.encrypted_archive_sha256,
  database_plaintext: backupEvidence.database.plaintext_archive_sha256,
  storage_ciphertext: backupEvidence.storage.encrypted_archive_sha256,
  storage_plaintext: backupEvidence.storage.plaintext_archive_sha256,
})) {
  assert.match(checksum, /^[a-f0-9]{64}$/, `${label} must have a complete SHA-256 checksum`)
}
for (const [label, value] of Object.entries({
  bucket_count: backupEvidence.storage.bucket_count,
  object_count: backupEvidence.storage.object_count,
  total_bytes: backupEvidence.storage.total_bytes,
  encrypted_archive_bytes: backupEvidence.storage.encrypted_archive_bytes,
})) {
  assert.ok(Number.isSafeInteger(value) && value > 0, `${label} must be a positive integer`)
}
assert.deepEqual(
  {
    bucket_count: backupEvidence.storage.bucket_count,
    object_count: backupEvidence.storage.object_count,
    total_bytes: backupEvidence.storage.total_bytes,
    encrypted_archive_bytes: backupEvidence.storage.encrypted_archive_bytes,
  },
  { bucket_count: 3, object_count: 22, total_bytes: 7265691, encrypted_archive_bytes: 7167392 },
)
assert.equal(backupEvidence.database.encrypted_archive_bytes, 295043)
assert.equal(backupEvidence.database.component_count, 10)
assert.deepEqual(backupEvidence.database.managed_app_objects, {
  auth_storage_triggers: 1,
  storage_policies: 9,
  catalog_exact: true,
  restore_verified: true,
})
assert.equal(backupEvidence.limitations.physical_backup, false)
assert.equal(backupEvidence.limitations.point_in_time_recovery, false)
assert.equal(backupEvidence.limitations.automated_backup_available_on_current_plan, false)
assert.equal(backupEvidence.restore_drill.disposable_target_destroyed, true)
assert.equal(backupEvidence.restore_drill.external_database_access_rejected, true)
assert.deepEqual(backupEvidence.restore_drill.disposable_target_only_tables_removed, [
  'storage.iceberg_namespaces',
  'storage.iceberg_tables',
])
assert.equal(Object.hasOwn(backupEvidence.storage, 'objects'), false)
const serializedBackupEvidence = JSON.stringify(backupEvidence)
for (const forbidden of [
  /\/Users\//,
  /postgres(?:ql)?:\/\//i,
  /pooler\.supabase\.com/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /\b(?:sk|whsec|sb_secret)_[A-Za-z0-9_-]+/,
]) {
  assert.doesNotMatch(serializedBackupEvidence, forbidden, 'backup evidence must not contain sensitive material')
}

const migrationPreflight = JSON.parse(read('security/production-migration-preflight.json'))
assert.equal(migrationPreflight.project_ref, 'yogwhfrjhcbnvoxitcay')
assert.equal(migrationPreflight.status, 'READY_FOR_PAIRED_DEPLOYMENT_APPROVAL')
assert.equal(migrationPreflight.production_mutated, false)
assert.equal(migrationPreflight.history_repair.production_repair_performed, false)
assert.equal(migrationPreflight.restored_data_rehearsal.disposable_target_destroyed, true)
assert.equal(migrationPreflight.restored_data_rehearsal.plaintext_rehearsal_files_removed, 39)
assert.equal(migrationPreflight.blocking_rollout_requirement.maintenance_window_authorized, false)
assert.equal(
  migrationPreflight.blocking_rollout_requirement.deployment_authorized_for_this_sequence,
  false,
)
assert.ok(
  migrationPreflight.blocking_rollout_requirement.required_sequence.some((step) => (
    step.includes('--prod --skip-domain')
  )),
  'the rollout must prepare a compatible unaliased deployment before production DDL',
)
assert.ok(
  migrationPreflight.blocking_rollout_requirement.excluded_immediate_production_checks
    .includes('npm run growth:status'),
  'growth:status is not a read-only production smoke test',
)
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
for (const id of ['GROWTH-MIGRATIONS', 'P1-19']) {
  const requirement = releaseManifest.requirements.find((row) => row.id === id)
  assert.equal(requirement?.status, 'BLOCKED', `${id} must remain blocked by incomplete production work`)
  assert.equal(requirement?.release_blocking, true, `${id} must remain release-blocking`)
}
const backupRequirement = releaseManifest.requirements.find((row) => row.id === 'P1-13')
assert.equal(backupRequirement?.status, 'PASS', 'the full logical restore closes P1-13')
assert.equal(backupRequirement?.release_blocking, true)
assert.doesNotMatch(backupRequirement?.evidence ?? '', /19 objects|database.*blocked/i)
const migrationRequirement = releaseManifest.requirements.find((row) => row.id === 'GROWTH-MIGRATIONS')
assert.match(migrationRequirement?.blocker ?? '', /repair.*history/i)
assert.match(migrationRequirement?.blocker ?? '', /dry-run/i)
assert.match(migrationRequirement?.blocker ?? '', /apply.*reviewed batch/i)
assert.doesNotMatch(migrationRequirement?.blocker ?? '', /create.*database.*backup/i)
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
