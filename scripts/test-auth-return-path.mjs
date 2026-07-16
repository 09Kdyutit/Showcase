#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AUTH_RETURN_PREFIXES, safeNextPath } from '../src/lib/security/safe-next-path.ts'

const source = (path) => readFileSync(path, 'utf8')

const billingIntent = '/billing?plan=monthly&source=publish&portfolio_id=portfolio-123'
assert.ok(AUTH_RETURN_PREFIXES.includes('/billing'))
assert.ok(AUTH_RETURN_PREFIXES.includes('/builder'))
assert.equal(safeNextPath(billingIntent), billingIntent)
assert.equal(safeNextPath('/builder/portfolio-123?source=publish'), '/builder/portfolio-123?source=publish')
assert.equal(safeNextPath('/builder/../billing?source=publish'), '/billing?source=publish')
assert.equal(safeNextPath('/billing/../api/private'), '/dashboard')

for (const unsafePath of [
  null,
  '',
  'https://attacker.example',
  '//attacker.example',
  '/\\attacker.example',
  '/dashboard://attacker.example',
  '/dashboard\nhttps://attacker.example',
  '/api/stripe/create-checkout-session',
  '/login?redirectTo=/billing',
  '/callback?next=/billing',
  '/signup',
  '/not-a-protected-page',
]) {
  assert.equal(
    safeNextPath(unsafePath),
    '/dashboard',
    `unsafe auth destination must fall back: ${String(unsafePath)}`,
  )
}

const proxy = source('src/proxy.ts')
assert.match(proxy, /const requestedPath = safeNextPath\(`\$\{path\}\$\{request\.nextUrl\.search\}`\)/)
assert.ok(
  (proxy.match(/url\.search = ''/g) ?? []).length >= 2,
  'protected-route redirects must clear top-level query parameters before encoding redirectTo',
)
assert.ok(
  (proxy.match(/url\.searchParams\.set\('redirectTo', requestedPath\)/g) ?? []).length >= 2,
  'both unauthenticated proxy branches must preserve the full safe destination',
)
assert.match(
  proxy,
  /safeNextPath\(request\.nextUrl\.searchParams\.get\('redirectTo'\)\)/,
  'an already-authenticated login visit must honor the same safe destination',
)

const login = source('src/app/(auth)/login/page.tsx')
assert.match(login, /router\.replace\(nextPath\)/, 'password login must keep the destination without leaving Login in history')
assert.match(login, /<GoogleButton next=\{nextPath\}/, 'Google login must keep the destination')
assert.match(
  login,
  /callback\?next=\$\{encodeURIComponent\(nextPath\)\}/,
  'magic-link login must keep the destination',
)

const callback = source('src/app/(auth)/callback/route.ts')
assert.match(callback, /import \{ safeNextPath \} from '@\/lib\/security\/safe-next-path'/)
assert.match(callback, /NextResponse\.redirect\(new URL\(next, origin\)\)/)

console.log('Auth return paths preserve same-app intent and reject external redirects.')
