import { buildInviteSignupUrl } from '../growth/admission.ts'

function safeFirstName(name: string | null | undefined): string | null {
  const cleaned = name
    ?.replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.split(' ')[0].slice(0, 80) : null
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] as string)
}

export function betaInviteEmail(
  name: string | null | undefined,
  appUrl: string,
  inviteToken: string,
  postalAddress?: string,
): { subject: string; html: string; text: string } {
  const firstName = safeFirstName(name)
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const signupUrl = buildInviteSignupUrl(appUrl, inviteToken)

  const subject = firstName ? `${firstName}, your Showcase invite is here` : 'Your Showcase invite is here'
  const safeGreeting = escapeHtml(greeting)
  const safeSubject = escapeHtml(subject)
  const safePostalAddress = postalAddress?.trim() ? escapeHtml(postalAddress.trim()) : null
  const preheader = 'You’re one of the first in. Turn your resume into proof of work in about 10 minutes.'

  // Outcome-focused — what they walk away with, not features.
  const outcomes: [string, string][] = [
    ['A portfolio draft', 'Your real experience organized into evidence-based case studies you can review and edit. Publishing the live page is a Pro feature.'],
    ['A ProofScore&trade;', 'An honest 0&ndash;100 audit across 11 dimensions, each with a specific fix. No fluff, no invented wins.'],
    ['A role-match view', 'Compare available role requirements with the evidence in your resume before you apply.'],
  ]

  const steps: [string, string][] = [
    ['Create your account', 'Sign up with this email address so we can link you to your invite.'],
    ['Upload your resume', 'That’s the only input. Showcase parses it and builds everything from there.'],
    ['Review &amp; tell us what’s rough', 'Read your draft, run ProofScore, edit anything that feels off, and then hit reply. You’re here to help us get it right.'],
  ]

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#000000;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Showcase</span>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="background:linear-gradient(135deg,#831843 0%,#be185d 45%,#ec4899 100%);border-radius:20px 20px 0 0;padding:46px 40px 38px;text-align:center;">
              <div style="display:inline-block;padding:5px 12px;background-color:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.28);border-radius:999px;margin-bottom:18px;">
                <span style="font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.12em;">Early access &middot; you're one of the first</span>
              </div>
              <p style="margin:0 0 8px;font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.15;">You&rsquo;re in.</p>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);line-height:1.6;">${safeGreeting} your Showcase access is open.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 20px 20px;padding:36px 40px 10px;">

              <p style="margin:0 0 26px;font-size:15px;color:#c4c4c4;line-height:1.7;">
                Upload one thing &mdash; your resume &mdash; and in about ten minutes you&rsquo;ll have:
              </p>

              <!-- Outcomes -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">
                ${outcomes.map(([title, desc]) => `
                <tr>
                  <td style="padding-bottom:16px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="26" style="vertical-align:top;padding-top:2px;">
                          <span style="font-size:15px;color:#f472b6;">&#10003;</span>
                        </td>
                        <td>
                          <p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#ffffff;">${title}</p>
                          <p style="margin:0;font-size:13.5px;color:#9ca3af;line-height:1.6;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:14px;">
                <tr>
                  <td align="center">
                    <a href="${signupUrl}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background:linear-gradient(135deg,#be185d,#ec4899);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 0;border-radius:12px;text-align:center;">
                      Claim your access &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 30px;font-size:12px;color:#6b7280;line-height:1.6;text-align:center;">
                Sign up with <span style="color:#a3a3a3;">this email address</span> &middot; free to use, no card needed
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;">
                <tr><td style="height:1px;background-color:rgba(255,255,255,0.07);font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- Steps -->
              <p style="margin:0 0 18px;font-size:11px;font-weight:700;color:#f472b6;text-transform:uppercase;letter-spacing:0.14em;">Your first 10 minutes</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">
                ${steps.map(([title, desc], i) => `
                <tr>
                  <td style="padding-bottom:18px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="34" style="vertical-align:top;">
                          <table cellpadding="0" cellspacing="0" border="0"><tr>
                            <td style="width:26px;height:26px;background:linear-gradient(135deg,#831843,#ec4899);border-radius:8px;text-align:center;vertical-align:middle;font-size:12px;font-weight:800;color:#ffffff;line-height:26px;">${i + 1}</td>
                          </tr></table>
                        </td>
                        <td style="padding-left:6px;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#ffffff;">${title}</p>
                          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.55;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- Referral program explanation -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:rgba(236,72,153,0.06);border:1px solid rgba(236,72,153,0.16);border-radius:12px;margin:8px 0 24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 5px;font-size:14px;font-weight:700;color:#ffffff;">This invite is only for your email</p>
                    <p style="margin:0;font-size:13px;color:#c4c4c4;line-height:1.65;">
                      Please don&rsquo;t forward this single-use link. After you complete your first portfolio, Showcase gives you three member invites of your own. Each friend gets 5 consumable AI credits, and you get 5 when that friend completes a first portfolio.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;line-height:1.6;">
                Button not working? Paste this into your browser:<br/>
                <a href="${signupUrl}" style="color:#f472b6;text-decoration:underline;word-break:break-all;">${signupUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:26px 12px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#737373;line-height:1.7;">
                Hit a bug or have a question? Reply to this email or write to <a href="mailto:hello@tryshowcase.ink" style="color:#f472b6;text-decoration:none;">hello@tryshowcase.ink</a>
              </p>
              <p style="margin:0 0 14px;font-size:12px;color:#525252;line-height:1.7;">
                You&rsquo;re receiving this because you joined the waitlist at tryshowcase.ink &middot;
                <a href="mailto:hello@tryshowcase.ink?subject=Unsubscribe" style="color:#737373;text-decoration:underline;">Unsubscribe</a>
              </p>
              ${safePostalAddress ? `<p style="margin:0 0 10px;font-size:11px;color:#525252;line-height:1.6;">Showcase &middot; ${safePostalAddress}</p>` : ''}
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

You're in — your Showcase early access is open. You're one of the first people we're letting in.

Upload one thing — your resume — and in about ten minutes you'll have:

  ✓ A portfolio draft — your real experience organized into evidence-based case studies. Publishing is a Pro feature.
  ✓ A ProofScore™ — an honest 0–100 audit across 11 dimensions, each with a specific fix.
  ✓ A role-match view — compare available role requirements with your actual evidence.

Claim your access: ${signupUrl}
(Sign up with this email address. Free to use, no card needed.)

YOUR FIRST 10 MINUTES
  1. Create your account — use this email address.
  2. Upload your resume — that's the only input.
  3. Review and tell us what's rough — read your draft, run ProofScore, edit anything that feels off, then reply.

THIS INVITE IS ONLY FOR YOUR EMAIL
Please don't forward this single-use link. After you complete your first portfolio, Showcase gives you three member invites of your own. Each friend gets 5 consumable AI credits, and you get 5 when that friend completes a first portfolio.

Hit a bug or have a question? Reply to this email or write to hello@tryshowcase.ink

-
Showcase · Turn your experience into evidence.
You're receiving this because you joined the waitlist at tryshowcase.ink.
To unsubscribe, email hello@tryshowcase.ink with subject "Unsubscribe".${postalAddress?.trim() ? `\nShowcase · ${postalAddress.trim()}` : ''}`

  return { subject, html, text }
}
