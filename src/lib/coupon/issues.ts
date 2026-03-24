import { getAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CouponIssue {
  id: string;
  couponMasterId: string;
  customerId: string;
  issueCode: string;
  status: 'issued' | 'used' | 'expired' | 'revoked';
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface CouponUsage {
  id: string;
  couponIssueId: string;
  customerId: string;
  discountAmount: number;
  usedAt: string;
}

// ---------------------------------------------------------------------------
// DB row types (snake_case)
// ---------------------------------------------------------------------------

interface CouponIssueRow {
  id: string;
  coupon_master_id: string;
  customer_id: string;
  issue_code: string;
  status: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface CouponUsageRow {
  id: string;
  coupon_issue_id: string;
  customer_id: string;
  discount_amount: number;
  used_at: string;
}

interface CouponIssueWithMasterRow extends CouponIssueRow {
  coupon_masters: {
    name: string;
    discount_type: string;
    discount_value: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapRowToIssue(row: CouponIssueRow): CouponIssue {
  return {
    id: row.id,
    couponMasterId: row.coupon_master_id,
    customerId: row.customer_id,
    issueCode: row.issue_code,
    status: row.status as CouponIssue['status'],
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

function mapRowToUsage(row: CouponUsageRow): CouponUsage {
  return {
    id: row.id,
    couponIssueId: row.coupon_issue_id,
    customerId: row.customer_id,
    discountAmount: row.discount_amount,
    usedAt: row.used_at,
  };
}

function generateIssueCode(masterCode: string): string {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${masterCode}-${hex}`;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const ISSUES_TABLE = 'coupon_issues';
const USAGES_TABLE = 'coupon_usages';
const MASTERS_TABLE = 'coupon_masters';

// ---------------------------------------------------------------------------
// Issue a coupon to a customer
// ---------------------------------------------------------------------------

export async function issueCoupon(
  couponMasterId: string,
  customerId: string,
  expiresAt: string,
): Promise<CouponIssue> {
  const supabase = getAdminClient();

  // Fetch master code for issue_code generation
  const { data: master, error: masterError } = await supabase
    .from(MASTERS_TABLE)
    .select('code')
    .eq('id', couponMasterId)
    .single();

  if (masterError || !master) {
    throw new Error(`Failed to fetch coupon master: ${masterError?.message ?? 'not found'}`);
  }

  const issueCode = generateIssueCode((master as { code: string }).code);

  const row = {
    coupon_master_id: couponMasterId,
    customer_id: customerId,
    issue_code: issueCode,
    expires_at: expiresAt,
  };

  const { data, error } = await supabase
    .from(ISSUES_TABLE)
    .insert(row as never)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to issue coupon: ${error.message}`);
  }

  return mapRowToIssue(data as CouponIssueRow);
}

// ---------------------------------------------------------------------------
// Batch issue coupons to multiple customers
// ---------------------------------------------------------------------------

export async function batchIssueCoupon(
  couponMasterId: string,
  customerIds: string[],
  expiresAt: string,
): Promise<CouponIssue[]> {
  const supabase = getAdminClient();

  // Fetch master code for issue_code generation
  const { data: master, error: masterError } = await supabase
    .from(MASTERS_TABLE)
    .select('code')
    .eq('id', couponMasterId)
    .single();

  if (masterError || !master) {
    throw new Error(`Failed to fetch coupon master: ${masterError?.message ?? 'not found'}`);
  }

  const masterCode = (master as { code: string }).code;

  const rows = customerIds.map((customerId) => ({
    coupon_master_id: couponMasterId,
    customer_id: customerId,
    issue_code: generateIssueCode(masterCode),
    expires_at: expiresAt,
  }));

  const { data, error } = await supabase
    .from(ISSUES_TABLE)
    .insert(rows as never)
    .select('*');

  if (error) {
    throw new Error(`Failed to batch issue coupons: ${error.message}`);
  }

  return (data as CouponIssueRow[]).map(mapRowToIssue);
}

// ---------------------------------------------------------------------------
// Get issued coupons for a customer (with master info)
// ---------------------------------------------------------------------------

export async function getCustomerCoupons(
  customerId: string,
  options?: { status?: string },
): Promise<(CouponIssue & { couponName?: string; discountType?: string; discountValue?: number })[]> {
  const supabase = getAdminClient();

  let query = supabase
    .from(ISSUES_TABLE)
    .select('*, coupon_masters(name, discount_type, discount_value)')
    .eq('customer_id', customerId)
    .order('issued_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch customer coupons: ${error.message}`);
  }

  return (data as CouponIssueWithMasterRow[]).map((row) => {
    const issue = mapRowToIssue(row);
    return {
      ...issue,
      couponName: row.coupon_masters?.name,
      discountType: row.coupon_masters?.discount_type,
      discountValue: row.coupon_masters?.discount_value,
    };
  });
}

// ---------------------------------------------------------------------------
// Get all issues for a coupon master
// ---------------------------------------------------------------------------

export async function getCouponIssues(couponMasterId: string): Promise<CouponIssue[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from(ISSUES_TABLE)
    .select('*')
    .eq('coupon_master_id', couponMasterId)
    .order('issued_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch coupon issues: ${error.message}`);
  }

  return (data as CouponIssueRow[]).map(mapRowToIssue);
}

// ---------------------------------------------------------------------------
// Use a coupon (mark as used, create usage record)
// ---------------------------------------------------------------------------

export async function useCoupon(
  issueId: string,
  discountAmount: number,
): Promise<CouponUsage> {
  const supabase = getAdminClient();

  // Fetch the issue to get customer_id and verify status
  const { data: issue, error: issueError } = await supabase
    .from(ISSUES_TABLE)
    .select('*')
    .eq('id', issueId)
    .single();

  if (issueError || !issue) {
    throw new Error(`Failed to fetch coupon issue: ${issueError?.message ?? 'not found'}`);
  }

  const issueRow = issue as CouponIssueRow;

  if (issueRow.status !== 'issued') {
    throw new Error(`Coupon cannot be used: current status is "${issueRow.status}"`);
  }

  // Mark coupon as used
  const { error: updateError } = await supabase
    .from(ISSUES_TABLE)
    .update({ status: 'used', used_at: new Date().toISOString() } as never)
    .eq('id', issueId);

  if (updateError) {
    throw new Error(`Failed to update coupon status: ${updateError.message}`);
  }

  // Create usage record
  const usageRow = {
    coupon_issue_id: issueId,
    customer_id: issueRow.customer_id,
    discount_amount: discountAmount,
  };

  const { data: usage, error: usageError } = await supabase
    .from(USAGES_TABLE)
    .insert(usageRow as never)
    .select('*')
    .single();

  if (usageError) {
    throw new Error(`Failed to create coupon usage record: ${usageError.message}`);
  }

  return mapRowToUsage(usage as CouponUsageRow);
}

// ---------------------------------------------------------------------------
// Revoke a coupon
// ---------------------------------------------------------------------------

export async function revokeCoupon(issueId: string): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from(ISSUES_TABLE)
    .update({ status: 'revoked' } as never)
    .eq('id', issueId);

  if (error) {
    throw new Error(`Failed to revoke coupon: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Get usage stats for a coupon master
// ---------------------------------------------------------------------------

export async function getCouponStats(couponMasterId: string): Promise<{
  totalIssued: number;
  totalUsed: number;
  totalRevoked: number;
  totalExpired: number;
  usageRate: number;
}> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from(ISSUES_TABLE)
    .select('status')
    .eq('coupon_master_id', couponMasterId);

  if (error) {
    throw new Error(`Failed to fetch coupon stats: ${error.message}`);
  }

  const rows = data as { status: string }[];

  const totalIssued = rows.length;
  const totalUsed = rows.filter((r) => r.status === 'used').length;
  const totalRevoked = rows.filter((r) => r.status === 'revoked').length;
  const totalExpired = rows.filter((r) => r.status === 'expired').length;
  const usageRate = totalIssued > 0 ? totalUsed / totalIssued : 0;

  return {
    totalIssued,
    totalUsed,
    totalRevoked,
    totalExpired,
    usageRate,
  };
}
