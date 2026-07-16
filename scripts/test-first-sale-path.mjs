#!/usr/bin/env node
import { readFileSync } from 'node:fs'

let failures = 0

function source(path) {
  return readFileSync(path, 'utf8')
}

function expect(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    return
  }
  console.log(`  ❌ ${label}`)
  failures++
}

const dashboard = source('src/app/(app)/dashboard/page.tsx')
const builderIndex = source('src/app/(app)/builder/page.tsx')
const builderEditor = source('src/app/(app)/builder/[portfolioId]/page.tsx')
const publishPaywall = source('src/components/billing/publish-paywall-dialog.tsx')

console.log('Checking the generated-portfolio → Publish/Pro handoff...\n')

expect('dashboard reads the authoritative generation timestamp', dashboard.includes('ai_generated_at'))
expect('dashboard links a generated user to the exact portfolio editor', dashboard.includes('`/builder/${latestGeneratedPortfolio.id}`'))
expect('dashboard prioritizes review/publish before Evidence Audit',
  dashboard.indexOf("label: 'Review and publish your portfolio'") > -1 &&
  dashboard.indexOf("label: 'Review and publish your portfolio'") < dashboard.indexOf("label: 'Run your Evidence Audit'"))
expect('builder list labels generated drafts Review & publish', builderIndex.includes("'Review & publish'"))
expect('first generated portfolio no longer auto-opens a referral dialog',
  !builderEditor.includes('CompletionReferralDialog') &&
  !builderEditor.includes('showcase_referral_prompted'))
expect('generation completion offers an explicit Publish live action',
  builderEditor.includes("label: 'Publish live'") && builderEditor.includes('void togglePublish()'))
expect('publish intent still goes through the authenticated publish route',
  builderEditor.includes("fetch('/api/portfolio/publish'"))
expect('paywall buttons still route through Billing instead of bypassing the approval hold',
  publishPaywall.includes('router.push(`/billing?${params.toString()}`)') &&
  !publishPaywall.includes("fetch('/api/stripe/create-checkout-session'"))

if (failures > 0) {
  console.log(`\n${failures} first-sale path check(s) failed.`)
  process.exit(1)
}

console.log('\nThe pre-Checkout handoff is intact and the checkout-hardening hold remains respected.')
