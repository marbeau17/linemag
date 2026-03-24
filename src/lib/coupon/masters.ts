import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CouponMaster {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: 'fixed' | 'percentage' | 'free_shipping';
  discountValue: number;
  minPurchaseAmount: number;
  maxIssues: number | null;
  maxUsesPerCustomer: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  targetSegmentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string;
  discountType: 'fixed' | 'percentage' | 'free_shipping';
  discountValue: number;
  minPurchaseAmount?: number;
  maxIssues?: number;
  maxUsesPerCustomer?: number;
  validFrom: string;
  validUntil: string;
  targetSegmentId?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// DB row type (snake_case)
// ---------------------------------------------------------------------------

interface CouponMasterRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_purchase_amount: number;
  max_issues: number | null;
  max_uses_per_customer: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  target_segment_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mapping helper
// ---------------------------------------------------------------------------

function mapRowToCouponMaster(row: CouponMasterRow): CouponMaster {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    discountType: row.discount_type as CouponMaster['discountType'],
    discountValue: row.discount_value,
    minPurchaseAmount: row.min_purchase_amount,
    maxIssues: row.max_issues,
    maxUsesPerCustomer: row.max_uses_per_customer,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    isActive: row.is_active,
    targetSegmentId: row.target_segment_id,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInputToRow(
  input: Partial<CreateCouponInput> & { isActive?: boolean },
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (input.code !== undefined) row.code = input.code;
  if (input.name !== undefined) row.name = input.name;
  if (input.description !== undefined) row.description = input.description;
  if (input.discountType !== undefined) row.discount_type = input.discountType;
  if (input.discountValue !== undefined) row.discount_value = input.discountValue;
  if (input.minPurchaseAmount !== undefined) row.min_purchase_amount = input.minPurchaseAmount;
  if (input.maxIssues !== undefined) row.max_issues = input.maxIssues;
  if (input.maxUsesPerCustomer !== undefined) row.max_uses_per_customer = input.maxUsesPerCustomer;
  if (input.validFrom !== undefined) row.valid_from = input.validFrom;
  if (input.validUntil !== undefined) row.valid_until = input.validUntil;
  if (input.targetSegmentId !== undefined) row.target_segment_id = input.targetSegmentId;
  if (input.metadata !== undefined) row.metadata = input.metadata;
  if (input.isActive !== undefined) row.is_active = input.isActive;

  return row;
}

// ---------------------------------------------------------------------------
// CRUD functions
// ---------------------------------------------------------------------------

const TABLE = 'coupon_masters';

export async function getCouponMasters(
  options?: { activeOnly?: boolean },
): Promise<CouponMaster[]> {
  const supabase = getAdminClient();

  let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false });

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch coupon masters: ${error.message}`);
  }

  return (data as CouponMasterRow[]).map(mapRowToCouponMaster);
}

export async function getCouponMasterById(id: string): Promise<CouponMaster | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch coupon master by id: ${error.message}`);
  }

  return data ? mapRowToCouponMaster(data as CouponMasterRow) : null;
}

export async function getCouponMasterByCode(code: string): Promise<CouponMaster | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase.from(TABLE).select('*').eq('code', code).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch coupon master by code: ${error.message}`);
  }

  return data ? mapRowToCouponMaster(data as CouponMasterRow) : null;
}

export async function createCouponMaster(input: CreateCouponInput): Promise<CouponMaster> {
  const supabase = getAdminClient();

  const row = mapInputToRow(input);

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row as never)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create coupon master: ${error.message}`);
  }

  return mapRowToCouponMaster(data as CouponMasterRow);
}

export async function updateCouponMaster(
  id: string,
  input: Partial<CreateCouponInput> & { isActive?: boolean },
): Promise<CouponMaster> {
  const supabase = getAdminClient();

  const row = mapInputToRow(input);

  const { data, error } = await supabase
    .from(TABLE)
    .update(row as never)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update coupon master: ${error.message}`);
  }

  return mapRowToCouponMaster(data as CouponMasterRow);
}

export async function deleteCouponMaster(id: string): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase.from(TABLE).delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete coupon master: ${error.message}`);
  }
}

export async function getCouponMasterCount(): Promise<number> {
  const supabase = getAdminClient();

  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count coupon masters: ${error.message}`);
  }

  return count ?? 0;
}
