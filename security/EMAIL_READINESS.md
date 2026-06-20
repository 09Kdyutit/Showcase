# Email Readiness

## Real bug found and fixed this session

`src/app/(auth)/signup/page.tsx` and `src/app/(auth)/login/page.tsx` (magic link)
both set `emailRedirectTo: ${origin}/auth/callback`. The only callback route that
actually exists is `src/app/(auth)/callback/route.ts` — the `(auth)` segment is a
Next.js route group (parentheses), stripped from the URL, so the real path is
`/callback`, not `/auth/callback`. `SUPABASE_SETUP.md`'s documented Redirect URLs
allowlist only includes `/callback`. This means signup-confirmation and magic-link
emails were generating links that Supabase Auth's own redirect-URL allowlist
would have rejected — **email confirmation and magic-link sign-in were broken**
end to end. Fixed both call sites to point at `/callback`. Verified the signup
flow still completes correctly after the fix.

## Current email provider: Supabase's built-in SMTP

No custom SMTP/transactional-email provider (Resend, SendGrid, Postmark, etc.)
is configured anywhere in this codebase — confirmed via a full source search.
All auth emails (signup confirmation, magic link, password reset) are sent
through Supabase Auth's default built-in email service.

**This has a real, low limit:** Supabase's built-in email is explicitly
documented as suitable for development/testing only, with a low per-hour
sending cap (a few emails per hour on the Free tier) and no deliverability
guarantees (no custom domain, more likely to land in spam). It is not
appropriate for real production signup volume.

## What's needed before launch

1. **Configure a custom SMTP provider** in Supabase Dashboard → Authentication
   → Email Templates / SMTP Settings, pointing at a real transactional email
   service (Resend, Postmark, SendGrid, AWS SES, etc.) with a verified sending
   domain (SPF/DKIM/DMARC configured — without these, a meaningful fraction of
   confirmation emails will land in spam, especially with major providers like
   Gmail).
2. **Update the Redirect URLs allowlist** in Supabase Dashboard → Authentication
   → URL Configuration to include the real production domain's `/callback`
   path (not just `localhost`).
3. **Customize the email templates** (Supabase Dashboard → Authentication →
   Email Templates) — the default templates are generic and don't carry the
   Showcase brand; this is a trust/conversion issue more than a security one,
   but worth doing before a real launch.
4. **Verify the from-address** matches the configured sending domain — a
   mismatched from-address is one of the most common reasons confirmation
   emails get marked as spam.

## What does NOT need custom SMTP

Stripe handles its own receipt/invoice emails independently — no app-level
email integration is needed for billing. The only email surface this app
controls is the three Supabase Auth flows above (signup confirmation, magic
link, password reset).
