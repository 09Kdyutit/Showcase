export function betaInviteEmail(name: string | null | undefined, appUrl: string): { subject: string; html: string; text: string } {
  const firstName = name?.trim().split(' ')[0] ?? null
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,'

  const subject = "Your Showcase invite is here"

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Showcase</span>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="background:linear-gradient(135deg,#831843 0%,#be185d 45%,#ec4899 100%);border-radius:20px 20px 0 0;padding:44px 40px 36px;text-align:center;">
              <div style="width:56px;height:56px;background-color:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.3);border-radius:50%;margin:0 auto 20px;line-height:56px;text-align:center;">
                <span style="font-size:26px;color:#ffffff;">&#9733;</span>
              </div>
              <p style="margin:0 0 6px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.2;">You&rsquo;re in</p>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);line-height:1.6;">${greeting} your early access to Showcase is open.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 20px 20px;padding:36px 40px 8px;">

              <p style="margin:0 0 28px;font-size:15px;color:#a3a3a3;line-height:1.7;">
                You&rsquo;re one of the first people we&rsquo;re letting in. Upload your resume and, in a few minutes, you&rsquo;ll have a published portfolio, a ProofScore&trade; audit of your evidence, and matched roles &mdash; nothing invented, everything traceable to your real experience.
              </p>

              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:30px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/signup" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background:linear-gradient(135deg,#be185d,#ec4899);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 0;border-radius:12px;text-align:center;">
                      Create your account &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 26px;font-size:13px;color:#9ca3af;line-height:1.7;">
                Use this email address (<span style="color:#d4d4d4;">the one this was sent to</span>) when you sign up. Take it for a full spin &mdash; build a portfolio, run an interview drill, tailor an application &mdash; and tell us what feels rough. You&rsquo;re here to help us get it right, and we read every reply.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr><td style="height:1px;background-color:rgba(255,255,255,0.07);font-size:0;">&nbsp;</td></tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#d4d4d4;line-height:1.65;">
                Link not working? Paste this into your browser:<br/>
                <a href="${appUrl}/signup" style="color:#f472b6;text-decoration:underline;word-break:break-all;">${appUrl}/signup</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 12px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#737373;line-height:1.7;">
                Questions or a bug? Just reply, or write to <a href="mailto:hello@tryshowcase.ink" style="color:#f472b6;text-decoration:none;">hello@tryshowcase.ink</a>
              </p>
              <p style="margin:0 0 14px;font-size:12px;color:#525252;line-height:1.7;">
                You&rsquo;re receiving this because you joined the waitlist at tryshowcase.ink &middot;
                <a href="mailto:hello@tryshowcase.ink?subject=Unsubscribe" style="color:#737373;text-decoration:underline;">Unsubscribe</a>
              </p>
              <p style="margin:0;font-size:11px;color:#404040;">Showcase &mdash; Turn your experience into evidence.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `${greeting}

You're in — your early access to Showcase is open.

You're one of the first people we're letting in. Upload your resume and, in a few minutes, you'll have a published portfolio, a ProofScore™ audit of your evidence, and matched roles — nothing invented, everything traceable to your real experience.

Create your account: ${appUrl}/signup

Use this email address (the one this was sent to) when you sign up. Take it for a full spin — build a portfolio, run an interview drill, tailor an application — and tell us what feels rough. We read every reply.

Questions or a bug? Reply to this email or write to hello@tryshowcase.ink

-
Showcase · Turn your experience into evidence.
You're receiving this because you joined the waitlist at tryshowcase.ink.
To unsubscribe, email hello@tryshowcase.ink with subject "Unsubscribe".`

  return { subject, html, text }
}
