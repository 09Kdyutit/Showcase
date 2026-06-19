# AI Setup

Showcase uses the Anthropic Claude API for resume parsing, portfolio generation, ProofScore audits, and bullet improvement.

## Get an API key

1. [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key
2. Set as `AI_API_KEY` in `.env.local`

## Cost control

AI calls are rate-limited per user:

| Action | Free tier | Pro tier |
|--------|-----------|----------|
| Resume analysis | 3/day | 25/day |
| ProofScore audit | 1/day | 10/day |
| Portfolio generation | 0 (Pro required) | 10/day |
| Bullet improvement | 5/day | 50/day |
| Role matching | 2/day | 20/day |

Approximate cost per action:
- Resume analysis: ~$0.01–0.02
- Full audit: ~$0.05–0.10
- Portfolio generation: ~$0.10–0.20

Monitor usage in [Anthropic Console](https://console.anthropic.com) → Usage.

## Mock mode

If `AI_API_KEY` is not set in development, the app automatically runs in **mock mode**:
- AI routes return sample data
- A warning is logged to the server console
- No API calls are made
- Perfect for local UI development

Mock mode only works in `NODE_ENV=development`. In production, missing `AI_API_KEY` returns an error to the user.

## Model configuration

The app uses `claude-sonnet-4-6` by default. To change the model, edit `src/lib/ai/client.ts`:

```ts
model = 'claude-sonnet-4-6',  // Change this
```

Available models: `claude-opus-4-8` (most capable, higher cost), `claude-sonnet-4-6` (recommended), `claude-haiku-4-5-20251001` (fastest, cheapest).

## Privacy

- Resume text and portfolio content is sent to Anthropic's API for processing
- No data is retained by Anthropic beyond the processing request (per their API terms)
- Do not include this in your privacy policy without verifying current Anthropic terms
- Consider adding a disclosure: "Your resume content is processed by Anthropic's Claude API to generate your portfolio."
