-- ============================================================================
-- Phase 4: Marketing Automation, A/B Testing, and Analytics Tables
-- LineMag -- MA scenarios, delivery tracking, KPI snapshots
-- ============================================================================

-- --- MA Scenarios -----------------------------------------------------------
-- trigger_type: 'event' (follow, purchase, etc.), 'schedule' (cron), 'manual'
-- steps: JSON array of step objects, e.g.:
--   [{type:'wait',days:1},{type:'message',templateId:'...',content:{...}},
--    {type:'condition',field:'...',op:'...',value:'...'}]

CREATE TABLE ma_scenarios (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text NOT NULL,
    description       text,
    trigger_type      text NOT NULL CHECK (trigger_type IN ('event', 'schedule', 'manual')),
    trigger_config    jsonb NOT NULL DEFAULT '{}',
    steps             jsonb NOT NULL DEFAULT '[]',
    is_active         boolean NOT NULL DEFAULT false,
    target_segment_id uuid REFERENCES segments(id) ON DELETE SET NULL,
    stats             jsonb NOT NULL DEFAULT '{"sent":0,"opened":0,"clicked":0}',
    last_executed_at  timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ma_scenarios_trigger_type ON ma_scenarios (trigger_type);
CREATE INDEX idx_ma_scenarios_is_active ON ma_scenarios (is_active);
CREATE INDEX idx_ma_scenarios_target_segment_id ON ma_scenarios (target_segment_id);
CREATE INDEX idx_ma_scenarios_last_executed_at ON ma_scenarios (last_executed_at DESC);

-- --- MA Scenario Execution Logs ---------------------------------------------

CREATE TABLE ma_scenario_logs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id  uuid NOT NULL REFERENCES ma_scenarios(id) ON DELETE CASCADE,
    customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    step_index   integer NOT NULL,
    status       text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed', 'pending')),
    detail       jsonb NOT NULL DEFAULT '{}',
    executed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ma_scenario_logs_scenario_id ON ma_scenario_logs (scenario_id);
CREATE INDEX idx_ma_scenario_logs_customer_id ON ma_scenario_logs (customer_id);
CREATE INDEX idx_ma_scenario_logs_status ON ma_scenario_logs (status);
CREATE INDEX idx_ma_scenario_logs_executed_at ON ma_scenario_logs (executed_at DESC);
CREATE INDEX idx_ma_scenario_logs_scenario_customer ON ma_scenario_logs (scenario_id, customer_id);

-- --- A/B Tests --------------------------------------------------------------

CREATE TABLE ab_tests (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text NOT NULL,
    description       text,
    status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'cancelled')),
    test_type         text NOT NULL CHECK (test_type IN ('template', 'content', 'timing', 'segment')),
    variant_a         jsonb NOT NULL DEFAULT '{}',
    variant_b         jsonb NOT NULL DEFAULT '{}',
    target_segment_id uuid REFERENCES segments(id) ON DELETE SET NULL,
    sample_size       integer NOT NULL DEFAULT 100,
    metric            text NOT NULL DEFAULT 'click_rate',
    results           jsonb NOT NULL DEFAULT '{}',
    winner            text CHECK (winner IN ('A', 'B', null)),
    started_at        timestamptz,
    ended_at          timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ab_tests_status ON ab_tests (status);
CREATE INDEX idx_ab_tests_test_type ON ab_tests (test_type);
CREATE INDEX idx_ab_tests_target_segment_id ON ab_tests (target_segment_id);
CREATE INDEX idx_ab_tests_started_at ON ab_tests (started_at DESC);

-- --- A/B Test User Assignments ----------------------------------------------

CREATE TABLE ab_test_assignments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ab_test_id   uuid NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
    customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    variant      text NOT NULL CHECK (variant IN ('A', 'B')),
    delivered_at timestamptz,
    opened_at    timestamptz,
    clicked_at   timestamptz,
    converted_at timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ab_test_id, customer_id)
);

CREATE INDEX idx_ab_test_assignments_ab_test_id ON ab_test_assignments (ab_test_id);
CREATE INDEX idx_ab_test_assignments_customer_id ON ab_test_assignments (customer_id);
CREATE INDEX idx_ab_test_assignments_variant ON ab_test_assignments (variant);
CREATE INDEX idx_ab_test_assignments_test_variant ON ab_test_assignments (ab_test_id, variant);

-- --- Delivery Logs (per-message tracking) -----------------------------------

CREATE TABLE delivery_logs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    broadcast_id uuid REFERENCES broadcasts(id) ON DELETE SET NULL,
    message_type text NOT NULL CHECK (message_type IN ('broadcast', 'push', 'narrowcast', 'scenario', 'ab_test')),
    template_id  text,
    status       text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'failed')),
    metadata     jsonb NOT NULL DEFAULT '{}',
    sent_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_logs_customer_id ON delivery_logs (customer_id);
CREATE INDEX idx_delivery_logs_broadcast_id ON delivery_logs (broadcast_id);
CREATE INDEX idx_delivery_logs_message_type ON delivery_logs (message_type);
CREATE INDEX idx_delivery_logs_status ON delivery_logs (status);
CREATE INDEX idx_delivery_logs_sent_at ON delivery_logs (sent_at DESC);
CREATE INDEX idx_delivery_logs_customer_type ON delivery_logs (customer_id, message_type);

-- --- Analytics Snapshots (for daily batch aggregation) ----------------------

CREATE TABLE analytics_snapshots (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date         date NOT NULL,
    metric_type  text NOT NULL,
    metric_value numeric(14,2) NOT NULL,
    dimensions   jsonb NOT NULL DEFAULT '{}',
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (date, metric_type, dimensions)
);

CREATE INDEX idx_analytics_snapshots_date ON analytics_snapshots (date DESC);
CREATE INDEX idx_analytics_snapshots_metric_type ON analytics_snapshots (metric_type);
CREATE INDEX idx_analytics_snapshots_date_metric ON analytics_snapshots (date, metric_type);

-- --- Auto-update updated_at triggers ---------------------------------------
-- update_updated_at_column() was created in Phase 2

CREATE TRIGGER trg_ma_scenarios_updated_at
    BEFORE UPDATE ON ma_scenarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ab_tests_updated_at
    BEFORE UPDATE ON ab_tests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- --- Enable Row Level Security ----------------------------------------------

ALTER TABLE ma_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ma_scenario_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role gets full access (app connects via admin client)
CREATE POLICY "Service role full access" ON ma_scenarios FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ma_scenario_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ab_tests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ab_test_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON delivery_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON analytics_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
