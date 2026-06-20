-- The Stripe webhook handler upserts subscriptions with onConflict: 'user_id', but
-- subscriptions.user_id only ever had a plain index, never a unique constraint. Every
-- upsert silently failed (Postgres error "no unique or exclusion constraint matching
-- ON CONFLICT specification") without the webhook handler checking the result — so
-- every real customer's subscription row was never updated to 'active' after payment.
-- Verified no duplicate user_id rows exist before adding the constraint.

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
