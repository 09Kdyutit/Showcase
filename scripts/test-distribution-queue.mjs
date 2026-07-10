import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const queue = JSON.parse(readFileSync('growth/distribution/content-queue.json', 'utf8'))
assert.deepEqual(queue.rules.approvedChannels, ['x'])
assert.equal(queue.rules.approvalRequired, true)
assert.equal(queue.rules.neverAutoPublish, true)
assert.equal(queue.items.length, 20)
assert.equal(new Set(queue.items.map((item) => item.id)).size, queue.items.length)

const weeklyCounts = new Map()
for (const item of queue.items) {
  assert.equal(item.channel, 'x', `${item.id}: only X is approved`)
  assert.ok(['draft', 'approved'].includes(item.status), `${item.id}: invalid status`)
  if (item.status === 'draft') {
    assert.equal(item.approvedBy, null)
    assert.equal(item.approvedAt, null)
  }
  if (item.text.includes('{{')) {
    assert.equal(item.status, 'draft', `${item.id}: unresolved evidence cannot be approved`)
    const evidencePlaceholders = item.text.replaceAll('{{url}}', '')
    if (evidencePlaceholders.includes('{{')) {
      assert.ok(item.evidenceRequired.length > 0, `${item.id}: metric placeholders need named evidence`)
    }
  } else {
    assert.ok(Array.from(item.text).length <= 280, `${item.id}: static X copy exceeds 280 characters`)
  }

  const date = new Date(`${item.scheduledAt.slice(0, 10)}T12:00:00Z`)
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - daysSinceMonday)
  const week = date.toISOString().slice(0, 10)
  weeklyCounts.set(week, (weeklyCounts.get(week) ?? 0) + 1)
}
assert.deepEqual([...weeklyCounts.values()], [4, 4, 4, 4, 4])

const partners = JSON.parse(readFileSync('growth/distribution/partner-pipeline.json', 'utf8'))
const firstWave = partners.targets.filter((target) => target.wave === 1)
assert.equal(firstWave.length, 5)
assert.ok(firstWave.every((target) => target.status === 'researched'))

const packet = readFileSync('growth/distribution/partner-wave-1-review.md', 'utf8')
for (const target of firstWave) {
  assert.ok(packet.includes(`## ${target.organization}`), `missing partner draft: ${target.organization}`)
}
assert.match(packet, /Nothing was sent|not a bulk-send list/i)

const bufferSync = readFileSync('scripts/sync-buffer-ideas.mjs', 'utf8')
assert.match(bufferSync, /createIdea/)
assert.doesNotMatch(bufferSync, /createPost|createUpdate|schedulePost|publishPost/)

console.log('distribution queue invariants passed: 20 X drafts, 4/week, 5 unsent partner drafts')
