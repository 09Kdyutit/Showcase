#!/usr/bin/env node
// The actual regression gate: re-runs the full fixture suite against whatever prompt code is
// currently checked out and fails the run if anything regresses. This is intentionally a thin
// wrapper around eval-prompts.mjs rather than a second implementation of the same checks —
// the eval harness IS the regression suite; this script exists only to give it a release-gate
// shaped name and exit code per the mission's required `npm run test:ai-regression` command.
import { spawnSync } from 'node:child_process'

console.log('Running the full prompt evaluation suite as the AI regression gate...\n')
const result = spawnSync('node', ['--env-file=.env.local', 'scripts/eval-prompts.mjs'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
