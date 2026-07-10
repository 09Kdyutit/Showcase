#!/usr/bin/env node

// Runs credentialed database tests against Supabase CLI's disposable local stack.
// Local credentials stay in child-process memory: this script never writes an env file,
// and its environment overrides any values loaded later from an existing .env.local.
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export const SUPABASE_CLI_VERSION = '2.109.1'
export const PRODUCTION_PROJECT_REF = 'yogwhfrjhcbnvoxitcay'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const APP_URL = 'http://127.0.0.1:3100'
const START_EXCLUDES = 'analytics,edge-runtime,imgproxy,realtime,studio,vector'
const DB_TEST_SCRIPTS = [
  'test:rls',
  'test:referral-credit',
  'test:interview-rls',
  'test:ai-budget-live',
  'test:portfolio-entitlement-live',
]

export function assertNoProductionReference(value, label = 'value') {
  const text = String(value ?? '').toLowerCase()
  if (text.includes(PRODUCTION_PROJECT_REF.toLowerCase())) {
    throw new Error(label + ' contains the production Supabase project ref')
  }
}

export function assertSafeSupabaseCommand(args) {
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error('Supabase command is missing')
  }
  assertNoProductionReference(args.join(' '), 'Supabase command')
  if (args.includes('--linked') || args.includes('--db-url')) {
    throw new Error('Remote-capable Supabase flags are forbidden by the local harness')
  }
  if (args[0] === 'db') {
    if (args[1] !== 'reset' || !args.includes('--local')) {
      throw new Error('The harness permits only an explicit local database reset')
    }
    return
  }
  if (!['start', 'status', 'stop'].includes(args[0])) {
    throw new Error('Unsupported Supabase command in local harness: ' + args[0])
  }
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.length < 8) {
    throw new Error(label + ' is missing from local Supabase status')
  }
  assertNoProductionReference(value, label)
  return value
}

function assertLoopbackUrl(value, label, protocols) {
  const raw = requiredString(value, label)
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(label + ' is not a valid URL')
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(label + ' uses a disallowed protocol: ' + parsed.protocol)
  }
  if (parsed.hostname !== '127.0.0.1') {
    throw new Error(label + ' must target exactly 127.0.0.1, got ' + parsed.hostname)
  }
  if (!parsed.port) {
    throw new Error(label + ' must use an explicit local port')
  }
  return parsed
}

export function assertSafeLocalStatus(status) {
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    throw new Error('Supabase status must be a JSON object')
  }

  assertNoProductionReference(JSON.stringify(status), 'Supabase status')
  const api = assertLoopbackUrl(status.API_URL, 'API_URL', ['http:'])
  const db = assertLoopbackUrl(status.DB_URL, 'DB_URL', ['postgres:', 'postgresql:'])

  for (const name of ['REST_URL', 'GRAPHQL_URL', 'STORAGE_S3_URL']) {
    if (status[name]) {
      const endpoint = assertLoopbackUrl(status[name], name, ['http:'])
      if (endpoint.origin !== api.origin) {
        throw new Error(name + ' does not share the verified local API origin')
      }
    }
  }

  const anonKey = requiredString(status.ANON_KEY, 'ANON_KEY')
  const serviceRoleKey = requiredString(status.SERVICE_ROLE_KEY, 'SERVICE_ROLE_KEY')
  if (anonKey === serviceRoleKey) {
    throw new Error('Local anon and service-role keys must be distinct')
  }

  return Object.freeze({
    apiUrl: api.origin,
    dbUrl: db.toString(),
    anonKey,
    serviceRoleKey,
  })
}

export function assertSafeTestEnvironment(env) {
  const api = assertLoopbackUrl(
    env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_URL',
    ['http:'],
  )
  assertLoopbackUrl(env.DATABASE_URL, 'DATABASE_URL', ['postgres:', 'postgresql:'])
  if (api.origin !== env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a bare local origin')
  }
  assertNoProductionReference(
    [
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.DATABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.SUPABASE_PROJECT_REF,
    ].join('|'),
    'effective test environment',
  )
}

