export function waitlistConfirmationEmail(name?: string | null): { subject: string; html: string; text: string } {
  const firstName = name?.trim().split(' ')[0] ?? null
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,'

  const subject = "You're on the Showcase waitlist"

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M18 4H9C6.79 4 5 5.79 5 8C5 10.21 6.79 12 9 12H15C17.21 12 19 13.79 19 16C19 18.21 17.21 20 15 20H6' stroke='url(%23g)' stroke-width='2' stroke-linecap='round'/%3E%3Cdefs%3E%3ClinearGradient id='g' x1='5' y1='4' x2='19' y2='20' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23f9a8d4'/%3E%3Cstop offset='1' stop-color='%23ec4899'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E" width="24" height="24" alt="" style="display:block;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:18px;font-weight:700;color:#f9fafb;letter-spacing:-0.02em;">Showcase</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#111111;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;">

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <!-- Top accent line -->
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#be185d,#ec4899,#f472b6);font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px 40px 32px;">

                    <!-- Check icon -->
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="width:48px;height:48px;background-color:rgba(236,72,153,0.1);border:1px solid rgba(236,72,153,0.2);border-radius:12px;text-align:center;vertical-align:middle;">
                          <span style="font-size:22px;line-height:1;color:#f472b6;">&#10003;</span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#f9fafb;letter-spacing:-0.03em;line-height:1.2;">You&rsquo;re on the list.</p>
                    <p style="margin:0 0 28px;font-size:15px;color:#9ca3af;line-height:1.6;">
                      ${greeting} We got you. You&rsquo;re officially on the Showcase waitlist and we&rsquo;ll reach out as soon as access opens.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                      <tr><td style="height:1px;background-color:rgba(255,255,255,0.06);font-size:0;">&nbsp;</td></tr>
                    </table>

                    <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.12em;">What is Showcase?</p>
                    <p style="margin:0 0 28px;font-size:14px;color:#d1d5db;line-height:1.7;">
                      Showcase turns your resume into a proof-of-work portfolio. It analyzes your real experience, scores how strong your evidence is with <strong style="color:#f9fafb;">ProofScore&trade;</strong>, and tells you exactly what to improve &mdash; without inventing a single thing.
                    </p>

                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.12em;">What to expect</p>

                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                      ${[
                        ['Resume &amp; portfolio builder', 'Upload your resume and get a polished, role-specific portfolio in minutes.'],
                        ['ProofScore&trade; audit',        'An honest 0&ndash;100 score across 11 dimensions &mdash; evidence strength, clarity, alignment, and more.'],
                        ['Interview prep',                 'Company-specific questions, AI-scored practice, and a question library with 70+ behavioral prompts.'],
                        ['Job matching',                   'Match your profile to real job postings and see exactly where you are strong or weak.'],
                        ['Project roadmap',                'AI analyzes your resume and suggests 6 custom projects to fill the gaps recruiters notice.'],
                      ].map(([title, desc], i) => `
                      <tr>
                        <td style="padding-bottom:14px;vertical-align:top;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td width="28" style="vertical-align:top;padding-top:1px;">
                                <span style="display:inline-block;width:20px;height:20px;background-color:rgba(236,72,153,0.12);border:1px solid rgba(236,72,153,0.25);border-radius:50%;font-size:9px;font-weight:800;color:#f472b6;text-align:center;line-height:20px;">${i + 1}</span>
                              </td>
                              <td>
                                <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#f9fafb;">${title}</p>
                                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">${desc}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>`).join('')}
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                      <tr><td style="height:1px;background-color:rgba(255,255,255,0.06);font-size:0;">&nbsp;</td></tr>
                    </table>

                    <table cellpadding="0" cellspacing="0" border="0" style="background-color:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:16px 18px;width:100%;">
                      <tr>
                        <td>
                          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                            <strong style="color:#f9fafb;">No spam. No fake urgency. No countdown timers.</strong><br/>
                            We&rsquo;ll only email you when something is real &mdash; access opening, product updates, or if we need to reach you directly.
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Footer inside card -->
                <tr>
                  <td style="padding:20px 40px 32px;border-top:1px solid rgba(255,255,255,0.05);">
                    <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
                      Questions? Reply to this email or reach us at <a href="mailto:hello@showcase.app" style="color:#f472b6;text-decoration:none;">hello@showcase.app</a><br/>
                      <a href="mailto:hello@showcase.app?subject=Unsubscribe" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4b5563;">Showcase &mdash; Turn your experience into evidence.</p>
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

We'll reach out as soon as access opens. No ETA — we want to get it right first.

WHAT IS SHOWCASE?
Showcase turns your resume into a proof-of-work portfolio. It analyzes your real experience, scores how strong your evidence is with ProofScore™, and tells you exactly what to improve — without inventing a single thing.

WHAT TO EXPECT:
1. Resume & portfolio builder — Upload your resume, get a polished portfolio in minutes.
2. ProofScore™ audit — An honest 0–100 score across 11 dimensions.
3. Interview prep — Company-specific questions and AI-scored practice.
4. Job matching — Match your profile to real job postings.
5. Project roadmap — AI suggests 6 custom projects to fill your gaps.

No spam. No fake urgency. We'll only email you when something is real.

Questions? Reply to this email or reach us at hello@showcase.app

—
Showcase · Turn your experience into evidence.
To unsubscribe, email hello@showcase.app with subject "Unsubscribe".`

  return { subject, html, text }
}
