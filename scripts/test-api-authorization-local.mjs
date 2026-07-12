#!/usr/bin/env node

// Complete API authorization audit for the disposable local Supabase harness.
//
// The static phase makes security/api-authorization-matrix.json fail closed whenever a
// route file or exported HTTP method is added, removed, or reclassified without review.
// The live phase then starts from real local auth users and exercises anonymous denial,
// cross-user ownership, cron secrets, webhook signatures, public bearer-token responses,
// referral/admission capacity, and direct attempts to invoke service-only RPCs. It never
// needs provider credentials and refuses to target anything except exact loopback origins.
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import ts from 'typescript'
import { assertSafeTestEnvironment } from './local-supabase-harness.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MATRIX_PATH = resolve(ROOT, 'security/api-authorization-matrix.json')
const ROUTE_ROOT = resolve(ROOT, 'src/app/api')
const MATRIX = JSON.parse(readFileSync(MATRIX_PATH, 'utf8'))
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const UUID = '00000000-0000-4000-8000-000000000001'
const PASSWORD = 'LocalAuthMatrix123!'
const OWNER_SECRET = 'OWNER_ONLY_AUTH_MATRIX_SECRET'
const FRAMEWORK_404_RETRY_DELAYS_MS = [100, 250, 500]

let PASS = 0
let FAIL = 0

function record(label, ok, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) PASS += 1
  else FAIL += 1
}

function recordHttpResponse(label, response, ok) {
  const payload = response.json ?? response.text
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const sanitized = serialized
    .replaceAll(OWNER_SECRET, '<redacted-owner-secret>')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<redacted-jwt>')
    .replace(/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+\b/g, '<redacted-supabase-key>')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<redacted-long-token>')
  const retryDetail = response.framework404Retries > 0
    ? `framework404Retries=${response.framework404Retries}`
    : ''
  const detail = ok
    ? retryDetail
    : [
        `status=${response.status}`,
        retryDetail,
        `content-type=${response.headers.get('content-type') ?? '<missing>'}`,
        `response=${sanitized.replace(/\s+/g, ' ').slice(0, 500)}`,
      ].filter(Boolean).join('; ')
  record(label, ok, detail)
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function routePath(file) {
  return '/api/' + relative(ROUTE_ROOT, dirname(file)).split('\\').join('/')
}

function boundaryFor(entry, method) {
  return entry.methodBoundaries?.[method] ?? entry.boundary
}

function sourceHandlers(file) {
  const source = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const handlers = new Map()
  for (const node of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) continue
    const method = node.name.text
    const exported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (exported && HTTP_METHODS.has(method)) handlers.set(method, node.body.getText(sourceFile))
  }
  return { source, handlers }
}

