# Showcase Beta Operating System

**Goal:** Get the first 20–50 users to publish a portfolio.  
**The one metric that matters:** `portfolio_published` events.  
**Timeline:** 6 weeks from first invite sent.

---

## Structure

| File | Purpose |
|------|---------|
| `beta-selection-criteria.md` | Who qualifies, scored rubric |
| `beta-selection-sql.sql` | SQL to find/score waitlist candidates |
| `beta-user-tracker.csv` | Master tracker — one row per beta user |
| `beta-status-definitions.md` | Every status code defined |
| `beta-invite-email.md` | 3 invite templates (student / designer-dev / switcher) |
| `beta-followup-email.md` | Day-3 followup if they haven't activated |
| `beta-no-response-followup.md` | Day-7 final ping if still no activity |
| `beta-feedback-request-email.md` | Post-publish feedback request |
| `beta-call-invite.md` | Invite to a 30-min beta call |
| `direct-dm-scripts.md` | 25 DM variants for cold outreach |
| `linkedin-outreach.md` | LinkedIn connection + note templates |
| `reddit-safe-outreach.md` | Reddit rules + safe outreach patterns |
| `community-posts.md` | Discord / Slack community recruitment posts |
| `no-spam-rules.md` | Hard rules — what we never do |
| `beta-call-script.md` | Script for 30-min beta calls |
| `user-observation-sheet.md` | Live session observation form |
| `interview-questions.md` | Post-session interview bank |
| `core-loop-test-script.md` | Steps to verify the core loop end-to-end |
| `beta-dashboard-sql.sql` | Weekly reporting queries |
| `beta-weekly-review.md` | Weekly review template |
| `feedback-analysis-template.md` | How to synthesize feedback into decisions |
| `top-bugs-template.md` | Bug triage log |
| `top-feature-requests-template.md` | Feature request log |
| `phase-gate.md` | Exact criteria to exit beta and enter growth |

---

## Core Loop (what we're testing)

```
Waitlisted → Invited → Activated (signup) → Resume uploaded →
Portfolio generated → Edits made → Portfolio PUBLISHED
```

Every piece of this system exists to move users through that loop.

---

## Beta cohort targets

| Segment | Target count | Why |
|---------|-------------|-----|
| Students (final year / new grad) | 10–15 | High urgency, fast to activate |
| Designers / developers | 8–12 | Care about quality, vocal feedback |
| Career switchers | 5–8 | High pain, tell story best |
| Freelancers | 3–5 | Different use case, good stress test |

**Do not invite:** recruiters, investors, general public, or people who will ghost after signup.
