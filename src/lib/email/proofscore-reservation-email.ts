function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`))
}

export function proofScoreReservationEmail(
  auditUrl: string,
  reservedFor: string,
): { subject: string; html: string; text: string } {
  const dateLabel = formatUtcDate(reservedFor)
  const subject = `Your ProofScore audit is reserved for ${dateLabel}`

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;background:#08080b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08080b;padding:36px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#111116;border:1px solid #292932;border-radius:18px">
        <tr><td style="padding:34px">
          <p style="margin:0 0 24px;font-size:17px;font-weight:750;color:#fff">Showcase</p>
          <p style="margin:0 0 10px;font-size:26px;font-weight:800;letter-spacing:-.02em;color:#fff">Your audit spot is held.</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#b8b8c2">This one-use link is valid on <strong style="color:#fff">${dateLabel} (UTC)</strong>. Your reservation is already counted inside that day&rsquo;s 25-audit limit.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>
            <a href="${auditUrl}" style="display:block;padding:14px 18px;border-radius:11px;background:#e44c9a;color:#fff;text-decoration:none;text-align:center;font-size:15px;font-weight:750">Open my reserved audit &rarr;</a>
          </td></tr></table>
          <p style="margin:22px 0 0;font-size:12px;line-height:1.65;color:#7f7f8c">The link works once and only on the date above. You asked for this reservation email; we will not add you to a marketing list or send follow-ups from this request.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = `Your ProofScore audit spot is held.

This one-use link is valid on ${dateLabel} (UTC). Your reservation is already counted inside that day's 25-audit limit.

Open your reserved audit: ${auditUrl}

The link works once and only on the date above. You asked for this reservation email; we will not add you to a marketing list or send follow-ups from this request.

Showcase — Turn your experience into evidence.`

  return { subject, html, text }
}
