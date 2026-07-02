# AI Prompt-Quality Findings

Honest log of concrete issues found and fixed while hardening Showcase's AI feature
surface. Only records real, verified findings — not aspirational checklists.

## AI-001 — `match-explanation` declared an input cap it did not enforce

- **Severity:** Low (bounded blast radius — see below)
- **Component:** `src/lib/ai/prompts/match-explanation.ts`
- **Found:** 2026-07-02, by auditing per-prompt enforcement of the declared
  `maxInputCharacters` budget across all prompt specs.
- **Issue:** Every prompt spec declares `maxInputCharacters`, and every prompt except
  `match-explanation` clamped its untrusted free-text inputs before interpolation
  (`.slice(0, MAX)` / a cap constant). `match-explanation` declared
  `maxInputCharacters: 4000` but interpolated its fields raw. Those fields all originate
  from untrusted sources: an **imported job posting** (`job.title`, `job.company`,
  `job.seniority`, `structured_data.required_skills`, `structured_data.domain`) and a
  **parsed résumé** (`experience[0].role/company`, `seniority_level`). A hostile or
  oversized imported job posting could therefore push unbounded text into the prompt.
- **Why blast radius is Low, not High:** this prompt only *explains* a score that has
  already been computed deterministically. Its output schema (`MatchExplanationSchema`)
  has **no score field**, so injected content cannot change the match number. It also
  carried no explicit untrusted-data notice.
- **Root cause:** input-cap enforcement is per-prompt (each `buildMessages` slices its own
  inputs) with no central guarantee, so a single prompt could silently omit it.
- **Fix:**
  1. Added a reusable `clampField(value, maxChars)` helper to
     `src/lib/ai/prompts/shared-rules.ts` (pure, nullish-safe).
  2. `match-explanation` now clamps every untrusted interpolated field (per-field cap 300,
     skills lists 1200 — well under the 4000 total budget) and prepends
     `untrustedDataNotice('JOB and CANDIDATE fields')` so embedded instructions are framed
     as data, not commands.
  3. Bumped the spec `version` 2.1.0 → 2.2.0 (old generations stay attributable) and added
     the clamp/label guarantee to its `invariants`.
- **Regression test:** `npm run test:prompt-input-caps` (offline, no provider calls).
  Asserts (a) `clampField` truncation/boundary/nullish behavior, (b) the
  `untrustedDataNotice` framing, (c) the structural invariant that **every** cap-declaring
  prompt references a truncation mechanism, and (d) targeted checks that
  `match-explanation` clamps `job.title`/`job.company` and labels its inputs. 25/25 pass.
  This test would have failed against the pre-fix code.
- **Status:** FIXED + regression-locked. `tsc` clean, `next build` clean, `test:match`
  17/17, `test:prompt-injection` 15/15 unchanged.

## Baseline (offline AI-quality suites, all green before and after)

| Suite | Result |
|---|---|
| `test:prompt-injection` | 15/15 |
| `test:truth-ledger` | 15/15 |
| `test:proofscore` | 13/13 |
| `test:match` | 17/17 |
| `test:generation-guard` | 13/13 |
| `test:taxonomy` | 17/17 |
| `test:marketing-truthfulness` | clean (31 files) |
| `test:prompt-input-caps` (new) | 25/25 |

Provider-hitting suites (`test:ai`, `test:prompts`, `eval:prompts`) were **not** run — they
call the live OpenAI account per run and cost money; they are unrelated to this
deterministic fix. Run them separately when doing a full eval pass.
