-- ============================================
-- INTRADAY HEART RATE SERIES
-- 5-minute rollup buckets for the day, so the hero chart on the Wellness
-- screen works for past days from Supabase without re-hitting Google
-- Health API each time (same reasoning as raw_payload on this table).
-- ============================================
ALTER TABLE wellness_metrics
    ADD COLUMN heart_rate_series JSONB;