function staticAudit() {
  console.log('\n── Static route inventory and trust-boundary audit ──')
  const routeFiles = walk(ROUTE_ROOT).filter((file) => file.endsWith('/route.ts')).sort()
  const actualRoutes = new Map(routeFiles.map((file) => [routePath(file), { file, ...sourceHandlers(file) }]))
  const matrixRoutes = new Map()
  const duplicateRoutes = []
  const listedHandlers = new Set()
  const duplicateHandlers = []

  for (const entry of MATRIX.entries) {
    if (matrixRoutes.has(entry.path)) duplicateRoutes.push(entry.path)
    matrixRoutes.set(entry.path, entry)
    for (const method of entry.methods) {
      const key = `${method} ${entry.path}`
      if (listedHandlers.has(key)) duplicateHandlers.push(key)
      listedHandlers.add(key)
    }
  }

  const missingRoutes = [...actualRoutes.keys()].filter((path) => !matrixRoutes.has(path))
  const staleRoutes = [...matrixRoutes.keys()].filter((path) => !actualRoutes.has(path))
  record(
    'matrix has exactly one entry for every route file',
    duplicateRoutes.length === 0 && missingRoutes.length === 0 && staleRoutes.length === 0
      && matrixRoutes.size === actualRoutes.size,
    `${actualRoutes.size} files; missing=${missingRoutes.join(',') || 'none'}; stale=${staleRoutes.join(',') || 'none'}; duplicates=${duplicateRoutes.join(',') || 'none'}`,
  )

  const actualHandlers = new Set()
  for (const [path, route] of actualRoutes) {
    for (const method of route.handlers.keys()) actualHandlers.add(`${method} ${path}`)
  }
  const missingHandlers = [...actualHandlers].filter((key) => !listedHandlers.has(key))
  const staleHandlers = [...listedHandlers].filter((key) => !actualHandlers.has(key))
  record(
    'matrix methods exactly match every exported HTTP handler',
    duplicateHandlers.length === 0 && missingHandlers.length === 0 && staleHandlers.length === 0
      && listedHandlers.size === actualHandlers.size,
    `${actualHandlers.size} handlers; missing=${missingHandlers.join(',') || 'none'}; stale=${staleHandlers.join(',') || 'none'}`,
  )

  const allowedBoundaries = new Set([
    'session', 'cron-secret', 'stripe-signature', 'resend-signature',
    'public-token-confirmation', 'public-sanitized', 'public-token',
    'public-input', 'public-capacity',
  ])
  const badBoundaries = []
  for (const entry of MATRIX.entries) {
    for (const method of entry.methods) {
      if (!allowedBoundaries.has(boundaryFor(entry, method))) {
        badBoundaries.push(`${method} ${entry.path}=${boundaryFor(entry, method)}`)
      }
    }
  }
  record('every handler has a reviewed trust-boundary class', badBoundaries.length === 0, badBoundaries.join(', '))

  const sessionErrors = []
  const ownershipErrors = []
  const cronErrors = []
  const signatureErrors = []
  const clientAuthorityInputs = []
  let sessionHandlers = 0

  for (const entry of MATRIX.entries) {
    const route = actualRoutes.get(entry.path)
    if (!route) continue
    for (const method of entry.methods) {
      const body = route.handlers.get(method) ?? ''
      const boundary = boundaryFor(entry, method)
      if (boundary === 'session') {
        sessionHandlers += 1
        const authIndex = body.indexOf('auth.getUser()')
        if (authIndex < 0 || !/if\s*\(\s*!user/.test(body)) {
          sessionErrors.push(`${method} ${entry.path}: missing getUser/401 guard`)
        }
        const privilegedIndexes = [
          body.indexOf('.from('), body.indexOf('.rpc('), body.indexOf('.formData('),
          body.indexOf('runPrompt'), body.indexOf('stripe.checkout'), body.indexOf('stripe.billingPortal'),
        ].filter((index) => index >= 0)
        const firstPrivileged = privilegedIndexes.length ? Math.min(...privilegedIndexes) : -1
        if (authIndex < 0 || (firstPrivileged >= 0 && authIndex > firstPrivileged)) {
          sessionErrors.push(`${method} ${entry.path}: privileged work precedes getUser`)
        }
        if (/(?:body|json|input|parsed\.data)\.(?:user_?id|userId)\b/.test(body)) {
          clientAuthorityInputs.push(`${method} ${entry.path}`)
        }
      }

      if (entry.authority === 'owner-filter' && !/\.eq\(\s*['"](?:user_id|id)['"]\s*,\s*user\.id\s*\)/.test(route.source)) {
        ownershipErrors.push(`${method} ${entry.path}`)
      }
      if (boundary === 'cron-secret' && (!body.includes('CRON_SECRET') || !body.includes("headers.get('authorization')") || !body.includes('Bearer ${secret}'))) {
        cronErrors.push(`${method} ${entry.path}`)
      }
      if (boundary === 'stripe-signature' && (!body.includes('stripe-signature') || !body.includes('webhooks.constructEvent'))) {
        signatureErrors.push(`${method} ${entry.path}`)
      }
      if (boundary === 'resend-signature' && !/signature|webhooks\.verify/.test(body)) {
        signatureErrors.push(`${method} ${entry.path}`)
      }
    }
  }

  record('all session handlers authenticate before privileged work', sessionErrors.length === 0, `${sessionHandlers} checked${sessionErrors.length ? `; ${sessionErrors.join('; ')}` : ''}`)
  record('all explicit owner-filter classifications have a server-side user filter', ownershipErrors.length === 0, ownershipErrors.join(', '))
  record('no session handler accepts a client-supplied authority user id', clientAuthorityInputs.length === 0, clientAuthorityInputs.join(', '))
  record('all cron handlers enforce the bearer secret before work', cronErrors.length === 0, cronErrors.join(', '))
  record('all provider-webhook handlers verify signatures', signatureErrors.length === 0, signatureErrors.join(', '))

  const grants = readFileSync(resolve(ROOT, 'supabase/migrations/20260710033047_explicit_data_api_grants.sql'), 'utf8')
  record(
    'Data API migration keeps all public RPCs service-only',
    /revoke execute on all functions in schema public from public, anon, authenticated/i.test(grants)
      && /grant execute on all functions in schema public to service_role/i.test(grants),
  )

  return {
    routeFiles: actualRoutes.size,
    handlers: actualHandlers.size,
    sessionHandlers,
    actualRoutes,
  }
}

function requireLoopback(value, label) {
  const parsed = new URL(value)
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !parsed.port) {
    throw new Error(`${label} must be an explicit http://127.0.0.1:<port> origin`)
  }
  return parsed.origin
}

function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function createLocalUser(service, email) {
  const data = must(await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Local Authorization Test' },
  }), `create ${email}`)
  if (!data.user) throw new Error(`create ${email}: no user returned`)
  return data.user
}

async function browserSession(supabaseUrl, anonKey, email) {
  const jar = new Map()
  const client = createBrowserClient(supabaseUrl, anonKey, {
    isSingleton: false,
    cookies: {
      getAll() {
        return [...jar].map(([name, value]) => ({ name, value }))
      },
      setAll(items) {
        for (const item of items) {
          if (item.value) jar.set(item.name, item.value)
          else jar.delete(item.name)
        }
      },
    },
  })
  const data = must(await client.auth.signInWithPassword({ email, password: PASSWORD }), `sign in ${email}`)
  if (!data.session) throw new Error(`sign in ${email}: no session returned`)
  return {
    client,
    cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
  }
}

