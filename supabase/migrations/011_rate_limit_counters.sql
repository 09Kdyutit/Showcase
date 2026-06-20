-- Generic atomic rate-limit counter, backed by Postgres so it works correctly across
-- multiple server instances (unlike an in-memory Map, which only protects a single
-- process — exactly the gap in the waitlist IP limiter this replaces). A plain
-- SELECT count() then INSERT has a race: two concurrent requests can both read N
-- before either writes N+1, letting both through even when N+1 exceeds the limit.
-- This function does the read-and-increment as a single atomic statement.

CREATE TABLE public.rate_limit_counters (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- Service-role only — accessed exclusively through the rate_limit_increment() function
-- below, never directly by end users.

CREATE OR REPLACE FUNCTION public.rate_limit_increment(
  p_key TEXT,
  p_window_seconds INTEGER,
  p_max INTEGER
) RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  INSERT INTO public.rate_limit_counters (key, count, window_start)
  VALUES (p_key, 1, NOW())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limit_counters.window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL
      THEN 1
      ELSE public.rate_limit_counters.count + 1
    END,
    window_start = CASE
      WHEN public.rate_limit_counters.window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL
      THEN NOW()
      ELSE public.rate_limit_counters.window_start
    END
  RETURNING public.rate_limit_counters.count, public.rate_limit_counters.window_start
  INTO v_count, v_window_start;

  RETURN QUERY SELECT
    v_count <= p_max,
    v_count,
    GREATEST(0, p_window_seconds - EXTRACT(EPOCH FROM (NOW() - v_window_start))::INTEGER);
END;
$$;
