-- Phase 5: Customer attributes (L-STEP style)

-- 1. Extend customers table with personal info + behavioral attrs
ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name_kana text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS age_group text CHECK (age_group IN ('10s','20s','30s','40s','50s','60plus'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS acquisition_source text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS acquisition_medium text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS acquisition_campaign text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS engagement_score integer NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'new' CHECK (lifecycle_stage IN ('new','active','dormant','churned'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_purchase_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS purchase_count integer NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_purchase_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS reservation_count integer NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS coupon_usage_count integer NOT NULL DEFAULT 0;

-- Indexes on new columns
CREATE INDEX IF NOT EXISTS idx_customers_engagement ON customers (engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_customers_lifecycle ON customers (lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_customers_age_group ON customers (age_group);
CREATE INDEX IF NOT EXISTS idx_customers_acquisition ON customers (acquisition_source);

-- 2. Custom field definitions
CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    field_key text NOT NULL UNIQUE,
    field_type text NOT NULL CHECK (field_type IN ('text','number','date','select','multiselect','boolean')),
    options jsonb NOT NULL DEFAULT '[]',
    is_required boolean NOT NULL DEFAULT false,
    display_order integer NOT NULL DEFAULT 0,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Custom field values (per customer)
CREATE TABLE IF NOT EXISTS custom_field_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    field_id uuid NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    value_text text,
    value_number numeric,
    value_date date,
    value_json jsonb,
    value_boolean boolean,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (customer_id, field_id)
);

CREATE INDEX idx_cfv_customer ON custom_field_values (customer_id);
CREATE INDEX idx_cfv_field ON custom_field_values (field_id);

-- 4. Tag categories
CREATE TABLE IF NOT EXISTS tag_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    color text NOT NULL DEFAULT '#6b7280',
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Add category to existing customer_tags
ALTER TABLE customer_tags ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES tag_categories(id) ON DELETE SET NULL;

-- 6. Tag auto-assign rules
CREATE TABLE IF NOT EXISTS tag_auto_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tag text NOT NULL,
    condition_field text NOT NULL,
    condition_operator text NOT NULL CHECK (condition_operator IN ('eq','neq','gt','lt','gte','lte','contains','in')),
    condition_value jsonb NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_auto_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON custom_field_definitions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON custom_field_values FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tag_categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tag_auto_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Triggers
CREATE TRIGGER update_custom_field_definitions_updated_at
    BEFORE UPDATE ON custom_field_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_field_values_updated_at
    BEFORE UPDATE ON custom_field_values
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
