import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 15

// One-click unsubscribe from the weekly digest. Linked from every digest email (CAN-SPAM).
// Token-based so it works without the user being logged in. Returns a small themed page.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')?.trim()

  let ok = false
  if (token && /^[a-f0-9]{16,64}$/.test(token)) {
    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('profiles')
      .update({ email_digest_enabled: false })
      .eq('unsubscribe_token', token)
      .select('id')
      .maybeSingle()
    ok = !!data
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://showcase-app-three.vercel.app'
  const body = ok
    ? { title: "You're unsubscribed", msg: "You won't receive weekly digest emails anymore. You can turn them back on anytime in Settings." }
    : { title: 'Link expired or invalid', msg: 'We couldn\'t process that unsubscribe link. You can manage email preferences in your Settings.' }

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${body.title}</title><meta name="robots" content="noindex"/></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:440px;text-align:center;padding:40px;">
    <div style="font-size:22px;font-weight:800;color:#818cf8;margin-bottom:24px;">Showcase</div>
    <h1 style="color:#fafafa;font-size:24px;margin:0 0 12px;">${body.title}</h1>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 28px;">${body.msg}</p>
    <a href="${appUrl}/settings" style="display:inline-block;background:#18181b;border:1px solid #27272a;color:#e4e4e7;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:9999px;">Manage email settings</a>
  </div>
</body></html>`

  return new NextResponse(html, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}
