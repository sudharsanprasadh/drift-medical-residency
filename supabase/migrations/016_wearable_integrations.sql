-- ============================================
-- WEARABLE CONNECTIONS TABLE
-- Provider-agnostic OAuth connection storage.
-- 'provider' is a free-text discriminator ('fitbit' today; 'garmin' /
-- 'oura' / 'health_connect' etc. can be added later without a schema change).
-- ============================================
CREATE TABLE wearable_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    scopes TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

CREATE INDEX idx_wearable_connections_user ON wearable_connections(user_id);

-- ============================================
-- WELLNESS METRICS TABLE
-- One row per resident/provider/day. raw_payload keeps the full API
-- response so later phases can pull additional fields without a migration.
-- ============================================
CREATE TABLE wellness_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    metric_date DATE NOT NULL,
    resting_heart_rate INTEGER,
    sleep_minutes INTEGER,
    sleep_efficiency INTEGER,
    steps INTEGER,
    raw_payload JSONB,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider, metric_date)
);

CREATE INDEX idx_wellness_metrics_user_date ON wellness_metrics(user_id, metric_date DESC);

-- ============================================
-- TRIGGERS (reuses update_updated_at_column() from 001_initial_schema.sql)
-- ============================================
CREATE TRIGGER update_wearable_connections_updated_at BEFORE UPDATE ON wearable_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wellness_metrics_updated_at BEFORE UPDATE ON wellness_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- Owner-only, no admin/chief bypass: unlike profiles, these rows hold
-- OAuth tokens and personal health data that belong to the resident alone.
-- A future chief-visible aggregate burnout score should live in its own
-- purpose-built table/view, not via wider RLS on raw tokens/metrics.
-- ============================================
ALTER TABLE wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wearable connections" ON wearable_connections
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own wellness metrics" ON wellness_metrics
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
