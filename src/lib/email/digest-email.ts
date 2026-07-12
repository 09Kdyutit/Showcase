// Weekly re-engagement digest. Content is computed from data the user already generated
// (evidence-score trend, job pipeline, interview readiness) — no AI cost, nothing fabricated.
// Every send carries a one-click unsubscribe link (CAN-SPAM compliant).

export interface DigestData {
  firstName: string | null
  appUrl: string
  unsubscribeUrl: string
  proofScore: number | null
  proofScoreDelta: number | null // vs previous audit
  pipelineCount: number // saved/tailoring jobs waiting
  followUpCount: number // applied jobs that could use a nudge
  readinessBand: string | null // interview readiness, e.g. "Interview Ready"
  newInterviewSince: boolean // has practiced recently
  postalAddress: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] as string)
}

/** Returns null when there's genuinely nothing worth emailing about (don't spam empty digests). */
export function weeklyDigestEmail(d: DigestData): { subject: string; html: string; text: string } | null {
  const hasSignal = d.proofScore !== null || d.pipelineCount > 0 || d.followUpCount > 0 || d.readinessBand !== null
  if (!hasSignal) return null

  const greeting = d.firstName ? `Hey ${d.firstName},` : 'Hey,'

  // Build the highlight lines — only include ones with real content.
  const lines: { label: string; value: string; cta: string; href: string }[] = []

  if (d.proofScore !== null) {
    const trend = d.proofScoreDelta && d.proofScoreDelta > 0
      ? ` (up ${d.proofScoreDelta} points)`
      : d.proofScoreDelta && d.proofScoreDelta < 0 ? ` (down ${Math.abs(d.proofScoreDelta)})` : ''
    lines.push({ label: 'Your evidence score', value: `${d.proofScore}/100${trend}`, cta: 'See your breakdown →', href: `${d.appUrl}/audit` })
  }
  if (d.followUpCount > 0) {
    lines.push({ label: 'Applications to follow up on', value: `${d.followUpCount} waiting`, cta: 'Open your pipeline →', href: `${d.appUrl}/jobs` })
  }
  if (d.pipelineCount > 0) {
    lines.push({ label: 'Jobs in your pipeline', value: `${d.pipelineCount} saved`, cta: 'Tailor & apply →', href: `${d.appUrl}/jobs` })
  }
  if (d.readinessBand) {
    lines.push({ label: 'Interview readiness', value: d.readinessBand, cta: 'Practice a session →', href: `${d.appUrl}/interviews` })
  }

  const subject = d.proofScoreDelta && d.proofScoreDelta > 0
    ? `Your evidence score is up ${d.proofScoreDelta} points`
    : d.followUpCount > 0
    ? `${d.followUpCount} application${d.followUpCount === 1 ? '' : 's'} to follow up on`
    : 'Your week on Showcase'

  const rowsHtml = lines.map((l) => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #1c1c22;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#8a8a94;">${escapeHtml(l.label)}</div>
        <div style="font-size:20px;font-weight:700;color:#fafafa;margin-top:4px;">${escapeHtml(l.value)}</div>
        <a href="${escapeHtml(l.href)}" style="font-size:13px;color:#818cf8;text-decoration:none;">${escapeHtml(l.cta)}</a>
      </td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#09090b;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f0f13;border:1px solid #1c1c22;border-radius:16px;padding:32px;">
        <tr><td>
          <div style="font-size:22px;font-weight:800;color:#fafafa;">Showcase</div>
          <p style="color:#d4d4d8;font-size:16px;line-height:1.5;margin:20px 0 8px;">${escapeHtml(greeting)}</p>
          <p style="color:#a1a1aa;font-size:15px;line-height:1.5;margin:0 0 8px;">Here's where your job search stands this week.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
          <a href="${d.appUrl}/dashboard" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:12px 24px;border-radius:9999px;">Open Showcase</a>
          <p style="color:#52525b;font-size:12px;line-height:1.5;margin-top:28px;">
            You're getting this because you have a Showcase account.
            <a href="${escapeHtml(d.unsubscribeUrl)}" style="color:#71717a;">Unsubscribe from weekly emails</a>.
          </p>
          <p style="color:#52525b;font-size:11px;line-height:1.5;margin-top:10px;">Showcase &middot; ${escapeHtml(d.postalAddress.trim())}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = [
    greeting,
    '',
    ...lines.map((l) => `${l.label}: ${l.value} — ${l.href}`),
    '',
    `Open Showcase: ${d.appUrl}/dashboard`,
    `Unsubscribe: ${d.unsubscribeUrl}`,
    `Showcase · ${d.postalAddress.trim()}`,
  ].join('\n')

  return { subject, html, text }
}
