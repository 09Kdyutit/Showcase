# Beta Status Definitions

This file defines the two separate tracking systems:

- **`waitlist_signups.status`** — invite lifecycle only (DB-enforced constraint)
- **Product loop state** — derived from `usage_events` (never stored on `waitlist_signups`)

These must never be mixed. The DB check constraint will reject any write that uses an invalid status value.

---

## A. `waitlist_signups.status` — invite lifecycle

The check constraint on `waitlist_signups.status` allows exactly these values:

| Status | Meaning | Set when |
|--------|---------|----------|
| `waitlisted` | Joined waitlist, not yet reviewed | Default on insert |
| `invited` | Invite email sent | After sending invite email |
| `accepted` | Created a Showcase account | After signup confirmed |
| `onboarded` | Completed onboarding / started product loop | After first meaningful product action |
| `feedback_requested` | Feedback request email sent | After `portfolio_published` event observed |
| `inactive` | No response after 2 follow-ups, or explicitly inactive | After final follow-up with no response |
| `unsubscribed` | Asked not to be contacted | Immediately on request |

**Do not use any other value.** The DB constraint will throw an error.

### Selection state (not a status)

Selecting someone for a cohort does not change their `status` field.  
It sets columns added in migration 004:

| Column | Meaning |
|--------|---------|
| `beta_cohort` | Wave identifier, e.g. `wave-1`, `wave-2` |
| `selection_score` | Numeric score 0–10 from the selection rubric |
| `selected_at` | When they were marked for a cohort |
| `accepted_at` | Mirror of signup time (set after account confirmed) |
| `onboarded_at` | When they completed onboarding |

A user is "selected" when `selected_at IS NOT NULL`.  
A user is "invited" when `status = 'invited'`.  
These are sequential: `selected_at` comes first, then `status → invited` when the email is sent.

---

## B. Product loop state

Product behavior is **never** stored in `waitlist_signups.status`.  
It is derived from `usage_events` by joining `waitlist_signups → auth.users → usage_events`.

| Derived state | How to detect |
|--------------|---------------|
| `signed_up` | `waitlist_signups.converted_user_id IS NOT NULL` or join on email |
| `uploaded_resume` | `usage_events.event_name IN ('resume_uploaded', 'resume_pasted', 'resume_parsed')` |
| `generated_portfolio` | `usage_events.event_name = 'portfolio_generated'` |
| `completed_proofscore` | `usage_events.event_name = 'proofscore_completed'` |
| `edited_portfolio` | `usage_events.event_name = 'portfolio_edit_saved'` |
| **`published_portfolio`** | `usage_events.event_name = 'portfolio_published'` ← THE WIN |
| `submitted_feedback` | `usage_events.event_name = 'feedback_submitted'` OR row in `beta_feedback` |

---

## C. The full join path for dashboard queries

```sql
-- Link waitlist → auth user → usage events
waitlist_signups w
LEFT JOIN auth.users u
  ON u.email = w.email
  OR u.id = w.converted_user_id
LEFT JOIN usage_events ue
  ON ue.user_id = u.id
```

---

## D. Status transition lifecycle

```
[signup]
  waitlisted
    ↓ (manual review, set selected_at + beta_cohort)
  still waitlisted, but selected_at IS NOT NULL
    ↓ (invite email sent)
  invited
    ↓ (user creates account)
  accepted           ← also set accepted_at, converted_user_id
    ↓ (user starts using product)
  onboarded          ← also set onboarded_at
    ↓ (portfolio_published event fires, feedback email sent)
  feedback_requested
    ↓ (no further contact needed)
  [terminal]
```

Parallel exits at any stage:
- `inactive` — no response after 2 follow-ups
- `unsubscribed` — explicitly requested removal

---

## E. DO NOT confuse

| Wrong (old docs) | Correct |
|-----------------|---------|
| `status = 'selected'` | `selected_at IS NOT NULL` |
| `status = 'activated'` | `status = 'accepted'` |
| `status = 'published'` | join `usage_events` for `portfolio_published` |
| `status = 'completed'` | join `usage_events` for `feedback_submitted` |
| `status = 'declined'` | `status = 'inactive'` or `status = 'unsubscribed'` |
| `status = 'bounced'` | `status = 'inactive'` |
