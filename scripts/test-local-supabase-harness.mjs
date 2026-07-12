#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PRODUCTION_PROJECT_REF,
  SUPABASE_CLI_VERSION,
  assertSafeHarnessDistDir,
  assertSafeHarnessLockDir,
  assertSafeLocalStatus,
  assertSafeSupabaseCommand,
  assertSafeTestEnvironment,
  buildLocalTestEnvironment,
  redactSecrets,
} from './local-supabase-harness.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOCAL_DB_URL = `postgresql://postgres:${'post' + 'gres'}@127.0.0.1:54322/postgres`
const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
const tsconfig = JSON.parse(readFileSync(resolve(ROOT, 'tsconfig.json'), 'utf8'))
const harnessSource = readFileSync(resolve(ROOT, 'scripts/local-supabase-harness.mjs'), 'utf8')
const LOCAL_HARNESS_CONFIG_ENV = {
  SHOWCASE_LOCAL_HARNESS: 'true',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  DATABASE_URL: LOCAL_DB_URL,
  SUPABASE_PROJECT_REF: 'local',
}

for (const script of ['test:rls', 'test:referral-credit', 'test:interview-rls', 'test:deletion']) {
  assert.match(
    packageJson.scripts?.[script] ?? '',
    /--env-file-if-exists=\.env\.local/,
    script + ' must accept the harness environment when .env.local is absent in CI',
  )
}

for (const script of ['test:stripe-webhook-expanded', 'test:authorization-local']) {
  assert.ok(packageJson.scripts?.[script], script + ' must be registered in package.json')
  assert.ok(harnessSource.includes(`'${script}'`), script + ' must run in the local Supabase harness')
}

for (const generatedTypes of ['.next-harness/types/**/*.ts', '.next-harness/dev/types/**/*.ts']) {
  assert.ok(
    tsconfig.include?.includes(generatedTypes),
    `tsconfig must include ${generatedTypes} so Next does not rewrite it during harness runs`,
  )
}

function nextConfigEnvironment(nodeEnv, overrides = {}) {
  const env = { ...process.env, NODE_ENV: nodeEnv }
  for (const name of [
    'SHOWCASE_LOCAL_HARNESS',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'DATABASE_URL',
    'SUPABASE_PROJECT_REF',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_URL',
  ]) {
    delete env[name]
  }
  return Object.assign(env, overrides)
}

function renderedCsp(nodeEnv, supabaseUrl, overrides = {}) {
  const child = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-strip-types',
      '--input-type=module',
      '--eval',
      [
        "const config = (await import('./next.config.ts')).default",
        'const groups = await config.headers()',
        "const csp = groups.flatMap((group) => group.headers).find((header) => header.key === 'Content-Security-Policy')",
        "if (!csp) throw new Error('CSP header missing')",
        'process.stdout.write(csp.value)',
      ].join(';'),
    ],
    {
      cwd: ROOT,
      env: nextConfigEnvironment(nodeEnv, {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        ...overrides,
      }),
      encoding: 'utf8',
    },
  )
  assert.equal(child.status, 0, child.stderr || 'could not render next.config.ts CSP')
  return child.stdout
}

function renderedDistDir(nodeEnv, overrides = {}) {
  const child = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-strip-types',
      '--input-type=module',
      '--eval',
      "const config = (await import('./next.config.ts')).default; process.stdout.write(config.distDir ?? '<default>')",
    ],
    {
      cwd: ROOT,
      env: nextConfigEnvironment(nodeEnv, overrides),
      encoding: 'utf8',
    },
  )
  assert.equal(child.status, 0, child.stderr || 'could not render next.config.ts distDir')
  return child.stdout
}

const SAFE_STATUS = {
  API_URL: 'http://127.0.0.1:54321',
  DB_URL: LOCAL_DB_URL,
  REST_URL: 'http://127.0.0.1:54321/rest/v1',
  GRAPHQL_URL: 'http://127.0.0.1:54321/graphql/v1',
  ANON_KEY: 'local-anon-key-for-harness-test',
  SERVICE_ROLE_KEY: 'local-service-role-key-for-harness-test',
}

