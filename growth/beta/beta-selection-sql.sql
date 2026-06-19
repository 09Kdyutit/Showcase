-- Beta User Selection Queries
-- Run in Supabase SQL Editor
-- Project: yogwhfrjhcbnvoxitcay
--
-- IMPORTANT: waitlist_signups.status only holds invite lifecycle values:
--   waitlisted | invited | accepted | onboarded | feedback_requested | inactive | unsubscribed
--
-- "Selected" is NOT a status value — it is tracked via selected_at IS NOT NULL + beta_cohort.
-- Product behavior (published, uploaded resume, etc.) is tracked in usage_events.

-- ============================================================
-- 1. Full waitlist with selection scoring
--    Read-only: does not write any status.
-- ============================================================
SELECT
  id,
  email,
  full_name,
  target_role,
  experience_level,
  user_type,
  biggest_challenge,
  current_portfolio_url,
  utm_source,
  utm_medium,
  referral_code,
  status,
  selected_at,
  beta_cohort,
  selection_score,
  created_at,
  -- Urgency score (0-3): prefer people actively searching
  CASE
    WHEN user_type IN ('job_search', 'career_switch') THEN 3
    WHEN user_type IN ('internship') THEN 2
    WHEN user_type IN ('freelance', 'personal_brand') THEN 1
    ELSE 0
  END AS urgency_score,
  -- Articulation score (0-3): non-empty, longer = more genuine
  CASE
    WHEN biggest_challenge IS NULL OR biggest_challenge = '' THEN 0
    WHEN length(biggest_challenge) > 80 THEN 3
    WHEN length(biggest_challenge) > 30 THEN 2
    ELSE 1
  END AS articulation_score,
  -- Portfolio gap score (0-2)
  CASE
    WHEN current_portfolio_url IS NULL OR current_portfolio_url = '' THEN 2
    ELSE 1
  END AS portfolio_gap_score,
  -- Segment fit (0-2)
  CASE
    WHEN experience_level IN ('student', 'new_grad') THEN 2
    WHEN experience_level IN ('early', 'switcher') THEN 2
    WHEN experience_level IN ('mid') THEN 1
    ELSE 0
  END AS segment_score,
  -- Total score
  (
    CASE
      WHEN user_type IN ('job_search', 'career_switch') THEN 3
      WHEN user_type IN ('internship') THEN 2
      WHEN user_type IN ('freelance', 'personal_brand') THEN 1
      ELSE 0
    END
    +
    CASE
      WHEN biggest_challenge IS NULL OR biggest_challenge = '' THEN 0
      WHEN length(biggest_challenge) > 80 THEN 3
      WHEN length(biggest_challenge) > 30 THEN 2
      ELSE 1
    END
    +
    CASE
      WHEN current_portfolio_url IS NULL OR current_portfolio_url = '' THEN 2
      ELSE 1
    END
    +
    CASE
      WHEN experience_level IN ('student', 'new_grad') THEN 2
      WHEN experience_level IN ('early', 'switcher') THEN 2
      WHEN experience_level IN ('mid') THEN 1
      ELSE 0
    END
  ) AS total_score
FROM waitlist_signups
WHERE status = 'waitlisted'
  AND selected_at IS NULL
ORDER BY total_score DESC, created_at ASC;


-- ============================================================
-- 2. Wave 1 candidates (score >= 7, not yet selected, limit 10)
--    Read-only: review these before running query 3.
-- ============================================================
SELECT
  id,
  email,
  full_name,
  target_role,
  experience_level,
  user_type,
  biggest_challenge,
  invite_token,
  (
    CASE WHEN user_type IN ('job_search', 'career_switch') THEN 3
         WHEN user_type IN ('internship') THEN 2
         WHEN user_type IN ('freelance', 'personal_brand') THEN 1
         ELSE 0 END
    +
    CASE WHEN biggest_challenge IS NULL OR biggest_challenge = '' THEN 0
         WHEN length(biggest_challenge) > 80 THEN 3
         WHEN length(biggest_challenge) > 30 THEN 2
         ELSE 1 END
    +
    CASE WHEN current_portfolio_url IS NULL OR current_portfolio_url = '' THEN 2
         ELSE 1 END
    +
    CASE WHEN experience_level IN ('student', 'new_grad') THEN 2
         WHEN experience_level IN ('early', 'switcher') THEN 2
         WHEN experience_level IN ('mid') THEN 1
         ELSE 0 END
  ) AS total_score
FROM waitlist_signups
WHERE status = 'waitlisted'
  AND selected_at IS NULL
