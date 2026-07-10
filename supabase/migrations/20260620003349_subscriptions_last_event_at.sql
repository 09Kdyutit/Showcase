-- Out-of-order delivery guard: Stripe does not guarantee webhook delivery order. Without
-- this, a delayed/retried older event could overwrite a subscription with stale status
-- after a newer event already applied the correct one. last_webhook_event_at stores the
-- Stripe-side event.created timestamp of whichever event last actually wrote this row.
ALTER TABLE public.subscriptions
  ADD COLUMN last_webhook_event_at TIMESTAMPTZ;
