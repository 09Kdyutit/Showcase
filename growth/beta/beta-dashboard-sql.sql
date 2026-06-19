-- Beta Dashboard SQL Queries
-- Run weekly in Supabase SQL Editor
-- Project: yogwhfrjhcbnvoxitcay
--
-- DATA MODEL:
--   waitlist_signups.status = invite lifecycle only
--     valid values: waitlisted | invited | accepted | onboarded |
--                   feedback_requested | inactive | unsubscribed
--   selected = selected_at IS NOT NULL (not a status value)
--   product behavior = usage_events (never stored on waitlist_signups)

-- ============================================================
-- 1. INVITE LIFECYCLE FUNNEL
--    All counts use valid status values only.
-- ============================================================
SELECT
  count(*) FILTER (WHERE status = 'waitlisted' AND selected_at IS NULL)     AS unreviewed,
  count(*) FILTER (WHERE selected_at IS NOT NULL AND status = 'waitlisted')  AS selected_pending_invite,
  count(*) FILTER (WHERE status = 'invited')                                  AS invited,
  count(*) FILTER (WHERE status = 'accepted')                                 AS accepted,
  count(*) FILTER (WHERE status = 'onboarded')                                AS onboarded,
  count(*) FILTER (WHERE status = 'feedback_requested')                       AS feedback_requested,
  count(*) FILTER (WHERE status = 'inactive')                                 AS inactive,
  count(*) FILTER (WHERE status = 'unsubscribed')                             AS unsubscribed,
  -- Invite lifecycle conversion rates
  round(
    count(*) FILTER (WHERE status IN ('accepted','onboarded','feedback_requested')) * 100.0
    / nullif(count(*) FILTER (WHERE status IN ('invited','accepted','onboarded','feedback_requested','inactive')), 0)
  , 1) AS invite_to_accept_pct,
  round(
    count(*) FILTER (WHERE status IN ('onboarded','feedback_requested')) * 100.0
    / nullif(count(*) FILTER (WHERE status IN ('accepted','onboarded','feedback_requested')), 0)
  , 1) AS accept_to_onboard_pct
FROM waitlist_signups;


-- ============================================================
-- 2. PRODUCT CORE LOOP — How far did each user get?
--    Joins auth.users → usage_events to derive product behavior.
--    Does NOT read waitlist_signups.status for product state.
-- ============================================================
SELECT
  u.email,
  u.created_at                                                          AS signup_date,
  w.beta_cohort,
  w.status                                                              AS invite_status,
  -- Product loop milestones (from usage_events)
  max(CASE WHEN ue.event_name IN ('resume_uploaded','resume_pasted','resume_parsed') THEN ue.created_at END) AS resume_started_at,
  max(CASE WHEN ue.event_name = 'resume_parsed'          THEN ue.created_at END)  AS resume_parsed_at,
  max(CASE WHEN ue.event_name = 'portfolio_generated'    THEN ue.created_at END)  AS portfolio_generated_at,
  max(CASE WHEN ue.event_name = 'proofscore_completed'   THEN ue.created_at END)  AS proofscore_at,
  max(CASE WHEN ue.event_name = 'portfolio_edit_saved'   THEN ue.created_at END)  AS last_edit_at,
  max(CASE WHEN ue.event_name = 'portfolio_published'    THEN ue.created_at END)  AS published_at,
  max(CASE WHEN ue.event_name = 'feedback_submitted'     THEN ue.created_at END)  AS feedback_at,
  -- Derived stage label (product loop, not DB status)
  CASE
    WHEN bool_or(ue.event_name = 'feedback_submitted')     THEN 'submitted_feedback'
    WHEN bool_or(ue.event_name = 'portfolio_published')    THEN 'published'
    WHEN bool_or(ue.event_name = 'portfolio_edit_saved')   THEN 'edited'
    WHEN bool_or(ue.event_name = 'proofscore_completed')   THEN 'proofscore_done'
    WHEN bool_or(ue.event_name = 'portfolio_generated')    THEN 'generated'
    WHEN bool_or(ue.event_name IN ('resume_uploaded','resume_pasted','resume_parsed')) THEN 'resume_started'
    ELSE 'signed_up_only'
  END AS product_stage
