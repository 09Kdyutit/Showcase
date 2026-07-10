# Free Tool Spec: "ProofScore" (free layer)

**Status:** Spec only — **build pre-launch.** This tool is the landing experience for the
Product Hunt / Show HN launch (see `.agents/marketing/06-launch-plan.md`), so it ships
*before* launch week, not after Gate 1. Gate 1 (`../beta/phase-gate.md`) still gates the
launch itself. Gating design of record: `.agents/marketing/02-proofscore-lead-magnet.md`.

---

## What it is

A free tool at the top of the funnel: paste your resume, get an honest 0–100 ProofScore.

No account required. No email required. **No email wall before the score — the gate comes
after value, which is the on-brand order.**

Gating model — **generous verdict, gated depth**:

| Layer | What they get |
|---|---|
| Free, no account | Overall score + one-paragraph honest diagnosis + the **2 worst dimensions with their complete fixes** |
| Visible, not expanded | The **names and scores of all 11 dimensions** — real numbers, no blur (the full audit is computed in one call anyway; showing scores costs $0 extra) |
| Free account | The other 9 fixes + score saved to profile + **the resume parse carried into onboarding** (no re-upload, no re-parse) |

Two deliberate choices:
- **Worst 2, not "top 2"** — an honest audit leads with the bad news; it's more actionable and more converting.
- **Scores visible for all 11** — the gate's job is conversion; the 25/day cap is what bounds cost. Don't blur rows: withheld diagnosis reads as bait, visible scores with gated fixes reads as generous.

---

## URL

`/proofscore` tool page — public, no auth. (The current `/proofscore` methodology page moves
to `/proofscore/how-it-works` or gets the tool embedded above it — decide at build time; the
methodology content stays, it's good.)

---

## Why build it

1. **Launch shock absorber** — PH/HN traffic gets real value same-day at bounded cost (25/day cap), then flows to the waitlist
2. **Warm pipeline** — everyone who uses it has already identified the problem Showcase solves
3. **Reciprocity** — complete, actionable value before asking for anything
4. **SEO entry point** — "how good is my resume" / "resume score" / "ATS score alternative"
5. **Cheaper activation** — the parse handoff (below) means a tool-sourced signup costs one *less* AI call than an organic one

---

## What it shows

1. **ProofScore: [N]/100** — large, animated number reveal
2. **One-paragraph honest diagnosis** rendered from the two lowest dimensions (template over audit output, no extra AI call)
3. **The 2 worst dimensions, complete**: score, explanation, specific gap with an example from *their* resume, and the full fix
4. **All 11 dimension names + scores** (the real engine's dimensions — mirror `lib/proofscore/engine.ts`, never invent a category)
5. **Gate copy:** "That's 2 of your 11 fixes. The other 9 are already scored above — the specific fixes are waiting in your free account, along with the portfolio that repairs the biggest ones." CTA: `Create a free account → get all 11 fixes`
6. **Optional share card** (user-initiated, no incentive): rendered score-card image — "ProofScore 61/100 — an audit, not a vanity score"

## What it does NOT show

- The 9 remaining fixes (free account)
- Portfolio generation (account)
- Score history (account)
- Any projected "publish and you'll score X" number — that would be an invented metric

---

## The 25/day cap → email reservation

Global cap of 25 free scores/day (real cost bound, honestly explained). At cap:

> **Today's 25 free audits are done.**
> Each audit costs us real compute, and we'd rather run 25 honest ones than 1,000 shallow
> ones. Leave your email and we'll hold you a spot in tomorrow's batch — one link, good for
> one audit, and that's the only email you'll get unless you ask for more.

Reservation links consume the next day's capacity first (honest queueing). This converts
cap-hits into an owned-channel list instead of bounces.

---

## Technical approach

- Reuse the audit engine + a resume-only prompt variant; **one AI call computes the full 11-dimension audit**, display logic does the layering
- Anonymous rate limit: 3/IP/hour (existing `lib/rate-limit`) + global 25/day counter (same pattern as `AI_GLOBAL_DAILY_LIMIT` in `lib/ai/rate-limit.ts`)
- **Parse handoff (already built):** the tool's scoring path stashes the parsed resume via `POST /api/proofscore/stash` (migration `20260710033036_pending_parses.sql`); the token goes to `localStorage['showcase_parse_token']`; onboarding claims it via `/api/proofscore/claim-parse` and skips upload + re-parse entirely
- **Data honesty:** the stash is stored server-side for **48h max, deleted on claim or expiry** — say exactly that in the tool's fine print ("saved for 48 hours so you can pick up where you left off, then deleted"). No-account users who never sign up: their stash simply expires. No PII in analytics events (existing `track.ts` rule)
- The old spec's "do not store resume text" line is superseded by the 48h-TTL stash — the public copy must state the true behavior, not the old aspiration

---

## Copy (headline)

> **Find out what your resume actually proves.**
> Paste your resume. Get an honest 0–100 ProofScore across 11 dimensions — what's strong,
> what's weak, and exactly what to fix. No account needed. We never inflate, and we never invent.

CTA button: `Score my resume →`
Fine print under the paste box: privacy one-liner from `.agents/marketing/07-privacy-stance.md` (pending founder review).

---

## Distribution plan (when built)

- Launch traffic (PH + Show HN) — primary, by design
- Reddit: r/cscareerquestions, r/resumes megathreads (respect per-sub self-promo rules — see `.agents/marketing/08-social-content-system.md`)
- LinkedIn/X: honest score-breakdown content series
- SEO: "resume score", "resume proof", "how strong is my resume"

---

## Success metrics

- Tool completion (paste → score viewed) ≥ 80%
- Score → free account: 25–40% on warm traffic
- Cap-hit → email reservation ≥ 50%
- Tool-sourced signups should activate (first portfolio completed ≤72h) at ≥ the organic rate — the handoff makes them *warmer*, and if they don't, the handoff is broken
- First A/B when volume allows: worst-2 vs. top-2 dimensions in the free layer
