#!/usr/bin/env node

// Deterministic account-deletion proof for the disposable local Supabase harness.
// It audits the applied migration ledger and auth.users FK graph, seeds every owned
// table plus intentional retention/unlink cases, uploads flat and nested files to
// every Storage bucket, invokes the real authenticated Next.js route, and verifies
// both deletion and retention semantics. No provider credentials or remote targets.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DB_CONTAINER = 'supabase_db_showcase'
const LOCAL_STORAGE_RETRY_DELAYS_MS = [250, 750, 1_500]

const EXPECTED_CASCADE_REFERENCES = [
  'applications.user_id',
  'audits.user_id',
  'evidence_items.user_id',
  'feedback.user_id',
  'generations.user_id',
  'interview_answers.user_id',
  'interview_dimension_scores.user_id',
  'interview_drills.user_id',
  'interview_evaluations.user_id',
  'interview_profiles.user_id',
  'interview_questions.user_id',
  'interview_reminders.user_id',
  'interview_sessions.user_id',
  'interview_shared_reports.user_id',
  'interview_story_bank.user_id',
  'interview_transcript_segments.user_id',
  'interview_usage.user_id',
  'interview_usage_reservations.user_id',
  'portfolios.user_id',
  'profiles.id',
  'projects.user_id',
  'resumes.user_id',
  'saved_jobs.user_id',
  'saved_projects.user_id',
  'saved_searches.user_id',
  'subscriptions.user_id',
  'tailored_assets.user_id',
  'usage_events.user_id',
  'voice_profiles.user_id',
]

const EXPECTED_UNLINK_REFERENCES = [
  'ai_cost_events.user_id',
  'email_deliveries.user_id',
  'founding_member_slots.user_id',
  'growth_attributions.user_id',
  'interview_cost_events.user_id',
  'profiles.referred_by',
  'trusted_events.user_id',
  'waitlist_signups.converted_user_id',
]

const EXPECTED_AUTH_USER_TABLES = [
  'flow_state',
  'identities',
  'mfa_factors',
  'oauth_authorizations',
  'oauth_consents',
  'one_time_tokens',
  'refresh_tokens',
  'sessions',
  'webauthn_challenges',
  'webauthn_credentials',
]

let passed = 0
let failed = 0

function record(label, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) passed += 1
  else failed += 1
}

function required(value, label) {
  if (typeof value !== 'string' || value.length < 8) throw new Error(`${label} is missing`)
  return value
}

