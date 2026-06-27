export function waitlistConfirmationEmail(name?: string | null): { subject: string; html: string; text: string } {
  const firstName = name?.trim().split(' ')[0] ?? null
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,'
  const siteUrl = 'https://tryshowcase.ink'

  const subject = "You're on the Showcase waitlist"

  const features: [string, string][] = [
    ['Resume &amp; portfolio builder', 'Upload your resume and get a polished, role-specific portfolio in minutes.'],
    ['ProofScore&trade; audit',        'An honest 0&ndash;100 score across 11 dimensions &mdash; evidence strength, clarity, alignment, and more.'],
    ['Interview prep',                 'Company-specific questions, AI-scored practice, and a question library with 70+ behavioral prompts.'],
    ['Job matching',                   'Match your profile to real job postings and see exactly where you are strong or weak.'],
    ['Project roadmap',                'AI analyzes your resume and suggests 6 custom projects to fill the gaps recruiters notice.'],
  ]

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
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:9px;vertical-align:middle;">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M18 4H9C6.79 4 5 5.79 5 8C5 10.21 6.79 12 9 12H15C17.21 12 19 13.79 19 16C19 18.21 17.21 20 15 20H6' stroke='%23f472b6' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E" width="22" height="22" alt="" style="display:block;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Showcase</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero gradient banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#831843 0%,#be185d 45%,#ec4899 100%);border-radius:20px 20px 0 0;padding:44px 40px 36px;text-align:center;">
              <div style="width:56px;height:56px;background-color:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.3);border-radius:50%;margin:0 auto 20px;line-height:56px;text-align:center;">
                <span style="font-size:26px;color:#ffffff;">&#10003;</span>
              </div>
              <p style="margin:0 0 6px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.2;">You&rsquo;re on the list</p>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);line-height:1.6;">${greeting} welcome to the Showcase waitlist.</p>
            </td>
          </tr>

          <!-- Card body -->
          <tr>
            <td style="background-color:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 20px 20px;padding:36px 40px 8px;">

              <p style="margin:0 0 28px;font-size:15px;color:#a3a3a3;line-height:1.7;">
                We&rsquo;ll reach out as soon as access opens. No ETA &mdash; we&rsquo;re taking the time to get it right first.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${siteUrl}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background:linear-gradient(135deg,#be185d,#ec4899);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:15px 0;border-radius:12px;text-align:center;">
                      Visit tryshowcase.ink &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr><td style="height:1px;background-color:rgba(255,255,255,0.07);font-size:0;">&nbsp;</td></tr>
              </table>

              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#f472b6;text-transform:uppercase;letter-spacing:0.14em;">What is Showcase?</p>
              <p style="margin:0 0 32px;font-size:14px;color:#d4d4d4;line-height:1.75;">
                Showcase turns your resume into a proof-of-work portfolio. It analyzes your real experience, scores how strong your evidence is with <strong style="color:#ffffff;">ProofScore&trade;</strong>, and tells you exactly what to improve &mdash; without inventing a single thing.
              </p>

              <p style="margin:0 0 18px;font-size:11px;font-weight:700;color:#f472b6;text-transform:uppercase;letter-spacing:0.14em;">What to expect</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                ${features.map(([title, desc], i) => `
                <tr>
                  <td style="padding-bottom:20px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="32" style="vertical-align:top;padding-top:1px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:24px;height:24px;background:linear-gradient(135deg,#831843,#ec4899);border-radius:7px;text-align:center;vertical-align:middle;font-size:11px;font-weight:800;color:#ffffff;line-height:24px;">${i + 1}</td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-left:4px;">
                          <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#ffffff;">${title}</p>
                          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.55;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr><td style="height:1px;background-color:rgba(255,255,255,0.07);font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- No BS promise -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:rgba(236,72,153,0.05);border:1px solid rgba(236,72,153,0.15);border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0;font-size:13px;color:#d4d4d4;line-height:1.65;">
                      <strong style="color:#ffffff;">No spam. No fake urgency. No countdown timers.</strong><br/>
                      We&rsquo;ll only email you when something is real &mdash; access opening, product updates, or if we need to reach you directly.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 12px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#737373;line-height:1.7;">
                Questions? Reply to this email or write to <a href="mailto:hello@tryshowcase.ink" style="color:#f472b6;text-decoration:none;">hello@tryshowcase.ink</a>
              </p>
              <p style="margin:0 0 14px;font-size:12px;color:#525252;line-height:1.7;">
                You&rsquo;re receiving this because you signed up at <a href="${siteUrl}" style="color:#737373;text-decoration:underline;">tryshowcase.ink</a> &middot;
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

You're on the Showcase waitlist.

We'll reach out as soon as access opens. No ETA - we want to get it right first.

Visit: ${siteUrl}

WHAT IS SHOWCASE?
Showcase turns your resume into a proof-of-work portfolio. It analyzes your real experience, scores how strong your evidence is with ProofScore™, and tells you exactly what to improve - without inventing a single thing.

WHAT TO EXPECT:
1. Resume & portfolio builder - Upload your resume and get a polished, role-specific portfolio in minutes.
2. ProofScore™ audit - An honest 0–100 score across 11 dimensions.
3. Interview prep - Company-specific questions and AI-scored practice.
4. Job matching - Match your profile to real job postings.
5. Project roadmap - AI suggests 6 custom projects to fill your gaps.

No spam. No fake urgency. We'll only email you when something is real.

Questions? Reply to this email or write to hello@tryshowcase.ink

-
Showcase · Turn your experience into evidence.
You're receiving this because you signed up at tryshowcase.ink.
To unsubscribe, email hello@tryshowcase.ink with subject "Unsubscribe".`

  return { subject, html, text }
}