assert.equal(SUPABASE_CLI_VERSION, '2.109.1', 'Supabase CLI must stay exactly pinned')
assert.doesNotThrow(() => assertSafeLocalStatus(SAFE_STATUS))
assert.doesNotThrow(() => assertSafeSupabaseCommand(['db', 'reset', '--local', '--no-seed']))
assert.throws(() => assertSafeSupabaseCommand(['db', 'reset', '--linked']), /forbidden/)
assert.throws(
  () => assertSafeSupabaseCommand(['db', 'reset', '--db-url', 'postgresql://remote/db']),
  /forbidden/,
)
assert.throws(() => assertSafeSupabaseCommand(['link', '--project-ref', PRODUCTION_PROJECT_REF]))
assert.equal(assertSafeHarnessDistDir(resolve(ROOT, '.next-harness')), resolve(ROOT, '.next-harness'))
for (const unsafeDirectory of [ROOT, resolve(ROOT, '.next'), resolve(ROOT, '..', '.next-harness')]) {
  assert.throws(() => assertSafeHarnessDistDir(unsafeDirectory), /Refusing to remove/)
}
const expectedLockDir = resolve(ROOT, 'node_modules', '.cache', 'showcase-local-harness.lock')
assert.equal(assertSafeHarnessLockDir(expectedLockDir), expectedLockDir)
for (const unsafeLockDirectory of [
  ROOT,
  resolve(ROOT, '.next-harness'),
  resolve(ROOT, 'node_modules', '.cache'),
  resolve(ROOT, 'node_modules', '.cache', 'another.lock'),
]) {
  assert.throws(() => assertSafeHarnessLockDir(unsafeLockDirectory), /Refusing to manage/)
}
assert.match(harnessSource, /mkdirSync\(lockDir\)/, 'the harness lock must use atomic mkdir')
assert.match(harnessSource, /\['SIGINT', 130\].*\['SIGTERM', 143\]/s,
  'the harness must clean up on both interactive and CI termination signals')

for (const unsafeStatus of [
  { ...SAFE_STATUS, API_URL: 'http://localhost:54321' },
  { ...SAFE_STATUS, API_URL: 'https://' + PRODUCTION_PROJECT_REF + '.supabase.co' },
  { ...SAFE_STATUS, DB_URL: `postgresql://postgres:${'sec' + 'ret'}@10.0.0.5:5432/postgres` },
  { ...SAFE_STATUS, REST_URL: 'http://127.0.0.2:54321/rest/v1' },
]) {
  assert.throws(() => assertSafeLocalStatus(unsafeStatus), /127\.0\.0\.1|production/)
}

const overridden = buildLocalTestEnvironment(SAFE_STATUS, {
  NEXT_PUBLIC_SUPABASE_URL: 'https://' + PRODUCTION_PROJECT_REF + '.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'remote-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'remote-service-role',
  DATABASE_URL: 'postgresql://remote.example.com/postgres',
  STAGING_SUPABASE_PROJECT_REF: 'remote-staging',
  UPSTASH_REDIS_REST_URL: 'https://real-upstash.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'real-upstash-token',
  ERROR_WEBHOOK_URL: 'https://real-webhook.example.com',
  JOBS_API_KEY: 'real-jobs-key',
  JOBS_API_BASE_URL: 'https://real-jobs.example.com',
  JOBS_PROVIDER: 'real-provider',
  JOBDATA_API_KEY: 'real-jobdata-key',
  BUFFER_API_KEY: 'real-buffer-key',
  BUFFER_ORGANIZATION_ID: 'real-buffer-org',
  INBOUND_FORWARD_TO: 'real-inbox@example.com',
  RESEND_FROM_EMAIL: 'real-sender@example.com',
  GROWTH_SCORECARD_EMAIL: 'real-scorecard@example.com',
  EMAIL_POSTAL_ADDRESS: 'real postal address',
  INVITE_APP_URL: 'https://real-app.example.com',
  INVITE_EXCLUDE: 'real-user@example.com',
  UNSUBSCRIBE_SIGNING_SECRET: 'real-unsubscribe-secret',
})
assert.doesNotThrow(() => assertSafeTestEnvironment(overridden))
assert.equal(overridden.NEXT_PUBLIC_SUPABASE_URL, SAFE_STATUS.API_URL)
assert.equal(overridden.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SAFE_STATUS.ANON_KEY)
assert.equal(overridden.SUPABASE_SERVICE_ROLE_KEY, SAFE_STATUS.SERVICE_ROLE_KEY)
assert.equal(overridden.STAGING_SUPABASE_PROJECT_REF, undefined)
assert.equal(overridden.EMAILS_ENABLED, 'false')
assert.equal(overridden.KILL_SWITCH_AI, 'true')
assert.equal(overridden.RUN_LIVE_TESTS, '1')
assert.equal(overridden.LOCAL_SUPABASE_PORT, '54321')
assert.equal(overridden.SHOWCASE_LOCAL_HARNESS, 'true')
for (const disabledProviderVariable of [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'ERROR_WEBHOOK_URL',
  'JOBS_API_KEY',
  'JOBS_API_BASE_URL',
  'JOBS_PROVIDER',
  'JOBDATA_API_KEY',
  'BUFFER_API_KEY',
  'BUFFER_ORGANIZATION_ID',
  'INBOUND_FORWARD_TO',
  'RESEND_FROM_EMAIL',
  'GROWTH_SCORECARD_EMAIL',
  'EMAIL_POSTAL_ADDRESS',
  'INVITE_APP_URL',
  'INVITE_EXCLUDE',
]) {
  assert.equal(
    overridden[disabledProviderVariable],
    '',
    `${disabledProviderVariable} must stay blank even when inherited from the parent environment`,
  )
}
assert.equal(overridden.UNSUBSCRIBE_SIGNING_SECRET, 'local-test-only-unsubscribe-secret')
assert.match(overridden.RESEND_WEBHOOK_SECRET, /^whsec_[A-Za-z0-9+/]+={0,2}$/)
assert.match(overridden.RESEND_DELIVERY_WEBHOOK_SECRET, /^whsec_[A-Za-z0-9+/]+={0,2}$/)

