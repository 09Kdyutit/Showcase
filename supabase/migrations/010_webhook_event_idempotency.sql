-- Stripe can and does deliver the same webhook event more than once (retries, replays).
-- The handler previously had no idempotency tracking at all — a duplicate
-- customer.subscription.updated could re-apply harmlessly, but a duplicate or
-- out-of-order delivery for a sequence of events (e.g. subscription.updated followed
-- much later by a replayed earlier subscription.updated) could overwrite a newer
-- status with a stale one. This table makes "have we already processed this exact
-- event id" a real, atomic, race-safe check instead of an assumption.

CREATE TABLE public.processed_webhook_events (
  event_id    TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- Service-role only — no end-user ever has a reason to read or write this table.
-- (No policies created means RLS denies all access except service-role, which bypasses RLS.)

-- Out-of-order delivery guard: Stripe does not guarantee webhook delivery order. Without
-- this, a delayed/retried older event could overwrite a subscription with stale status
-- after a newer event already applied the correct one. last_webhook_event_at stores the
-- Stripe-side event.created timestamp of whichever event last actually wrote this row.
ALTER TABLE public.subscriptions
  ADD COLUMN last_webhook_event_at TIMESTAMPTZ;