HAVING (
    CASE WHEN user_type IN ('job_search', 'career_switch') THEN 3
         WHEN user_type IN ('internship') THEN 2
         WHEN user_type IN ('freelance', 'personal_brand') THEN 1
         ELSE 0 END
    +
    CASE WHEN biggest_challenge IS NULL OR biggest_challenge = '' THEN 0
         WHEN length(biggest_challenge) > 80 THEN 3
         WHEN length(biggest_challenge) > 30 THEN 2
         ELSE 1 END
    +
    CASE WHEN current_portfolio_url IS NULL OR current_portfolio_url = '' THEN 2
         ELSE 1 END
    +
    CASE WHEN experience_level IN ('student', 'new_grad') THEN 2
         WHEN experience_level IN ('early', 'switcher') THEN 2
         WHEN experience_level IN ('mid') THEN 1
         ELSE 0 END
  ) >= 7
ORDER BY total_score DESC, created_at ASC
LIMIT 10;


-- ============================================================
-- 3. Mark as selected (run after reviewing query 2)
--    Sets beta_cohort + selected_at + selection_score.
--    Does NOT change status — status stays 'waitlisted' until invite is sent.
--    Replace the IDs and scores with real values from your review.
-- ============================================================
-- UPDATE waitlist_signups
-- SET
--   beta_cohort     = 'wave-1',
--   selected_at     = now(),
--   selection_score = 8,        -- replace with actual score per person
--   updated_at      = now()
-- WHERE id = 'uuid-here'        -- one statement per person, or use IN for a batch
--   AND status = 'waitlisted';  -- guard: only move waitlisted rows


-- ============================================================
-- 4. Mark as invited (run immediately after sending each invite email)
--    status → 'invited', invited_at set to now.
--    Only run for rows that are selected (selected_at IS NOT NULL).
-- ============================================================
-- UPDATE waitlist_signups
-- SET
--   status     = 'invited',
--   invited_at = now(),
--   updated_at = now()
-- WHERE id IN ('uuid1', 'uuid2', ...)
--   AND selected_at IS NOT NULL
--   AND status = 'waitlisted';


-- ============================================================
-- 5. Invite lifecycle funnel summary
--    Uses only valid status values.
--    Selected = selected_at IS NOT NULL (not a status).
-- ============================================================
SELECT
  count(*) FILTER (WHERE status = 'waitlisted' AND selected_at IS NULL) AS unreviewed,
  count(*) FILTER (WHERE selected_at IS NOT NULL AND status = 'waitlisted') AS selected_pending_invite,
  count(*) FILTER (WHERE status = 'invited') AS invited,
  count(*) FILTER (WHERE status = 'accepted') AS accepted,
  count(*) FILTER (WHERE status = 'onboarded') AS onboarded,
  count(*) FILTER (WHERE status = 'feedback_requested') AS feedback_requested,
  count(*) FILTER (WHERE status = 'inactive') AS inactive,
  count(*) FILTER (WHERE status = 'unsubscribed') AS unsubscribed,
  count(*) AS total
FROM waitlist_signups;


-- ============================================================
-- 6. UTM source breakdown (using accepted status, not invalid statuses)
-- ============================================================
SELECT
  coalesce(utm_source, 'direct') AS source,
  coalesce(utm_medium, '-') AS medium,
  count(*) AS signups,
  count(*) FILTER (WHERE status IN ('accepted', 'onboarded', 'feedback_requested')) AS accepted_invite,
  count(*) FILTER (WHERE status = 'invited') AS currently_invited
FROM waitlist_signups
GROUP BY utm_source, utm_medium
ORDER BY signups DESC;


-- ============================================================
-- 7. Time from invite to account creation (invited → accepted)
--    Uses accepted_at column (added in migration 004) for direct query.
--    Falls back to auth.users join for cases where accepted_at was not set.
-- ============================================================
SELECT
  w.email,
  w.status,
  w.invited_at,
  coalesce(w.accepted_at, u.created_at) AS signed_up_at,
  extract(epoch from (coalesce(w.accepted_at, u.created_at) - w.invited_at)) / 3600 AS hours_to_accept,
  w.beta_cohort,
  w.selection_score
FROM waitlist_signups w
LEFT JOIN auth.users u ON u.email = w.email OR u.id = w.converted_user_id
WHERE w.status IN ('accepted', 'onboarded', 'feedback_requested')
  AND w.invited_at IS NOT NULL
ORDER BY hours_to_accept ASC;
