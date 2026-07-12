#!/usr/bin/env node

// One safe operator console for the two real scarcity dials. Read-only by default.
// Mutations require --apply so an exploratory status check can never release invites or
// Founding Member slots accidentally.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.length ? rest.join('=') : true]
}))
const APPLY = args.has('apply')
const changes = {}

if (args.has('pause-invites')) changes.invites_paused = true
if (args.has('resume-invites')) changes.invites_paused = false
if (args.has('invites')) changes.daily_invite_limit = boundedInteger(args.get('invites'), 0, 100, '--invites')

const foundingChanges = {}
if (args.has('pause-founding')) foundingChanges.reservations_paused = true
if (args.has('resume-founding')) foundingChanges.reservations_paused = false
if (args.has('founding-limit')) foundingChanges.slot_limit = boundedInteger(args.get('founding-limit'), 1, 10, '--founding-limit')

if (Object.keys(changes).length || Object.keys(foundingChanges).length) {
  console.log(`${APPLY ? 'APPLY MODE' : 'DRY RUN'} — proposed operator changes`)
  if (Object.keys(changes).length) console.log('Invite control:', changes)
  if (Object.keys(foundingChanges).length) console.log('Founding control:', foundingChanges)
  if (!APPLY) console.log('Nothing changed. Add --apply only after checking the status below.')
}

if (APPLY && Object.keys(changes).length) {
  const { error } = await admin.from('growth_controls').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) fail(`Invite control update failed: ${error.message}`)
}
if (APPLY && Object.keys(foundingChanges).length) {
  const { error } = await admin.from('founding_member_config').update({ ...foundingChanges, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) fail(`Founding control update failed: ${error.message}`)
}

const today = new Date().toISOString().slice(0, 10)
const todayStart = `${today}T00:00:00.000Z`
const [
  controlResult,
  waitlistResult,
  invitedTodayResult,
  foundingResult,
  aiCostResult,
] = await Promise.all([
  admin.from('growth_controls').select('invites_paused, daily_invite_limit, updated_at').eq('id', 1).maybeSingle(),
  admin.from('waitlist_signups').select('*', { count: 'exact', head: true }).eq('status', 'waitlisted'),
  admin.from('waitlist_signups').select('*', { count: 'exact', head: true }).gte('invite_sent_at', todayStart),
  admin.rpc('get_founding_member_availability'),
  readAiCostRows(todayStart),
])

for (const [label, result] of [
  ['growth_controls', controlResult],
  ['waitlist_signups', waitlistResult],
  ['invited_today', invitedTodayResult],
  ['founding_availability', foundingResult],
  ['general_ai_budget_reservations', aiCostResult],
]) {
  if (result.error) fail(`${label} read failed: ${result.error.message}`)
}

const founding = Array.isArray(foundingResult.data) ? foundingResult.data[0] : foundingResult.data
const aiCostNanoUsd = (aiCostResult.data ?? []).reduce((sum, row) => {
  if (row.status === 'released') return sum
  return sum + Number(row.status === 'reserved'
    ? row.estimated_cost_nano_usd
    : row.actual_cost_nano_usd ?? 0)
}, 0)

console.log('\nShowcase growth controls')
console.table({
  invites_paused: controlResult.data?.invites_paused ?? 'unknown',
  daily_invite_limit: controlResult.data?.daily_invite_limit ?? 'unknown',
  waitlisted: waitlistResult.count ?? 0,
  invited_today_utc: invitedTodayResult.count ?? 0,
  founding_paused: founding?.reservations_paused ?? 'unknown',
  founding_claimed_or_reserved: founding?.claimed_count ?? 'unknown',
  founding_remaining: founding?.remaining_count ?? 'unknown',
  ai_cost_today_usd: Number((aiCostNanoUsd / 1_000_000_000).toFixed(4)),
})

function boundedInteger(value, min, max, name) {
  const number = Number.parseInt(String(value), 10)
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${name} must be an integer from ${min} to ${max}.`)
  }
  return number
}

async function readAiCostRows(since) {
  const rows = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('general_ai_budget_reservations')
      .select('status, estimated_cost_nano_usd, actual_cost_nano_usd')
      .gte('reserved_at', since)
      .order('id')
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
