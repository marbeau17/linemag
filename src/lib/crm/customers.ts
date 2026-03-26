// ============================================================================
// src/lib/crm/customers.ts
// Customer CRUD operations using Supabase admin client
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Customer {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthDate: string | null;
  prefecture: string | null;
  membershipTier: string | null;
  messageCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  blockedAt: string | null;
  attributes: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // New attribute fields
  fullName: string | null;
  fullNameKana: string | null;
  nickname: string | null;
  postalCode: string | null;
  city: string | null;
  occupation: string | null;
  company: string | null;
  ageGroup: string | null;
  acquisitionSource: string | null;
  acquisitionMedium: string | null;
  acquisitionCampaign: string | null;
  engagementScore: number;
  lifecycleStage: string;
  totalPurchaseAmount: number;
  purchaseCount: number;
  lastPurchaseAt: string | null;
  reservationCount: number;
  couponUsageCount: number;
}

export interface CustomerListParams {
  page?: number;
  perPage?: number;
  search?: string;
  tier?: string;
  prefecture?: string;
  tags?: string[];
  ageGroup?: string;
  lifecycleStage?: string;
  acquisitionSource?: string;
  sortBy?: 'last_seen_at' | 'created_at' | 'display_name' | 'message_count';
  sortOrder?: 'asc' | 'desc';
}

export interface CustomerListResult {
  customers: Customer[];
  total: number;
  page: number;
  perPage: number;
}

// ---------------------------------------------------------------------------
// Row <-> Customer mapping
// ---------------------------------------------------------------------------

/** DB row shape (snake_case) */
interface CustomerRow {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  status_message: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birth_date: string | null;
  prefecture: string | null;
  membership_tier: string | null;
  message_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  blocked_at: string | null;
  attributes: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // New attribute fields
  full_name: string | null;
  full_name_kana: string | null;
  nickname: string | null;
  postal_code: string | null;
  city: string | null;
  occupation: string | null;
  company: string | null;
  age_group: string | null;
  acquisition_source: string | null;
  acquisition_medium: string | null;
  acquisition_campaign: string | null;
  engagement_score: number;
  lifecycle_stage: string;
  total_purchase_amount: number;
  purchase_count: number;
  last_purchase_at: string | null;
  reservation_count: number;
  coupon_usage_count: number;
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    lineUserId: row.line_user_id,
    displayName: row.display_name,
    pictureUrl: row.picture_url,
    statusMessage: row.status_message,
    email: row.email,
    phone: row.phone,
    gender: row.gender,
    birthDate: row.birth_date,
    prefecture: row.prefecture,
    membershipTier: row.membership_tier,
    messageCount: row.message_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    blockedAt: row.blocked_at,
    attributes: row.attributes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // New attribute fields
    fullName: row.full_name,
    fullNameKana: row.full_name_kana,
    nickname: row.nickname,
    postalCode: row.postal_code,
    city: row.city,
    occupation: row.occupation,
    company: row.company,
    ageGroup: row.age_group,
    acquisitionSource: row.acquisition_source,
    acquisitionMedium: row.acquisition_medium,
    acquisitionCampaign: row.acquisition_campaign,
    engagementScore: row.engagement_score,
    lifecycleStage: row.lifecycle_stage,
    totalPurchaseAmount: row.total_purchase_amount,
    purchaseCount: row.purchase_count,
    lastPurchaseAt: row.last_purchase_at,
    reservationCount: row.reservation_count,
    couponUsageCount: row.coupon_usage_count,
  };
}

function customerToRow(
  data: Partial<Customer>,
): Record<string, unknown> {
  const map: Record<string, unknown> = {};

  if (data.lineUserId !== undefined) map.line_user_id = data.lineUserId;
  if (data.displayName !== undefined) map.display_name = data.displayName;
  if (data.pictureUrl !== undefined) map.picture_url = data.pictureUrl;
  if (data.statusMessage !== undefined) map.status_message = data.statusMessage;
  if (data.email !== undefined) map.email = data.email;
  if (data.phone !== undefined) map.phone = data.phone;
  if (data.gender !== undefined) map.gender = data.gender;
  if (data.birthDate !== undefined) map.birth_date = data.birthDate;
  if (data.prefecture !== undefined) map.prefecture = data.prefecture;
  if (data.membershipTier !== undefined) map.membership_tier = data.membershipTier;
  if (data.messageCount !== undefined) map.message_count = data.messageCount;
  if (data.firstSeenAt !== undefined) map.first_seen_at = data.firstSeenAt;
  if (data.lastSeenAt !== undefined) map.last_seen_at = data.lastSeenAt;
  if (data.blockedAt !== undefined) map.blocked_at = data.blockedAt;
  if (data.attributes !== undefined) map.attributes = data.attributes;
  // New attribute fields
  if (data.fullName !== undefined) map.full_name = data.fullName;
  if (data.fullNameKana !== undefined) map.full_name_kana = data.fullNameKana;
  if (data.nickname !== undefined) map.nickname = data.nickname;
  if (data.postalCode !== undefined) map.postal_code = data.postalCode;
  if (data.city !== undefined) map.city = data.city;
  if (data.occupation !== undefined) map.occupation = data.occupation;
  if (data.company !== undefined) map.company = data.company;
  if (data.ageGroup !== undefined) map.age_group = data.ageGroup;
  if (data.acquisitionSource !== undefined) map.acquisition_source = data.acquisitionSource;
  if (data.acquisitionMedium !== undefined) map.acquisition_medium = data.acquisitionMedium;
  if (data.acquisitionCampaign !== undefined) map.acquisition_campaign = data.acquisitionCampaign;
  if (data.engagementScore !== undefined) map.engagement_score = data.engagementScore;
  if (data.lifecycleStage !== undefined) map.lifecycle_stage = data.lifecycleStage;
  if (data.totalPurchaseAmount !== undefined) map.total_purchase_amount = data.totalPurchaseAmount;
  if (data.purchaseCount !== undefined) map.purchase_count = data.purchaseCount;
  if (data.lastPurchaseAt !== undefined) map.last_purchase_at = data.lastPurchaseAt;
  if (data.reservationCount !== undefined) map.reservation_count = data.reservationCount;
  if (data.couponUsageCount !== undefined) map.coupon_usage_count = data.couponUsageCount;

  return map;
}

