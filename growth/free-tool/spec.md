# Free Tool Spec: "ProofScore Preview"

**Status:** Spec only. Do not build until Gate 1 is met (`phase-gate.md`).

---

## What it is

A free, ungated tool that lets anyone paste their resume and get a ProofScore — a numeric measure of how much proof and impact evidence is in their resume.

No account required. No email required.  
Shows the score + top 3 specific gaps.  
CTA to sign up for Showcase to fix them.

---

## URL

`/proofscore` — public, no auth

---

## Why build it

1. **SEO entry point** — targets queries like "how good is my resume" / "resume proof score" / "ATS score alternative"
2. **Viral loop** — people share their score ("I got a 62 — what did you get?")
3. **Warm pipeline** — everyone who uses the free tool has already identified the problem Showcase solves
4. **Reciprocity** — gives value before asking for anything

---

## What it shows

1. **ProofScore: [N]/100** — large, animated number reveal
2. **Score breakdown by category:**
   - Quantified impact (do they have numbers?)
   - Specificity (are claims concrete?)
   - Outcomes (do they show results, not just tasks?)
   - Relevance (does it match the target role?)
3. **Top 3 gaps with specific examples from their resume:**
   - "You wrote 'managed social media' — but gave no metrics. Who saw it? What happened to engagement?"
4. **What a 90+ score looks like** — brief, honest description
5. **CTA:** "Fix this with Showcase → generate a portfolio that shows proof" → `/waitlist`

---

## What it does NOT show

- Full recommendations (Pro feature)
- Portfolio generation (requires signup)
- Export or save (requires account)
- Score history (requires account)

---

## Technical approach (when ready to build)

- Use existing `audit-portfolio/route.ts` logic but lighter prompt (resume only, no portfolio context)
- Rate limit: 3 per IP per hour, no auth required
- Do not store the resume text — only store the score + metadata in an anonymous `usage_events` record
- No PII in analytics: do not log email, name, or resume text

---

## Copy (headline)

> **Is your resume actually proving anything?**  
> Paste it in. Get your ProofScore in 30 seconds.

CTA button: `Score my resume →`

---

## Distribution plan (when built)

- Reddit: r/cscareerquestions, r/resumes megathreads
- Twitter: "what's your resume ProofScore?" thread
- LinkedIn posts: score-your-resume content series
- SEO: target "resume score", "resume proof", "how strong is my resume"

---

## Success metric for the free tool

- 500 uses per month with no paid acquisition
- 10%+ of users click the Showcase CTA after seeing their score