const productionCsp = renderedCsp('production', SAFE_STATUS.API_URL)
assert.ok(!productionCsp.includes('127.0.0.1'), 'production CSP must never gain loopback')
assert.ok(!productionCsp.includes('localhost'), 'production CSP must never gain localhost')
assert.ok(!productionCsp.includes('[::1]'), 'production CSP must never gain IPv6 loopback')
assert.equal(renderedDistDir('production'), '<default>', 'ordinary production must keep the default cache')
assert.equal(
  renderedDistDir('production', { SHOWCASE_LOCAL_HARNESS: 'true' }),
  '<default>',
  'the flag alone must not enable the harness cache',
)
assert.equal(
  renderedDistDir('production', LOCAL_HARNESS_CONFIG_ENV),
  '.next-harness',
  'the exact local production harness must isolate its cache',
)
assert.equal(
  renderedDistDir('development', LOCAL_HARNESS_CONFIG_ENV),
  '.next-harness',
  'the exact local development harness must isolate its cache',
)
assert.equal(renderedDistDir('development'), '<default>', 'ordinary development must keep the default cache')
assert.equal(
  renderedDistDir('production', { ...LOCAL_HARNESS_CONFIG_ENV, VERCEL: '1', VERCEL_ENV: 'production' }),
  '<default>',
  'Vercel must ignore the local harness cache gate',
)
for (const unsafeHarnessOverride of [
  { ...LOCAL_HARNESS_CONFIG_ENV, NEXT_PUBLIC_APP_URL: 'https://showcase.example.com' },
  { ...LOCAL_HARNESS_CONFIG_ENV, NEXT_PUBLIC_SUPABASE_URL: 'https://remote.supabase.co' },
  { ...LOCAL_HARNESS_CONFIG_ENV, DATABASE_URL: 'postgresql://remote.example.com/postgres' },
  { ...LOCAL_HARNESS_CONFIG_ENV, SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF },
]) {
  assert.equal(
    renderedDistDir('production', unsafeHarnessOverride),
    '<default>',
    'remote or non-local configuration must disable the harness cache gate',
  )
}

const localProductionCsp = renderedCsp(
  'production',
  SAFE_STATUS.API_URL,
  LOCAL_HARNESS_CONFIG_ENV,
)
assert.ok(
  localProductionCsp.includes(' http://127.0.0.1:54321'),
  'the exact local production harness CSP must allow its disposable Supabase origin',
)
const vercelProductionCsp = renderedCsp(
  'production',
  SAFE_STATUS.API_URL,
  { ...LOCAL_HARNESS_CONFIG_ENV, VERCEL: '1', VERCEL_ENV: 'production' },
)
assert.ok(!vercelProductionCsp.includes('127.0.0.1'), 'Vercel production CSP must ignore the harness gate')

const localDevelopmentCsp = renderedCsp('development', SAFE_STATUS.API_URL)
assert.ok(
  localDevelopmentCsp.includes(' http://127.0.0.1:54321'),
  'development CSP must allow the exact disposable Supabase origin',
)
for (const unsafeUrl of [
  'http://localhost:54321',
  'http://127.0.0.2:54321',
  'http://[::1]:54321',
  'https://remote.example.com',
  'not a URL',
]) {
  const csp = renderedCsp('development', unsafeUrl)
  assert.ok(!csp.includes(unsafeUrl), 'development CSP must reject ' + unsafeUrl)
}

const redacted = redactSecrets(
  'key=' + SAFE_STATUS.SERVICE_ROLE_KEY
    + ' db=' + SAFE_STATUS.DB_URL
    + ' JWT_SECRET="local-jwt-secret-that-must-not-print"'
    + ' S3_PROTOCOL_ACCESS_KEY_SECRET=' + 'a'.repeat(64),
  [SAFE_STATUS.SERVICE_ROLE_KEY, SAFE_STATUS.DB_URL],
)
assert.ok(!redacted.includes(SAFE_STATUS.SERVICE_ROLE_KEY))
assert.ok(!redacted.includes('postgres:postgres'))
assert.ok(!redacted.includes('local-jwt-secret-that-must-not-print'))
assert.ok(!redacted.includes('a'.repeat(64)))

console.log('local Supabase harness safety invariants passed')
