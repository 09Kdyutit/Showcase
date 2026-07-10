#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

function required(value, description) {
  if (!value) throw new Error(`${description} is required`)
  return resolve(value)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
    )
  }
  return value
}

function equal(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}

function assertEqual(left, right, description) {
  if (!equal(left, right)) throw new Error(`${description} does not match`)
}

function without(record, key) {
  const copy = { ...record }
  delete copy[key]
  return copy
}

const expectedPhysicalOrdinalChanges = new Map([
  ['interview_profiles.preferred_language', [5, 2]],
  ['interview_profiles.default_delivery_mode', [6, 3]],
  ['interview_profiles.default_coaching_mode', [7, 4]],
  ['interview_profiles.default_interviewer_style', [8, 5]],
  ['interview_profiles.default_accommodations', [9, 6]],
  ['interview_profiles.raw_audio_retention_enabled', [10, 7]],
  ['interview_profiles.transcript_retention_days', [11, 8]],
  ['interview_profiles.created_at', [12, 9]],
  ['interview_profiles.updated_at', [13, 10]],
])

function normalizeCatalogColumns(sourceCatalog, restoredCatalog) {
  if (sourceCatalog.columns.length !== restoredCatalog.columns.length) {
    throw new Error('Public catalog column counts do not match')
  }

  const sourceByName = new Map(
    sourceCatalog.columns.map((column) => [`${column.table}.${column.column}`, column]),
  )
  const restoredByName = new Map(
    restoredCatalog.columns.map((column) => [`${column.table}.${column.column}`, column]),
  )
  assertEqual([...sourceByName.keys()], [...restoredByName.keys()], 'Public catalog column order')

  const observedOrdinalChanges = new Map()
  for (const [name, sourceColumn] of sourceByName) {
    const restoredColumn = restoredByName.get(name)
    const sourceOrdinal = sourceColumn.ordinal
    const restoredOrdinal = restoredColumn.ordinal
    const sourceDefinition = without(sourceColumn, 'ordinal')
    const restoredDefinition = without(restoredColumn, 'ordinal')
    assertEqual(sourceDefinition, restoredDefinition, `Public catalog column ${name}`)
    if (sourceOrdinal !== restoredOrdinal) {
      observedOrdinalChanges.set(name, [sourceOrdinal, restoredOrdinal])
    }
  }
  assertEqual(
    Object.fromEntries(observedOrdinalChanges),
    Object.fromEntries(expectedPhysicalOrdinalChanges),
    'Expected dropped-column physical ordinal compaction',
  )

  return restoredCatalog.columns.map((column) => without(column, 'ordinal'))
}

function normalizePlatform(manifest) {
  return {
    ...manifest,
    storage_migrations: manifest.storage_migrations.map((migration) => (
      without(migration, 'executed_at')
    )),
  }
}

function storageProjection(object) {
  return {
    bucket: object.bucket,
    path: object.path,
    size: object.size,
  }
}

