#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  EXPORT_GENERIC_ERROR,
  EXPORT_GENERATING_ERROR,
  EXPORT_SAVE_ERROR,
  runPortfolioExport,
} from '../src/lib/portfolio/export-flow.ts'

let failures = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✅ ${name}`)
  } catch (error) {
    failures++
    console.log(`  ❌ ${name}`)
    console.error(error)
  }
}

function harness(overrides = {}) {
  const events = []
  const lock = { current: false }
  const dependencies = {
    lock,
    isGenerating: false,
    isPublishing: false,
    setBusy: (busy) => events.push(`busy:${busy}`),
    clearPendingSave: () => events.push('clear-save'),
    flushEditorSave: async () => { events.push('flush'); return true },
    requestExport: async () => { events.push('request'); return { kind: 'download', payload: 'html' } },
    openPaywall: () => events.push('paywall'),
    markNotPro: () => events.push('not-pro'),
    download: async (payload) => events.push(`download:${payload}`),
    reportError: (message) => events.push(`error:${message}`),
    ...overrides,
  }
  return { dependencies, events, lock }
}

console.log('Checking the save-safe portfolio Export flow...\n')

await test('Free Export flushes current edits and lets the server authorize before opening its paywall', async () => {
  const { dependencies, events, lock } = harness({
    requestExport: async () => { events.push('request:pro-required'); return { kind: 'pro-required' } },
  })
  await runPortfolioExport(dependencies)
  assert.deepEqual(events, [
    'busy:true',
    'clear-save',
    'flush',
    'request:pro-required',
    'clear-save',
    'flush',
    'not-pro',
    'paywall',
    'busy:false',
  ])
  assert.equal(lock.current, false)
})

await test('a failed initial save opens neither paywall nor download', async () => {
  const { dependencies, events, lock } = harness({
    flushEditorSave: async () => { events.push('flush-failed'); return false },
  })
  await runPortfolioExport(dependencies)
  assert.deepEqual(events, ['busy:true', 'clear-save', 'flush-failed', `error:${EXPORT_SAVE_ERROR}`, 'busy:false'])
  assert.equal(lock.current, false)
})

await test('a server-authorized Export saves before requesting and downloads the successful response', async () => {
  const { dependencies, events } = harness()
  await runPortfolioExport(dependencies)
  assert.deepEqual(events, ['busy:true', 'clear-save', 'flush', 'request', 'download:html', 'busy:false'])
})

await test('a stale Pro response re-flushes edits before changing entitlement and opening the paywall', async () => {
  let clearCount = 0
  let flushCount = 0
  const { dependencies, events } = harness({
    clearPendingSave: () => events.push(`clear-save:${++clearCount}`),
    flushEditorSave: async () => { events.push(`flush:${++flushCount}`); return true },
    requestExport: async () => { events.push('request:pro-required'); return { kind: 'pro-required' } },
  })
  await runPortfolioExport(dependencies)
  assert.deepEqual(events, [
    'busy:true',
    'clear-save:1',
    'flush:1',
    'request:pro-required',
    'clear-save:2',
    'flush:2',
    'not-pro',
    'paywall',
    'busy:false',
  ])
})

await test('a failed stale-entitlement re-flush navigates nowhere and does not downgrade local state', async () => {
  let flushCount = 0
  const { dependencies, events, lock } = harness({
    flushEditorSave: async () => {
      flushCount++
      events.push(`flush:${flushCount}`)
      return flushCount === 1
    },
    requestExport: async () => { events.push('request:pro-required'); return { kind: 'pro-required' } },
  })
  await runPortfolioExport(dependencies)
  assert.deepEqual(events, [
    'busy:true',
    'clear-save',
    'flush:1',
    'request:pro-required',
    'clear-save',
    'flush:2',
    `error:${EXPORT_SAVE_ERROR}`,
    'busy:false',
  ])
  assert.equal(lock.current, false)
})

await test('rapid duplicate clicks share a synchronous lock and produce one request/download', async () => {
  let releaseRequest
  const requestGate = new Promise((resolve) => { releaseRequest = resolve })
  let requestCount = 0
  const { dependencies, events, lock } = harness({
    requestExport: async () => {
      requestCount++
      events.push('request:waiting')
      await requestGate
      return { kind: 'download', payload: 'html' }
    },
  })
  const first = runPortfolioExport(dependencies)
  await runPortfolioExport(dependencies)
  releaseRequest()
  await first
  assert.equal(requestCount, 1)
  assert.equal(events.filter((event) => event === 'download:html').length, 1)
  assert.equal(lock.current, false)
})

await test('request exceptions report one generic error and always reset busy/lock state', async () => {
  const { dependencies, events, lock } = harness({
    requestExport: async () => { events.push('request:throw'); throw new Error('network') },
  })
  await runPortfolioExport(dependencies)
  assert.deepEqual(events, [
    'busy:true',
    'clear-save',
    'flush',
    'request:throw',
    `error:${EXPORT_GENERIC_ERROR}`,
    'busy:false',
  ])
  assert.equal(lock.current, false)
})

await test('an explicit request error reports its safe message and never calls download', async () => {
  const { dependencies, events, lock } = harness({
    requestExport: async () => { events.push('request:error'); return { kind: 'error', message: 'Export unavailable' } },
  })
  await runPortfolioExport(dependencies)
  assert.deepEqual(events, [
    'busy:true',
    'clear-save',
    'flush',
    'request:error',
    'error:Export unavailable',
    'busy:false',
  ])
  assert.equal(lock.current, false)
})

await test('a download callback failure reports once and resets busy/lock state', async () => {
  const { dependencies, events, lock } = harness({
    download: async (payload) => { events.push(`download:${payload}`); throw new Error('filesystem') },
  })
  await runPortfolioExport(dependencies)
  assert.deepEqual(events, [
    'busy:true',
    'clear-save',
    'flush',
    'request',
    'download:html',
    `error:${EXPORT_GENERIC_ERROR}`,
    'busy:false',
  ])
  assert.equal(lock.current, false)
})

await test('generation and publishing guards start no save, paywall, request, or download', async () => {
  const generating = harness({ isGenerating: true })
  await runPortfolioExport(generating.dependencies)
  assert.deepEqual(generating.events, [`error:${EXPORT_GENERATING_ERROR}`])

  const publishing = harness({ isPublishing: true })
  await runPortfolioExport(publishing.dependencies)
  assert.deepEqual(publishing.events, [])
})

if (failures > 0) {
  console.log(`\n${failures} Export flow check(s) failed.`)
  process.exit(1)
}

console.log('\nThe Export flow preserves edits, suppresses duplicates, and stays outside Checkout.')
