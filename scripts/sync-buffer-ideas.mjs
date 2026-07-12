#!/usr/bin/env node

// Copies the local content backlog into Buffer Ideas for human review. Ideas are not posts
// and cannot publish. Network writes require both --push and an API key.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PUSH = process.argv.includes('--push')
const ROOT = resolve(import.meta.dirname, '..')
const queue = JSON.parse(readFileSync(resolve(ROOT, 'growth/distribution/content-queue.json'), 'utf8'))
const approvedChannels = new Set(queue.rules?.approvedChannels ?? [])
const disallowed = queue.items.filter((item) => !approvedChannels.has(item.channel))
if (disallowed.length) {
  console.error(`Refusing Buffer sync: disallowed channels found (${disallowed.map((item) => item.channel).join(', ')})`)
  process.exit(1)
}
const items = queue.items.filter((item) => item.status === 'draft')

console.log(`${PUSH ? 'PUSH MODE' : 'DRY RUN'}: ${items.length} draft ideas`)
for (const item of items) console.log(`- [${item.channel}] ${item.id}`)
if (!PUSH) {
  console.log('\nNothing changed. Re-run with --push to create non-publishing Buffer Ideas.')
  process.exit(0)
}

const apiKey = process.env.BUFFER_API_KEY
const organizationId = process.env.BUFFER_ORGANIZATION_ID
if (!apiKey || !organizationId) {
  console.error('BUFFER_API_KEY and BUFFER_ORGANIZATION_ID are required in --push mode.')
  process.exit(1)
}

const mutation = `
  mutation CreateIdea($input: CreateIdeaInput!) {
    createIdea(input: $input) {
      ... on Idea { id }
      ... on MutationError { message }
    }
  }
`

let created = 0
for (const item of items) {
  const response = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          organizationId,
          content: {
            title: `[${item.channel}] ${item.id}`,
            text: `${item.text}\n\nInternal evidence checks: ${(item.evidenceRequired || []).join('; ') || 'none'}`,
          },
        },
      },
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.errors?.length || payload?.data?.createIdea?.message) {
    console.error(`Failed ${item.id}:`, payload?.errors?.[0]?.message || payload?.data?.createIdea?.message || response.statusText)
    process.exit(1)
  }
  created += 1
  console.log(`Created ${item.id} as idea ${payload?.data?.createIdea?.id}`)
}

console.log(`\nCreated ${created} Buffer Ideas. Review them in Buffer; nothing was scheduled or published.`)
