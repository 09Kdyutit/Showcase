# Showcase — Product Decision Log

Internal record of product decisions: what changed, why, user impact, risk, and evidence.
Not user-facing. Newest entries first.

---

## 2026-07-02 — Free plan includes the FIRST AI portfolio generation

**What changed:** `/api/ai/generate-portfolio` previously hard-gated all AI generation behind
Pro. It now allows a free user's first generation (counted server-side by portfolios with
`ai_generated_at` set); regeneration and additional portfolios still require Pro. Builder
paywall copy and the pricing page were updated to match.

**Why:** Onboarding's review screen promises "One click builds your full portfolio from
this" with a single dominant CTA. For free users that click produced an empty builder
(0/7 quality) and a paywall — a broken promise at the exact moment of first value, and a
direct violation of the "Free must provide a real aha moment" rule. One generation costs
cents (gpt-based, bounded); activation is worth far more than the COGS.

**User impact:** Every new free signup now completes upload → parse → review → generated
portfolio (~86% quality in live verification) without paying.

**Risk:** Marginal AI spend per free signup (bounded to one call by a server-side count;
per-user rate limits still apply). Slightly weaker upgrade pressure at the builder,
compensated by Pro-gated publishing, regeneration, full ProofScore, Tailor Studio,
For-You feed, and Interview Lab depth.

**Evidence:** Live fresh-signup flow verified in a real browser (screenshots in session
scratchpad); `test:generation-guard` 13/13; commit fc67993.

---

## 2026-07-02 — Jobs browse seeds its search from the user's target role

**What changed:** The Jobs "Browse" tab used to load the provider's unfiltered latest
listings (a software engineer saw a wall of physician roles). It now seeds the search
query from `profiles.target_role`; the user can clear or change it freely.

**Why:** Relevance is the product's first impression of the jobs area; showing unrelated
roles reads as broken. The mission's hard-filter requirement applies to For You; Browse
stays a free search, just seeded sensibly.

**User impact:** Default browse results match the user's stated goal.

**Risk:** None material — one extra profile read at mount; empty target_role falls back to
the old behavior.

---

## 2026-07-02 — Launch-open CTA posture (retire "private beta" copy)

**What changed:** Pricing (both cards), /proofscore, and the mobile sticky CTA said "Join
the private beta" → /waitlist with a "Private beta - limited spots" scarcity line, even
though LAUNCH_OPEN=true and signup is open. All now say "Start free" → /signup; the
scarcity line became "No credit card required". /for-career-services keeps its /waitlist
form (legitimate institutional-interest capture) with "private beta" phrasing softened to
"Showcase is early".

**Why:** Truthfulness. Advertising scarcity for a product with open signup is fake
scarcity, which the product rules ban outright.

---

## 2026-07-02 — Billing/pricing state the real interview cap, not "unlimited"

**What changed:** "Unlimited written practice interviews" → "150 written practice
interviews / month" on billing and pricing.

**Why:** The plan is a 150/month fair-use cap (see `entitlements/plans.ts`). "Do not
advertise unlimited interviews" is an explicit product rule; 150/month reads as
effectively unlimited to any real user while staying honest.

---

## 2026-07-01 — "Save as Story" stays removed from interview Results (reaffirmed)

**What changed:** Nothing re-added. Commit 85c4d70 (2026-06-25) deliberately removed the
per-answer "Save as Story" button when the results page was rebuilt around delivery
signals + per-answer AI coaching. The Story Bank page remains as the standalone home for
stories. The stale test that still expected the button was updated to document this.

**Why (original rationale, preserved):** The results page was overloaded; story capture
had low engagement relative to its footprint and Story Bank remains reachable from the
hub with its own creation flow.

**Contrast:** Per-answer **Retry** was also missing after the later visual redesign — but
that removal was accidental (the API and tests still existed), so Retry was restored
(commit 9113430). Removal-on-purpose vs. loss-by-redesign are different things; this log
entry exists so future sessions don't re-litigate either.

---

## 2026-07-01 — Interview plan limits: Free 5 text / Pro 150 text + 20 voice + 100 retries

**What changed:** Free `sessionsPerPeriod` 3 → 5 (text-only), Pro 30 → 150 with audio
15 → 20 and retries 30 → 100.

**Why (cost-model rationale, from plans.ts):** Text interviews cost ~$0.03 each; live
voice ~$0.017/min. Meter the expensive thing (voice — the upgrade reason), let the cheap
thing feel abundant. 150/month text reads as unlimited to a real user (5/day) while
capping pathological abuse; 20 voice sessions at ~15 min average is ~$5 COGS against $15
revenue (~65% margin), with the live-voice spend budget as the backstop.

**Evidence:** `test:interview-entitlements` 25/25; `test:interview-limits` 16/16 with
adversarial concurrency (parallel session/audio/retry races).
