#!/usr/bin/env node
// Real concurrent-load test against a running server (local dev or a production build —
// run against whichever is currently up on NEXT_PUBLIC_APP_URL). No new dependency
// (k6/Artillery) added; plain concurrent fetch() with latency percentiles is enough to
// get a real first-pass signal on this app's current capacity and to catch obvious
// regressions (a change that doubles p95 latency, a code path that starts erroring
// under concurrency).
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 20)
const REQUESTS_PER_ENDPOINT = Number(process.env.LOAD_REQUESTS ?? 100)

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function runBatch(label, makeRequest, total, concurrency) {
  const latencies = []
  const errors = []
  let completed = 0

  async function worker() {
    while (completed < total) {
      completed++
      const start = performance.now()
      try {
        const res = await makeRequest()
        latencies.push(performance.now() - start)
        if (!res.ok) errors.push(res.status)
      } catch (e) {
        latencies.push(performance.now() - start)
        errors.push(e.message)
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker())
  const start = performance.now()
  await Promise.all(workers)
  const wallTime = performance.now() - start

  const sorted = [...latencies].sort((a, b) => a - b)
  console.log(`\n  ${label}`)
  console.log(`    requests: ${total}, concurrency: ${concurrency}, wall time: ${(wallTime / 1000).toFixed(2)}s`)
  console.log(`    throughput: ${(total / (wallTime / 1000)).toFixed(1)} req/s`)
  console.log(`    latency — p50: ${percentile(sorted, 50).toFixed(0)}ms, p95: ${percentile(sorted, 95).toFixed(0)}ms, p99: ${percentile(sorted, 99).toFixed(0)}ms, max: ${sorted[sorted.length - 1].toFixed(0)}ms`)
  console.log(`    errors: ${errors.length}/${total} (${((errors.length / total) * 100).toFixed(1)}%)`)
  if (errors.length > 0) {
    const counts = {}
    for (const e of errors) counts[e] = (counts[e] ?? 0) + 1
    console.log(`    error breakdown:`, counts)
  }

  return { label, errorRate: errors.length / total, p95: percentile(sorted, 95) }
}

async function main() {
  console.log(`Load test against ${APP_URL} (concurrency=${CONCURRENCY}, requests/endpoint=${REQUESTS_PER_ENDPOINT})`)

  const results = []

  results.push(await runBatch(
    'GET /api/health',
    () => fetch(`${APP_URL}/api/health`),
    REQUESTS_PER_ENDPOINT,
    CONCURRENCY
  ))

  results.push(await runBatch(
    'GET /waitlist (static-ish landing page)',
    () => fetch(`${APP_URL}/waitlist`),
    REQUESTS_PER_ENDPOINT,
    CONCURRENCY
  ))

  results.push(await runBatch(
    'GET /pricing',
    () => fetch(`${APP_URL}/pricing`),
    REQUESTS_PER_ENDPOINT,
    CONCURRENCY
  ))

  console.log('\n  Summary:')
  let anyFailed = false
  for (const r of results) {
    // Loose thresholds for a local-dev first pass, not a production SLA: <5% errors,
    // p95 under 5s. The point is catching gross regressions, not certifying capacity.
    const ok = r.errorRate < 0.05 && r.p95 < 5000
    console.log(`    ${ok ? '✅' : '❌'} ${r.label} — error rate ${(r.errorRate * 100).toFixed(1)}%, p95 ${r.p95.toFixed(0)}ms`)
    if (!ok) anyFailed = true
  }

  console.log()
  process.exit(anyFailed ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message, e.stack); process.exit(1) })
