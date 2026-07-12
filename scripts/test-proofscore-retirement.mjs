#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

const redirectPage = read('src/app/proofscore/page.tsx')
assert.match(redirectPage, /permanentRedirect\(['"]\/['"]\)/)
const nextConfig = read('next.config.ts')
assert.match(nextConfig, /source:\s*['"]\/proofscore\/:path\*['"]/)
assert.match(nextConfig, /destination:\s*['"]\/['"]/)
assert.match(nextConfig, /permanent:\s*true/)

for (const retiredPath of [
  'src/app/api/proofscore/score/route.ts',
  'src/app/api/proofscore/reserve/route.ts',
  'src/app/api/proofscore/stash/route.ts',
  'src/app/api/proofscore/claim-parse/route.ts',
  'src/components/proofscore/public-proofscore-tool.tsx',
  'src/lib/proofscore/capacity.ts',
  'src/lib/proofscore/public-tool.ts',
  'src/lib/email/proofscore-reservation-email.ts',
]) {
  assert.equal(existsSync(retiredPath), false, `${retiredPath} must stay retired`)
}

const retirementMigrationPath = 'supabase/migrations/20260712035035_retire_public_proofscore_infrastructure.sql'
const retirementMigration = read(retirementMigrationPath)
const normalizedRetirementMigration = retirementMigration.toLowerCase()

assert.match(
  normalizedRetirementMigration,
  /clock_timestamp\(\)\s*<=\s*timestamptz\s*'2026-07-12 03:50:34\+00'/,
  'migration must hard-abort until the legacy claim grace window has ended',
)
assert.match(normalizedRetirementMigration, /to_regclass\('public\.pending_parses'\)/)
assert.match(normalizedRetirementMigration, /lock table public\.pending_parses in access exclusive mode/)
assert.match(normalizedRetirementMigration, /expires_at\s*>\s*clock_timestamp\(\)/)
assert.match(normalizedRetirementMigration, /v_active_pending_parses\s*>\s*0/)
assert.match(normalizedRetirementMigration, /to_regclass\('public\.proofscore_reservations'\)/)
assert.match(normalizedRetirementMigration, /lock table public\.proofscore_reservations in access exclusive mode/)
assert.match(normalizedRetirementMigration, /status\s*=\s*'reserved'/)
assert.match(
  normalizedRetirementMigration,
  /reserved_for\s*>=\s*\(clock_timestamp\(\)\s+at time zone\s+'utc'\)::date/,
)
assert.match(normalizedRetirementMigration, /v_active_reservations\s*>\s*0/)

for (const retiredPrefix of [
  'proofscore-public:%',
  'proofscore-reservation:%',
  'parse-stash:%',
]) {
  assert.ok(
    normalizedRetirementMigration.includes(`key like '${retiredPrefix}'`),
    `migration must delete the exact retired rate-limit prefix ${retiredPrefix}`,
  )
}

for (const signature of [
  'claim_pending_parse(uuid, uuid, jsonb)',
  'reserve_proofscore_slot(text, date)',
  'claim_proofscore_capacity(date, uuid)',
]) {
  assert.ok(
    normalizedRetirementMigration.includes(`drop function if exists public.${signature};`),
    `migration must drop the retired RPC ${signature}`,
  )
}

for (const table of ['pending_parses', 'proofscore_reservations', 'proofscore_daily_usage']) {
  const drop = normalizedRetirementMigration.match(new RegExp(`drop\\s+table\\s+if\\s+exists\\s+public\\.${table}[^;]*;`))?.[0]
  assert.ok(drop, `migration must drop retired table ${table}`)
  assert.doesNotMatch(drop, /\bcascade\b/, `${table} must be dropped without dependency bypass`)
}
assert.doesNotMatch(normalizedRetirementMigration, /drop\s+table[^;]*public\.audits/)
assert.match(normalizedRetirementMigration, /notify\s+pgrst\s*,\s*'reload schema'\s*;/)

const abuseHelper = read('src/lib/security/public-abuse.ts')
assert.match(abuseHelper, /import 'server-only'/)
assert.match(abuseHelper, /ABUSE_IP_HASH_SALT/)
assert.match(abuseHelper, /configuredSalt\s*&&\s*configuredSalt\.length\s*>=\s*32/)
assert.match(abuseHelper, /createHash\(['"]sha256['"]\)/)
assert.match(abuseHelper, /!strongConfiguredSalt\s*&&\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]/)
assert.match(abuseHelper, /throw new PublicAbuseGuardError/)
assert.match(abuseHelper, /rpc\(['"]rate_limit_increment['"]/)

for (const activeAsset of [
  'src/components/shared/footer.tsx',
  'growth/distribution/content-queue.json',
  'growth/distribution/partner-pipeline.json',
  'scripts/prepare-partner-wave.mjs',
]) {
  const source = read(activeAsset)
  assert.doesNotMatch(source, /(?:https?:\/\/[^\s"']*)?\/proofscore\b/i, `${activeAsset} must not distribute the retired route`)
  assert.doesNotMatch(source, /free\s+proofscore/i, `${activeAsset} must not restore the retired pitch`)
}

for (const publicCopyAsset of [
  'src/app/page.tsx',
  'src/app/pricing/page.tsx',
]) {
  const source = read(publicCopyAsset)
  assert.doesNotMatch(source, /proof\s*score/i, `${publicCopyAsset} must use Evidence Audit language`)
}

// The legacy waitlist is a separately deployed sibling project and is not present in
// standalone casefile CI checkouts. Scan it whenever the local workspace includes it.
for (const siblingWaitlistAsset of [
  '../waitlist/src/app/page.tsx',
  '../waitlist/src/lib/waitlist-email.ts',
]) {
  if (!existsSync(siblingWaitlistAsset)) continue
  const source = read(siblingWaitlistAsset)
  assert.doesNotMatch(source, /proof\s*score/i, `${siblingWaitlistAsset} must use Evidence Audit language`)
}

assert.ok(existsSync('src/app/(app)/audit/page.tsx'), 'authenticated Evidence Audit UI must remain')
assert.ok(existsSync('src/lib/proofscore/engine.ts'), 'authenticated audit engine and user data contract must remain')

console.log('✓ anonymous ProofScore funnel is retired; authenticated Evidence Audit remains')
