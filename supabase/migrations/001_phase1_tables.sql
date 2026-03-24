-- Phase 1: Foundation tables
-- LineMag: File-based to Supabase migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sent URLs (tracks which article URLs have been broadcast)
CREATE TABLE sent_urls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sent_urls_url ON sent_urls (url);
CREATE INDEX idx_sent_urls_created_at ON sent_urls (created_at DESC);

-- Broadcasts (delivery history)
CREATE TABLE broadcasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url text NOT NULL,
    title text NOT NULL,
    template_id text,
    status text NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    error_message text,
    sent_at timestamptz NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcasts_sent_at ON broadcasts (sent_at DESC);
CREATE INDEX idx_broadcasts_status ON broadcasts (status);
CREATE INDEX idx_broadcasts_url ON broadcasts (url);

-- Schedules (delivery schedule config)
CREATE TABLE schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE DEFAULT 'default',
    enabled boolean NOT NULL DEFAULT false,
    times text[] NOT NULL DEFAULT '{}',
    template_id text NOT NULL DEFAULT 'daily-column',
    max_articles_per_run integer NOT NULL DEFAULT 3,
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Execution logs
CREATE TABLE execution_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    step text NOT NULL CHECK (step IN ('SCRAPE', 'SUMMARIZE', 'BROADCAST', 'CRON')),
    result text NOT NULL CHECK (result IN ('SUCCESS', 'ERROR', 'SKIP')),
    detail text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_execution_logs_executed_at ON execution_logs (executed_at DESC);
CREATE INDEX idx_execution_logs_step ON execution_logs (step);
CREATE INDEX idx_execution_logs_result ON execution_logs (result);
CREATE INDEX idx_execution_logs_step_executed ON execution_logs (step, executed_at DESC);

-- Error tracking
CREATE TABLE error_trackings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE DEFAULT 'default',
    consecutive_errors integer NOT NULL DEFAULT 0,
    last_error_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Customers (user profiles)
CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id text NOT NULL UNIQUE,
    display_name text,
    picture_url text,
    status_message text,
    email text,
    phone text,
    gender text CHECK (gender IN ('male', 'female', 'other')),
    birth_date date,
    prefecture text,
    membership_tier text NOT NULL DEFAULT 'free' CHECK (membership_tier IN ('free', 'silver', 'gold', 'platinum')),
    message_count integer NOT NULL DEFAULT 0,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    blocked_at timestamptz,
    attributes jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_customers_line_user_id ON customers (line_user_id);
CREATE INDEX idx_customers_membership_tier ON customers (membership_tier);
CREATE INDEX idx_customers_prefecture ON customers (prefecture);
CREATE INDEX idx_customers_blocked_at ON customers (blocked_at) WHERE blocked_at IS NULL;
CREATE INDEX idx_customers_last_seen_at ON customers (last_seen_at DESC);
CREATE INDEX idx_customers_attributes ON customers USING GIN (attributes);

-- RPC: Atomic increment of consecutive errors
CREATE OR REPLACE FUNCTION increment_consecutive_errors(p_key text DEFAULT 'default')
RETURNS integer AS $$
DECLARE
    new_count integer;
BEGIN
    INSERT INTO error_trackings (key, consecutive_errors, last_error_at, updated_at)
    VALUES (p_key, 1, now(), now())
    ON CONFLICT (key) DO UPDATE
        SET consecutive_errors = error_trackings.consecutive_errors + 1,
            last_error_at = now(),
            updated_at = now()
    RETURNING consecutive_errors INTO new_count;
    RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on all tables
ALTER TABLE sent_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_trackings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS policies: service_role full access
CREATE POLICY "Service role full access" ON sent_urls FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON broadcasts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON execution_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON error_trackings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON customers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed data
INSERT INTO schedules (key, enabled, times, template_id, max_articles_per_run)
VALUES ('default', false, ARRAY['09:00', '18:00'], 'daily-column', 3);

INSERT INTO error_trackings (key, consecutive_errors)
VALUES ('default', 0);
