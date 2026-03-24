-- ============================================================================
-- Phase 2: CRM Tables
-- LineMag - Customer tags, action logs, and segmentation
-- ============================================================================

-- --- Customer Tags --------------------------------------------------------

CREATE TABLE customer_tags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tag         text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (customer_id, tag)
);

CREATE INDEX idx_customer_tags_customer_id ON customer_tags (customer_id);
CREATE INDEX idx_customer_tags_tag ON customer_tags (tag);

-- --- Customer Action Event Log --------------------------------------------

CREATE TABLE customer_actions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    action_type   text NOT NULL CHECK (action_type IN (
                      'message_received', 'link_tap', 'purchase',
                      'follow', 'unfollow', 'coupon_use',
                      'reservation', 'page_view'
                  )),
    action_detail jsonb NOT NULL DEFAULT '{}',
    source        text,
    acted_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_actions_customer_id ON customer_actions (customer_id);
CREATE INDEX idx_customer_actions_type ON customer_actions (action_type);
CREATE INDEX idx_customer_actions_acted_at ON customer_actions (acted_at DESC);
CREATE INDEX idx_customer_actions_customer_type ON customer_actions (customer_id, action_type);

-- --- Segment Definitions --------------------------------------------------

CREATE TABLE segments (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name             text NOT NULL,
    description      text,
    type             text NOT NULL CHECK (type IN ('static', 'dynamic')),
    rules            jsonb NOT NULL DEFAULT '[]',
    auto_refresh     boolean NOT NULL DEFAULT false,
    last_computed_at timestamptz,
    customer_count   integer NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- --- Segment Members ------------------------------------------------------

CREATE TABLE segment_members (
    segment_id  uuid NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    added_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (segment_id, customer_id)
);

CREATE INDEX idx_segment_members_customer ON segment_members (customer_id);

-- --- Trigger function to auto-update the updated_at column ----------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_segments_updated_at
    BEFORE UPDATE ON segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- --- Placeholder function to compute segment members ----------------------

CREATE OR REPLACE FUNCTION compute_segment_members(p_segment_id uuid)
RETURNS void AS $$
DECLARE
    v_type text;
BEGIN
    SELECT type INTO v_type FROM segments WHERE id = p_segment_id;

    IF v_type IS NULL THEN
        RAISE EXCEPTION 'Segment % not found', p_segment_id;
    END IF;

    IF v_type = 'static' THEN
        -- Static segments are managed manually; nothing to compute
        NULL;
    ELSE
        -- TODO: Implement dynamic segment rule evaluation in Phase 3
        RAISE NOTICE 'Dynamic segment computation not yet implemented for segment %', p_segment_id;
    END IF;

    -- Update the member count
    UPDATE segments
       SET customer_count   = (SELECT count(*) FROM segment_members WHERE segment_id = p_segment_id),
           last_computed_at = now()
     WHERE id = p_segment_id;
END;
$$ LANGUAGE plpgsql;

-- --- Enable Row Level Security --------------------------------------------

ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_members ENABLE ROW LEVEL SECURITY;

-- Service role gets full access (app connects via admin client)
CREATE POLICY "Service role full access" ON customer_tags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON customer_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON segments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON segment_members FOR ALL TO service_role USING (true) WITH CHECK (true);
