import type { LifecycleTemplate } from '../growth/lifecycle'

export interface LifecycleEmailData {
  template: LifecycleTemplate
  firstName: string | null
  appUrl: string
  unsubscribeUrl: string
  portfolioId: string | null
  postalAddress: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] as string)
}

export function lifecycleEmail(data: LifecycleEmailData): RenderedEmail {
  const appUrl = data.appUrl.replace(/\/$/, '')
  const firstName = data.firstName?.trim() || null
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,'
  const builderUrl = data.portfolioId
    ? `${appUrl}/builder/${encodeURIComponent(data.portfolioId)}`
    : `${appUrl}/builder`

  const copy: Record<LifecycleTemplate, { subject: string; body: string; cta: string; href: string }> = {
    signup_not_generated_24h: {
      subject: 'Your Showcase draft is one step away',
      body: 'Add your resume and Showcase can turn it into a proof-first portfolio draft. You can review everything before anything is published.',
      cta: 'Build my draft',
      href: `${appUrl}/onboarding`,
    },
    generated_not_previewed_2h: {
      subject: 'Your portfolio draft is ready to review',
      body: 'Your draft is waiting. Open the preview, check the proof points, and edit anything that does not sound like you.',
      cta: 'Review my portfolio',
      href: builderUrl,
    },
    generated_not_previewed_68h: {
      subject: 'A quick final pass on your portfolio?',
      body: 'Your generated draft is still private. A short review is enough to tighten the story and decide what is ready to share.',
      cta: 'Finish my review',
      href: builderUrl,
    },
    portfolio_completion: {
      subject: 'You completed your first Showcase portfolio 🎉',
      body: 'Nice work—your experience is now shaped into a portfolio you can keep refining. Your draft stays private until you choose to publish it.',
      cta: 'See my portfolio',
      href: builderUrl,
    },
  }

  const selected = copy[data.template]
  const safeGreeting = escapeHtml(greeting)
  const safeBody = escapeHtml(selected.body)
  const safeHref = escapeHtml(selected.href)
  const safeUnsubscribe = escapeHtml(data.unsubscribeUrl)
  const safePostalAddress = escapeHtml(data.postalAddress.trim())
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fafafa">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f0f13;border:1px solid #27272a;border-radius:16px;padding:32px"><tr><td>
<div style="font-size:22px;font-weight:800;color:#818cf8">Showcase</div>
<p style="font-size:16px;line-height:1.6;color:#e4e4e7;margin:24px 0 8px">${safeGreeting}</p>
<p style="font-size:15px;line-height:1.7;color:#a1a1aa;margin:0 0 24px">${safeBody}</p>
<a href="${safeHref}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px">${escapeHtml(selected.cta)}</a>
<p style="font-size:12px;line-height:1.5;color:#52525b;margin-top:28px">You received this product email because you have a Showcase account. <a href="${safeUnsubscribe}" style="color:#71717a">Unsubscribe from lifecycle emails</a>.</p>
<p style="font-size:11px;line-height:1.5;color:#52525b;margin-top:10px">Showcase &middot; ${safePostalAddress}</p>
</td></tr></table></td></tr></table></body></html>`

  const text = [
    greeting,
    '',
    selected.body,
    '',
    `${selected.cta}: ${selected.href}`,
    '',
    `Unsubscribe: ${data.unsubscribeUrl}`,
    `Showcase · ${data.postalAddress.trim()}`,
  ].join('\n')

  return { subject: selected.subject, html, text }
}
