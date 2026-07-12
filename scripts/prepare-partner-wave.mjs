#!/usr/bin/env node

// Generates tailored, value-first contact-form copy from the verified partner pipeline.
// It never contacts anyone. Default mode previews the selected organizations; --output
// writes a Markdown packet for the founder to review and submit one route at a time.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const pipeline = JSON.parse(readFileSync(resolve(ROOT, 'growth/distribution/partner-pipeline.json'), 'utf8'))
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.length ? rest.join('=') : true]
}))
const wave = Number.parseInt(String(args.get('wave') ?? '1'), 10)
const output = typeof args.get('output') === 'string' ? resolve(String(args.get('output'))) : null
const founder = process.env.FOUNDER_NAME || 'Kumar Dyutit'
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.tryshowcase.ink').replace(/\/$/, '')
const targets = pipeline.targets.filter((target) => target.wave === wave)

if (!targets.length) {
  console.error(`No targets found for wave ${wave}.`)
  process.exit(1)
}

console.log(`Wave ${wave}: ${targets.length} verified partner hypotheses`)
for (const target of targets) console.log(`- ${target.organization}: ${target.contactRoute}`)

if (!output) {
  console.log('\nNothing contacted. Add --output=/absolute/path/wave.md to create a review packet.')
  process.exit(0)
}

const sections = targets.map((target) => {
  const subject = `Portfolio pilot for ${target.segment.toLowerCase()}`
  const body = `Hi ${target.organization} team,

I'm ${founder}, the founder of Showcase. I built it to help early-career job seekers turn real resumes and projects into evidence-first portfolios, with an honest audit that never invents achievements.

${target.whyFit} That makes your community a strong fit for a small, no-cost pilot: ${lowercaseFirst(target.offer)}

There is no member-list request and no sales pitch. Every participant opts in directly, the pilot is capped at 10 participants so support stays real, and any feedback shared with your team is aggregate and deidentified.

Would this be useful for an upcoming cohort or career-programming slot? If not, no follow-up is needed.

Best,
${founder}
${appUrl}/`

  return `## ${target.organization}

- Status: ${target.status}
- Audience: ${target.segment}
- Verified: ${pipeline.verifiedOn}
- Official page: ${target.officialUrl}
- Submit through: ${target.contactRoute}
- Subject: ${subject}

${body}

### Before submitting

- [ ] Re-open the official contact route and confirm the program is still active.
- [ ] Replace every bracketed placeholder.
- [ ] Confirm capacity for a 10-person supported pilot before proposing a date.
- [ ] Submit once; record the date and do not send an automated follow-up.
`
}).join('\n---\n\n')

const packet = `# Showcase partner outreach — wave ${wave}

Generated from official pages verified ${pipeline.verifiedOn}. This packet is a review aid,
not a bulk-send list. Personalize each note and use only the listed public contact route.

${sections}`

writeFileSync(output, packet, 'utf8')
console.log(`\nWrote ${targets.length} reviewable drafts to ${output}. Nothing was sent.`)

function lowercaseFirst(value) {
  return value ? `${value[0].toLowerCase()}${value.slice(1)}` : value
}
