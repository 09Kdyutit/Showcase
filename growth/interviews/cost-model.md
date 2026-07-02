# Interview Lab — Cost Model

Sources of truth: `src/lib/interviews/budget.ts` (RATES, cost helpers, budget gates),
`src/lib/interviews/entitlements/plans.ts` (Free/Pro limits + pricing rationale),
`src/lib/ai/openai.ts` (analysis model). Update this file whenever RATES or plan limits
change. All figures are estimates from provider list prices; the `interview_cost_events`
ledger (migration 028) records estimated/actual spend per call for real reconciliation.

## Provider rates (per 1M tokens)

| Provider / model | Input | Output | Used for |
|---|---|---|---|
| Gemini 2.5 Flash (text) | $0.30 | $2.50 | Question generation |
| Gemini 2.5 Flash (audio in) | $1.00 | — | Recorded-audio transcription |
| Gemini 2.5 Flash Native Audio (Live) | $3.00 | $12.00 | Live voice interviews |
| OpenAI gpt-5-mini | $0.25 | $2.00 | Post-session analysis, question scoring |

## Per-action cost estimates

| Action | Est. tokens (in / out) | Est. cost |
|---|---|---|
| AI question generation (per session) | ~4k / ~1k (Flash text) | ~$0.004 |
| Written answer scoring (per drill/question) | ~2k / ~1k (gpt-5-mini) | ~$0.003 |
| Post-session analysis (per session) | ~10k / ~5k (gpt-5-mini) | ~$0.013 |
| **Written interview, all-in** (gen + analysis) | — | **~$0.02–0.04** |
| Recorded-audio transcription (per 10 min) | ~19k audio-in (Flash) | ~$0.02 |
| **Live voice interview** (Gemini Live, ~15 min avg) | audio in+out | **~$0.25 (~$0.017/min)** |
| Retry (deterministic comparison) | none | $0 |
| Deterministic drill checks | none | $0 |

30-minute hard ceiling per session (`getMaxSessionMinutes`, uncircumventable by env)
bounds the worst single live session at ~$0.50.

## Monthly exposure per user

| Plan | Ceiling usage | Worst-case COGS | Revenue | Worst-case margin |
|---|---|---|---|---|
| Free (5 text, 0 voice) | 5 × $0.04 | ~$0.20 | $0 | Activation spend; bounded |
| Pro average (realistic: ~10 text, ~4 voice) | 10×$0.03 + 4×$0.25 | ~$1.30 | $15 | ~91% |
| Pro ceiling (150 text, 20 voice @ 15 min) | 150×$0.04 + 20×$0.25 | ~$11 | $15 | ~27% |
| Pro pathological (20 voice @ 30-min ceiling) | +$5 over ceiling case | ~$16 | $15 | negative — see backstops |

The pathological row is why the budget gates exist and must stay on.

## Backstops (all server-side, all fail closed)

1. **Entitlement reservations** — atomic per-period session/audio/retry counters
   (`interview_reserve_usage` / `interview_reserve_retry`, migrations 022–027); proven
   against parallel-request races (`test:interview-limits`, 16/16).
2. **Spend budgets** — `assertWithinBudget()` blocks any cost-incurring call once
   `INTERVIEW_USER_MONTHLY_BUDGET_USD`, `INTERVIEW_GLOBAL_DAILY_BUDGET_USD`, or
   `INTERVIEW_GLOBAL_MONTHLY_BUDGET_USD` would be exceeded (summed from the
   `interview_cost_events` ledger). Recommended production values: user-monthly $12,
   global-daily $50 at beta scale, global-monthly $500 — revisit with real traffic.
3. **Session ceiling** — 30-minute absolute cap regardless of env configuration.
4. **Kill switch** — `INTERVIEW_KILL_SWITCH` disables the lab wholesale.

## Margin posture

Meter the expensive resource (voice — also the upgrade reason), keep the cheap resource
(text) feeling abundant. Break-even on a Pro seat requires roughly 55 voice-minutes/day
sustained all month, which the audio session cap makes impossible; the realistic-average
row is the expected case. Baseline pending real traffic — reconcile against
`interview_cost_events` after the first paid cohort.
