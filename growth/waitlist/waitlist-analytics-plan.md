# Showcase Waitlist Analytics Plan

## Events to track

All events stored on waitlist_signups via UTM fields. No external analytics required for beta.

### Captured automatically on signup
- `utm_source` — where traffic came from (twitter, linkedin, reddit, direct)
- `utm_medium` — channel type (social, organic, referral, email)
- `utm_campaign` — campaign name (beta-launch, v1-waitlist)
- `utm_content` — specific creative or post variant
- `referral_code` — which existing user referred them
- `referrer` — document.referrer from browser
- `source` — hardcoded to 'waitlist_page' for all /waitlist submissions

### What to watch in Supabase

Query to get signup volume by day:
```sql
select date_trunc('day', created_at) as day, count(*) as signups
from waitlist_signups
group by 1 order by 1 desc;
```

Query to see top sources:
```sql
select utm_source, count(*) as signups
from waitlist_signups
where utm_source is not null
group by 1 order by 2 desc;
```

Query to see experience level mix:
```sql
select experience_level, count(*) as signups
from waitlist_signups
group by 1 order by 2 desc;
```

Query to see biggest challenges:
```sql
select biggest_challenge, count(*) as signups
from waitlist_signups
where biggest_challenge is not null
group by 1 order by 2 desc;
```

Query to see referral performance:
```sql
select referral_code, count(*) as referrals
from waitlist_signups
where referral_code is not null
group by 1 order by 2 desc;
```

## UTM link format

Use this format for all shared links:

```
/waitlist?utm_source=twitter&utm_medium=social&utm_campaign=beta-launch
/waitlist?utm_source=linkedin&utm_medium=social&utm_campaign=beta-launch
/waitlist?utm_source=reddit&utm_medium=community&utm_campaign=beta-launch
/waitlist?utm_source=direct&utm_medium=organic
```

## Referral tracking

Each signup gets a unique referral_code (e.g. ALEXC7F).

Share link format: `/waitlist?ref=ALEXC7F`

When someone signs up via a referral link, their record includes the code. Query to see which referrers convert best:
```sql
select ws.referral_code as referrer_code, count(*) as referred_signups
from waitlist_signups referred
join waitlist_signups ws on ws.referral_code = referred.referral_code
group by 1 order by 2 desc;
```

Note: current implementation stores the ref param as referral_code on the new signup. To track full referral chains, add a `referred_by_code` column in a future migration.

## Status funnel

Track how users move through the funnel:
```sql
select status, count(*) as count
from waitlist_signups
group by 1 order by 2 desc;
```

Target funnel:
- waitlisted → invited: aim for 100% of active batch
- invited → accepted (created account): target >40%
- accepted → onboarded (completed first portfolio): target >60%
- onboarded → feedback_requested: all who complete a portfolio
- feedback_requested → submitted feedback: target >30%

## Metrics to watch for beta health

1. Signup rate: waitlist submissions per day
2. Form completion rate: how many start vs submit the form
3. Context fill rate: % who fill experience_level, user_type, biggest_challenge
4. Referral rate: % of signups via referral links
5. Invite acceptance rate: % of invited users who create an account
6. Onboarding completion: % who complete a portfolio after signup
7. Feedback submission rate: % of onboarded users who fill feedback form
8. Feedback rating average: ProofScore average from beta_feedback.rating

## No third-party analytics needed for beta

UTM fields on waitlist_signups are sufficient for launch decisions.

When V1 goes public, consider adding:
- PostHog (open source, privacy-first)
- Plausible (simple, no cookie banner needed)

Do NOT add Google Analytics without legal review — requires cookie consent in EU.
