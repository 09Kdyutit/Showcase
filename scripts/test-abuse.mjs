#!/usr/bin/env node
// Real test against the live waitlist route, which now uses the Postgres-backed atomic
// rate limiter (src/lib/rate-limit) instead of an in-memory Map. Proves: (1) the limit
// is actually enforced after N requests, (2) concurrent simultaneous requests can't
// race past the limit (the original COUNT-then-INSERT pattern this replaces would have
// been vulnerable to this), (3) a different IP is unaffected by another IP's usage.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

function joinWaitlist(ip, email) {
  return fetch(`${APP_URL}/api/waitlist/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, consent: true }),
  })
}

async function main() {
  const ip1 = `203.0.113.${Math.floor(Math.random() * 250) + 1}`
  const ip2 = `203.0.113.${Math.floor(Math.random() * 250) + 1}`
  const suffix = Date.now()

  // ── Sequential: first 5 from the same IP succeed, the 6th is rate-limited ──
  const sequentialResults = []
  for (let i = 0; i < 6; i++) {
    const res = await joinWaitlist(ip1, `abuse-seq-${suffix}-${i}@example.com`)
    sequentialResults.push(res.status)
  }
  const successCount = sequentialResults.filter((s) => s !== 429).length
  record('Sequential requests: exactly 5 succeed, 6th is rate-limited', successCount === 5 && sequentialResults[5] === 429, `statuses: ${sequentialResults.join(',')}`)

  // ── A different IP is completely unaffected ──
  {
    const res = await joinWaitlist(ip2, `abuse-other-${suffix}@example.com`)
    record('A different IP is not affected by ip1 hitting its limit', res.status !== 429, `got ${res.status}`)
  }

  // ── Concurrency: fire 10 simultaneous requests from a fresh IP, expect exactly 5 to pass ──
  const ip3 = `203.0.113.${Math.floor(Math.random() * 250) + 1}`
  const concurrentResults = await Promise.all(
    Array.from({ length: 10 }, (_, i) => joinWaitlist(ip3, `abuse-concurrent-${suffix}-${i}@example.com`).then((r) => r.status))
  )
  const concurrentSuccessCount = concurrentResults.filter((s) => s !== 429).length
  record(
    'Concurrency: 10 simultaneous requests, atomic counter allows exactly 5 (no race past the limit)',
    concurrentSuccessCount === 5,
    `successes: ${concurrentSuccessCount}/10, statuses: ${concurrentResults.join(',')}`
  )

  console.log(`\n  Abuse/rate-limit test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message, e.stack); process.exit(1) })
