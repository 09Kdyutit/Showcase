import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import crypto from 'node:crypto'

export const maxDuration = 20

// Resend inbound-email webhook. Any mail sent to the receiving domain (e.g. replies to
// hello@tryshowcase.ink) is POSTed here by Resend as an `email.received` event. We verify
// the Svix signature, then forward the message to a real inbox (INBOUND_FORWARD_TO) with
// reply-to set to the original sender — so "just reply to this email" actually reaches a
// human, and that human can reply straight back.

const resend = new Resend(process.env.RESEND_API_KEY)
const FORWARD_TO = process.env.INBOUND_FORWARD_TO || ''
const SECRET = process.env.RESEND_WEBHOOK_SECRET || ''

// Svix signature verification (Resend's webhook signing). No external dep — HMAC-SHA256 of
// `${id}.${timestamp}.${body}` keyed by the base64 secret after the whsec_ prefix.
function verify(headers: Headers, body: string): boolean {
  if (!SECRET) return true // not yet configured — accept but the route logs a warning below
  const id = headers.get('svix-id')
  const ts = headers.get('svix-timestamp')
  const sigHeader = headers.get('svix-signature')
  if (!id || !ts || !sigHeader) return false
  const key = Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
  return sigHeader.split(' ').some((part) => {
    const sig = part.split(',')[1]
    if (!sig) return false
    try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) } catch { return false }
  })
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
}

export async function POST(request: NextRequest) {
  const raw = await request.text()

  if (!verify(request.headers, raw)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  if (!SECRET) console.warn('[inbound] RESEND_WEBHOOK_SECRET not set — webhook is UNVERIFIED. Set it in env.')

  let event: { type?: string; data?: Record<string, unknown> }
  try { event = JSON.parse(raw) } catch { return NextResponse.json({ ok: true }) }

  if (event.type !== 'email.received' || !event.data) {
    return NextResponse.json({ ok: true }) // ignore other event types
  }

  const d = event.data as {
    from?: string; to?: string[]; subject?: string; text?: string; html?: string
    email_id?: string; attachments?: { filename?: string }[]
  }
  const from = d.from || 'unknown sender'
  const to = (d.to || []).join(', ')
  const subject = d.subject || '(no subject)'
  const bodyText = d.text || ''
  const bodyHtml = d.html || ''
  const files = (d.attachments || []).map((a) => a.filename).filter(Boolean)

  if (!FORWARD_TO) {
    console.warn('[inbound] received a reply but INBOUND_FORWARD_TO is not set. from=%s subject=%s', from, subject)
    return NextResponse.json({ ok: true })
  }

  const header = `New reply to Showcase\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}${files.length ? `\nAttachments: ${files.join(', ')} (open in Resend to download)` : ''}`
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <div style="padding:12px 16px;background:#0d0d0d;border:1px solid #222;border-radius:10px;margin-bottom:16px;color:#d4d4d4;font-size:13px;line-height:1.6;">
      <strong style="color:#fff;">New reply to Showcase</strong><br/>
      <span style="color:#9ca3af;">From:</span> ${esc(from)}<br/>
      <span style="color:#9ca3af;">To:</span> ${esc(to)}<br/>
      <span style="color:#9ca3af;">Subject:</span> ${esc(subject)}${files.length ? `<br/><span style="color:#9ca3af;">Attachments:</span> ${esc(files.join(', '))} (open in Resend)` : ''}
    </div>
    ${bodyHtml || `<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;color:#111;">${esc(bodyText || '(no text body in payload — open email ' + (d.email_id || '') + ' in Resend)')}</pre>`}
  </div>`

  try {
    await resend.emails.send({
      from: 'Showcase inbound <hello@tryshowcase.ink>',
      to: FORWARD_TO,
      replyTo: from, // reply from your inbox goes straight to the actual person
      subject: `↩ ${from}: ${subject}`,
      text: `${header}\n\n${bodyText || '(no text body in payload)'}`,
      html,
      tags: [{ name: 'type', value: 'inbound_forward' }],
    })
  } catch (err) {
    console.error('[inbound] forward failed:', err instanceof Error ? err.message : err)
    // Still 200 so Resend doesn't hammer retries; we've logged it.
  }

  return NextResponse.json({ ok: true })
}