export function buildLocalTestEnvironment(status, baseEnv = process.env) {
  const local = assertSafeLocalStatus(status)
  const env = { ...baseEnv }

  for (const name of [
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_DB_PASSWORD',
    'STAGING_SUPABASE_PROJECT_REF',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_URL',
  ]) {
    delete env[name]
  }

  Object.assign(env, {
    NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.anonKey,
    SUPABASE_URL: local.apiUrl,
    SUPABASE_ANON_KEY: local.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
    SUPABASE_PROJECT_REF: 'local',
    DATABASE_URL: local.dbUrl,
    NEXT_PUBLIC_APP_URL: APP_URL,
    LAUNCH_OPEN: 'true',
    EMAILS_ENABLED: 'false',
    LIFECYCLE_EMAILS_ENABLED: 'false',
    KILL_SWITCH_AI: 'true',
    KILL_SWITCH_GEMINI: 'true',
    KILL_SWITCH_CHECKOUT: 'true',
    KILL_SWITCH_JOBS_PROVIDER: 'true',
    KILL_SWITCH_PUBLISHING: 'true',
    AI_REVIEW_MODE: 'off',
    GEMINI_PAID_PROJECT_CONFIRMED: 'false',
    GEMINI_INTERVIEW_ENABLED: 'false',
    INTERVIEW_LIVE_ENABLED: 'false',
    INTERVIEW_ANALYSIS_ENABLED: 'false',
    INTERVIEW_RECORDING_ENABLED: 'false',
    OPENAI_API_KEY: 'local-disabled-no-network',
    GEMINI_API_KEY: '',
    RESEND_API_KEY: 'local-disabled-no-network',
    RESEND_WEBHOOK_SECRET: 'local-disabled',
    RESEND_DELIVERY_WEBHOOK_SECRET: 'local-disabled',
    STRIPE_SECRET_KEY: 'sk_test_local_disabled',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_local_disabled',
    STRIPE_WEBHOOK_SECRET: 'whsec_local_disabled',
    STRIPE_PRICE_ID_PRO_MONTHLY: '',
    STRIPE_PRICE_ID_PRO_ANNUAL: '',
    STRIPE_PRICE_ID_FOUNDING_ANNUAL: '',
    JOBDATA_API_KEY: '',
    CRON_SECRET: 'local-test-only',
    PROOFSCORE_IP_HASH_SALT: 'local-test-only',
    RUN_LIVE_TESTS: '1',
    LOCAL_SUPABASE_PORT: '54321',
  })

  assertSafeTestEnvironment(env)
  return env
}

export function redactSecrets(value, explicitSecrets = []) {
  let output = String(value ?? '')
  for (const secret of explicitSecrets) {
    if (typeof secret === 'string' && secret.length >= 8) {
      output = output.split(secret).join('<redacted>')
    }
  }
  return output
    .replace(
      /((?:ANON_KEY|SERVICE_ROLE_KEY|SECRET_KEY|JWT_SECRET|S3_PROTOCOL_ACCESS_KEY_SECRET|DB_URL)["']?\s*[:=]\s*["']?)[^"',\s]+/gi,
      '$1<redacted>',
    )
    .replace(
      /((?:anon key|service.role key|secret key|jwt secret|database url|s3 protocol access key secret)\s*[:=]\s*)\S+/gi,
      '$1<redacted>',
    )
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<redacted-jwt>')
    .replace(/\bsb_secret_[A-Za-z0-9_-]+\b/g, '<redacted-supabase-key>')
    .replace(/\b[a-f0-9]{64}\b/gi, '<redacted-hex-secret>')
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://<redacted>@')
}

function cliEnvironment() {
  const env = { ...process.env }
  for (const name of [
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_DB_PASSWORD',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'STAGING_SUPABASE_PROJECT_REF',
  ]) {
    delete env[name]
  }
  return env
}

function runSupabase(args, label) {
  assertSafeSupabaseCommand(args)
  const result = spawnSync(
    NPX,
    ['--yes', 'supabase@' + SUPABASE_CLI_VERSION, '--workdir', ROOT, ...args],
    {
      cwd: ROOT,
      env: cliEnvironment(),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  )

  if (result.error) {
    throw new Error(label + ' could not start: ' + result.error.message)
  }
  if (result.status !== 0) {
    const detail = redactSecrets((result.stdout || '') + '\n' + (result.stderr || ''))
    throw new Error(label + ' failed with exit ' + result.status + '\n' + detail.trim())
  }
  return result.stdout
}

function readLocalStatus() {
  const stdout = runSupabase(['status', '-o', 'json'], 'Supabase local status')
  let status
  try {
    status = JSON.parse(stdout)
  } catch {
    throw new Error('Supabase local status returned invalid JSON')
  }
  return { raw: status, safe: assertSafeLocalStatus(status) }
}

function printChildOutput(result, secrets) {
  const output = redactSecrets((result.stdout || '') + (result.stderr || ''), secrets)
  if (output) process.stdout.write(output)
}

function runNpmScript(script, env, secrets) {
  assertSafeTestEnvironment(env)
  const result = spawnSync(NPM, ['run', script], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  printChildOutput(result, secrets)
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(script + ' failed with exit ' + result.status)
  }
}

async function assertHarnessPortAvailable() {
  await new Promise((resolvePromise, rejectPromise) => {
    const probe = createServer()
    probe.unref()
    probe.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        rejectPromise(new Error('Refusing to reuse an existing listener on ' + APP_URL))
        return
      }
      rejectPromise(error)
    })
    probe.listen({ host: '127.0.0.1', port: 3100, exclusive: true }, () => {
      probe.close(resolvePromise)
    })
  })
}