function sortStorageObjects(objects) {
  return [...objects]
    .map(storageProjection)
    .sort((left, right) => `${left.bucket}\0${left.path}`.localeCompare(`${right.bucket}\0${right.path}`))
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function verifyStorageFiles(storageDirectory, manifest) {
  if (manifest.all_buckets_private !== true) {
    throw new Error('The Storage backup contains or reports a public bucket')
  }
  const expectedObjectKeys = manifest.objects.map((object) => object.object_key).sort()
  const restoredObjectKeys = readdirSync(resolve(storageDirectory, 'objects')).sort()
  assertEqual(restoredObjectKeys, expectedObjectKeys, 'Restored Storage file set')

  let totalBytes = 0
  for (const object of manifest.objects) {
    if (!/^[a-f0-9]{64}$/.test(object.object_key)) {
      throw new Error('Storage manifest contains an invalid object key')
    }
    if (!/^[a-f0-9]{64}$/.test(object.sha256)) {
      throw new Error('Storage manifest contains an invalid content digest')
    }

    const objectPath = resolve(storageDirectory, 'objects', object.object_key)
    const objectBytes = statSync(objectPath).size
    if (objectBytes !== object.size) throw new Error('A restored Storage object has the wrong size')
    if (sha256(objectPath) !== object.sha256) {
      throw new Error('A restored Storage object failed its content digest check')
    }
    totalBytes += objectBytes
  }

  if (totalBytes !== manifest.total_bytes) {
    throw new Error('Restored Storage bytes do not match the manifest total')
  }
  return totalBytes
}

function main() {
  const databaseDirectory = required(process.argv[2], 'database directory')
  const restoredInventoryPath = required(process.argv[3], 'restored inventory')
  const restoredCatalogPath = required(process.argv[4], 'restored catalog')
  const restoredPlatformPath = required(process.argv[5], 'restored platform manifest')
  const storageDirectory = required(process.argv[6], 'storage directory')

  const sourceInventory = readJson(resolve(databaseDirectory, 'source-inventory.json'))
  const restoredInventory = readJson(restoredInventoryPath)
  assertEqual(sourceInventory, restoredInventory, 'Database content inventory')

  const sourceCatalog = readJson(resolve(databaseDirectory, 'source-public-catalog.json'))
  const restoredCatalog = readJson(restoredCatalogPath)
  const normalizedRestoredColumns = normalizeCatalogColumns(sourceCatalog, restoredCatalog)
  assertEqual(
    { ...sourceCatalog, columns: sourceCatalog.columns.map((column) => without(column, 'ordinal')) },
    { ...restoredCatalog, columns: normalizedRestoredColumns },
    'Normalized public catalog',
  )
  const disabledTriggerCount = restoredCatalog.triggers.filter((trigger) => trigger.enabled !== 'O').length
  if (disabledTriggerCount !== 0) throw new Error('The restored database has disabled public triggers')

  const sourcePlatform = readJson(resolve(databaseDirectory, 'platform-manifest.json'))
  const restoredPlatform = readJson(restoredPlatformPath)
  assertEqual(
    normalizePlatform(sourcePlatform),
    normalizePlatform(restoredPlatform),
    'Platform and application migration manifest',
  )

  const storageDatabaseManifest = readJson(
    resolve(databaseDirectory, 'storage-database-manifest.json'),
  )
  const storageManifest = readJson(resolve(storageDirectory, 'manifest.json'))
  assertEqual(
    sortStorageObjects(storageDatabaseManifest.objects),
    sortStorageObjects(storageManifest.objects),
    'Storage database and byte inventories',
  )
  if (storageDatabaseManifest.row_count !== storageManifest.object_count) {
    throw new Error('Storage database row count does not match the byte archive')
  }
  const distinctBucketCount = new Set(storageManifest.objects.map((object) => object.bucket)).size
  if (distinctBucketCount !== storageManifest.bucket_count) {
    throw new Error('Storage manifest bucket count does not match its objects')
  }
  const verifiedStorageBytes = verifyStorageFiles(storageDirectory, storageManifest)

  const result = {
    schema_version: 1,
    database: {
      inventory_exact: true,
      object_count: restoredInventory.object_count,
      table_count: restoredInventory.table_count,
      sequence_count: restoredInventory.sequence_count,
      total_table_rows: restoredInventory.total_table_rows,
      normalized_public_catalog_exact: true,
      physical_column_ordinals_ignored: true,
      physical_column_ordinal_change_count: expectedPhysicalOrdinalChanges.size,
      historical_dropped_column_gap_count: 3,
      disabled_public_trigger_count: disabledTriggerCount,
    },
    platform: {
      application_migration_count: restoredPlatform.application_migrations.count,
      application_latest_version: restoredPlatform.application_migrations.latest_version,
      auth_migration_count: restoredPlatform.auth_migrations.length,
      storage_migration_count: restoredPlatform.storage_migrations.length,
      extension_count: restoredPlatform.extensions.length,
      storage_execution_timestamps_ignored: true,
    },
    storage: {
      bucket_count: storageManifest.bucket_count,
      object_count: storageManifest.object_count,
      total_bytes: verifiedStorageBytes,
      database_inventory_exact: true,
      file_sizes_exact: true,
      file_sha256_exact: true,
      all_buckets_private: storageManifest.all_buckets_private,
    },
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
