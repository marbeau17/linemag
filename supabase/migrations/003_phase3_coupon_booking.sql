-- ============================================================================
-- Phase 3: Coupon and Booking tables
-- LineMag - Coupon management and consultation booking
-- ============================================================================

-- --- Coupon Masters --------------------------------------------------------

CREATE TABLE coupon_masters (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                  text NOT NULL UNIQUE,
    name                  text NOT NULL,
    description           text,
    discount_type         text NOT NULL CHECK (discount_type IN ('fixed', 'percentage', 'free_shipping')),
    discount_value        numeric(10,2) NOT NULL,
    min_purchase_amount   numeric(10,2) DEFAULT 0,
    max_issues            integer,
    max_uses_per_customer integer NOT NULL DEFAULT 1,
    valid_from            timestamptz NOT NULL,
    valid_until           timestamptz NOT NULL,
    is_active             boolean NOT NULL DEFAULT true,
    target_segment_id     uuid REFERENCES segments(id) ON DELETE SET NULL,
    metadata              jsonb NOT NULL DEFAULT '{}',
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_period CHECK (valid_until > valid_from),
    CONSTRAINT valid_discount CHECK (
        (discount_type = 'percentage' AND discount_value > 0 AND discount_value <= 100)
        OR (discount_type = 'fixed' AND discount_value > 0)
        OR (discount_type = 'free_shipping' AND discount_value = 0)
    )
);

CREATE INDEX idx_coupon_masters_code ON coupon_masters (code);
CREATE INDEX idx_coupon_masters_is_active ON coupon_masters (is_active);
CREATE INDEX idx_coupon_masters_valid_from ON coupon_masters (valid_from);
CREATE INDEX idx_coupon_masters_valid_until ON coupon_masters (valid_until);
CREATE INDEX idx_coupon_masters_target_segment_id ON coupon_masters (target_segment_id);
CREATE INDEX idx_coupon_masters_discount_type ON coupon_masters (discount_type);

-- --- Coupon Issues ---------------------------------------------------------

CREATE TABLE coupon_issues (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_master_id uuid NOT NULL REFERENCES coupon_masters(id) ON DELETE RESTRICT,
    customer_id      uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    issue_code       text NOT NULL UNIQUE,
    status           text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'used', 'expired', 'revoked')),
    issued_at        timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz NOT NULL,
    used_at          timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupon_issues_coupon_master_id ON coupon_issues (coupon_master_id);
CREATE INDEX idx_coupon_issues_customer_id ON coupon_issues (customer_id);
CREATE INDEX idx_coupon_issues_issue_code ON coupon_issues (issue_code);
CREATE INDEX idx_coupon_issues_status ON coupon_issues (status);
CREATE INDEX idx_coupon_issues_expires_at ON coupon_issues (expires_at);
CREATE INDEX idx_coupon_issues_customer_status ON coupon_issues (customer_id, status);

-- --- Coupon Usages (redemption history) ------------------------------------

CREATE TABLE coupon_usages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_issue_id uuid NOT NULL REFERENCES coupon_issues(id) ON DELETE RESTRICT,
    customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    discount_amount numeric(10,2) NOT NULL,
    used_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupon_usages_coupon_issue_id ON coupon_usages (coupon_issue_id);
CREATE INDEX idx_coupon_usages_customer_id ON coupon_usages (customer_id);
CREATE INDEX idx_coupon_usages_used_at ON coupon_usages (used_at DESC);

-- --- Consultants -----------------------------------------------------------

CREATE TABLE consultants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    email           text NOT NULL UNIQUE,
    meet_url        text NOT NULL,
    specialties     text[] NOT NULL DEFAULT '{}',
    is_active       boolean NOT NULL DEFAULT true,
    max_daily_slots integer NOT NULL DEFAULT 8,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consultants_email ON consultants (email);
CREATE INDEX idx_consultants_is_active ON consultants (is_active);
CREATE INDEX idx_consultants_specialties ON consultants USING GIN (specialties);

-- --- Booking Settings ------------------------------------------------------

CREATE TABLE booking_settings (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key              text NOT NULL UNIQUE DEFAULT 'default',
    business_hours   jsonb NOT NULL DEFAULT '{"mon":{"start":"09:00","end":"18:00"},"tue":{"start":"09:00","end":"18:00"},"wed":{"start":"09:00","end":"18:00"},"thu":{"start":"09:00","end":"18:00"},"fri":{"start":"09:00","end":"18:00"}}',
    slot_durations   integer[] NOT NULL DEFAULT '{30,60}',
    buffer_minutes   integer NOT NULL DEFAULT 10,
    max_advance_days integer NOT NULL DEFAULT 30,
    holidays         jsonb NOT NULL DEFAULT '[]',
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- --- Time Slots ------------------------------------------------------------

CREATE TABLE time_slots (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultant_id    uuid NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
    date             date NOT NULL,
    start_time       time NOT NULL,
    end_time         time NOT NULL,
    duration_minutes integer NOT NULL CHECK (duration_minutes IN (30, 60)),
    is_available     boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (consultant_id, date, start_time)
);

CREATE INDEX idx_time_slots_consultant_id ON time_slots (consultant_id);
CREATE INDEX idx_time_slots_date ON time_slots (date);
CREATE INDEX idx_time_slots_is_available ON time_slots (is_available) WHERE is_available = true;
CREATE INDEX idx_time_slots_consultant_date ON time_slots (consultant_id, date);

-- --- Reservations ----------------------------------------------------------

CREATE TABLE reservations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    time_slot_id     uuid NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
    consultant_id    uuid NOT NULL REFERENCES consultants(id) ON DELETE RESTRICT,
    status           text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'reminded', 'completed', 'cancelled', 'no_show')),
    service_type     text DEFAULT 'general',
    notes            text,
    meet_url         text,
    reminder_sent_at timestamptz,
    cancelled_at     timestamptz,
    completed_at     timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_customer_id ON reservations (customer_id);
CREATE INDEX idx_reservations_time_slot_id ON reservations (time_slot_id);
CREATE INDEX idx_reservations_consultant_id ON reservations (consultant_id);
CREATE INDEX idx_reservations_status ON reservations (status);
CREATE INDEX idx_reservations_service_type ON reservations (service_type);
CREATE INDEX idx_reservations_customer_status ON reservations (customer_id, status);

-- --- updated_at auto-update triggers --------------------------------------
-- update_updated_at_column() was created in Phase 2

CREATE TRIGGER trg_coupon_masters_updated_at
    BEFORE UPDATE ON coupon_masters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_consultants_updated_at
    BEFORE UPDATE ON consultants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_booking_settings_updated_at
    BEFORE UPDATE ON booking_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- --- Enable Row Level Security ---------------------------------------------

ALTER TABLE coupon_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- --- RLS Policies: service_role gets full access (app uses admin client) ---

CREATE POLICY "Service role full access" ON coupon_masters FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON coupon_issues FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON coupon_usages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON consultants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON booking_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON time_slots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON reservations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- --- Seed data -------------------------------------------------------------

INSERT INTO booking_settings (key) VALUES ('default');