async function appRequest(appUrl, path, options = {}) {
  const headers = new Headers(options.headers ?? {})
  if (options.cookie) headers.set('cookie', options.cookie)
  let body
  if (options.json !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(options.json)
  } else if (options.form !== undefined) {
    headers.set('content-type', 'application/x-www-form-urlencoded')
    body = new URLSearchParams(options.form).toString()
  } else if (options.raw !== undefined) {
    body = options.raw
  }
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(appUrl + path, {
      method: options.method ?? 'GET',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    })
    const text = await response.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* non-JSON route */ }
    const result = {
      status: response.status,
      headers: response.headers,
      text,
      json,
      framework404Retries: attempt,
    }

    // Next dev can briefly omit a newly discovered deep app route from its development
    // manifest and answer with its own HTML not-found page. Retry only that framework
    // response: API JSON 401/404 responses are real authorization outcomes and are never
    // retried or weakened. A persistent missing route still fails after this small cap.
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    const isFrameworkNotFound = response.status === 404
      && contentType.includes('text/html')
      && /<!doctype html>|<html[\s>]/i.test(text)
      && /__next_error__|next-error|NEXT_HTTP_ERROR_FALLBACK;404|This page could not be found/i.test(text)
    if (!isFrameworkNotFound || attempt >= FRAMEWORK_404_RETRY_DELAYS_MS.length) {
      return result
    }
    await delay(FRAMEWORK_404_RETRY_DELAYS_MS[attempt])
  }
}

function concretePath(path) {
  if (path === '/api/interviews/drills/[id]/attempt') return '/api/interviews/drills/intro_60s/attempt'
  return path
    .replace('[questionId]', UUID)
    .replace('[id]', UUID)
    .replace('[token]', 'invalid-auth-matrix-token')
}

function anonymousFixture(entry, method) {
  if (entry.path === '/api/waitlist/admission' && method === 'POST') {
    return { json: { token: 'a'.repeat(48) } }
  }
  return ['POST', 'PUT', 'PATCH'].includes(method) ? { json: {} } : {}
}

function containsOwnerSecret(response) {
  return response.text.includes(OWNER_SECRET)
}

function svixHeaders(secret, payload, id) {
  if (typeof secret !== 'string' || !secret.startsWith('whsec_')) {
    throw new Error('Resend webhook test secret must use the whsec_<base64> Standard Webhooks format')
  }
  const encodedKey = secret.slice('whsec_'.length)
  const key = Buffer.from(encodedKey, 'base64')
  const canonicalKey = key.toString('base64').replace(/=+$/, '')
  if (!key.length || canonicalKey !== encodedKey.replace(/=+$/, '')) {
    throw new Error('Resend webhook test secret contains an invalid Standard Webhooks base64 key')
  }
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64')
  return {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
  }
}

async function assertRpcDenied(client, name, args, actor) {
  const { data, error } = await client.rpc(name, args)
  const denied = data == null && Boolean(error)
    && ['42501', 'PGRST202', 'PGRST301'].includes(error.code)
      || Boolean(error?.message?.match(/permission denied|not find the function|not allowed/i))
  record(`${actor} cannot execute service-only RPC ${name}`, Boolean(denied), error ? `code=${error.code}` : 'RPC unexpectedly returned data')
}