// ---------------------------------------------------------------------------
// CRUD Functions
// ---------------------------------------------------------------------------

/**
 * Paginated customer list with search, filtering, and sorting.
 */
export async function getCustomers(
  params: CustomerListParams = {},
): Promise<CustomerListResult> {
  const supabase = getAdminClient();

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const sortBy = params.sortBy ?? 'created_at';
  const sortOrder = params.sortOrder ?? 'desc';
  const offset = (page - 1) * perPage;

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' });

  // Full-text search on display_name or email
  if (params.search) {
    const term = `%${params.search}%`;
    query = query.or(`display_name.ilike.${term},email.ilike.${term}`);
  }

  // Filter by membership tier
  if (params.tier) {
    query = query.eq('membership_tier', params.tier);
  }

  // Filter by prefecture
  if (params.prefecture) {
    query = query.eq('prefecture', params.prefecture);
  }

  // Filter by tags stored inside attributes jsonb
  if (params.tags && params.tags.length > 0) {
    for (const tag of params.tags) {
      query = query.contains('attributes', { tags: [tag] });
    }
  }

  // Filter by age group
  if (params.ageGroup) {
    query = query.eq('age_group', params.ageGroup);
  }

  // Filter by lifecycle stage
  if (params.lifecycleStage) {
    query = query.eq('lifecycle_stage', params.lifecycleStage);
  }

  // Filter by acquisition source
  if (params.acquisitionSource) {
    query = query.eq('acquisition_source', params.acquisitionSource);
  }

  // Sorting & pagination
  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + perPage - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch customers: ${error.message}`);
  }

  return {
    customers: (data as CustomerRow[]).map(rowToCustomer),
    total: count ?? 0,
    page,
    perPage,
  };
}

/**
 * Fetch a single customer by primary key.
 */
export async function getCustomerById(
  id: string,
): Promise<Customer | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch customer ${id}: ${error.message}`);
  }

  return data ? rowToCustomer(data as CustomerRow) : null;
}

/**
 * Fetch a single customer by LINE user ID.
 */
export async function getCustomerByLineUserId(
  lineUserId: string,
): Promise<Customer | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('line_user_id', lineUserId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch customer by line_user_id ${lineUserId}: ${error.message}`,
    );
  }

  return data ? rowToCustomer(data as CustomerRow) : null;
}

/**
 * Upsert a customer by LINE user ID.
 *
 * If a row with the given `line_user_id` already exists it will be updated;
 * otherwise a new row is inserted.
 */
export async function upsertCustomerByLineUserId(
  lineUserId: string,
  data: Partial<Customer>,
): Promise<Customer> {
  const supabase = getAdminClient();

  const row = {
    ...customerToRow(data),
    line_user_id: lineUserId,
    updated_at: new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('customers')
    .upsert(row, { onConflict: 'line_user_id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `Failed to upsert customer for line_user_id ${lineUserId}: ${error.message}`,
    );
  }

  return rowToCustomer(result as CustomerRow);
}

/**
 * Update an existing customer by primary key.
 */
export async function updateCustomer(
  id: string,
  data: Partial<Customer>,
): Promise<Customer> {
  const supabase = getAdminClient();

  const row = {
    ...customerToRow(data),
    updated_at: new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('customers')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update customer ${id}: ${error.message}`);
  }

  return rowToCustomer(result as CustomerRow);
}

/**
 * Return the total number of customers.
 */
export async function getCustomerCount(): Promise<number> {
  const supabase = getAdminClient();

  const { count, error } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count customers: ${error.message}`);
  }

  return count ?? 0;
}
