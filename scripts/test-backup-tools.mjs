#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AES_SCRIPT = resolve(ROOT, 'scripts/backup-aes-gcm.mjs')
const STORAGE_SCRIPT = resolve(ROOT, 'scripts/backup-production-storage.mjs')
const VERIFY_SCRIPT = resolve(ROOT, 'scripts/verify-backup-restore.mjs')
const MANAGED_CATALOG_SCRIPT = resolve(ROOT, 'scripts/backup-managed-app-catalog.sql')
const MANAGED_RESTORE_SCRIPT = resolve(ROOT, 'scripts/restore-managed-app-objects.sql')
const PASSPHRASE = 'offline-test-passphrase-32-characters-minimum'
const TEMP_DIRECTORY = mkdtempSync(resolve(tmpdir(), 'showcase-backup-tools-'))

function runAes(mode, input, output, passphrase = PASSPHRASE) {
  return spawnSync(process.execPath, [AES_SCRIPT, mode, input, output], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { BACKUP_PASSPHRASE: passphrase },
    timeout: 30_000,
  })
}

function assertSuccess(result, operation) {
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${operation} failed: ${result.stderr.trim()}`)
}

function assertFailure(result, operation) {
  if (result.error) throw result.error
  assert.notEqual(result.status, 0, `${operation} unexpectedly succeeded`)
}

function mode(path) {
  return statSync(path).mode & 0o777
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
}

try {
  const plaintext = resolve(TEMP_DIRECTORY, 'plaintext.bin')
  const encrypted = resolve(TEMP_DIRECTORY, 'backup.aesgcm')
  const decrypted = resolve(TEMP_DIRECTORY, 'restored.bin')
  const fixture = Buffer.concat([
    Buffer.from('Showcase offline backup fixture\n', 'utf8'),
    Buffer.from([0, 1, 2, 127, 128, 254, 255]),
  ])
  writeFileSync(plaintext, fixture, { mode: 0o600 })

  const encryption = runAes('encrypt', plaintext, encrypted)
  assertSuccess(encryption, 'AES-GCM encryption')
  assert.equal(mode(encrypted), 0o600, 'encrypted archives must be owner-readable only')

  const decryption = runAes('decrypt', encrypted, decrypted)
  assertSuccess(decryption, 'AES-GCM decryption')
  assert.deepEqual(readFileSync(decrypted), fixture, 'AES-GCM roundtrip must preserve every byte')
  assert.equal(mode(decrypted), 0o600, 'decrypted files must be owner-readable only')

  const tampered = resolve(TEMP_DIRECTORY, 'tampered.aesgcm')
  const tamperedOutput = resolve(TEMP_DIRECTORY, 'tampered-output.bin')
  const tamperedBytes = readFileSync(encrypted)
  tamperedBytes[tamperedBytes.length - 1] ^= 0x01
  writeFileSync(tampered, tamperedBytes, { mode: 0o600 })
  const tamperedDecryption = runAes('decrypt', tampered, tamperedOutput)
  assertFailure(tamperedDecryption, 'tampered AES-GCM decryption')
  assert.equal(
    existsSync(tamperedOutput),
    false,
    'authentication failure must not leave a plaintext output file',
  )

  const shortPassphraseOutput = resolve(TEMP_DIRECTORY, 'short-passphrase.aesgcm')
  const shortPassphrase = runAes('encrypt', plaintext, shortPassphraseOutput, 'too-short')
  assertFailure(shortPassphrase, 'short-passphrase encryption')
  assert.match(shortPassphrase.stderr, /at least 32 characters/)
  assert.equal(
    existsSync(shortPassphraseOutput),
    false,
    'a rejected passphrase must not leave an archive',
  )

  const existingEncrypted = resolve(TEMP_DIRECTORY, 'existing-encrypted.bin')
  const encryptedSentinel = Buffer.from('do not replace encrypted output', 'utf8')
  writeFileSync(existingEncrypted, encryptedSentinel, { mode: 0o600 })
  const refusedEncryption = runAes('encrypt', plaintext, existingEncrypted)
  assertFailure(refusedEncryption, 'encryption over an existing output')
  assert.deepEqual(
    readFileSync(existingEncrypted),
    encryptedSentinel,
    'encryption must not overwrite an existing file',
  )

  const existingDecrypted = resolve(TEMP_DIRECTORY, 'existing-decrypted.bin')
  const decryptedSentinel = Buffer.from('do not replace decrypted output', 'utf8')
  writeFileSync(existingDecrypted, decryptedSentinel, { mode: 0o600 })
  const refusedDecryption = runAes('decrypt', encrypted, existingDecrypted)
  assertFailure(refusedDecryption, 'decryption over an existing output')
  assert.deepEqual(
    readFileSync(existingDecrypted),
    decryptedSentinel,
    'decryption must not overwrite an existing file',
  )

  // This script is intentionally inspected rather than imported or executed: the
  // offline test must never initialize a production-capable Supabase client.
  const storageSource = readFileSync(STORAGE_SCRIPT, 'utf8')

  assert.match(storageSource, /const PROJECT_REF = 'yogwhfrjhcbnvoxitcay'/)
  assert.match(storageSource, /const PROJECT_URL = `https:\/\/\$\{PROJECT_REF\}\.supabase\.co`/)
  assert.match(storageSource, /configuredUrl !== PROJECT_URL/)
  assert.match(storageSource, /Refusing to back up an unexpected Supabase project/)

  assert.match(
    storageSource,
    /process\.env\.SHOWCASE_PRODUCTION_BACKUP_CONFIRMED !== 'true'/,
    'production backup must require an exact, explicit confirmation value',
  )
  assert.match(storageSource, /SHOWCASE_PRODUCTION_BACKUP_CONFIRMED=true is required/)

  assert.match(storageSource, /before\.buckets\.some\(\(bucket\) => bucket\.public\)/)
  assert.match(storageSource, /Every production Storage bucket must remain private/)

  assert.match(storageSource, /const before = await listAllObjects\(client\)/)
  assert.match(storageSource, /const after = await listAllObjects\(client\)/)
  assert.match(storageSource, /before\.objects\.map\(objectProjection\)/)
  assert.match(storageSource, /after\.objects\.map\(objectProjection\)/)
  assert.match(storageSource, /if \(beforeState !== afterState\)/)
  assert.match(storageSource, /Storage inventory changed during backup/)

  assert.match(
    storageSource,
    /const BACKUP_ROOT = resolve\(homedir\(\), 'Showcase-backups', `production-\$\{PROJECT_REF\}`\)/,
  )
  assert.match(storageSource, /const output = resolve\(required\(directory, 'output directory'\)\)/)
  assert.match(storageSource, /!output\.startsWith\(BACKUP_ROOT \+ sep\)/)
  assert.match(storageSource, /basename\(output\) !== '\.storage-work'/)
  assert.match(storageSource, /dirname\(output\) === BACKUP_ROOT/)
  assert.match(storageSource, /Refusing to write outside a timestamped production backup directory/)
  assert.match(storageSource, /writeFileSync\(resolve\(objectDirectory, objectKey\), bytes/)

  assert.match(storageSource, /if \(bytes\.length !== object\.size\)/)
  assert.match(storageSource, /Storage size changed during download/)
  assert.match(
    storageSource,
    /createHash\('sha256'\)\.update\(`\$\{object\.bucket\}\\0\$\{object\.path\}`\)\.digest\('hex'\)/,
    'stored object names must be a SHA-256 projection of bucket and path',
  )
  assert.match(
    storageSource,
    /createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)/,
    'the manifest must record a SHA-256 content digest',
  )
  assert.match(storageSource, /totalBytes \+= bytes\.length/)
  assert.match(storageSource, /object_key: objectKey/)
  assert.match(storageSource, /\bsha256,\n\s+\}\)/)

  assert.match(storageSource, /mkdirSync\(output, \{ mode: 0o700 \}\)/)
  assert.match(storageSource, /chmodSync\(output, 0o700\)/)
  assert.match(storageSource, /mkdirSync\(objectDirectory, \{ mode: 0o700 \}\)/)
  assert.match(
    storageSource,
    /writeFileSync\(resolve\(objectDirectory, objectKey\), bytes, \{ mode: 0o600 \}\)/,
  )
  assert.match(
    storageSource,
    /writeFileSync\(resolve\(output, 'manifest\.json'\),[\s\S]*\{ mode: 0o600 \}\)/,
  )

  const managedCatalogSource = readFileSync(MANAGED_CATALOG_SCRIPT, 'utf8')
  assert.match(managedCatalogSource, /table_namespace\.nspname IN \('auth', 'storage'\)/)
  assert.match(managedCatalogSource, /function_namespace\.nspname = 'public'/)
  assert.match(managedCatalogSource, /pg_get_triggerdef/)
  assert.match(managedCatalogSource, /FROM pg_catalog\.pg_policies/)
  assert.match(managedCatalogSource, /WHERE schemaname = 'storage'/)

  const managedRestoreSource = readFileSync(MANAGED_RESTORE_SCRIPT, 'utf8')
  assert.match(managedRestoreSource, /CREATE TRIGGER on_auth_user_created/)
  assert.match(managedRestoreSource, /EXECUTE FUNCTION public\.handle_new_user\(\)/)
  for (const policyName of [
    'Users can upload their own resume files',
    'Users can read their own resume files',
    'Users can delete their own resume files',
    'Users can upload their own interview recordings',
    'Users can read their own interview recordings',
    'Users can delete their own interview recordings',
    'portfolio_images_insert_own',
    'portfolio_images_select_own',
    'portfolio_images_delete_own',
  ]) {
    assert.ok(managedRestoreSource.includes(policyName), `missing managed policy: ${policyName}`)
  }
  assert.match(managedRestoreSource, /Showcase Auth signup trigger was not restored/)
  assert.match(managedRestoreSource, /Showcase Storage policy set does not match/)

  const verifierFixture = resolve(TEMP_DIRECTORY, 'verifier')
  const databaseDirectory = resolve(verifierFixture, 'database')
  const storageDirectory = resolve(verifierFixture, 'storage')
  const storageObjectsDirectory = resolve(storageDirectory, 'objects')
  mkdirSync(databaseDirectory, { recursive: true, mode: 0o700 })
  mkdirSync(storageObjectsDirectory, { recursive: true, mode: 0o700 })

  const inventory = {
    schema_version: 1,
    objects: {
      'table:public.example': { row_count: 1, content_digest: 'fixture-digest' },
    },
    object_count: 1,
    table_count: 1,
    sequence_count: 0,
    total_table_rows: 1,
  }
  writeJson(resolve(databaseDirectory, 'source-inventory.json'), inventory)
  writeJson(resolve(verifierFixture, 'restored-inventory.json'), inventory)

  const ordinalColumns = [
    ['user_id', 1, 1],
    ['preferred_language', 5, 2],
    ['default_delivery_mode', 6, 3],
    ['default_coaching_mode', 7, 4],
    ['default_interviewer_style', 8, 5],
    ['default_accommodations', 9, 6],
    ['raw_audio_retention_enabled', 10, 7],
    ['transcript_retention_days', 11, 8],
    ['created_at', 12, 9],
    ['updated_at', 13, 10],
  ]
  const makeColumn = (column, ordinal) => ({
    table: 'interview_profiles',
    column,
    ordinal,
    data_type: 'text',
    udt_schema: 'pg_catalog',
    udt_name: 'text',
    nullable: 'YES',
    default: null,
    identity: 'NO',
    generated: 'NEVER',
  })
  const catalogBase = {
    schema_version: 1,
    relations: [],
    constraints: [],
    indexes: [],
    functions: [],
    triggers: [{ table: 'example', name: 'example_trigger', enabled: 'O' }],
    policies: [],
    table_grants: [],
    routine_grants: [],
    usage_grants: [],
  }
  writeJson(resolve(databaseDirectory, 'source-public-catalog.json'), {
    ...catalogBase,
    columns: ordinalColumns.map(([name, sourceOrdinal]) => makeColumn(name, sourceOrdinal)),
  })
  writeJson(resolve(verifierFixture, 'restored-public-catalog.json'), {
    ...catalogBase,
    columns: ordinalColumns.map((entry) => makeColumn(entry[0], entry[2])),
  })

  const platformBase = {
    schema_version: 1,
    application_migrations: { count: 1, latest_version: '1', entries: [{ version: '1' }] },
    auth_migrations: ['1'],
    extensions: [{ name: 'plpgsql', version: '1.0', schema: 'pg_catalog' }],
  }
  writeJson(resolve(databaseDirectory, 'platform-manifest.json'), {
    ...platformBase,
    storage_migrations: [{ id: '1', name: 'fixture', hash: 'fixture-hash', executed_at: 'source' }],
  })
  writeJson(resolve(verifierFixture, 'restored-platform-manifest.json'), {
    ...platformBase,
    storage_migrations: [{ id: '1', name: 'fixture', hash: 'fixture-hash', executed_at: 'target' }],
  })

  const storageBytes = Buffer.from('verified storage bytes', 'utf8')
  const objectKey = createHash('sha256').update('private\0fixture/path').digest('hex')
  const contentSha256 = createHash('sha256').update(storageBytes).digest('hex')
  writeFileSync(resolve(storageObjectsDirectory, objectKey), storageBytes, { mode: 0o600 })
  writeJson(resolve(databaseDirectory, 'storage-database-manifest.json'), {
    schema_version: 1,
    row_count: 1,
    content_digest: 'fixture',
    objects: [{ bucket: 'private', path: 'fixture/path', size: storageBytes.length }],
  })
  writeJson(resolve(storageDirectory, 'manifest.json'), {
    schema_version: 2,
    project_ref: 'fixture',
    bucket_count: 1,
    all_buckets_private: true,
    object_count: 1,
    total_bytes: storageBytes.length,
    objects: [{
      bucket: 'private',
      path: 'fixture/path',
      size: storageBytes.length,
      object_key: objectKey,
      sha256: contentSha256,
    }],
  })

  const managedCatalog = {
    schema_version: 1,
    managed_app_triggers: [{
      table_schema: 'auth',
      table_name: 'users',
      trigger_name: 'on_auth_user_created',
      enabled: 'O',
      function_schema: 'public',
      function_name: 'handle_new_user',
      definition: 'CREATE TRIGGER fixture',
    }],
    storage_policies: [
      'Users can delete their own interview recordings',
      'Users can delete their own resume files',
      'Users can read their own interview recordings',
      'Users can read their own resume files',
      'Users can upload their own interview recordings',
      'Users can upload their own resume files',
      'portfolio_images_delete_own',
      'portfolio_images_insert_own',
      'portfolio_images_select_own',
    ].map((name) => ({
      table: 'objects',
      name,
      permissive: 'PERMISSIVE',
      roles: ['authenticated'],
      command: 'SELECT',
      using: 'fixture',
      check: null,
    })),
  }
  writeJson(resolve(databaseDirectory, 'managed-app-catalog.json'), managedCatalog)
  writeJson(resolve(verifierFixture, 'restored-managed-app-catalog.json'), managedCatalog)

  const verifierArguments = [
    VERIFY_SCRIPT,
    databaseDirectory,
    resolve(verifierFixture, 'restored-inventory.json'),
    resolve(verifierFixture, 'restored-public-catalog.json'),
    resolve(verifierFixture, 'restored-platform-manifest.json'),
    storageDirectory,
    resolve(verifierFixture, 'restored-managed-app-catalog.json'),
  ]
  const verification = spawnSync(process.execPath, verifierArguments, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  })
  assertSuccess(verification, 'restore verifier fixture')
  const verificationResult = JSON.parse(verification.stdout)
  assert.equal(verificationResult.database.inventory_exact, true)
  assert.equal(verificationResult.database.historical_dropped_column_gap_count, 3)
  assert.equal(verificationResult.database.managed_app_objects.catalog_exact, true)
  assert.equal(verificationResult.database.managed_app_objects.auth_storage_trigger_count, 1)
  assert.equal(verificationResult.database.managed_app_objects.storage_policy_count, 9)
  assert.equal(verificationResult.storage.file_sha256_exact, true)

  const missingManagedCatalogVerification = spawnSync(
    process.execPath,
    verifierArguments.slice(0, -1),
    { cwd: ROOT, encoding: 'utf8', timeout: 30_000 },
  )
  assertFailure(
    missingManagedCatalogVerification,
    'restore verifier without a restored managed application catalog',
  )
  assert.match(
    missingManagedCatalogVerification.stderr,
    /restored managed application catalog is required/,
  )

  writeFileSync(resolve(storageObjectsDirectory, 'extra'), 'unexpected', { mode: 0o600 })
  const extraFileVerification = spawnSync(process.execPath, verifierArguments, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  })
  assertFailure(extraFileVerification, 'restore verifier with an extra Storage file')
  assert.match(extraFileVerification.stderr, /Restored Storage file set does not match/)

  console.log('Backup tool tests passed: encryption, Storage safety, and restore verification')
} finally {
  rmSync(TEMP_DIRECTORY, { recursive: true, force: true })
}
