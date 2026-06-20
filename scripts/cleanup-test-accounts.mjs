#!/usr/bin/env node
// One-time cleanup: removes test accounts created by this session's adversarial test
// scripts. Only ever targets @example.com (RFC 2606 reserved domain — no real user can
// have this), and uses the same auth.admin.deleteUser() path verified in
// scripts/test-account-deletion.mjs, so cascade behavior is identical to the real
// account-deletion feature, not a raw table DELETE.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  const service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: profiles, error } = await service
    .from('profiles')
    .select('id, email, created_at')
    .like('email', '%@example.com')

  if (error) throw error

  console.log(`Found ${profiles.length} @example.com accounts to remove.\n`)
  if (profiles.length === 0) {
    console.log('Nothing to clean up.')
    return
  }

  let deleted = 0, failed = 0
  for (const p of profiles) {
    const { error: delError } = await service.auth.admin.deleteUser(p.id)
    if (delError) {
      console.log(`  ❌ ${p.email} — ${delError.message}`)
      failed++
    } else {
      deleted++
    }
  }

  console.log(`\nDeleted: ${deleted}, Failed: ${failed}`)

  // Storage cleanup for any leftover files under these now-deleted users' prefixes
  // (best-effort, mirrors the real account-delete route's behavior)
  let storageCleaned = 0
  for (const p of profiles) {
    try {
      const { data: files } = await service.storage.from('resumes').list(p.id)
      if (files && files.length > 0) {
        await service.storage.from('resumes').remove(files.map((f) => `${p.id}/${f.name}`))
        storageCleaned++
      }
    } catch { /* best-effort */ }
  }
  console.log(`Storage prefixes cleaned: ${storageCleaned}`)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
