import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { configuredAppUrl } from '@/lib/app-url'

export const maxDuration = 15

type UnsubscribeKind = 'digest' | 'lifecycle' | 'all'

const TOKEN_PATTERN = /^[a-f0-9]{16,64}$/
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/
const MAX_POST_BYTES = 4 * 1024

function parseKind(value: string | null): UnsubscribeKind | null {
  return value === 'digest' || value === 'lifecycle' || value === 'all' ? value : null
}

function signingSecret(): string | null {
  return process.env.UNSUBSCRIBE_SIGNING_SECRET?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || null
}

function signRequest(token: string, kind: UnsubscribeKind, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${kind}\n${token}`).digest('hex')
}

function hasValidSignature(token: string, kind: UnsubscribeKind, signature: string, secret: string): boolean {
  if (!SIGNATURE_PATTERN.test(signature)) return false
  const expected = Buffer.from(signRequest(token, kind, secret), 'hex')
  const received = Buffer.from(signature, 'hex')
  return expected.length === received.length && crypto.timingSafeEqual(expected, received)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] as string)
}

function kindDescription(kind: UnsubscribeKind): string {
  if (kind === 'lifecycle') return 'portfolio setup and progress emails'
  if (kind === 'all') return 'product and weekly digest emails'
  return 'weekly digest emails'
}

function htmlResponse(input: {
  status: number
  title: string
  message: string
  form?: { token: string; kind: UnsubscribeKind; signature: string }
}) {
  const appUrl = configuredAppUrl()
  const settingsUrl = escapeHtml(`${appUrl}/settings`)
  const form = input.form
    ? `<form method="post" action="/api/email/unsubscribe" style="margin:0 0 16px;">
        <input type="hidden" name="token" value="${escapeHtml(input.form.token)}"/>
        <input type="hidden" name="kind" value="${input.form.kind}"/>
        <input type="hidden" name="signature" value="${input.form.signature}"/>
        <button type="submit" style="border:0;cursor:pointer;background:#4f46e5;color:#fff;font-weight:700;padding:12px 22px;border-radius:9999px;">Confirm unsubscribe</button>
      </form>`
    : ''
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(input.title)}</title><meta name="robots" content="noindex,nofollow"/></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <main style="max-width:440px;text-align:center;padding:40px;">
    <div style="font-size:22px;font-weight:800;color:#818cf8;margin-bottom:24px;">Showcase</div>
    <h1 style="color:#fafafa;font-size:24px;margin:0 0 12px;">${escapeHtml(input.title)}</h1>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 28px;">${escapeHtml(input.message)}</p>
    ${form}
    <a href="${settingsUrl}" style="display:inline-block;background:#18181b;border:1px solid #27272a;color:#e4e4e7;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:9999px;">Manage email settings</a>
  </main>
</body></html>`

  return new NextResponse(html, {
    status: input.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  })
}

// Link scanners may GET every URL in an email. GET therefore renders only a confirmation
// form and never mutates preferences. The server signs the exact token + preference scope
// embedded in that form; only the subsequent same-origin POST can apply the change.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const token = params.get('token')?.trim().toLowerCase() ?? ''
  const kind = parseKind(params.get('kind')) ?? 'digest'
  const secret = signingSecret()

  if (!TOKEN_PATTERN.test(token)) {
    return htmlResponse({
      status: 400,
      title: 'Link expired or invalid',
      message: 'We could not validate this unsubscribe link. You can manage email preferences in Settings.',
    })
  }
  if (!secret) {
    console.error('[email/unsubscribe] signing secret is not configured')
    return htmlResponse({
      status: 503,
      title: 'Unsubscribe temporarily unavailable',
      message: 'Please try again shortly or manage email preferences in Settings.',
    })
  }

  return htmlResponse({
    status: 200,
    title: 'Confirm unsubscribe',
    message: `Confirm that you no longer want ${kindDescription(kind)}.`,
    form: { token, kind, signature: signRequest(token, kind, secret) },
  })
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return htmlResponse({ status: 415, title: 'Invalid request', message: 'Please use the confirmation form in the unsubscribe link.' })
  }
  if (Number.isFinite(declaredLength) && declaredLength > MAX_POST_BYTES) {
    return htmlResponse({ status: 413, title: 'Invalid request', message: 'The unsubscribe request was too large.' })
  }

  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_POST_BYTES) {
    return htmlResponse({ status: 413, title: 'Invalid request', message: 'The unsubscribe request was too large.' })
  }
  const form = new URLSearchParams(raw)
  const token = form.get('token')?.trim().toLowerCase() ?? ''
  const kind = parseKind(form.get('kind'))
  const signature = form.get('signature')?.trim().toLowerCase() ?? ''
  const secret = signingSecret()

  if (!TOKEN_PATTERN.test(token) || !kind || !secret || !hasValidSignature(token, kind, signature, secret)) {
    return htmlResponse({
      status: 403,
      title: 'Invalid confirmation',
      message: 'This confirmation is invalid or expired. Open the original email link and try again.',
    })
  }

  const updates = kind === 'all'
    ? { email_digest_enabled: false, lifecycle_email_enabled: false }
    : kind === 'lifecycle'
      ? { lifecycle_email_enabled: false }
      : { email_digest_enabled: false }
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('unsubscribe_token', token)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[email/unsubscribe] preference update failed:', error.message)
    return htmlResponse({
      status: 503,
      title: 'Unsubscribe temporarily unavailable',
      message: 'Please try again shortly or manage email preferences in Settings.',
    })
  }
  if (!data) {
    return htmlResponse({
      status: 400,
      title: 'Link expired or invalid',
      message: 'We could not process this unsubscribe link. You can manage email preferences in Settings.',
    })
  }

  return htmlResponse({
    status: 200,
    title: "You're unsubscribed",
    message: `You will no longer receive ${kindDescription(kind)}.`,
  })
}
