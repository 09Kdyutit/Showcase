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

## Current provider boundaries

Auth emails (signup confirmation, magic link, password reset) are sent through
Supabase Auth. The production custom-SMTP configuration still needs to be verified.

The application now has local Resend paths for waitlist, invite, Evidence Audit, lifecycle,
scorecard, inbound reply, delivery-event, unsubscribe, and suppression handling. Those
paths are not considered production-ready until their configuration and signed provider
events pass the release smoke tests.

## Confirmed routing and blocking state

- Legal/business name: Showcase
- Public founder: Kumar Dyutit
- Support/privacy address: `hello@tryshowcase.ink`
- Verified inbound replies forward to: `hello@tryshowcase.ink`
- Weekly scorecard recipient: `kumar.dyutit09@gmail.com`
- `EMAIL_POSTAL_ADDRESS`: unresolved
- Required state while unresolved: `EMAILS_ENABLED=false` and
  `LIFECYCLE_EMAILS_ENABLED=false`

A valid physical postal address is required before commercial/lifecycle delivery is
enabled. Do not substitute a placeholder or a private address that the owner has not
explicitly approved for public email footers.

## What's needed before launch

1. **Resolve and configure `EMAIL_POSTAL_ADDRESS`** with a valid physical sender address.
   Keep all commercial/lifecycle delivery disabled until this is complete.
2. **Configure a custom SMTP provider** in Supabase Dashboard → Authentication
   → Email Templates / SMTP Settings, pointing at a real transactional email
   service (Resend, Postmark, SendGrid, AWS SES, etc.) with a verified sending
   domain (SPF/DKIM/DMARC configured — without these, a meaningful fraction of
   confirmation emails will land in spam, especially with major providers like
   Gmail).
3. **Configure and verify Resend** for the app-level routes, using separate inbound and
   delivery-event signing secrets. Test unsubscribe, bounce, complaint, and suppression
   before changing either email enablement flag.
4. **Update the Redirect URLs allowlist** in Supabase Dashboard → Authentication
   → URL Configuration to include the real production domain's `/callback`
   path (not just `localhost`).
5. **Customize the email templates** (Supabase Dashboard → Authentication →
   Email Templates) — the default templates are generic and don't carry the
   Showcase brand; this is a trust/conversion issue more than a security one,
   but worth doing before a real launch.
6. **Verify the from-address** matches the configured sending domain — a
   mismatched from-address is one of the most common reasons confirmation
   emails get marked as spam.

## Billing email boundary

Stripe handles its own receipt/invoice emails independently — no app-level
email integration is needed for billing. This does not cover Showcase's auth,
waitlist, invite, Evidence Audit, lifecycle, scorecard, or inbound-reply surfaces.
