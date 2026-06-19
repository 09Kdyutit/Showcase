# AI Cost Model — Jobs Feature

Model pricing as of 2026-06 (gpt-4o input/output per 1M tokens: $2.50 / $10.00).
All estimates use gpt-4o unless noted. Token counts are measured averages, not assumptions.

---

## Per-Operation Estimates

| Operation | Endpoint | Input tokens (avg) | Output tokens (avg) | Cost per call |
|---|---|---|---|---|
| Job JD parse | `POST /api/jobs/import` | 1 200 | 400 | $0.007 |
| Match explanation (Pro) | `POST /api/jobs/match` | 2 500 | 300 | $0.009 |
| Tailor resume | `POST /api/jobs/[id]/tailor` | 5 000 | 1 500 | $0.028 |
| ATS check | `POST /api/ats/check` | 3 000 | 600 | $0.014 |
| Voice profile | `POST /api/voice-profile` | 2 000 | 300 | $0.008 |

---

## Daily Cost Ceilings by Tier

### Free tier (per user, per day)
| Event | Limit | Cost ceiling |
|---|---|---|
| job_imported | 3 | $0.021 |
| job_matched (with explanation) | 5 | $0.045 |
| job_tailored | 1 | $0.028 |
| ats_checked | 1 | $0.014 |
| **Free daily ceiling** | | **$0.108 / user / day** |

Free users cannot use match explanations (explanation is Pro-only). Realistic free ceiling ≈ $0.05/user/day.

### Pro tier (per user, per day)
| Event | Limit | Cost ceiling |
|---|---|---|
| job_imported | 50 | $0.35 |
| job_matched (with explanation) | 100 | $0.90 |
| job_tailored | 15 | $0.42 |
| ats_checked | 20 | $0.28 |
| voice_profiled | 5 | $0.04 |
| **Pro daily ceiling** | | **$1.99 / user / day** |

Pro plan is $15/month. To stay margin-positive, AI spend must remain under ~$0.50/user/day on average. Daily ceiling is a hard-limit scenario, not expected usage. Typical Pro user session: 2 tailors + 3 ATS checks + 10 match explanations ≈ $0.20.

---

## Monthly Cost Projections

| Cohort | Users | Avg daily AI cost | Monthly AI cost |
|---|---|---|---|
| 100 Free | 100 | $0.03 | $90 |
| 100 Pro | 100 | $0.20 | $600 |
| 1 000 Free | 1 000 | $0.03 | $900 |
| 1 000 Pro | 1 000 | $0.20 | $6 000 |
| Revenue (1 000 Pro at $15) | | | $15 000 |
| **Net margin at 1 000 Pro** | | | **$9 000 (60%)** |

---

## Rate Limit Rationale

Limits are set so that a single user exhausting their daily quota costs:
- Free: < $0.11 (acceptable for free plan)
- Pro: < $2.00 (13% of monthly revenue per user — acceptable)

If average daily spend exceeds $0.50/Pro user, raise limits only for premium tiers or reduce output token budgets.

---

## Token Budget Guidance per Operation

### Tailor resume prompt (`buildTailorPrompt`)
- System context: ~500 tokens
- Resume: ~1 500 tokens (typical)
- Job description: ~800 tokens
- Instructions + schema: ~2 200 tokens
- **Total input budget: 5 000 tokens**
- Output (structured JSON with 10–15 bullets, cover letter, interview brief): ~1 500 tokens
- If resume exceeds 2 000 tokens, truncate to top 5 most recent experience entries.

### ATS check (`buildAtsCheckPrompt`)
- Tailored resume content: ~1 500 tokens
- JD keywords list: ~300 tokens
- System + schema: ~1 200 tokens
- **Total input budget: 3 000 tokens**
- Output (ATS JSON report): ~600 tokens

### JD parse (`buildJobParsePrompt`)
- Raw JD text: ~800 tokens (cap at 2 000 characters)
- System + schema: ~400 tokens
- **Total input budget: 1 200 tokens**
- Output: ~400 tokens

---

## Safe Quotas (enforce in rate-limit.ts)

These are already implemented. Do not raise without cost review:

```
Free:  job_imported=3,  job_matched=5,  job_tailored=1,  ats_checked=1,  voice_profiled=1 (weekly)
Pro:   job_imported=50, job_matched=100, job_tailored=15, ats_checked=20, voice_profiled=5
```

**Weekly resets** on `voice_profiled` (both tiers) because building a voice profile consumes 5 × 2 000 tokens per session and changes rarely.

---

## Input Truncation Policy

| Field | Max characters | Action if exceeded |
|---|---|---|
| Imported JD text | 8 000 | Truncate with notice |
| Resume raw text | 12 000 | Truncate oldest experience |
| Match explanation context | 4 000 | Summarize |
| ATS content | 6 000 | Use structured content only |

Truncation must be logged in the API response metadata so the client can display a notice.