function assertDisposableLocalEnvironment() {
  const app = new URL(required(APP_URL, 'NEXT_PUBLIC_APP_URL'))
  const supabase = new URL(required(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'))
  required(ANON_KEY, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  required(SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')

  assert.equal(app.origin, 'http://127.0.0.1:3100', 'app must be the harness-owned listener')
  assert.equal(supabase.origin, 'http://127.0.0.1:54321', 'Supabase must be disposable localhost')
  assert.equal(process.env.SUPABASE_PROJECT_REF, 'local', 'project ref must be local')
  assert.equal(process.env.RUN_LIVE_TESTS, '1', 'credentialed local tests must be explicitly enabled')
}

function queryLocalJson(sql) {
  const result = spawnSync(
    'docker',
    [
      'exec', '-i', DB_CONTAINER,
      'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt',
      '-v', 'ON_ERROR_STOP=1', '-c', sql,
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`local schema query failed: ${(result.stderr || result.stdout).trim()}`)
  }
  const output = result.stdout.trim()
  if (!output) throw new Error('local schema query returned no JSON')
  return JSON.parse(output)
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b))
}

function auditAppliedMigrations() {
  const files = readdirSync(join(ROOT, 'supabase', 'migrations'))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
  const expected = files.map((file) => {
    const stem = file.slice(0, -4)
    const separator = stem.indexOf('_')
    return { version: stem.slice(0, separator), name: stem.slice(separator + 1) }
  })
  const applied = queryLocalJson(`
    select coalesce(
      json_agg(json_build_object('version', version, 'name', name) order by version),
      '[]'::json
    )::text
    from supabase_migrations.schema_migrations
  `)
  assert.deepEqual(applied, expected)
  assert.equal(files.at(-1), '20260712035035_retire_public_proofscore_infrastructure.sql')
  record('canonical migration ledger exactly matches all repository files through 048', true, `${files.length} applied`)
}

function auditAuthOwnershipGraph() {
  const references = queryLocalJson(`
    select coalesce(json_agg(reference order by key), '[]'::json)::text
    from (
      select json_build_object(
        'key', c.relname || '.' || a.attname,
        'action', case con.confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL' else con.confdeltype::text end
      ) as reference,
      c.relname || '.' || a.attname as key
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_class referenced on referenced.oid = con.confrelid
      join pg_namespace referenced_ns on referenced_ns.oid = referenced.relnamespace
      join unnest(con.conkey) with ordinality columns(attnum, ordinality) on true
      join pg_attribute a on a.attrelid = c.oid and a.attnum = columns.attnum
      where con.contype = 'f'
        and n.nspname = 'public'
        and referenced_ns.nspname = 'auth'
        and referenced.relname = 'users'
    ) inventory
  `)
  const cascades = references.filter((item) => item.action === 'CASCADE').map((item) => item.key)
  const unlinks = references.filter((item) => item.action === 'SET NULL').map((item) => item.key)
  const unsafe = references.filter((item) => !['CASCADE', 'SET NULL'].includes(item.action))

  assert.deepEqual(sorted(cascades), sorted(EXPECTED_CASCADE_REFERENCES))
  assert.deepEqual(sorted(unlinks), sorted(EXPECTED_UNLINK_REFERENCES))
  assert.deepEqual(unsafe, [])

  const authTables = queryLocalJson(`
    select coalesce(json_agg(table_name order by table_name), '[]'::json)::text
    from information_schema.columns
    where table_schema = 'auth' and column_name = 'user_id'
  `)
  assert.deepEqual(authTables, EXPECTED_AUTH_USER_TABLES)
  record('auth.users ownership graph is fully inventoried', true, `${cascades.length} cascades, ${unlinks.length} unlinks`)
}

function auditUploadPathOwnership() {
  const sourceRoot = join(ROOT, 'src')
  const uploadFiles = readdirSync(sourceRoot, { recursive: true })
    .filter((file) => typeof file === 'string' && /\.(?:ts|tsx)$/.test(file))
    .map((file) => join(sourceRoot, file))
    .filter((file) => readFileSync(file, 'utf8').includes('.upload('))
    .map((file) => file.slice(ROOT.length + 1))
    .sort((a, b) => a.localeCompare(b))
  assert.deepEqual(uploadFiles, [
    'src/app/api/interviews/sessions/[id]/answers/[questionId]/recording/route.ts',
    'src/app/api/portfolio/upload-image/route.ts',
    'src/components/shared/file-upload-zone.tsx',
  ])

  const resumeUpload = readFileSync(join(ROOT, 'src/components/shared/file-upload-zone.tsx'), 'utf8')
  const portfolioUpload = readFileSync(join(ROOT, 'src/app/api/portfolio/upload-image/route.ts'), 'utf8')
  const audioPath = readFileSync(join(ROOT, 'src/lib/interviews/audio-validation.ts'), 'utf8')
  assert.match(resumeUpload, /const path = `\$\{userData\.user\.id\}\//)
  assert.match(portfolioUpload, /const path = `\$\{user\.id\}\//)
  assert.match(audioPath, /return `\$\{userId\}\//)
  record('every current application upload path starts with its authenticated user id', true, `${uploadFiles.length} upload call sites`)
}

async function insertOne(service, table, values) {
  const { data, error } = await service.from(table).insert(values).select('*').single()
  if (error) throw new Error(`${table} seed failed: ${error.message}`)
  return data
}

async function countWhere(service, table, column, value) {
  const { count, error } = await service
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value)
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function selectOne(service, table, column, value) {
  const { data, error } = await service.from(table).select('*').eq(column, value).maybeSingle()
  if (error) throw new Error(`${table} lookup failed: ${error.message}`)
  return data
}

function storageErrorText(error) {
  if (!error) return 'unknown Storage error'
  if (typeof error === 'string') return error
  const fields = ['message', 'error', 'details', 'hint']
    .map((field) => error[field])
    .filter((value) => typeof value === 'string' && value.trim())
  return fields.length ? [...new Set(fields)].join(' | ') : String(error)
}

function isTransientLocalStorageError(error) {
  const text = storageErrorText(error)
  // Authorization, policy, and path/configuration failures are deterministic. They
  // must fail on the first attempt even if a proxy happens to report them as a 5xx.
  if (/unauthori[sz]ed|forbidden|permission(?: denied)?|row.level security|invalid (?:jwt|token)|jwt.*expired|bucket.*(?:not found|does not exist)|invalid bucket|invalid request|violates/i.test(text)) {
    return false
  }

  if (/connection to the database timed out|(?:database|connection).*(?:timed? out|timeout|temporarily unavailable|unavailable|not ready)|\b(?:ETIMEDOUT|ECONNRESET|ECONNREFUSED)\b|socket hang up|fetch failed|bad gateway|service unavailable|gateway timeout|temporarily unavailable/i.test(text)) {
    return true
  }

  const status = Number(error?.statusCode ?? error?.status ?? 0)
  return [408, 425, 429, 502, 503, 504].includes(status)
}

async function withTransientLocalStorageRetry(label, operation) {
  // This retry exists only for Supabase CLI's disposable local Storage service,
  // which can briefly lag Postgres after the preceding high-concurrency auth suite.
  // Never make a remote credentialed operation more persistent through this helper.
  if (SUPABASE_URL !== 'http://127.0.0.1:54321' || process.env.SUPABASE_PROJECT_REF !== 'local') {
    throw new Error(`refusing local Storage retry outside the disposable harness (${label})`)
  }

  const totalAttempts = LOCAL_STORAGE_RETRY_DELAYS_MS.length + 1
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    let result
    try {
      result = await operation()
    } catch (error) {
      if (!isTransientLocalStorageError(error)) throw error
      if (attempt === totalAttempts) {
        throw new Error(`${label} exhausted ${totalAttempts} local attempts: ${storageErrorText(error)}`)
      }
      const waitMs = LOCAL_STORAGE_RETRY_DELAYS_MS[attempt - 1]
      console.warn(`  RETRY ${label} after transient local Storage failure (${attempt}/${totalAttempts}, ${waitMs}ms): ${storageErrorText(error)}`)
      await delay(waitMs)
      continue
    }

    if (!result?.error || !isTransientLocalStorageError(result.error)) return result
    if (attempt === totalAttempts) {
      throw new Error(`${label} exhausted ${totalAttempts} local attempts: ${storageErrorText(result.error)}`)
    }
    const waitMs = LOCAL_STORAGE_RETRY_DELAYS_MS[attempt - 1]
    console.warn(`  RETRY ${label} after transient local Storage failure (${attempt}/${totalAttempts}, ${waitMs}ms): ${storageErrorText(result.error)}`)
    await delay(waitMs)
  }

  throw new Error(`${label} reached an impossible retry state`)
}

function auditLocalStorageRetryPolicy() {
  assert.equal(isTransientLocalStorageError({ message: 'The connection to the database timed out' }), true)
  assert.equal(isTransientLocalStorageError({ statusCode: '503', message: 'Service unavailable' }), true)
  assert.equal(isTransientLocalStorageError({ statusCode: '500', message: 'Permission denied for storage.objects' }), false)
  assert.equal(isTransientLocalStorageError({ statusCode: '403', message: 'new row violates row-level security policy' }), false)
  assert.equal(isTransientLocalStorageError({ statusCode: '404', message: 'Bucket not found' }), false)
  assert.equal(isTransientLocalStorageError({ statusCode: '500', message: 'Invalid request' }), false)
}

async function removeStoragePrefix(service, bucket, prefix, depth = 0) {
  if (depth > 12) throw new Error(`cleanup nesting exceeded in ${bucket}`)
  const { data, error } = await withTransientLocalStorageRetry(
    `${bucket} cleanup list ${prefix}`,
    () => service.storage.from(bucket).list(prefix, { limit: 1000 }),
  )
  if (error) throw new Error(`${bucket} cleanup list failed: ${error.message}`)
  const files = []
  const folders = []
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`
    if (entry.id) files.push(path)
    else folders.push(path)
  }
  for (const folder of folders) await removeStoragePrefix(service, bucket, folder, depth + 1)
  for (let offset = 0; offset < files.length; offset += 100) {
    const { error: removeError } = await withTransientLocalStorageRetry(
      `${bucket} cleanup remove batch ${Math.floor(offset / 100) + 1}`,
      () => service.storage.from(bucket).remove(files.slice(offset, offset + 100)),
    )
    if (removeError) throw new Error(`${bucket} cleanup remove failed: ${removeError.message}`)
  }
}

async function listStoragePrefix(service, bucket, prefix, depth = 0) {
  if (depth > 12) throw new Error(`storage nesting exceeded in ${bucket}`)
  const { data, error } = await withTransientLocalStorageRetry(
    `${bucket} proof list ${prefix}`,
    () => service.storage.from(bucket).list(prefix, { limit: 1000 }),
  )
  if (error) throw new Error(`${bucket} list failed: ${error.message}`)
  const paths = []
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`
    if (entry.id) paths.push(path)
    else paths.push(...await listStoragePrefix(service, bucket, path, depth + 1))
  }
  return paths
}

function mimeForBucket(bucket) {
  return bucket.allowed_mime_types?.[0]
    ?? bucket.allowedMimeTypes?.[0]
    ?? 'application/octet-stream'
}

async function seedOwnedRows(service, targetId, marker) {
  const owned = [{ table: 'profiles', column: 'id', value: targetId }]
  const seed = async (table, values, column = 'user_id') => {
    const row = await insertOne(service, table, values)
    owned.push({ table, column, value: targetId, row })
    return row
  }

  const resume = await seed('resumes', {
    user_id: targetId,
    title: 'Deletion proof resume',
    raw_text: `owned-${marker}`,
    file_path: `${targetId}/${marker}-resume.txt`,
  })
  const portfolio = await seed('portfolios', {
    user_id: targetId,
    slug: `deletion-proof-${marker}`,
    title: 'Deletion proof portfolio',
    status: 'draft',
    content: { marker },
  })
  const project = await seed('projects', {
    user_id: targetId,
    portfolio_id: portfolio.id,
    title: 'Deletion proof project',
  })
  await seed('audits', {
    user_id: targetId,
    portfolio_id: portfolio.id,
    resume_id: resume.id,
    overall_score: 50,
    category_scores: {},
    findings: [],
    recommendations: [],
  })
  const generation = await seed('generations', {
    user_id: targetId,
    type: 'portfolio',
    output: { marker },
    status: 'completed',
  })
  await seed('usage_events', { user_id: targetId, event_name: 'deletion_proof', metadata: { marker } })
  await seed('feedback', { user_id: targetId, message: `delete-${marker}`, rating: 5 })
  await seed('subscriptions', { user_id: targetId, status: 'none' })

  const savedJob = await seed('saved_jobs', {
    user_id: targetId,
    imported_title: 'Deletion Proof Engineer',
    imported_company: 'Local Fixture',
    status: 'saved',
  })
  const tailoredAsset = await seed('tailored_assets', {
    user_id: targetId,
    saved_job_id: savedJob.id,
    asset_type: 'resume',
    base_resume_id: resume.id,
    base_portfolio_id: portfolio.id,
    content: { marker },
  })
  await seed('applications', {
    user_id: targetId,
    saved_job_id: savedJob.id,
    tailored_asset_id: tailoredAsset.id,
    stage: 'saved',
  })
  await seed('voice_profiles', { user_id: targetId, style_profile: { marker } })
  await seed('evidence_items', {
    user_id: targetId,
    title: 'Deletion proof evidence',
    evidence_type: 'document',
    storage_path: `${targetId}/evidence/${marker}.txt`,
  })
  await seed('saved_projects', { user_id: targetId, project: { title: marker } })
  await seed('saved_searches', { user_id: targetId, label: marker, filters: {} })
  await seed('interview_reminders', {
    user_id: targetId,
    remind_at: new Date(Date.now() + 86_400_000).toISOString(),
    note: marker,
  })
  await seed('interview_profiles', { user_id: targetId })

  const session = await seed('interview_sessions', {
    user_id: targetId,
    saved_job_id: savedJob.id,
    resume_id: resume.id,
    portfolio_id: portfolio.id,
    session_type: 'behavioral',
    delivery_mode: 'text',
    coaching_mode: 'guided',
    difficulty: 'standard',
    interviewer_style: 'neutral',
    target_role: 'Deletion Proof Engineer',
    session_plan: { marker },
    rubric_id: 'local-proof',
    rubric_version: '1',
    planned_question_count: 1,
    max_duration_seconds: 300,
  })
  const question = await seed('interview_questions', {
    user_id: targetId,
    session_id: session.id,
    order_index: 0,
    question_text: 'Describe a local proof.',
    competency: 'clarity',
    difficulty: 'standard',
    selection_reason: marker,
  })
  const answer = await seed('interview_answers', {
    user_id: targetId,
    session_id: session.id,
    question_id: question.id,
    answer_text: marker,
    audio_storage_path: `${targetId}/${session.id}/${question.id}/1.webm`,
  })
  await seed('interview_transcript_segments', {
    user_id: targetId,
    session_id: session.id,
    question_id: question.id,
    speaker: 'candidate',
    start_ms: 0,
    end_ms: 1,
    content: marker,
    source_mode: 'text',
  })
  const evaluation = await seed('interview_evaluations', {
    user_id: targetId,
    session_id: session.id,
    prompt_id: 'local-proof',
    prompt_version: '1',
    provider: 'disabled-local',
    model: 'disabled-local',
    rubric_id: 'local-proof',
    rubric_version: '1',
    overall_score: 50,
    readiness_band: 'practicing',
    result: { marker },
  })
  await seed('interview_dimension_scores', {
    user_id: targetId,
    session_id: session.id,
    evaluation_id: evaluation.id,
    answer_id: answer.id,
    dimension_id: 'clarity',
    score: 50,
    weight: 1,
    explanation: marker,
    confidence: 'medium',
  })
  await seed('interview_story_bank', {
    user_id: targetId,
    title: marker,
    competencies: [],
    actions: [],
    verified_metrics: [],
    resume_source_id: resume.id,
    project_source_id: project.id,
    evidence_status: 'unverified',
  })
  await seed('interview_drills', {
    user_id: targetId,
    drill_type: 'behavioral',
    competency: 'clarity',
    source_session_id: session.id,
    status: 'recommended',
  })
  const periodStart = new Date()
  periodStart.setUTCDate(1)
  const periodEnd = new Date(periodStart)
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)
  await seed('interview_usage', {
    user_id: targetId,
    period_start: periodStart.toISOString().slice(0, 10),
    period_end: periodEnd.toISOString().slice(0, 10),
  })
  await seed('interview_usage_reservations', {
    user_id: targetId,
    session_id: session.id,
    kind: 'session',
    status: 'reserved',
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
  })
  await seed('interview_shared_reports', {
    user_id: targetId,
    session_id: session.id,
    token_hash: `hash-${marker}`,
    scope: 'completion_only',
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  })

  const seededTables = owned.map((item) => item.table)
  const expectedTables = EXPECTED_CASCADE_REFERENCES.map((reference) => reference.split('.')[0])
  assert.deepEqual(sorted(seededTables), sorted(expectedTables))
  return { owned, generation, session }
}

async function seedRetainedRows(service, context) {
  const {
    targetId, survivorId, targetEmail, marker, generationId, sessionId,
  } = context
  const retained = []
  const seed = async (table, values, keyColumn = 'id', nullColumns = ['user_id']) => {
    const row = await insertOne(service, table, values)
    retained.push({ table, keyColumn, keyValue: row[keyColumn], nullColumns })
    return row
  }

  await seed('ai_cost_events', {
    idempotency_key: `ai-cost-${marker}`,
    user_id: targetId,
    generation_id: generationId,
    feature: 'deletion_proof',
    provider: 'disabled-local',
    model: 'disabled-local',
    cost_usd: 0,
    pricing_version: 'local-proof',
  }, 'id', ['user_id', 'generation_id'])
  const delivery = await seed('email_deliveries', {
    idempotency_key: `email-delivery-${marker}`,
    user_id: targetId,
    recipient_email: targetEmail,
    template: 'deletion-proof',
    subject: 'Local deletion proof',
    html_body: '<p>local</p>',
    text_body: 'local',
    status: 'sent',
    provider_status: 'sent',
    provider_message_id: `provider-${marker}`,
    sent_at: new Date().toISOString(),
  })
  await seed('founding_member_slots', {
    user_id: targetId,
    status: 'released',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    released_at: new Date().toISOString(),
    release_reason: marker,
  })
  await seed('growth_attributions', {
    session_id: `growth-${marker}`,
    user_id: targetId,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  }, 'session_id')
  await seed('interview_cost_events', {
    user_id: targetId,
    session_id: sessionId,
    feature: 'analysis',
    provider: 'disabled-local',
    model: 'disabled-local',
    cost_usd: 0,
  }, 'id', ['user_id', 'session_id'])
  await seed('trusted_events', {
    idempotency_key: `trusted-${marker}`,
    user_id: targetId,
    event_name: 'deletion_proof',
    entity_type: 'local_fixture',
    entity_id: marker,
  })
  await seed('waitlist_signups', {
    email: targetEmail,
    full_name: 'Deletion Proof',
    status: 'onboarded',
    converted_user_id: targetId,
    consent_granted_at: new Date().toISOString(),
    consent_version: 'local-proof',
  }, 'id', ['converted_user_id'])

  const { error: referralError } = await service
    .from('profiles')
    .update({ referred_by: targetId })
    .eq('id', survivorId)
  if (referralError) throw new Error(`survivor referral seed failed: ${referralError.message}`)
  retained.push({
    table: 'profiles', keyColumn: 'id', keyValue: survivorId, nullColumns: ['referred_by'],
  })

  await insertOne(service, 'email_suppressions', {
    normalized_email: targetEmail,
    reason: 'manual',
    provider: 'resend',
    provider_event_id: `suppression-${marker}`,
    last_event_at: new Date().toISOString(),
  })
  await insertOne(service, 'processed_webhook_events', {
    event_id: `stripe-${marker}`,
    event_type: 'deletion.proof',
    status: 'processed',
    attempt_count: 1,
    processed_at: new Date().toISOString(),
  })
  await insertOne(service, 'email_provider_events', {
    event_id: `email-event-${marker}`,
    event_type: 'email.delivered',
    provider_message_id: delivery.provider_message_id,
    event_occurred_at: new Date().toISOString(),
    status: 'processed',
    attempt_count: 1,
    processed_at: new Date().toISOString(),
  })
  return retained
}

async function seedStorage(service, buckets, targetId, survivorId, marker) {
  const paths = new Map()
  for (const bucket of buckets) {
    const contentType = mimeForBucket(bucket)
    const targetPaths = [
      `${targetId}/${marker}-flat.bin`,
      `${targetId}/level-one/${marker}/level-two/deep.bin`,
    ]
    const survivorPath = `${survivorId}/${marker}-must-survive.bin`
    for (const path of [...targetPaths, survivorPath]) {
      const { error } = await service.storage
        .from(bucket.id)
        .upload(path, Buffer.from(`local deletion proof ${path}`), { contentType, upsert: false })
      if (error) throw new Error(`${bucket.id} seed failed at ${path}: ${error.message}`)
    }
    paths.set(bucket.id, { targetPaths, survivorPath })
  }
  return paths
}

function authResidue(userId) {
  assert.match(userId, /^[0-9a-f-]{36}$/i)
  return queryLocalJson(`
    select json_build_object(
      'users', (select count(*) from auth.users where id = '${userId}'::uuid),
      'flow_state', (select count(*) from auth.flow_state where user_id::text = '${userId}'),
      'identities', (select count(*) from auth.identities where user_id = '${userId}'::uuid),
      'mfa_factors', (select count(*) from auth.mfa_factors where user_id = '${userId}'::uuid),
      'oauth_authorizations', (select count(*) from auth.oauth_authorizations where user_id = '${userId}'::uuid),
      'oauth_consents', (select count(*) from auth.oauth_consents where user_id = '${userId}'::uuid),
      'one_time_tokens', (select count(*) from auth.one_time_tokens where user_id = '${userId}'::uuid),
      'refresh_tokens', (select count(*) from auth.refresh_tokens where user_id::text = '${userId}'),
      'sessions', (select count(*) from auth.sessions where user_id = '${userId}'::uuid),
      'webauthn_challenges', (select count(*) from auth.webauthn_challenges where user_id = '${userId}'::uuid),
      'webauthn_credentials', (select count(*) from auth.webauthn_credentials where user_id = '${userId}'::uuid)
    )::text
  `)
}

async function deleteBy(service, table, column, value) {
  if (value === undefined || value === null) return
  const { error } = await service.from(table).delete().eq(column, value)
  if (error) throw new Error(`${table} cleanup failed: ${error.message}`)
}

async function loginInFreshContext(browser, email, password) {
  const browserContext = await browser.newContext()
  let cookieJar = []
  const authClient = createBrowserClient(SUPABASE_URL, ANON_KEY, {
    isSingleton: false,
    cookies: {
      getAll() {
        return cookieJar
      },
      async setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookieJar = cookieJar.filter((existing) => existing.name !== cookie.name)
          if (cookie.value) cookieJar.push({ name: cookie.name, value: cookie.value })
        }
        await browserContext.addCookies(
          cookieJar.map((cookie) => ({ ...cookie, url: APP_URL })),
        )
      },
    },
  })
  const { error } = await authClient.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`local browser login failed: ${error.message}`)
  assert.ok(cookieJar.some((cookie) => cookie.name.includes('auth-token')))

  const page = await browserContext.newPage()
  await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'domcontentloaded' })
  return { browserContext, page }
}

async function cleanup(context) {
  const {
    service, buckets, targetId, survivorId, failureId, targetEmail, marker,
  } = context
  const cleanupErrors = []
  const attempt = async (operation) => {
    try { await operation() } catch (error) { cleanupErrors.push(error) }
  }

  for (const bucket of buckets) {
    for (const userId of [targetId, survivorId, failureId].filter(Boolean)) {
      await attempt(() => removeStoragePrefix(service, bucket.id, userId))
    }
  }

  const explicitRows = [
    ['ai_cost_events', 'idempotency_key', `ai-cost-${marker}`],
    ['email_deliveries', 'idempotency_key', `email-delivery-${marker}`],
    ['founding_member_slots', 'release_reason', marker],
    ['growth_attributions', 'session_id', `growth-${marker}`],
    ['trusted_events', 'idempotency_key', `trusted-${marker}`],
    ['waitlist_signups', 'email', targetEmail],
    ['email_suppressions', 'normalized_email', targetEmail],
    ['processed_webhook_events', 'event_id', `stripe-${marker}`],
    ['email_provider_events', 'event_id', `email-event-${marker}`],
  ]
  for (const [table, column, value] of explicitRows) {
    await attempt(() => deleteBy(service, table, column, value))
  }
  if (targetId) {
    await attempt(async () => {
      const { error } = await service.from('interview_cost_events').delete().is('user_id', null)
        .eq('provider', 'disabled-local').eq('model', 'disabled-local')
      if (error) throw error
    })
    await attempt(async () => {
      const { error } = await service.from('storage_deletion_queue').delete().like('path', `${targetId}/%`)
      if (error) throw error
    })
  }

  for (const userId of [targetId, survivorId, failureId].filter(Boolean)) {
    await attempt(async () => {
      const { error } = await service.auth.admin.deleteUser(userId)
      if (error && !/not found/i.test(error.message)) throw error
    })
  }

  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, 'synthetic account cleanup failed')
  }

  for (const bucket of buckets) {
    for (const userId of [targetId, survivorId, failureId].filter(Boolean)) {
      const remaining = await listStoragePrefix(service, bucket.id, userId)
      assert.deepEqual(remaining, [])
    }
  }
  for (const userId of [targetId, survivorId, failureId].filter(Boolean)) {
    assert.ok(Object.values(authResidue(userId)).every((count) => count === 0))
  }
}

async function main() {
  assertDisposableLocalEnvironment()
  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const marker = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const targetEmail = `delete-proof-${marker}@example.com`
  const survivorEmail = `delete-survivor-${marker}@example.com`
  const failureEmail = `delete-storage-failure-${marker}@example.com`
  const password = 'LocalDeletionProof123!'
  const context = {
    service, marker, targetEmail, survivorEmail, failureEmail,
    targetId: null, survivorId: null, failureId: null, buckets: [],
  }
  let browser = null

  try {
    auditAppliedMigrations()
    auditAuthOwnershipGraph()
    auditUploadPathOwnership()
    auditLocalStorageRetryPolicy()
    record('local Storage retry policy excludes deterministic authorization and configuration errors', true)

    const { data: bucketData, error: bucketError } = await service.storage.listBuckets()
    if (bucketError) throw new Error(`bucket inventory failed: ${bucketError.message}`)
    context.buckets = bucketData ?? []
    assert.ok(context.buckets.length > 0, 'canonical schema must contain Storage buckets')
    record('all canonical Storage buckets discovered dynamically', true, context.buckets.map((bucket) => bucket.id).join(', '))

    const { data: targetCreate, error: targetError } = await service.auth.admin.createUser({
      email: targetEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Deletion Proof Target' },
    })
    if (targetError || !targetCreate.user) throw targetError ?? new Error('target user missing')
    context.targetId = targetCreate.user.id

    const { data: survivorCreate, error: survivorError } = await service.auth.admin.createUser({
      email: survivorEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Deletion Proof Survivor' },
    })
    if (survivorError || !survivorCreate.user) throw survivorError ?? new Error('survivor user missing')
    context.survivorId = survivorCreate.user.id

    const { data: failureCreate, error: failureError } = await service.auth.admin.createUser({
      email: failureEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Deletion Storage Failure Fixture' },
    })
    if (failureError || !failureCreate.user) throw failureError ?? new Error('failure user missing')
    context.failureId = failureCreate.user.id

    const { error: profileError } = await service.from('profiles')
      .update({ onboarding_completed: true })
      .in('id', [context.targetId, context.survivorId, context.failureId])
    if (profileError) throw new Error(`profile setup failed: ${profileError.message}`)

    const owned = await seedOwnedRows(service, context.targetId, marker)
    const retained = await seedRetainedRows(service, {
      ...context,
      generationId: owned.generation.id,
      sessionId: owned.session.id,
    })
    const storagePaths = await seedStorage(
      service, context.buckets, context.targetId, context.survivorId, marker,
    )
    const recordingPath = storagePaths.get('interview-recordings')?.targetPaths.at(-1)
    assert.ok(recordingPath, 'interview-recordings nested fixture missing')
    await insertOne(service, 'storage_deletion_queue', {
      bucket: 'interview-recordings', path: recordingPath,
    })

    for (const fixture of owned.owned) {
      const count = await countWhere(service, fixture.table, fixture.column, fixture.value)
      assert.equal(count, 1, `${fixture.table} fixture missing before deletion`)
    }
    record('representative row exists in every user-owned table', true, `${owned.owned.length} tables`)

    for (const bucket of context.buckets) {
      const targetFiles = await listStoragePrefix(service, bucket.id, context.targetId)
      const survivorFiles = await listStoragePrefix(service, bucket.id, context.survivorId)
      assert.equal(targetFiles.length, 2)
      assert.equal(survivorFiles.length, 1)
    }
    record('flat, nested, and out-of-scope Storage fixtures exist in every bucket', true)

    const unauthenticated = await fetch(`${APP_URL}/api/account/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    })
    record('unauthenticated deletion is rejected', unauthenticated.status === 401, `status ${unauthenticated.status}`)

    browser = await chromium.launch({ headless: true })
    // Establish the target session before exercising the independent failure fixture.
    // Keeping it in its own browser context also proves the route scopes deletion to
    // the caller rather than whichever synthetic user was most recently created.
    const targetLogin = await loginInFreshContext(browser, targetEmail, password)
    const failureBucket = context.buckets[0]
    const failurePath = [
      context.failureId,
      ...Array.from({ length: 10 }, (_, index) => `depth-${index + 1}`),
      `${marker}.bin`,
    ].join('/')
    const { error: failureUploadError } = await service.storage
      .from(failureBucket.id)
      .upload(failurePath, Buffer.from('force traversal depth failure'), {
        contentType: mimeForBucket(failureBucket), upsert: false,
      })
    if (failureUploadError) throw new Error(`failure fixture upload failed: ${failureUploadError.message}`)

    const failureLogin = await loginInFreshContext(browser, failureEmail, password)
    const failedDeletion = await failureLogin.page.evaluate(async () => {
      const response = await fetch('/api/account/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      return { status: response.status, body: await response.json().catch(() => null) }
    })
    const failureUserAfter = await service.auth.admin.getUserById(context.failureId)
    const failureFilesAfter = await listStoragePrefix(service, failureBucket.id, context.failureId)
    record(
      'Storage traversal failure returns 500 and leaves the auth user intact for retry',
      failedDeletion.status === 500
        && Boolean(failureUserAfter.data.user)
        && failureFilesAfter.includes(failurePath),
      `status ${failedDeletion.status}`,
    )
    await failureLogin.browserContext.close()
    await removeStoragePrefix(service, failureBucket.id, context.failureId)
    const { error: failureDeleteError } = await service.auth.admin.deleteUser(context.failureId)
    if (failureDeleteError) throw new Error(`failure fixture user cleanup failed: ${failureDeleteError.message}`)

    const page = targetLogin.page

    const rejectedConfirmation = await page.evaluate(async () => {
      const response = await fetch('/api/account/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'delete' }),
      })
      return { status: response.status, body: await response.json().catch(() => null) }
    })
    record('non-exact confirmation is rejected', rejectedConfirmation.status === 400, `status ${rejectedConfirmation.status}`)
    const targetStillExists = await service.auth.admin.getUserById(context.targetId)
    assert.ok(targetStillExists.data.user)

    const deletion = await page.evaluate(async () => {
      const response = await fetch('/api/account/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      return { status: response.status, body: await response.json().catch(() => null) }
    })
    record(
      'real authenticated account deletion route succeeds',
      deletion.status === 200 && deletion.body?.success === true,
      `status ${deletion.status}`,
    )

    for (const fixture of owned.owned) {
      const count = await countWhere(service, fixture.table, fixture.column, fixture.value)
      assert.equal(count, 0, `${fixture.table} survived auth deletion`)
    }
    record('all user-owned rows are removed by the audited cascade graph', true, `${owned.owned.length} tables`)

    for (const fixture of retained) {
      const row = await selectOne(service, fixture.table, fixture.keyColumn, fixture.keyValue)
      assert.ok(row, `${fixture.table} operational row should remain`)
      for (const column of fixture.nullColumns) {
        assert.equal(row[column], null, `${fixture.table}.${column} was not unlinked`)
      }
    }
    record('operational history remains but all auth-user foreign keys are unlinked', true, `${retained.length} fixtures`)

    const suppression = await selectOne(service, 'email_suppressions', 'normalized_email', targetEmail)
    assert.equal(suppression?.reason, 'manual')
    record('email suppression remains to honor future opt-outs', true)

    const stripeEvent = await selectOne(service, 'processed_webhook_events', 'event_id', `stripe-${marker}`)
    const emailEvent = await selectOne(service, 'email_provider_events', 'event_id', `email-event-${marker}`)
    assert.ok(stripeEvent && emailEvent)
    record('provider webhook idempotency records remain', true)

    for (const bucket of context.buckets) {
      const targetFiles = await listStoragePrefix(service, bucket.id, context.targetId)
      const survivorFiles = await listStoragePrefix(service, bucket.id, context.survivorId)
      assert.deepEqual(targetFiles, [], `${bucket.id} retained target files`)
      assert.deepEqual(survivorFiles, [storagePaths.get(bucket.id).survivorPath])
    }
    record('every flat and nested target file is gone while other-user files survive', true, `${context.buckets.length} buckets`)

    const queuedPath = await selectOne(service, 'storage_deletion_queue', 'path', recordingPath)
    assert.equal(queuedPath, null)
    record('obsolete retention-queue pointer is removed with its Storage object', true)

    const residue = authResidue(context.targetId)
    assert.ok(Object.values(residue).every((count) => count === 0), JSON.stringify(residue))
    record('auth user, identity, session, refresh-token, and auxiliary auth rows are gone', true)

    const relogin = await anon.auth.signInWithPassword({ email: targetEmail, password })
    record('deleted credentials cannot establish a new session', Boolean(relogin.error) && !relogin.data.session, relogin.error?.message)
    await targetLogin.browserContext.close()
  } catch (error) {
    record('account-deletion proof completed', false, error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) console.error(error.stack)
  } finally {
    if (browser) await browser.close().catch(() => {})
    try {
      await cleanup(context)
      record('all synthetic users, retained rows, and Storage fixtures were cleaned up', true)
    } catch (error) {
      record('all synthetic users, retained rows, and Storage fixtures were cleaned up', false, error instanceof Error ? error.message : String(error))
      if (error instanceof Error && error.stack) console.error(error.stack)
    }
  }

  console.log(`\n  Account deletion proof: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
