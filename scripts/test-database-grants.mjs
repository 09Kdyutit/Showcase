import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationPath = 'supabase/migrations/20260710033047_explicit_data_api_grants.sql'
const migration = readFileSync(resolve(migrationPath), 'utf8')

const expectedAuthenticated = {
  SELECT: [
    'applications', 'audits', 'evidence_items', 'generations', 'interview_answers',
    'interview_dimension_scores', 'interview_drills', 'interview_evaluations',
    'interview_profiles', 'interview_questions', 'interview_reminders',
    'interview_sessions', 'interview_shared_reports', 'interview_story_bank',
    'interview_transcript_segments', 'interview_usage', 'interview_usage_reservations',
    'job_listings_cache', 'portfolios', 'profiles', 'projects', 'resumes', 'saved_jobs',
    'saved_projects', 'saved_searches', 'subscriptions', 'tailored_assets', 'voice_profiles',
  ],
  INSERT: [
    'applications', 'evidence_items', 'feedback', 'generations', 'interview_answers',
    'interview_dimension_scores', 'interview_drills', 'interview_evaluations',
    'interview_profiles', 'interview_questions', 'interview_reminders',
    'interview_sessions', 'interview_shared_reports', 'interview_story_bank',
    'interview_transcript_segments', 'job_listings_cache', 'portfolios', 'profiles',
    'projects', 'resumes', 'saved_jobs', 'saved_projects', 'saved_searches',
    'tailored_assets', 'voice_profiles',
  ],
  UPDATE: [
    'applications', 'evidence_items', 'interview_answers', 'interview_drills',
    'interview_profiles', 'interview_questions', 'interview_reminders',
    'interview_sessions', 'interview_shared_reports', 'interview_story_bank',
    'portfolios', 'profiles', 'projects', 'resumes', 'saved_jobs', 'saved_projects',
    'tailored_assets', 'voice_profiles',
  ],
  DELETE: [
    'applications', 'evidence_items', 'interview_drills', 'interview_reminders',
    'interview_sessions', 'interview_shared_reports', 'interview_story_bank',
    'interview_transcript_segments', 'portfolios', 'projects', 'resumes', 'saved_jobs',
    'saved_projects', 'saved_searches', 'tailored_assets',
  ],
}

const normalize = (values) => [...new Set(values)].sort()
for (const operation of Object.keys(expectedAuthenticated)) {
  expectedAuthenticated[operation] = normalize(expectedAuthenticated[operation])
}

function extractRoleGrants(role) {
  const grants = { SELECT: [], INSERT: [], UPDATE: [], DELETE: [] }
  const pattern = /grant\s+(select|insert|update|delete)\s+on\s+table\s+([\s\S]*?)\s+to\s+(anon|authenticated)\s*;/gi
  for (const match of migration.matchAll(pattern)) {
    if (match[3].toLowerCase() !== role) continue
    const operation = match[1].toUpperCase()
    grants[operation].push(...[...match[2].matchAll(/public\.([a-z][a-z0-9_]*)/gi)].map((item) => item[1]))
  }
  return Object.fromEntries(Object.entries(grants).map(([operation, tables]) => [operation, normalize(tables)]))
}

assert.deepEqual(
  extractRoleGrants('authenticated'),
  expectedAuthenticated,
  'authenticated grants must exactly match the reviewed RLS operation matrix',
)
assert.deepEqual(
  extractRoleGrants('anon'),
  { SELECT: ['portfolios'], INSERT: [], UPDATE: [], DELETE: [] },
  'anonymous Data API access must remain published-portfolio SELECT only',
)

const policyOperations = new Map()
const migrationDir = resolve('supabase/migrations')
for (const file of readdirSync(migrationDir).filter((name) => name.endsWith('.sql'))) {
  const sql = readFileSync(resolve(migrationDir, file), 'utf8')
  const policyPattern = /create\s+policy\s+(?:"[^"]+"|[a-z][a-z0-9_]*)\s+on\s+(?:public\.)?([a-z][a-z0-9_]*)\s+for\s+(all|select|insert|update|delete)/gi
  for (const match of sql.matchAll(policyPattern)) {
    const table = match[1]
    const operation = match[2].toUpperCase()
    const operations = policyOperations.get(table) ?? new Set()
    if (operation === 'ALL') {
      for (const item of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) operations.add(item)
    } else {
      operations.add(operation)
    }
    policyOperations.set(table, operations)
  }
}

for (const [operation, tables] of Object.entries(expectedAuthenticated)) {
  for (const table of tables) {
    assert.ok(
      policyOperations.get(table)?.has(operation),
      `authenticated ${operation} on ${table} must be backed by an RLS policy`,
    )
  }
}

for (const table of [
  'ai_cost_events', 'beta_feedback', 'email_deliveries', 'email_provider_events',
  'email_suppressions', 'founding_member_config', 'founding_member_slots',
  'general_ai_budget_reservations', 'growth_attributions', 'growth_controls',
  'interview_cost_events', 'marketing_events', 'processed_webhook_events',
  'rate_limit_counters', 'storage_deletion_queue', 'trusted_events', 'usage_events',
  'waitlist_signups',
]) {
  for (const [operation, tables] of Object.entries(expectedAuthenticated)) {
    assert.ok(!tables.includes(table), `${table} must remain service-only, not authenticated ${operation}`)
  }
}

assert.match(migration, /revoke all privileges on all tables in schema public from public, anon, authenticated/i)
assert.match(migration, /grant all privileges on all tables in schema public to service_role/i)
assert.match(migration, /grant all privileges on all sequences in schema public to service_role/i)
assert.match(migration, /revoke execute on all functions in schema public from public, anon, authenticated/i)
assert.match(migration, /grant execute on all functions in schema public to service_role/i)
assert.match(migration, /alter default privileges[\s\S]*grant all privileges on tables to service_role/i)
assert.match(migration, /alter default privileges[\s\S]*revoke execute on functions from public, anon, authenticated/i)
assert.match(migration, /has_table_privilege\('service_role'/)
assert.match(migration, /has_function_privilege\('authenticated'/)

console.log('database grant matrix passed')
