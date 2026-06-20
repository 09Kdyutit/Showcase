#!/usr/bin/env node
// Reads security/release-gate.json and exits nonzero if any release-blocking
// requirement is not PASS. BLOCKED items that are release_blocking still fail the
// gate (a blocker doesn't mean "ignore" — it means a human action is needed first).
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const gatePath = join(__dirname, '..', 'security', 'release-gate.json')

const gate = JSON.parse(readFileSync(gatePath, 'utf8'))

let blockingFailures = 0
let nonBlockingOpen = 0

console.log(`\n  Release gate — target: ${gate.release_target}\n`)

for (const req of gate.requirements) {
  const isOk = req.status === 'PASS'
  const icon = isOk ? '✅' : req.status === 'BLOCKED' ? '🚧' : req.status === 'FAIL' ? '❌' : '⬜'
  const tag = req.release_blocking ? '[BLOCKING]' : '[non-blocking]'
  console.log(`  ${icon} ${req.id} ${tag} ${req.area} — ${req.description} (${req.status})`)
  if (req.blocker) console.log(`      blocker: ${req.blocker}`)

  if (!isOk) {
    if (req.release_blocking) blockingFailures++
    else nonBlockingOpen++
  }
}

console.log(`\n  ${blockingFailures} release-blocking requirement(s) not PASS, ${nonBlockingOpen} non-blocking open.\n`)

if (blockingFailures > 0) {
  console.log('  ❌ RELEASE GATE: NOT READY\n')
  process.exit(1)
} else {
  console.log('  ✅ RELEASE GATE: PASS\n')
  process.exit(0)
}
