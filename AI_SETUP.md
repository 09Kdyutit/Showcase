# AI Setup

Showcase uses the OpenAI API for resume parsing, portfolio generation, ProofScore audits, and bullet improvement.

## Get an API key

1. [platform.openai.com](https://platform.openai.com/api-keys) → API Keys → Create new secret key
2. Set as `OPENAI_API_KEY` in `.env.local`

## Cost control

AI calls are rate-limited per user (`src/lib/ai/rate-limit.ts`):

| Action | Free tier | Pro tier |
|--------|-----------|----------|
| Resume analysis | 3/day | 25/day |
| ProofScore audit | 1/day | 10/day |
| Portfolio generation | 0 (Pro required) | 10/day |
| Bullet improvement | 5/day | 50/day |
| Role matching | 2/day | 20/day |

Monitor usage in the [OpenAI Platform dashboard](https://platform.openai.com/usage).

An emergency kill switch exists for incidents (e.g. runaway spend from a bug):
set `KILL_SWITCH_AI=true` to immediately block every AI-quota-gated route
without a code deploy — see `src/lib/feature-flags.ts`.

## Model configuration

The app uses `gpt-4o-mini` (fast tier) and `gpt-4o` (main/premium tiers) by
default — see `src/lib/ai/openai.ts`. Override via env vars:

```
OPENAI_MODEL_FAST=gpt-4o-mini
OPENAI_MODEL_MAIN=gpt-4o
OPENAI_MODEL_PREMIUM=gpt-4o
```

## Missing key behavior

If `OPENAI_API_KEY` is not set, the client falls back to a non-functional
placeholder string so the app doesn't crash at startup in development, but
any real AI call will fail. In production, a missing key throws at startup
(`src/lib/ai/openai.ts`).

## Privacy

- Resume text and portfolio content is sent to OpenAI's API for processing
- Per OpenAI's API terms, API data is not used for model training by default
- This is reflected in the actual privacy policy (`src/app/privacy/page.tsx`)
  — keep that page and this doc in sync if the AI provider ever changes again
  (this doc and several user-facing pages drifted to reference a previous,
  incorrect provider name; verify against `src/lib/ai/openai.ts` if in doubt)
