#!/usr/bin/env node
// Diffs two saved evals/results/<timestamp>.json snapshots (produced by eval-prompts.mjs) to
// answer Phase 7's actual question: did a prompt change make things better or worse, on the
// same fixtures? Promote a prompt version only when this shows improvement with no new
// regressions — never promote a rewrite just because it reads better.
import { readFileSync, readdirSync } from 'node:fs'

function loadSnapshot(arg) {
  const path = /^\d+$/.test(arg) || arg.endsWith('.json') ? (arg.endsWith('.json') ? arg : `evals/results/${arg}.json`) : arg
  return JSON.parse(readFileSync(path, 'utf8'))
}

function diffPass(baseline, candidate, label) {
  const baseMap = new Map(baseline.results.map((r) => [r.fixtureId, r.pass]))
  const candMap = new Map(candidate.results.map((r) => [r.fixtureId, r.pass]))

  const regressions = []
  const improvements = []
  for (const [id, candPass] of candMap) {
    const basePass = baseMap.get(id)
    if (basePass === undefined) continue
    if (basePass && !candPass) regressions.push(id)
    if (!basePass && candPass) improvements.push(id)
  }

  console.log(`\n=== ${label} ===`)
  console.log(`  baseline: ${baseline.summary.passed}/${baseline.summary.total} passed`)
  console.log(`  candidate: ${candidate.summary.passed}/${candidate.summary.total} passed`)
  console.log(`  newly passing: ${improvements.length ? improvements.join(', ') : 'none'}`)
  console.log(`  newly failing (REGRESSION): ${regressions.length ? regressions.join(', ') : 'none'}`)
  return { regressions, improvements }
}

function main() {
  const [baselineArg, candidateArg] = process.argv.slice(2)
  if (!baselineArg || !candidateArg) {
    const available = readdirSync('evals/results').filter((f) => f.endsWith('.json')).sort()
    console.error('Usage: node scripts/compare-prompt-versions.mjs <baseline.json> <candidate.json>')
    console.error('Available snapshots:', available.join(', ') || '(none — run npm run eval:prompts first)')
    process.exit(1)
  }

  const baseline = loadSnapshot(baselineArg)
  const candidate = loadSnapshot(candidateArg)

  const a = diffPass(baseline.resumeParse, candidate.resumeParse, 'Resume-parse')
  const b = diffPass(baseline.portfolioGeneration, candidate.portfolioGeneration, 'Portfolio-generation')

  const totalRegressions = a.regressions.length + b.regressions.length
  if (totalRegressions > 0) {
    console.log(`\n❌ ${totalRegressions} regression(s) — do not promote this candidate.`)
    process.exit(1)
  }
  console.log('\n✅ No regressions found.')
  process.exit(0)
}

main()
