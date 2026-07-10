#!/usr/bin/env node

// Turns explicitly approved content into Buffer's current bulk-upload CSV format.
// It never publishes. Buffer shows an import preview and can save the rows as drafts.
// Default mode only validates and reports; --output is required to write a CSV.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const QUEUE_PATH = resolve(ROOT, 'growth/distribution/content-queue.json')
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.length ? rest.join('=') : true]
}))
const channel = typeof args.get('channel') === 'string' ? String(args.get('channel')).toLowerCase() : null
const output = typeof args.get('output') === 'string' ? resolve(String(args.get('output'))) : null
const includeDrafts = args.has('include-drafts')
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.tryshowcase.ink').replace(/\/$/, '')

const queue = JSON.parse(readFileSync(QUEUE_PATH, 'utf8'))
const unresolved = /\{\{[^}]+\}\}/
const errors = []
const approvedChannels = new Set(queue.rules?.approvedChannels ?? [])
for (const item of queue.items) {
  if (!approvedChannels.has(item.channel)) errors.push(`${item.id}: channel ${item.channel} is not approved`)
}
const selected = queue.items.filter((item) => (!channel || item.channel === channel) && (includeDrafts || item.status === 'approved'))
const rows = []

for (const item of selected) {
  if (!includeDrafts && (!item.approvedBy || !item.approvedAt)) {
    errors.push(`${item.id}: approved items require approvedBy and approvedAt`)
    continue
  }
  const url = item.linkPath ? `${appUrl}${item.linkPath}${item.linkPath.includes('?') ? '&' : '?'}utm_source=${encodeURIComponent(item.channel)}&utm_medium=social&utm_campaign=organic-30-day&utm_content=${encodeURIComponent(item.id)}` : ''
  const text = item.text.replaceAll('{{url}}', url)
  if (unresolved.test(text)) {
    errors.push(`${item.id}: unresolved evidence placeholders remain`)
    continue
  }
  if (item.permissionEvidence === 'required' && !item.permissionEvidenceUrl) {
    errors.push(`${item.id}: missing permission evidence`)
    continue
  }
  if (item.channel === 'x' && xWeightedLength(text) > 280) {
    errors.push(`${item.id}: X text is ${xWeightedLength(text)} weighted characters (max 280)`)
    continue
  }
  rows.push({
    Text: text,
    'Image URL': item.imageUrl || '',
    Tags: item.tags?.join(',') || '',
    'Posting Time': item.scheduledAt || '',
  })
}

console.log(`Queue: ${queue.items.length} items`)
console.log(`Selected: ${selected.length}${channel ? ` for ${channel}` : ''}`)
console.log(`Exportable: ${rows.length}`)
if (errors.length) {
  console.log('\nBlocked rows:')
  for (const error of errors) console.log(`- ${error}`)
}

if (!output) {
  console.log('\nValidation only. Add --output=/absolute/path/buffer.csv after approving rows.')
  process.exit(errors.length ? 2 : 0)
}
if (includeDrafts) {
  console.error('--include-drafts is preview-only and cannot be combined with --output.')
  process.exit(1)
}
if (errors.length) {
  console.error('\nNo file written: fix every blocked approved row first.')
  process.exit(1)
}
if (!rows.length) {
  console.error('\nNo approved rows to export.')
  process.exit(1)
}

const headers = ['Text', 'Image URL', 'Tags', 'Posting Time']
const csv = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
  .map((row) => row.map(csvCell).join(','))
  .join('\n') + '\n'
writeFileSync(output, csv, 'utf8')
console.log(`\nWrote ${rows.length} approved rows to ${output}`)
console.log('Import the file through the target Buffer channel, inspect the preview, then choose Save as Drafts.')

function csvCell(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function xWeightedLength(value) {
  // X shortens HTTP(S) URLs to a fixed t.co length. This English-only queue otherwise uses
  // code-point count; revalidate in Buffer's preview before saving any approved draft.
  const withoutUrls = value.replace(/https?:\/\/\S+/g, 'x'.repeat(23))
  return Array.from(withoutUrls).length
}
