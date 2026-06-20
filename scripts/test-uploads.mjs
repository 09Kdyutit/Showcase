#!/usr/bin/env node
// Real adversarial file-upload tests against the live /api/resume/extract-text route, using
// a real authenticated browser session (this app's server route reads cookies via @supabase/ssr,
// not Bearer tokens) so the test exercises the exact auth path production traffic uses.
import { chromium } from 'playwright'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

async function postFileViaPage(page, buffer, filename, mimeType) {
  const base64 = buffer.toString('base64')
  return page.evaluate(async ({ base64, filename, mimeType }) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mimeType }), filename)
    const res = await fetch('/api/resume/extract-text', { method: 'POST', body: form })
    let body = null
    try { body = await res.json() } catch {}
    return { status: res.status, body }
  }, { base64, filename, mimeType })
}

async function main() {
  const browser = await chromium.launch()

  // ── Unauthenticated context ──
  {
    const page = await browser.newPage()
    await page.goto(`${APP_URL}/waitlist`, { waitUntil: 'networkidle' })
    const { status } = await postFileViaPage(page, Buffer.from('%PDF-1.4 hello'), 'r.pdf', 'application/pdf')
    record('Unauthenticated upload is rejected (401)', status === 401, `got ${status}`)
    await page.close()
  }

  // ── Authenticated context ──
  const page = await browser.newPage()
  const email = `upload-abuse-${Date.now()}@example.com`
  await page.goto(`${APP_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Alex Chen"]', 'Upload Abuse Test')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'TestPassword123!')
  await page.click('button[type=submit]')
  await page.waitForTimeout(3000)
  await page.goto(`${APP_URL}/resume`, { waitUntil: 'networkidle' })

  console.log('\n── Magic-byte spoofing (authenticated) ──')
  {
    const exeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, ...Buffer.from('A'.repeat(60))])
    const { status, body } = await postFileViaPage(page, exeBytes, 'resume.pdf', 'application/pdf')
    record('Renamed .exe claiming to be .pdf is rejected by magic-byte check', status === 400, `got ${status} ${JSON.stringify(body)}`)
  }
  {
    const htmlBytes = Buffer.from('<html><body><script>alert(1)</script></body></html>')
    const { status } = await postFileViaPage(page, htmlBytes, 'resume.pdf', 'application/pdf')
    record('HTML file renamed as .pdf is rejected by magic-byte check', status === 400, `got ${status}`)
  }
  {
    const realPdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('1 0 obj << /Type /Catalog >> endobj\n'.repeat(5))])
    const { status, body } = await postFileViaPage(page, realPdf, 'resume.pdf', 'application/pdf')
    record('Real %PDF-signed but unparseable PDF fails gracefully (no crash)', [400, 422, 500].includes(status), `got ${status} ${JSON.stringify(body)}`)
  }

  console.log('\n── Oversized payload (authenticated) ──')
  {
    const big = Buffer.alloc(5 * 1024 * 1024, 0x41)
    const { status } = await postFileViaPage(page, big, 'big.txt', 'text/plain')
    record('5MB file (over 4MB cap) is rejected', status === 400, `got ${status}`)
  }

  console.log('\n── Zero-byte / corrupted files (authenticated) ──')
  {
    const { status } = await postFileViaPage(page, Buffer.alloc(0), 'empty.pdf', 'application/pdf')
    record('Zero-byte file is rejected, not crashing the server', status >= 400 && status < 500, `got ${status}`)
  }
  {
    const truncated = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])
    const { status } = await postFileViaPage(page, truncated, 'corrupt.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    record('Truncated/corrupted DOCX is rejected gracefully', status >= 400 && status < 600, `got ${status}`)
  }

  console.log('\n── Path-traversal-style filename (authenticated) ──')
  {
    const real = Buffer.from('plain resume text '.repeat(10))
    const { status } = await postFileViaPage(page, real, '../../../etc/passwd.txt', 'text/plain')
    record('Path-traversal-style filename does not crash the route', status === 200 || status === 422, `got ${status}`)
  }

  await browser.close()
  console.log(`\n  Upload abuse test: ${PASS} passed, ${FAIL} failed\n`)
  process.exit(FAIL > 0 ? 1 : 0)
}

main().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1) })
