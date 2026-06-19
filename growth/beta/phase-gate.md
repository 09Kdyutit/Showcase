# Phase Gate: Beta → Growth

**This document defines the exact criteria to exit beta and open Showcase to the public.**

Do not run paid ads, launch on Product Hunt, or do broad PR until every criterion in Gate 1 is met. Gate 2 criteria must be met before running any paid acquisition.

---

## Gate 1 — Exit beta (open to public, no paid ads)

All of the following must be true:

### Publish rate
- [ ] ≥ 40% of invited beta users published a portfolio  
  _Current: __%_

### Portfolio quality
- [ ] At least 3 published portfolios reviewed by an independent observer (not the founder) score ≥ 8/10 on: accuracy, specificity, visual quality, and professional confidence
- [ ] Zero P0 quality bugs observed in review
  _Current: [reviewed / not reviewed]_

### Core loop reliability
- [ ] Core loop test script passes 100% (see `core-loop-test-script.md`)
- [ ] Zero P0 bugs active in `top-bugs-template.md`
- [ ] Resume parse success rate ≥ 95% (measured over ≥ 20 parses)
  _Current: __%_

### User satisfaction
- [ ] Average feedback rating ≥ 7.0 / 10 (minimum 10 responses)
- [ ] "Would recommend" rate ≥ 60%
  _Current: avg __ / 10, __% would recommend_

### Activation
- [ ] Waitlist → publish median time ≤ 72 hours (among those who published)
  _Current: __ hours_

### Legal / compliance
- [ ] No prohibited language anywhere on public-facing pages (see `scripts/verify.mjs`)
- [ ] Privacy policy and terms published
- [ ] `npm run verify` passes with 0 failures
  _Current: [passing / failing — N failures]_

---

## Gate 2 — Paid acquisition (run ads, launch campaigns)

All Gate 1 criteria plus:

### Unit economics
- [ ] Average revenue per activated user > $0 (at least some conversions to Pro)
- [ ] Pro conversion rate ≥ 5% of activated users

### Retention signal
- [ ] At least 5 users have come back to the product after their initial session (day-7 retention ≥ 20%)

### Portfolio sharing evidence
- [ ] At least 5 users have shared their portfolio link in a real application or social post (verified via analytics or self-report)

### Support capacity
- [ ] Can handle 5x current user volume without personal founder support needed for core loop issues

---

## Gate 3 — PR / Product Hunt launch

All Gate 1 + Gate 2 criteria plus:

- [ ] 3+ real user testimonials approved for public use (`testimonial_permission = true`)
- [ ] At least 1 user story where portfolio directly contributed to a job interview or offer
- [ ] Analytics confirm organic referral traffic (share rate > 0 from portfolio pages)
- [ ] 100+ total waitlist signups

---

## How to measure this week

Run `beta-dashboard-sql.sql` query #1 (core funnel) and query #7 (feedback summary).  
Compare against each Gate 1 criterion above.  
Update the "Current:" fields in this document weekly.

---

## Last updated: [DATE]

Gate 1 status: NOT MET / PARTIAL / MET  
Gate 2 status: NOT MET / PARTIAL / MET  
Gate 3 status: NOT MET / PARTIAL / MET