async function liveAudit(summary) {
  console.log('\n── Credentialed local adversarial API audit ──')
  assertSafeTestEnvironment(process.env)
  const appUrl = requireLoopback(process.env.NEXT_PUBLIC_APP_URL, 'NEXT_PUBLIC_APP_URL')
  const supabaseUrl = requireLoopback(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!anonKey || !serviceKey) throw new Error('local anon/service keys are required')

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const anonymous = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`
  const emails = {
    owner: `auth-owner-${suffix}@example.com`,
    attacker: `auth-attacker-${suffix}@example.com`,
    referral: `auth-referral-${suffix}@example.com`,
    admitted: `auth-admitted-${suffix}@example.com`,
    rpc: `auth-rpc-${suffix}@example.com`,
  }
  const users = []
  const cleanupEventIds = []
  const admissionToken = randomBytes(24).toString('hex')

  try {
    const owner = await createLocalUser(service, emails.owner); users.push(owner)
    const attacker = await createLocalUser(service, emails.attacker); users.push(attacker)
    const referral = await createLocalUser(service, emails.referral); users.push(referral)
    const admitted = await createLocalUser(service, emails.admitted); users.push(admitted)
    const rpcVictim = await createLocalUser(service, emails.rpc); users.push(rpcVictim)

    const attackerSession = await browserSession(supabaseUrl, anonKey, emails.attacker)
    const referralSession = await browserSession(supabaseUrl, anonKey, emails.referral)
    const admittedSession = await browserSession(supabaseUrl, anonKey, emails.admitted)
    const rpcSession = await browserSession(supabaseUrl, anonKey, emails.rpc)

    const { data: profiles, error: profileError } = await service
      .from('profiles')
      .select('id, referral_code, unsubscribe_token, email_digest_enabled, lifecycle_email_enabled')
      .in('id', users.map((user) => user.id))
    if (profileError) throw profileError
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
    if (profileById.size !== users.length) throw new Error('profile trigger did not create every local test profile')

    must(await service.from('profiles').update({
      email_digest_enabled: true,
      lifecycle_email_enabled: true,
    }).eq('id', owner.id), 'configure owner profile')

    // The attacker is Pro so ownership checks on Pro-gated routes are reached without a
    // provider call. All Stripe ids are inert local fixtures.
    must(await service.from('subscriptions').insert({
      user_id: attacker.id,
      status: 'active',
      stripe_customer_id: `cus_auth_${suffix.replaceAll('-', '')}`,
      stripe_subscription_id: `sub_auth_${suffix.replaceAll('-', '')}`,
      price_id: 'price_local_auth_matrix',
      current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
    }), 'seed attacker subscription')

    const resume = must(await service.from('resumes').insert({
      user_id: owner.id,
      title: 'Owner resume',
      raw_text: `${OWNER_SECRET} private resume text with enough detail for authorization testing`,
      parsed_json: { name: 'Owner', skills: ['PrivateSkill'] },
    }).select('id').single(), 'seed resume')
    const portfolio = must(await service.from('portfolios').insert({
      user_id: owner.id,
      slug: `auth-owner-${suffix}`,
      title: 'Owner portfolio',
      target_role: 'Private Role',
      status: 'draft',
      content: { hero: { headline: OWNER_SECRET }, about: { bio: OWNER_SECRET } },
      ai_generated_at: new Date().toISOString(),
    }).select('id').single(), 'seed portfolio')
    // A completed portfolio grants three referral invites through the database trigger.
    // Apply this test's one-invite fixture after that trigger so the later exhaustion
    // assertions exercise exactly one successful claim followed by one rejection.
    must(await service.from('profiles').update({
      referral_invite_limit: 1,
      referral_invites_used: 0,
    }).eq('id', owner.id), 'configure owner referral capacity')
    const savedJob = must(await service.from('saved_jobs').insert({
      user_id: owner.id,
      imported_title: 'Owner secret job',
      imported_company: 'Owner Co',
      imported_description: OWNER_SECRET,
      status: 'saved',
    }).select('id').single(), 'seed saved job')
    const application = must(await service.from('applications').insert({
      user_id: owner.id,
      saved_job_id: savedJob.id,
      stage: 'saved',
      notes: OWNER_SECRET,
    }).select('id').single(), 'seed application')
    const tailored = must(await service.from('tailored_assets').insert({
      user_id: owner.id,
      saved_job_id: savedJob.id,
      base_resume_id: resume.id,
      asset_type: 'application_kit',
      content: { professional_summary: OWNER_SECRET },
      truth_map: [],
    }).select('id').single(), 'seed tailored asset')
    const savedProject = must(await service.from('saved_projects').insert({
      user_id: owner.id,
      project: { title: OWNER_SECRET },
    }).select('id').single(), 'seed saved project')
    const savedSearch = must(await service.from('saved_searches').insert({
      user_id: owner.id,
      label: OWNER_SECRET,
      filters: { query: 'private' },
    }).select('id').single(), 'seed saved search')
    const reminder = must(await service.from('interview_reminders').insert({
      user_id: owner.id,
      remind_at: new Date(Date.now() + 86400_000).toISOString(),
      note: OWNER_SECRET,
    }).select('id').single(), 'seed reminder')
    const audit = must(await service.from('audits').insert({
      user_id: owner.id,
      portfolio_id: portfolio.id,
      resume_id: resume.id,
      overall_score: 73,
      category_scores: { evidence: 73 },
      findings: [OWNER_SECRET],
      recommendations: [OWNER_SECRET],
    }).select('id').single(), 'seed audit')

    const interview = must(await service.from('interview_sessions').insert({
      user_id: owner.id,
      session_type: 'behavioral',
      delivery_mode: 'text',
      coaching_mode: 'guided',
      difficulty: 'standard',
      target_role: 'Authorization Test Engineer',
      session_plan: { competencies: ['ownership'] },
      rubric_id: 'local-auth',
      rubric_version: '1',
      status: 'completed',
      planned_question_count: 1,
      completed_question_count: 1,
      max_duration_seconds: 900,
      started_at: new Date(Date.now() - 60_000).toISOString(),
      completed_at: new Date().toISOString(),
    }).select('id').single(), 'seed interview session')
    const question = must(await service.from('interview_questions').insert({
      user_id: owner.id,
      session_id: interview.id,
      order_index: 0,
      question_text: OWNER_SECRET,
      competency: 'ownership',
      difficulty: 'standard',
      selection_reason: 'authorization fixture',
    }).select('id').single(), 'seed interview question')
    must(await service.from('interview_answers').insert({
      user_id: owner.id,
      session_id: interview.id,
      question_id: question.id,
      attempt_number: 1,
      answer_text: OWNER_SECRET,
    }), 'seed interview answer')
    const story = must(await service.from('interview_story_bank').insert({
      user_id: owner.id,
      title: OWNER_SECRET,
      competencies: ['ownership'],
    }).select('id').single(), 'seed story')
    const shareToken = randomBytes(32).toString('base64url')
    const share = must(await service.from('interview_shared_reports').insert({
      user_id: owner.id,
      session_id: interview.id,
      token_hash: createHash('sha256').update(shareToken).digest('hex'),
      scope: 'full_summary',
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    }).select('id').single(), 'seed share')

    must(await service.from('waitlist_signups').insert({
      email: emails.admitted,
      full_name: 'Admitted Local User',
      status: 'invited',
      invite_token: admissionToken,
      invited_at: new Date().toISOString(),
      invite_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      referral_code: randomBytes(6).toString('hex').toUpperCase(),
    }), 'seed waitlist admission')

    console.log('\nAnonymous denial across every session handler')
    let anonymousChecked = 0
    for (const entry of MATRIX.entries) {
      for (const method of entry.methods) {
        if (boundaryFor(entry, method) !== 'session') continue
        const fixture = anonymousFixture(entry, method)
        const response = await appRequest(appUrl, concretePath(entry.path), { method, ...fixture })
        const safe = response.status === 401 && !containsOwnerSecret(response)
        recordHttpResponse(`anonymous ${method} ${entry.path} is 401`, response, safe)
        anonymousChecked += 1
      }
    }
    record('anonymous sweep covered every reviewed session handler', anonymousChecked === summary.sessionHandlers, `${anonymousChecked}/${summary.sessionHandlers}`)

    console.log('\nAuthenticated cross-user resource attacks')
    const sessionProbe = await appRequest(appUrl, '/api/applications', { cookie: attackerSession.cookie })
    recordHttpResponse(
      'attacker cookie authenticates immediately before cross-user attacks',
      sessionProbe,
      sessionProbe.status === 200 && !containsOwnerSecret(sessionProbe),
    )

    const attack = async (label, path, options, expectedStatuses) => {
      const response = await appRequest(appUrl, path, { ...options, cookie: attackerSession.cookie })
      const statusOk = expectedStatuses.includes(response.status)
      recordHttpResponse(label, response, statusOk && !containsOwnerSecret(response))
      return response
    }

    await attack('attacker cannot save owner portfolio', '/api/portfolio/save', { method: 'POST', json: { portfolioId: portfolio.id, title: 'HIJACKED' } }, [404])
    await attack('attacker cannot publish owner portfolio', '/api/portfolio/publish', { method: 'POST', json: { portfolioId: portfolio.id, action: 'publish' } }, [404])
    await attack('attacker cannot export owner portfolio HTML', '/api/portfolio/export-html', { method: 'POST', json: { portfolioId: portfolio.id } }, [404])
    await attack('attacker cannot export owner resume DOCX', '/api/resume/export', { method: 'POST', json: { resume_id: resume.id, format: 'docx' } }, [404])
    await attack('attacker cannot export owner resume PDF', '/api/resume/export-pdf', { method: 'POST', json: { resume_id: resume.id } }, [404])
    await attack('attacker cannot export owner tailored asset', '/api/resume/export', { method: 'POST', json: { tailored_asset_id: tailored.id, format: 'docx' } }, [404])
    await attack('attacker cannot generate resume from owner portfolio', '/api/resume/generate-from-portfolio', { method: 'POST', json: { portfolioId: portfolio.id } }, [404])
    await attack('attacker cannot create application for owner saved job', '/api/applications', { method: 'POST', json: { saved_job_id: savedJob.id } }, [404])
    await attack('attacker cannot patch owner application', '/api/applications', { method: 'PATCH', json: { id: application.id, stage: 'rejected' } }, [404])
    await attack('attacker cannot patch owner saved job', '/api/jobs/save', { method: 'PATCH', json: { id: savedJob.id, status: 'archived' } }, [404])
    await attack('attacker delete on owner saved job is non-enumerating', `/api/jobs/save?id=${savedJob.id}`, { method: 'DELETE' }, [200])
    await attack('attacker delete on owner saved search is non-enumerating', `/api/jobs/saved-searches?id=${savedSearch.id}`, { method: 'DELETE' }, [200])
    await attack('attacker delete on owner saved project is non-enumerating', `/api/projects/saved?id=${savedProject.id}`, { method: 'DELETE' }, [200])
    await attack('attacker delete on owner reminder is non-enumerating', `/api/interviews/reminders?id=${reminder.id}`, { method: 'DELETE' }, [200])
    await attack('attacker audit cannot resolve owner portfolio/resume', '/api/ai/audit-portfolio', { method: 'POST', json: { portfolioId: portfolio.id, resumeId: resume.id, targetRole: 'Engineer', industry: 'Tech' } }, [400])
    await attack('attacker generation cannot target owner portfolio', '/api/ai/generate-portfolio', { method: 'POST', json: { parsedResume: { name: 'Attacker' }, targetRole: 'Engineer', industry: 'Tech', portfolioGoal: 'job search', links: {}, portfolioId: portfolio.id } }, [404])
    await attack('attacker cover letter cannot resolve owner evidence', '/api/ai/cover-letter', { method: 'POST', json: { role: 'Engineer', company: 'Co', savedJobId: savedJob.id, resumeId: resume.id } }, [422])
    await attack('attacker outreach cannot resolve owner evidence', '/api/ai/outreach', { method: 'POST', json: { role: 'Engineer', company: 'Co', savedJobId: savedJob.id, resumeId: resume.id, outreachType: 'recruiter_dm' } }, [422])
    await attack('attacker suggestions cannot resolve owner resume', '/api/ai/suggest-projects', { method: 'POST', json: { resumeId: resume.id } }, [422])
    await attack('attacker cannot tailor owner saved job', `/api/jobs/${savedJob.id}/tailor`, { method: 'POST', json: { parsed_resume: { name: 'Attacker' }, saved_job_id: savedJob.id } }, [404])
    await attack('attacker cannot emit trusted events for owner portfolio', '/api/growth/portfolio-events', { method: 'POST', json: { portfolio_id: portfolio.id } }, [404])
    await attack('attacker cannot create a share for owner audit', '/api/audit/share', { method: 'POST', json: {} }, [404])
    await attack('attacker revoke request does not touch owner audit share', '/api/audit/share', { method: 'DELETE' }, [200])

    await attack('attacker cannot read owner interview session', `/api/interviews/sessions/${interview.id}`, { method: 'GET' }, [404])
    await attack('attacker cannot start owner interview session', `/api/interviews/sessions/${interview.id}/start`, { method: 'POST', json: {} }, [404])
    await attack('attacker cannot complete owner interview session', `/api/interviews/sessions/${interview.id}/complete`, { method: 'POST', json: {} }, [404])
    await attack('attacker cannot analyze owner interview session', `/api/interviews/sessions/${interview.id}/analyze`, { method: 'POST', json: {} }, [404])
    await attack('attacker cannot issue live token for owner session', `/api/interviews/sessions/${interview.id}/live-token`, { method: 'POST', json: {} }, [404])
    await attack('attacker cannot write owner text transcript', `/api/interviews/sessions/${interview.id}/transcript`, { method: 'POST', json: { questionId: question.id, answerText: 'hijack' } }, [404])
    await attack('attacker cannot write owner live transcript', `/api/interviews/sessions/${interview.id}/live-transcript`, { method: 'POST', json: { segments: [{ speaker: 'candidate', content: 'hijack', startMs: 0, endMs: 1, questionId: question.id }] } }, [404])
    await attack('attacker cannot retry owner answer', `/api/interviews/sessions/${interview.id}/answers/${question.id}/retry`, { method: 'POST', json: { answerText: 'hijack' } }, [404])
    await attack('attacker cannot upload recording to owner answer', `/api/interviews/sessions/${interview.id}/answers/${question.id}/recording`, { method: 'POST' }, [404])
    await attack('attacker share list leaks no owner share', `/api/interviews/sessions/${interview.id}/share`, { method: 'GET' }, [200])
    await attack('attacker cannot create owner session share', `/api/interviews/sessions/${interview.id}/share`, { method: 'POST', json: { scope: 'full_summary', expiresInDays: 1 } }, [404])
    await attack('attacker cannot revoke owner session share', `/api/interviews/shares/${share.id}`, { method: 'DELETE' }, [404])
    await attack('attacker cannot patch owner story', `/api/interviews/story-bank/${story.id}`, { method: 'PATCH', json: { title: 'HIJACKED' } }, [404])
    await attack('attacker cannot delete owner story', `/api/interviews/story-bank/${story.id}`, { method: 'DELETE' }, [404])
    await attack('attacker cannot delete owner interview session', `/api/interviews/sessions/${interview.id}`, { method: 'DELETE' }, [404])

    const [portfolioCheck, jobCheck, applicationCheck, searchCheck, projectCheck, reminderCheck, interviewCheck, storyCheck, shareCheck, auditCheck] = await Promise.all([
      service.from('portfolios').select('title, status').eq('id', portfolio.id).single(),
      service.from('saved_jobs').select('status').eq('id', savedJob.id).single(),
      service.from('applications').select('stage').eq('id', application.id).single(),
      service.from('saved_searches').select('id').eq('id', savedSearch.id).single(),
      service.from('saved_projects').select('id').eq('id', savedProject.id).single(),
      service.from('interview_reminders').select('done').eq('id', reminder.id).single(),
      service.from('interview_sessions').select('id').eq('id', interview.id).single(),
      service.from('interview_story_bank').select('title').eq('id', story.id).single(),
      service.from('interview_shared_reports').select('revoked_at').eq('id', share.id).single(),
      service.from('audits').select('share_token_revoked_at').eq('id', audit.id).single(),
    ])
    record('owner resources remain unchanged after cross-user attacks',
      portfolioCheck.data?.title === 'Owner portfolio' && portfolioCheck.data?.status === 'draft'
      && jobCheck.data?.status === 'saved' && applicationCheck.data?.stage === 'saved'
      && Boolean(searchCheck.data) && Boolean(projectCheck.data) && reminderCheck.data?.done === false
      && Boolean(interviewCheck.data) && storyCheck.data?.title === OWNER_SECRET
      && shareCheck.data?.revoked_at == null && auditCheck.data?.share_token_revoked_at == null)

    console.log('\nPublic sanitized/token/capacity boundaries')
    let response = await appRequest(appUrl, '/api/health')
    const healthKeys = response.json ? Object.keys(response.json).sort() : []
    record('public health response is coarse and secret-free', response.status === 200 && !containsOwnerSecret(response)
      && healthKeys.every((key) => ['checks', 'commit', 'environment', 'status', 'timestamp'].includes(key)))

    response = await appRequest(appUrl, `/api/interviews/reports/${encodeURIComponent(shareToken)}`)
    const reportData = response.json?.data
    const reportKeys = reportData ? Object.keys(reportData) : []
    record('public interview share returns only the reviewed DTO', response.status === 200 && !containsOwnerSecret(response)
      && reportKeys.every((key) => ['sessionType', 'targetRole', 'status', 'completedAt', 'targetCompany', 'plannedQuestionCount', 'durationMinutes', 'competencies', 'scoringNote'].includes(key))
      && !('user_id' in (reportData ?? {})) && !('transcript' in (reportData ?? {})))

    response = await appRequest(appUrl, `/api/waitlist/admission?token=${admissionToken}`)
    record('public admission lookup masks the invited email', response.status === 200 && response.json?.valid === true
      && response.json?.emailHint !== emails.admitted && !response.text.includes(emails.admitted))

    const ownerProfile = must(await service.from('profiles').select('referral_code').eq('id', owner.id).single(), 'read owner referral code')
    response = await appRequest(appUrl, `/api/referral/validate?code=${ownerProfile.referral_code}`)
    const referralValidationIsSanitized = response.status === 200 && response.json?.valid === true
      && response.json?.remaining === 1 && Object.keys(response.json).every((key) => ['valid', 'remaining'].includes(key))
    recordHttpResponse('public referral validation exposes remaining capacity only', response, referralValidationIsSanitized)

    response = await appRequest(appUrl, '/api/waitlist/join', { method: 'POST', json: { email: `honeypot-${suffix}@example.com`, consent: true, website_url_hidden: 'bot' } })
    record('waitlist honeypot succeeds without creating a public-enumerable result', response.status === 200 && response.json?.success === true)
    response = await appRequest(appUrl, '/api/beta/feedback', { method: 'POST', json: {} })
    record('public feedback rejects an unattributed payload', response.status === 400)
    response = await appRequest(appUrl, '/api/marketing/track', { method: 'POST', json: { event_name: 'not-allowed', session_id: 'auth-matrix' } })
    record('public analytics fails soft without accepting unreviewed event names', response.status === 200 && response.json?.success === true)

    console.log('\nService-only RPC boundaries')
    const rpcCases = [
      ['rate_limit_increment', { p_key: `auth-matrix:${suffix}`, p_window_seconds: 60, p_max: 1 }],
      ['claim_webhook_event', { p_event_id: `auth-matrix-rpc:${suffix}`, p_event_type: 'auth.matrix', p_stale_after_seconds: 300 }],
      ['claim_referral', { p_new_user: rpcVictim.id, p_code: ownerProfile.referral_code }],
      ['redeem_waitlist_admission', { p_token: admissionToken, p_user_id: admitted.id }],
    ]
    for (const [name, args] of rpcCases) {
      await assertRpcDenied(anonymous, name, args, 'anonymous client')
      await assertRpcDenied(rpcSession.client, name, args, 'authenticated client')
    }

    console.log('\nReferral and admission route authority')
    response = await appRequest(appUrl, '/api/referral/claim', { method: 'POST', cookie: referralSession.cookie, json: { code: ownerProfile.referral_code } })
    record('referral route attributes the signed-in new user', response.status === 200 && response.json?.data?.claimed === true)
    const referralProfile = must(await service.from('profiles').select('referred_by').eq('id', referral.id).single(), 'read referral claimant')
    const ownerAfterClaim = must(await service.from('profiles').select('referral_invites_used').eq('id', owner.id).single(), 'read referral capacity')
    record('referral RPC consumed exactly one owner invite for the caller', referralProfile.referred_by === owner.id && ownerAfterClaim.referral_invites_used === 1)
    response = await appRequest(appUrl, '/api/referral/claim', { method: 'POST', cookie: attackerSession.cookie, json: { code: ownerProfile.referral_code } })
    const referralCapacityIsRejected = response.status === 409 && response.json?.code === 'REFERRAL_UNAVAILABLE'
    recordHttpResponse('exhausted referral capacity rejects a different signed-in user', response, referralCapacityIsRejected)

    response = await appRequest(appUrl, '/api/waitlist/admission', { method: 'POST', cookie: attackerSession.cookie, json: { token: admissionToken } })
    const wrongEmailIsRejected = response.status === 403
    recordHttpResponse('waitlist admission rejects a signed-in user with the wrong email', response, wrongEmailIsRejected)
    response = await appRequest(appUrl, '/api/waitlist/admission', { method: 'POST', cookie: admittedSession.cookie, json: { token: admissionToken } })
    record('waitlist admission accepts the matching signed-in user once', response.status === 200 && response.json?.data?.admitted === true)
    const admissionRow = must(await service.from('waitlist_signups').select('converted_user_id, admission_redeemed_at').eq('email', emails.admitted).single(), 'read admission result')
    record('admission conversion is bound to the cookie user', admissionRow.converted_user_id === admitted.id && Boolean(admissionRow.admission_redeemed_at))

    console.log('\nCron secret boundaries')
    for (const entry of MATRIX.entries.filter((item) => item.boundary === 'cron-secret')) {
      const basePath = entry.path === '/api/cron/lifecycle-email' ? `${entry.path}?dryRun=1`
        : entry.path === '/api/cron/invite-batch' ? `${entry.path}?limit=1`
          : entry.path
      const missing = await appRequest(appUrl, basePath)
      const wrong = await appRequest(appUrl, basePath, { headers: { authorization: 'Bearer wrong-local-secret' } })
      const valid = await appRequest(appUrl, basePath, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
      record(`${entry.path} rejects missing cron secret`, missing.status === 401)
      record(`${entry.path} rejects wrong cron secret`, wrong.status === 401)
      if (entry.path === '/api/cron/invite-batch' && process.env.EMAILS_ENABLED !== 'true') {
        recordHttpResponse(
          `${entry.path} accepts the local cron secret and reports the disabled email gate`,
          valid,
          valid.status === 503 && valid.json?.code === 'EMAILS_DISABLED',
        )
      } else {
        recordHttpResponse(
          `${entry.path} accepts the local cron secret boundary`,
          valid,
          ![401, 403].includes(valid.status),
        )
      }
    }

    console.log('\nWebhook signature boundaries')
    response = await appRequest(appUrl, '/api/stripe/webhook', { method: 'POST', raw: '{}' })
    record('Stripe webhook rejects missing signature', response.status === 400)
    response = await appRequest(appUrl, '/api/stripe/webhook', { method: 'POST', raw: '{}', headers: { 'stripe-signature': 'bad' } })
    record('Stripe webhook rejects invalid signature', response.status === 400)
    const stripePayloadObject = {
      id: `evt_auth_matrix_${suffix.replaceAll('-', '')}`,
      object: 'event',
      api_version: '2025-06-30.basil',
      created: Math.floor(Date.now() / 1000),
      data: { object: {} },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: 'auth.matrix.ignored',
    }
    const stripePayload = JSON.stringify(stripePayloadObject)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const stripeSignature = stripe.webhooks.generateTestHeaderString({
      payload: stripePayload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    })
    cleanupEventIds.push(stripePayloadObject.id)
    response = await appRequest(appUrl, '/api/stripe/webhook', { method: 'POST', raw: stripePayload, headers: { 'stripe-signature': stripeSignature } })
    record('Stripe webhook accepts a valid signed ignored event locally', response.status === 200 && response.json?.received === true)

    for (const endpoint of ['/api/email/events', '/api/email/inbound']) {
      const payload = JSON.stringify({ type: 'auth.matrix.ignored', data: {} })
      const id = `msg_auth_matrix_${randomUUID()}`
      const secret = endpoint.endsWith('/events')
        ? (process.env.RESEND_DELIVERY_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET)
        : process.env.RESEND_WEBHOOK_SECRET
      const signed = svixHeaders(secret, payload, id)
      cleanupEventIds.push(`resend:${id}`, `resend-delivery:${id}`)
      const invalid = await appRequest(appUrl, endpoint, { method: 'POST', raw: payload, headers: { ...signed, 'svix-signature': 'v1,invalid' } })
      record(`${endpoint} rejects invalid signature`, invalid.status === 401)
      const valid = await appRequest(appUrl, endpoint, { method: 'POST', raw: payload, headers: signed })
      record(`${endpoint} accepts a valid signed ignored event`, valid.status === 200)
    }

    console.log('\nSigned unsubscribe confirmation')
    const unsubscribeToken = profileById.get(owner.id)?.unsubscribe_token
    response = await appRequest(appUrl, `/api/email/unsubscribe?token=${unsubscribeToken}&kind=digest`)
    const signature = response.text.match(/name="signature" value="([a-f0-9]{64})"/)?.[1]
    const beforeUnsubscribe = must(await service.from('profiles').select('email_digest_enabled').eq('id', owner.id).single(), 'read pre-unsubscribe state')
    record('unsubscribe GET is read-only and creates a signed confirmation', response.status === 200 && Boolean(signature) && beforeUnsubscribe.email_digest_enabled === true)
    response = await appRequest(appUrl, '/api/email/unsubscribe', { method: 'POST', form: { token: unsubscribeToken, kind: 'digest', signature: '0'.repeat(64) } })
    record('unsubscribe rejects a tampered confirmation signature', response.status === 403)
    response = await appRequest(appUrl, '/api/email/unsubscribe', { method: 'POST', form: { token: unsubscribeToken, kind: 'digest', signature } })
    const afterUnsubscribe = must(await service.from('profiles').select('email_digest_enabled').eq('id', owner.id).single(), 'read post-unsubscribe state')
    const attackerEmailState = must(await service.from('profiles').select('email_digest_enabled').eq('id', attacker.id).single(), 'read attacker email state')
    record('valid unsubscribe changes only the token owner', response.status === 200 && afterUnsubscribe.email_digest_enabled === false && attackerEmailState.email_digest_enabled === true)
  } finally {
    // The harness resets the database after the suite. Best-effort deletion keeps this test
    // composable with later app tests even before that reset happens.
    try { await service.from('waitlist_signups').delete().in('email', Object.values(emails)) } catch { /* best effort */ }
    try { await service.from('processed_webhook_events').delete().in('event_id', cleanupEventIds) } catch { /* best effort */ }
    try { await service.from('rate_limit_counters').delete().or(`key.like.%${suffix}%,key.like.auth-matrix:%`) } catch { /* best effort */ }
    for (const user of users.reverse()) {
      try { await service.auth.admin.deleteUser(user.id) } catch { /* best effort */ }
    }
  }
}

async function main() {
  const options = new Set(process.argv.slice(2))
  for (const option of options) {
    if (option !== '--inventory-only') throw new Error(`unknown option: ${option}`)
  }

  const summary = staticAudit()
  if (!options.has('--inventory-only')) await liveAudit(summary)

  console.log(`\nAPI authorization audit: ${PASS} passed, ${FAIL} failed`)
  console.log(`Coverage: ${summary.routeFiles} route files, ${summary.handlers} HTTP handlers, ${summary.sessionHandlers} session handlers`)
  if (FAIL > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('API authorization audit failed:', error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
