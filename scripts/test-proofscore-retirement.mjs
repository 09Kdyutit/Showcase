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
  'src/components/proofscore/public-proofscore-tool.tsx',
  'src/lib/proofscore/public-tool.ts',
  'src/lib/email/proofscore-reservation-email.ts',
]) {
  assert.equal(existsSync(retiredPath), false, `${retiredPath} must stay retired`)
}

const graceRoute = read('src/app/api/proofscore/claim-parse/route.ts')
assert.match(graceRoute, /LEGACY_CLAIM_GRACE_END_MS/)
assert.match(graceRoute, /status:\s*410/)

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

assert.ok(existsSync('src/app/(app)/audit/page.tsx'), 'authenticated Evidence Audit UI must remain')
assert.ok(existsSync('src/lib/proofscore/engine.ts'), 'authenticated audit engine and user data contract must remain')

console.log('✓ anonymous ProofScore funnel is retired; authenticated Evidence Audit remains')
