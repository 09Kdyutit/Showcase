# Credential Rotation

Internal only — do not publish. No actual credentials are recorded here.

## Principle

Any credential that was ever pasted into a chat session, a terminal command visible in scrollback, a screenshot, or a commit (even one later removed) must be treated as permanently compromised and rotated — removing it from the current file is not sufficient, since Git history and chat logs persist independently of the working tree. This was the standard applied to P0-05 in `EXECUTION_MANIFEST.md` / `release-gate.json`: marked PASS only after the account owner explicitly confirmed rotation in every relevant dashboard, never inferred from the variable simply being present.

## Where each credential lives and how to rotate it

| Credential | Where it's used | Rotation steps | Requires redeploy |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (`server-only` guarded) | Supabase Dashboard → Project Settings → API → reset service-role key | Yes — update `.env.local` + Vercel Production/Preview |
| Supabase database password | Not directly used by current runtime code (no direct Postgres connection in app code; confirm before assuming) | Supabase Dashboard → Project Settings → Database → reset password | Only if `DATABASE_URL` is actually read somewhere — verify first |
| `OPENAI_API_KEY` | Server-only (`src/lib/ai/openai.ts`, `src/lib/ai/client.ts`) | OpenAI Dashboard → API keys → revoke + create new | Yes |
| `GEMINI_API_KEY` (if retained) | Server-only (`src/lib/ai/gemini.ts`), only active if `AI_REVIEW_MODE` is enabled — confirmed disabled for real user data per prior session's explicit policy | Google AI Studio / Cloud Console → revoke + create new | Yes, if in use |
| `STRIPE_SECRET_KEY` | Server-only (`src/lib/stripe/client.ts`) | Stripe Dashboard → Developers → API keys → roll key | Yes |
| `STRIPE_WEBHOOK_SECRET` | Server-only, read in webhook route only | Stripe Dashboard → delete + recreate the webhook endpoint for the same URL (generates a new secret — do not reuse an old endpoint's secret) | Yes |
| `JOBDATA_API_KEY` | Server-only (`src/lib/jobs/providers/jobdataapi.ts`) | jobdataapi dashboard → regenerate key | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Intentionally public (browser) | Supabase Dashboard → API → rotate publishable key. Low urgency — this key is designed to be public and is meaningless without RLS being the actual gate, which this audit verified holds. | Yes, cosmetic |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Intentionally public (browser) | Stripe Dashboard → API keys. Same low-urgency reasoning. | Yes, cosmetic |

## Verification after rotating any secret

1. Confirm format only (never print the value) — `vercel env ls production` shows the variable exists; the actual prefix/format check is done by piping the value into a local Node script that never echoes it (the pattern used throughout this session's deployment work), or by behavioral verification (e.g., `/api/health`'s `stripe_configured`/`openai_configured` flags, or a real test-mode Stripe API call via the CLI with `--api-key` sourced from a shell variable that's never printed).
2. Re-run the relevant test: `npm run test:stripe-config` after a Stripe key rotation, `npm run test:ai` after an OpenAI key rotation, `npm run test:rls` after a Supabase credential rotation.
3. Confirm the account owner has updated the value in **every** place it's configured: local `.env.local`, Vercel Production, Vercel Preview (a gap found and fixed earlier this engagement — Preview had zero env vars for a period), and the provider's own dashboard if the credential itself was regenerated there.

## Mark rotation complete only on explicit confirmation

Per the standing instruction already encoded in `release-gate.json` (P0-05): never mark a credential rotated because the environment variable is merely present, non-empty, or correctly formatted. Only the account owner can confirm the *value itself* changed in the provider's system — ask directly and record their explicit statement, not an inference.