FROM auth.users u
LEFT JOIN waitlist_signups w ON w.email = u.email OR w.converted_user_id = u.id
LEFT JOIN usage_events ue ON ue.user_id = u.id
GROUP BY u.id, u.email, u.created_at, w.beta_cohort, w.status
ORDER BY u.created_at DESC;


-- ============================================================
-- 3. PUBLISH RATE — THE ONE METRIC THAT MATTERS
--    Users who published / users who generated / users who signed up.
-- ============================================================
WITH user_events AS (
  SELECT
    u.id,
    bool_or(ue.event_name = 'portfolio_published')                     AS published,
    bool_or(ue.event_name = 'portfolio_generated')                     AS generated,
    bool_or(ue.event_name IN ('resume_uploaded','resume_pasted','resume_parsed')) AS started_resume
  FROM auth.users u
  LEFT JOIN usage_events ue ON ue.user_id = u.id
  GROUP BY u.id
)
SELECT
  count(*) FILTER (WHERE started_resume) AS users_started_resume,
  count(*) FILTER (WHERE generated)      AS users_generated_portfolio,
  count(*) FILTER (WHERE published)      AS users_published_portfolio,
  count(*)                               AS total_users,
  round(count(*) FILTER (WHERE published) * 100.0 / nullif(count(*) FILTER (WHERE generated), 0), 1)  AS generate_to_publish_pct,
  round(count(*) FILTER (WHERE published) * 100.0 / nullif(count(*), 0), 1)                            AS overall_publish_rate_pct
FROM user_events;


-- ============================================================
-- 4. BETA PASS CRITERIA CHECK
--    Criteria to declare beta complete and open growth mode.
--    See growth/beta/phase-gate.md for full definitions.
-- ============================================================
WITH invite_counts AS (
  SELECT count(*) FILTER (WHERE status = 'invited') AS invited
  FROM waitlist_signups
),
product_counts AS (
  SELECT
    count(DISTINCT user_id) FILTER (WHERE event_name = 'portfolio_published') AS published,
    count(DISTINCT user_id) FILTER (
      WHERE event_name IN ('resume_uploaded','resume_pasted','resume_parsed')
    ) AS started_resume
  FROM usage_events
),
full_loop_users AS (
  -- Full beta loop = resume started + portfolio generated + proofscore + edit + published + feedback
  SELECT user_id
  FROM usage_events
  GROUP BY user_id
  HAVING
    bool_or(event_name IN ('resume_uploaded','resume_pasted','resume_parsed')) AND
    bool_or(event_name = 'portfolio_generated') AND
    bool_or(event_name = 'proofscore_completed') AND
    bool_or(event_name = 'portfolio_edit_saved') AND
    bool_or(event_name = 'portfolio_published') AND
    bool_or(event_name = 'feedback_submitted')
),
feedback_counts AS (
  SELECT
    count(*) FILTER (WHERE would_recommend = true)  AS would_recommend,
    count(*) FILTER (WHERE sent_to_recruiter = true) AS sent_to_recruiter
  FROM beta_feedback
)
SELECT
  i.invited,
  p.published,
  (SELECT count(*) FROM full_loop_users) AS completed_full_loop,
  f.would_recommend,
  f.sent_to_recruiter,
  -- Gate 1 criteria (from phase-gate.md)
  CASE WHEN i.invited >= 20 THEN '✅' ELSE '❌' END AS gate_20_invited,
  CASE WHEN (SELECT count(*) FROM full_loop_users) >= 10 THEN '✅' ELSE '❌' END AS gate_10_full_loop,
  CASE WHEN p.published * 100.0 / nullif(p.started_resume, 0) >= 50 THEN '✅' ELSE '❌' END AS gate_publish_rate_50pct,
  CASE WHEN f.would_recommend >= 5 THEN '✅' ELSE '❌' END AS gate_5_useful,
  CASE WHEN f.sent_to_recruiter >= 5 THEN '✅' ELSE '❌' END AS gate_5_sent_recruiter
FROM invite_counts i, product_counts p, feedback_counts f;


