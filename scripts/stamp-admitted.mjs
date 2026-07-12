#!/usr/bin/env node
// Stamps showcase_admitted=true on every real account that lacks it, so accounts created
// while the gate is open (e.g. the 2026-07 weekend window) stay able to log in after the
// closed-beta gate returns. Merge-safe (app_metadata keys are merged, not replaced).
// Re-run this RIGHT BEFORE closing the gate to catch last-minute signups.
// Run: node --env-file=.env.local scripts/stamp-admitted.mjs
import { createClient } from '@supabase/supabase-js'

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: page, error } = await s.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (error) { console.error(error.message); process.exit(1) }

const real = page.users.filter((u) => !/example\.com$/.test(u.email || ''))
const missing = real.filter((u) => u.app_metadata?.showcase_admitted !== true)
console.log(`accounts: ${real.length} real | already admitted: ${real.length - missing.length} | stamping: ${missing.length}`)

let failed = 0
for (const u of missing) {
  const { error: e } = await s.auth.admin.updateUserById(u.id, {
    app_metadata: { ...u.app_metadata, showcase_admitted: true, showcase_admission_source: u.app_metadata?.showcase_admission_source ?? 'open_window_stamp' },
  })
  console.log(`  ${u.email}: ${e ? 'FAILED ' + e.message : 'stamped ✓'}`)
  if (e) failed++
}

// Verify end state
const { data: after } = await s.auth.admin.listUsers({ page: 1, perPage: 1000 })
const still = after.users.filter((u) => !/example\.com$/.test(u.email || '') && u.app_metadata?.showcase_admitted !== true)
console.log(`\nVERIFY — real accounts still missing the flag: ${still.length}${still.length ? ' → ' + still.map((u) => u.email).join(', ') : ' ✓ all admitted'}`)
process.exit(failed || still.length ? 1 : 0)
