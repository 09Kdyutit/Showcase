#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, resolve, sep } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PROJECT_REF = 'yogwhfrjhcbnvoxitcay'
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`
const BACKUP_ROOT = resolve(homedir(), 'Showcase-backups', `production-${PROJECT_REF}`)

function required(value, name) {
  if (!value) throw new Error(`${name} is required`)
  return value
}

function assertSafeOutput(directory) {
  const output = resolve(required(directory, 'output directory'))
  if (
    !output.startsWith(BACKUP_ROOT + sep)
    || basename(output) !== '.storage-work'
    || dirname(output) === BACKUP_ROOT
  ) {
    throw new Error('Refusing to write outside a timestamped production backup directory')
  }
  return output
}

function objectProjection(object) {
  return {
    bucket: object.bucket,
    path: object.path,
    size: object.size,
    content_type: object.content_type,
    version: object.version,
    created_at: object.created_at,
    updated_at: object.updated_at,
  }
}

async function listBucketObjects(client, bucket) {
  const found = []

  async function walk(prefix = '') {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.storage.from(bucket.id).list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw new Error(`Storage list failed for bucket ${bucket.id}: ${error.message}`)
      const entries = data ?? []

      for (const entry of entries) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.id === null) {
          await walk(path)
          continue
        }
        found.push({
          bucket: bucket.id,
          path,
          size: Number(entry.metadata?.size ?? 0),
          content_type: entry.metadata?.mimetype ?? null,
          version: entry.version ?? null,
          created_at: entry.created_at ?? null,
          updated_at: entry.updated_at ?? null,
        })
      }

      if (entries.length < 100) break
    }
  }

  await walk()
  return found
}

async function listAllObjects(client) {
  const { data: buckets, error } = await client.storage.listBuckets()
  if (error) throw new Error(`Storage bucket discovery failed: ${error.message}`)
  const sortedBuckets = [...(buckets ?? [])].sort((left, right) => left.id.localeCompare(right.id))
  const objects = []
  for (const bucket of sortedBuckets) {
    objects.push(...await listBucketObjects(client, bucket))
  }
  objects.sort((left, right) => `${left.bucket}\0${left.path}`.localeCompare(`${right.bucket}\0${right.path}`))
  return { buckets: sortedBuckets, objects }
}

async function main() {
  if (process.env.SHOWCASE_PRODUCTION_BACKUP_CONFIRMED !== 'true') {
    throw new Error('SHOWCASE_PRODUCTION_BACKUP_CONFIRMED=true is required')
  }
  const configuredUrl = required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  if (configuredUrl !== PROJECT_URL) throw new Error('Refusing to back up an unexpected Supabase project')
  const serviceRoleKey = required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
  const output = assertSafeOutput(process.argv[2])

  mkdirSync(output, { mode: 0o700 })
  chmodSync(output, 0o700)
  const objectDirectory = resolve(output, 'objects')
  mkdirSync(objectDirectory, { mode: 0o700 })

  try {
    const client = createClient(PROJECT_URL, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const before = await listAllObjects(client)
    if (before.buckets.some((bucket) => bucket.public)) {
      throw new Error('Every production Storage bucket must remain private')
    }

    const manifestObjects = []
    let totalBytes = 0
    for (const object of before.objects) {
      const { data, error } = await client.storage.from(object.bucket).download(object.path)
      if (error || !data) {
        throw new Error(`Storage download failed in bucket ${object.bucket}: ${error?.message ?? 'empty response'}`)
      }
      const bytes = Buffer.from(await data.arrayBuffer())
      if (bytes.length !== object.size) {
        throw new Error(`Storage size changed during download in bucket ${object.bucket}`)
      }
      const objectKey = createHash('sha256').update(`${object.bucket}\0${object.path}`).digest('hex')
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      writeFileSync(resolve(objectDirectory, objectKey), bytes, { mode: 0o600 })
      totalBytes += bytes.length
      manifestObjects.push({
        ...objectProjection(object),
        object_key: objectKey,
        sha256,
      })
    }

    const after = await listAllObjects(client)
    const beforeState = JSON.stringify(before.objects.map(objectProjection))
    const afterState = JSON.stringify(after.objects.map(objectProjection))
    if (beforeState !== afterState) throw new Error('Storage inventory changed during backup')

    const manifest = {
      schema_version: 2,
      project_ref: PROJECT_REF,
      created_at: new Date().toISOString(),
      bucket_count: before.buckets.length,
      all_buckets_private: true,
      object_count: manifestObjects.length,
      total_bytes: totalBytes,
      objects: manifestObjects,
    }
    writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
    process.stdout.write(JSON.stringify({
      bucket_count: manifest.bucket_count,
      object_count: manifest.object_count,
      total_bytes: manifest.total_bytes,
      inventory_stable: true,
    }) + '\n')
  } catch (error) {
    rmSync(output, { recursive: true, force: true })
    throw error
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