-- ============================================================
-- 5. DAILY EVENTS — What's happening day by day
-- ============================================================
SELECT
  date_trunc('day', created_at)::date AS day,
  event_name,
  count(*) AS events
FROM usage_events
WHERE created_at > now() - interval '30 days'
GROUP BY day, event_name
ORDER BY day DESC, events DESC;


-- ============================================================
-- 6. TIME TO PUBLISH — How fast do users go from signup to published?
-- ============================================================
SELECT
  u.email,
  w.beta_cohort,
  u.created_at                                                         AS signup_at,
  min(ue_pub.created_at)                                               AS first_publish_at,
  extract(epoch from (min(ue_pub.created_at) - u.created_at)) / 3600  AS hours_to_first_publish
FROM auth.users u
JOIN usage_events ue_pub
  ON ue_pub.user_id = u.id AND ue_pub.event_name = 'portfolio_published'
LEFT JOIN waitlist_signups w
  ON w.email = u.email OR w.converted_user_id = u.id
GROUP BY u.id, u.email, u.created_at, w.beta_cohort
ORDER BY hours_to_first_publish ASC;


-- ============================================================
-- 7. DROP-OFF ANALYSIS — Who started but didn't publish after 2+ days?
-- ============================================================
SELECT
  u.email,
  u.created_at,
  w.beta_cohort,
  w.status                                                             AS invite_status,
  bool_or(ue.event_name IN ('resume_uploaded','resume_pasted','resume_parsed')) AS did_resume,
  bool_or(ue.event_name = 'portfolio_generated')                       AS did_generate,
  bool_or(ue.event_name = 'portfolio_published')                       AS did_publish,
  extract(epoch from (now() - u.created_at)) / 86400                  AS days_since_signup,
  max(ue.created_at)                                                   AS last_active_at
FROM auth.users u
LEFT JOIN waitlist_signups w ON w.email = u.email OR w.converted_user_id = u.id
LEFT JOIN usage_events ue ON ue.user_id = u.id
GROUP BY u.id, u.email, u.created_at, w.beta_cohort, w.status
HAVING
  NOT bool_or(ue.event_name = 'portfolio_published') AND
  extract(epoch from (now() - u.created_at)) / 86400 > 2
ORDER BY days_since_signup DESC;


-- ============================================================
-- 8. FEEDBACK SUMMARY — Qualitative health signal
-- ============================================================
SELECT
  count(*)                                                             AS total_responses,
  round(avg(rating), 2)                                                AS avg_rating,
  count(*) FILTER (WHERE rating >= 7)                                  AS positive_ratings,
  count(*) FILTER (WHERE rating <= 4)                                  AS negative_ratings,
  count(*) FILTER (WHERE would_recommend = true)                       AS would_recommend,
  count(*) FILTER (WHERE published_portfolio = true)                   AS self_reported_published,
  count(*) FILTER (WHERE sent_to_recruiter = true)                     AS sent_to_recruiter,
  count(*) FILTER (WHERE testimonial_permission = true)                AS testimonial_ok,
  count(*) FILTER (WHERE followup_permission = true)                   AS followup_ok
FROM beta_feedback;


-- ============================================================
-- 9. PROOFSCORE DISTRIBUTION
-- ============================================================
SELECT
  overall_score,
  audit_type,
  count(*) AS audits
FROM audits
GROUP BY overall_score, audit_type
ORDER BY overall_score DESC;


-- ============================================================
-- 10. WEEKLY COHORT — Did they come back after first session?
-- ============================================================
SELECT
  date_trunc('week', u.created_at)::date AS cohort_week,
  w.beta_cohort,
  count(DISTINCT u.id)                   AS users_signed_up,
  count(DISTINCT ue.user_id) FILTER (
    WHERE ue.created_at > u.created_at + interval '7 days'
  )                                      AS returned_week2,
  count(DISTINCT ue.user_id) FILTER (
    WHERE ue.event_name = 'portfolio_published'
  )                                      AS published
FROM auth.users u
LEFT JOIN waitlist_signups w ON w.email = u.email OR w.converted_user_id = u.id
LEFT JOIN usage_events ue ON ue.user_id = u.id
GROUP BY cohort_week, w.beta_cohort
ORDER BY cohort_week DESC;
