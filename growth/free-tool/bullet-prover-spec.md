# Free Tool Spec: "Bullet Point Prover"

**Status:** Spec only. **Build decision: founder's.** Companion micro-tool to the main
ProofScore tool (`spec.md`) — smaller, cheaper, more shareable. If both can't be built,
the ProofScore tool wins (it's the launch landing experience); this one is the follow-up.

---

## What it is

Paste **one resume bullet**. Get back, in ~5 seconds:

1. **An honest verdict** — `Claim`, `Partially proven`, or `Evidence`, with one sentence of
   why ("this says what you did, but nothing about scale, outcome, or timeframe").
2. **A rewrite that uses only what's in the bullet.** If the bullet has no number, the
   rewrite does not get one — it gets a **blank**:
   > *"Rebuilt the onboarding flow — cut new-user drop-off __% in __ weeks."*
   The blanks are the product demonstrating its ethics in a single interaction: this is
   what "never invents anything" looks like, rendered as UI.
3. **What's missing to make it provable** — a checklist against five evidence components:
   metric · scope · timeframe · outcome · baseline. Each missing one gets a
   go-find-it prompt ("Who saw it? Check your analytics, standup notes, or ask your old manager").

No account. No email. One bullet at a time.

---

## URL

`/prove` — public, no auth. (Also embeddable as the CTA target for P4 craft posts in
`.agents/marketing/08-social-content-system.md` — the tool IS the content pillar, interactive.)

---

## Why build it

1. **Micro → macro funnel**: one bullet is the smallest possible unit of the core insight
   (claims vs. evidence). The natural next thought is "what about my other 20 bullets?" —
   which is exactly what the full ProofScore answers.
2. **Cheapest possible aha**: a single small-model call on ≤300 characters — roughly an
   order of magnitude cheaper per use than the full audit, so it can absorb social traffic
   the 25/day ProofScore cap can't.
3. **Born shareable**: a before/after of one bullet fits in a screenshot, a Reel, a Reddit
   comment. The share card (below) makes every result a portable ad that contains real value.
4. **SEO**: "resume bullet checker", "how to quantify resume bullet points", "resume
   accomplishment statement generator" — generator-intent queries where every competing
   result happily invents numbers. Being the one that refuses is the differentiator, stated
   right on the page.

---

## What it shows

1. **Verdict chip** — Claim / Partially proven / Evidence (color-coded, no numeric score —
   scores are ProofScore's job; this tool stays binary-ish and fast)
2. **The rewrite with blanks** for anything unsupported, plus a one-line explanation of
   every blank ("no baseline in the original — we don't invent one")
3. **The missing-evidence checklist** (metric/scope/timeframe/outcome/baseline)
4. **CTA:** "That's one bullet. ProofScore does this for your whole resume — 11 dimensions,
   every gap named. **Get your free ProofScore →**" (links to `/proofscore`; the two tools
   share the funnel, not the cap)
5. **Share card** (user-initiated, no incentive): rendered image — original bullet struck
   through, rewrite-with-blanks below, verdict chip, small `tryshowcase.ink/prove` mark.
   Mirrors the homepage ProofEngine's diff aesthetic (−/+ lines) so the brand look carries.

## What it does NOT show

- A filled-in number the user didn't provide — **ever**. The blanks are non-negotiable;
  they are the whole point.
- A full-resume analysis (that's ProofScore's job)
- More than one bullet per run (keeps cost flat and the interaction legible)

---

## Cost cap (same honest pattern as ProofScore)

- Per-IP: 5/hour (existing `lib/rate-limit` pattern)
- Global: **100/day** (cheaper call than the full audit ⇒ higher cap; still finite, still
  honestly explained). At cap:
  > **Today's 100 free checks are done.** Every check costs real compute — small money,
  > but real, and we'd rather stay honest about limits than quietly degrade quality.
  > It resets tomorrow, or your full resume can wait in line for a ProofScore instead.
- No email reservation for this one (the check is small enough that "come back tomorrow"
  is a fair answer; keep the reservation mechanic exclusive to the higher-value audit)

---

## Technical approach

- **One small-model call** (cheapest tier in `lib/ai/openai.ts` MODELS), structured output:
  `{ verdict, why, rewrite, blanks: [{ slot, reason }], missing: [metric|scope|timeframe|outcome|baseline], find_prompts }`
- Input: single string, hard cap 300 chars (reject longer with "one bullet at a time — paste
  your full resume into ProofScore instead"), stripped of newlines
- Prompt inherits the no-invention instruction + the same defense posture as the resume
  parser: user text is data, not instructions; deterministic post-check that every number in
  `rewrite` appears in the input, else replace with a blank (the `sanitize-resume.ts`
  philosophy applied to a single string — cheap regex, no second AI call)
- Share card: same rendering pipeline as the link-preview/score-card images
- Analytics: `bullet_proved` event, verdict in metadata, never the bullet text (track.ts rule)
- No storage of the bullet at all — stateless request/response (and say so on the page:
  "your bullet isn't saved"); nothing here needs the pending-parse stash
- Effort: ~1–2 founder-days including the share card

---

## Copy (page headline)

> **Is that resume bullet a claim or evidence?**
> Paste one bullet. Get an honest verdict, a rewrite that uses only what's true, and the
> exact list of what's missing. We don't invent numbers — you'll see blanks where proof
> should go, and where to find it.

CTA button: `Prove it →`

---

## Distribution plan (if built)

- Every P4 (evidence-writing craft) social post links here as its interactive companion
- Reddit: legitimately useful enough to be linked *when someone asks* — still respect
  per-sub rules; never post it cold (`08-social-content-system.md` rules apply)
- Short-form video: screen-record real checks (own bullets) — the blank-instead-of-number
  reveal is a natural 15-second Reel beat (idea #14's sibling)
- SEO landing copy targets "resume bullet" query cluster

---

## Success metrics

- Check → ProofScore tool click-through ≥ 15% (the tool's only conversion job)
- Share-card generation rate ≥ 5% of checks (is it actually shareable?)
- Global cap hit-rate (if it never hits 100/day after the social pillar is running, the
  distribution is broken, not the tool)
- Zero instances of a number appearing in a rewrite that wasn't in the input (automated
  check in the deterministic post-processor; this metric failing is a P0, not a KPI miss)
