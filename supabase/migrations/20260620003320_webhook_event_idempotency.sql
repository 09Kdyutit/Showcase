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
