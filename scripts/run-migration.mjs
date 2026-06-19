#!/usr/bin/env node
/**
 * Runs the waitlist migration (002_waitlist.sql) against the configured Supabase project.
 * Usage: node scripts/run-migration.mjs
 * Requires: pg installed (npm install --no-save pg), .env.local configured
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)

// Load env
const envPath = join(ROOT, '.env.local')
if (!existsSync(envPath)) {
  console.error('❌ .env.local not found')
  process.exit(1)
}
const env = readFileSync(envPath, 'utf-8')
const vars = Object.fromEntries(
  env.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const projectRef = vars.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!projectRef) {
  console.error('❌ Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}

// Parse connection details from DATABASE_URL (handle special chars in password)
const rawUrl = vars.DATABASE_URL?.replace('your-project-ref', projectRef) ?? ''
const urlMatch = rawUrl.match(/^postgresql:\/\/([^:]+):(.+)@([^:]+):(\d+)\/(.+)$/)
if (!urlMatch) {
  console.error('❌ Could not parse DATABASE_URL — check .env.local')
  process.exit(1)
}
const [, user, , host, port, database] = urlMatch
// Get password as everything between user: and the last @host
const passMatch = rawUrl.match(/^postgresql:\/\/[^:]+:(.+)@[^@]+:\d+\/[^/]+$/)
const password = passMatch?.[1]

if (!password) {
  console.error('❌ Could not extract password from DATABASE_URL')
  process.exit(1)
}

console.log(`Connecting to ${host}...`)

const { Client } = require('pg')
const client = new Client({ host, port: parseInt(port), database, user, password, ssl: { rejectUnauthorized: false } })

await client.connect()
console.log('✅ Connected\n')

const migrationFile = join(ROOT, 'supabase/migrations/002_waitlist.sql')
const sql = readFileSync(migrationFile, 'utf-8')

// Parse statements: split on semicolons that aren't inside function bodies
// Simple approach: split on ';\n' outside of $$ blocks
const statements = []
let current = ''
let inDollarBlock = false

for (const line of sql.split('\n')) {
  const stripped = line.replace(/--[^\n]*/, '').trim()
  if (stripped.startsWith('--') || !stripped) {
    current += line + '\n'
    continue
  }
  if (stripped.includes('$$')) {
    const count = (stripped.match(/\$\$/g) || []).length
    if (count % 2 === 1) inDollarBlock = !inDollarBlock
  }
  current += line + '\n'
  if (!inDollarBlock && stripped.endsWith(';')) {
    const stmt = current.replace(/--[^\n]*/g, '').trim()
    if (stmt) statements.push(stmt)
    current = ''
  }
}
if (current.trim()) statements.push(current.trim())

let passed = 0
let skipped = 0
let failed = 0

for (const stmt of statements) {
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
  try {
    await client.query(stmt)
    console.log(`✅ ${preview}`)
    passed++
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log(`⏭️  (exists) ${preview}`)
      skipped++
    } else {
      console.log(`❌ ${e.message.slice(0, 120)}`)
      console.log(`   Statement: ${preview}`)
      failed++
    }
  }
}

await client.end()
console.log(`\n── Results ──────────────────────────`)
console.log(`  ✅ ${passed} executed`)
console.log(`  ⏭️  ${skipped} already existed`)
if (failed > 0) console.log(`  ❌ ${failed} failed`)
console.log()
if (failed === 0) console.log('Migration complete. Tables are ready.')
else process.exit(1)