async function startHarnessApp(env, secrets) {
  // A server may already own the port while its health route is still compiling.
  // Probing the bind itself prevents the harness from mistaking that for a free port.
  await assertHarnessPortAvailable()

  const child = spawn(
    NPM,
    ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3100'],
    {
      cwd: ROOT,
      env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let logs = ''
  const remember = (chunk) => {
    logs = (logs + chunk.toString()).slice(-200_000)
  }
  child.stdout.on('data', remember)
  child.stderr.on('data', remember)

  for (let attempt = 0; attempt < 180; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(
        'Harness app exited before becoming healthy\n' + redactSecrets(logs, secrets),
      )
    }
    try {
      const response = await fetch(APP_URL + '/api/health', {
        signal: AbortSignal.timeout(1_000),
      })
      if (response.status === 200) return child
    } catch {
      // Compilation and local database startup can take a while on the first run.
    }
    await delay(1_000)
  }

  await stopHarnessApp(child)
  throw new Error('Harness app did not become healthy\n' + redactSecrets(logs, secrets))
}

async function stopHarnessApp(child) {
  if (!child || child.exitCode !== null) return
  try {
    if (process.platform === 'win32') child.kill('SIGTERM')
    else process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
  await delay(1_500)
  if (child.exitCode === null) {
    try {
      if (process.platform === 'win32') child.kill('SIGKILL')
      else process.kill(-child.pid, 'SIGKILL')
    } catch {
      child.kill('SIGKILL')
    }
  }
}

function usage() {
  console.log('Usage: npm run test:local-supabase -- [--db-only|--pending-parse-only] [--stop]')
  console.log('  --db-only            Skip the localhost Next.js route/browser test')
  console.log('  --pending-parse-only Run only the localhost pending-parse route/browser test')
  console.log('  --stop               Stop Supabase and delete its local volume after the run')
}

async function main() {
  const options = new Set(process.argv.slice(2))
  const allowed = new Set(['--db-only', '--pending-parse-only', '--stop', '--help'])
  for (const option of options) {
    if (!allowed.has(option)) throw new Error('Unknown option: ' + option)
  }
  if (options.has('--db-only') && options.has('--pending-parse-only')) {
    throw new Error('--db-only and --pending-parse-only are mutually exclusive')
  }
  if (options.has('--help')) {
    usage()
    return
  }

  let app = null
  let local = null
  let verifiedLocal = false
  const failures = []

  try {
    console.log('Starting pinned Supabase CLI ' + SUPABASE_CLI_VERSION + ' locally...')
    runSupabase(['start', '--exclude', START_EXCLUDES], 'Supabase local start')

    local = readLocalStatus()
    verifiedLocal = true
    console.log('Verified disposable target: ' + local.safe.apiUrl)
    console.log('Resetting only the local database and applying repository migrations...')
    runSupabase(['db', 'reset', '--local', '--no-seed'], 'Supabase local database reset')

    // Re-derive keys after reset instead of reusing cached output.
    local = readLocalStatus()
    const env = buildLocalTestEnvironment(local.raw)
    const secrets = [local.safe.anonKey, local.safe.serviceRoleKey, local.safe.dbUrl]

    if (!options.has('--pending-parse-only')) {
      for (const script of DB_TEST_SCRIPTS) {
        console.log('\nRunning ' + script + ' against verified localhost...')
        try {
          runNpmScript(script, env, secrets)
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error))
        }
      }
    }

    if (!options.has('--db-only')) {
      console.log('\nStarting a harness-owned Next.js server on ' + APP_URL + '...')
      try {
        app = await startHarnessApp(env, secrets)
        runNpmScript('test:pending-parse', env, secrets)
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      } finally {
        await stopHarnessApp(app)
        app = null
      }
    }
  } finally {
    await stopHarnessApp(app)
    if (verifiedLocal && !options.has('--stop')) {
      console.log('\nResetting the verified local database to remove all synthetic rows...')
      try {
        runSupabase(['db', 'reset', '--local', '--no-seed'], 'Supabase local cleanup reset')
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      }
    }
    if (options.has('--stop')) {
      console.log('\nStopping the disposable local Supabase stack...')
      try {
        runSupabase(['stop', '--no-backup'], 'Supabase local stop')
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      }
    }
  }

  if (failures.length) {
    console.error('\nLocal Supabase harness failed:')
    for (const failure of failures) console.error('- ' + redactSecrets(failure))
    process.exitCode = 1
    return
  }
  console.log('\nLocal Supabase credentialed suite passed without provider credentials.')
}

const invokedAsScript = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsScript) {
  main().catch((error) => {
    console.error(redactSecrets(error instanceof Error ? error.stack || error.message : error))
    process.exitCode = 1
  })
}
