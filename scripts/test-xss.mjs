#!/usr/bin/env node
// Real adversarial test: plant a malicious portfolio with javascript:/data: URIs directly
// in contact links and project links, publish it, then render the real public page and
// inspect the actual DOM for whether those URIs made it into a clickable href.
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function main() {
  const client = createClient(URL, ANON_KEY)
  const email = `xss-test-${Date.now()}@example.com`
  const { data: signup, error } = await client.auth.signUp({ email, password: 'TestPassword123!' })
  if (error) throw new Error('signup failed: ' + error.message)
  const userId = signup.user.id
  const slug = `xss-test-${Date.now()}`

  const maliciousContent = {
    hero: { headline: 'Test <script>alert(1)</script>', subheadline: 'sub', tagline: 'tag' },
    about: { bio: 'bio', values: [] },
    skills: [],
    experience: [],
    projects: [{
      title: 'Project', role: 'role', summary: 's', problem: 'p', process: 'p', outcome: 'o',
      metrics: [], tags: [],
      links: [{ label: 'Click me', url: 'javascript:alert(document.cookie)' }],
    }],
    proof: [],
    contact: {
      email: 'test@example.com',
      linkedin: 'javascript:alert(document.cookie)',
      github: 'data:text/html,<script>alert(1)</script>',
      website: 'https://real-safe-site.example.com',
    },
    cta: { headline: 'cta', buttonLabel: 'Contact' },
  }

  const { error: insertErr } = await client.from('portfolios').insert({
    user_id: userId, slug, title: 'XSS Test', status: 'published',
    content: maliciousContent, published_at: new Date().toISOString(),
  })
  if (insertErr) throw new Error('insert failed: ' + insertErr.message)

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${APP_URL}/p/${slug}`, { waitUntil: 'networkidle' })

  const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href')))
  console.log('All hrefs found on rendered page:', JSON.stringify(hrefs))

  record('No javascript: URI present in any rendered href', !hrefs.some(h => h?.startsWith('javascript:')))
  record('No data: URI present in any rendered href', !hrefs.some(h => h?.startsWith('data:')))
  record('Safe https:// website link still renders correctly', hrefs.some(h => h === 'https://real-safe-site.example.com'))

  const bodyText = await page.evaluate(() => document.body.innerHTML)
  record('Script tag in headline did not execute / inject raw HTML', !bodyText.includes('<script>alert(1)</script>'))

  await browser.close()
  console.log(`\n  XSS test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
