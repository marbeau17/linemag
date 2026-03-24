// ============================================================================
// src/lib/analytics/kpi.ts
// KPI calculation service — computes all dashboard KPIs by querying the DB
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KPICard {
  label: string;
  value: number | string;
  change: number; // percentage change vs previous period
  trend: 'up' | 'down' | 'flat';
  format: 'number' | 'percentage' | 'currency' | 'string';
}

export interface DashboardKPIs {
  // Delivery
  totalDeliveries: KPICard;
  openRate: KPICard;
  clickRate: KPICard;

  // Customers
  totalCustomers: KPICard;
  newCustomers: KPICard;
  activeCustomers: KPICard;
  churnRate: KPICard;

  // Coupons
  couponIssued: KPICard;
  couponUsageRate: KPICard;

  // Bookings
  totalReservations: KPICard;
  reservationRate: KPICard;
  cancelRate: KPICard;
}

export type DateRange = { from: string; to: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive the previous period of equal length for comparison. */
export function getPreviousPeriod(range: DateRange): DateRange {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const diffMs = to.getTime() - from.getTime();

  const prevTo = new Date(from.getTime() - 1); // 1 ms before current start
  const prevFrom = new Date(prevTo.getTime() - diffMs);

  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

/** Calculate percentage change and determine trend direction. */
function calcChange(current: number, previous: number): { change: number; trend: 'up' | 'down' | 'flat' } {
  if (previous === 0) {
    return { change: current > 0 ? 100 : 0, trend: current > 0 ? 'up' : 'flat' };
  }

  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 100) / 100;

  let trend: 'up' | 'down' | 'flat';
  if (Math.abs(rounded) < 1) {
    trend = 'flat';
  } else {
    trend = rounded > 0 ? 'up' : 'down';
  }

  return { change: rounded, trend };
}

/** Build a KPICard from raw values. */
function buildCard(
  label: string,
  value: number | string,
  change: number,
  trend: 'up' | 'down' | 'flat',
  format: KPICard['format'],
): KPICard {
  return { label, value, change, trend, format };
}

/** Count rows with optional filters using head: true for efficiency. */
async function countRows(
  table: string,
  dateColumn: string,
  range: DateRange,
  extraFilter?: (query: any) => any,
): Promise<number> {
  const supabase = getAdminClient();

  let query: any = supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .gte(dateColumn, range.from)
    .lte(dateColumn, range.to);

  if (extraFilter) {
    query = extraFilter(query);
  }

  const { count, error } = await query;

  if (error) {
    console.error(`[KPI] countRows error on ${table}:`, error.message);
    return 0;
  }

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Delivery KPIs
// ---------------------------------------------------------------------------

export async function getDeliveryKPIs(
  range: DateRange,
  prevRange: DateRange,
): Promise<Pick<DashboardKPIs, 'totalDeliveries' | 'openRate' | 'clickRate'>> {
  const [
    currentTotal,
    prevTotal,
    currentOpened,
    prevOpened,
    currentClicked,
    prevClicked,
  ] = await Promise.all([
    countRows('delivery_logs', 'created_at', range),
    countRows('delivery_logs', 'created_at', prevRange),
    countRows('delivery_logs', 'created_at', range, (q) => q.not('opened_at', 'is', null)),
    countRows('delivery_logs', 'created_at', prevRange, (q) => q.not('opened_at', 'is', null)),
    countRows('delivery_logs', 'created_at', range, (q) => q.not('clicked_at', 'is', null)),
    countRows('delivery_logs', 'created_at', prevRange, (q) => q.not('clicked_at', 'is', null)),
  ]);

  const currentOpenRate = currentTotal > 0 ? (currentOpened / currentTotal) * 100 : 0;
  const prevOpenRate = prevTotal > 0 ? (prevOpened / prevTotal) * 100 : 0;

  const currentClickRate = currentTotal > 0 ? (currentClicked / currentTotal) * 100 : 0;
  const prevClickRate = prevTotal > 0 ? (prevClicked / prevTotal) * 100 : 0;

  const deliveryChange = calcChange(currentTotal, prevTotal);
  const openChange = calcChange(currentOpenRate, prevOpenRate);
  const clickChange = calcChange(currentClickRate, prevClickRate);

  return {
    totalDeliveries: buildCard('配信数', currentTotal, deliveryChange.change, deliveryChange.trend, 'number'),
    openRate: buildCard('開封率', Math.round(currentOpenRate * 100) / 100, openChange.change, openChange.trend, 'percentage'),
    clickRate: buildCard('クリック率', Math.round(currentClickRate * 100) / 100, clickChange.change, clickChange.trend, 'percentage'),
  };
}

// ---------------------------------------------------------------------------
// Customer KPIs
// ---------------------------------------------------------------------------

export async function getCustomerKPIs(
  range: DateRange,
  prevRange: DateRange,
): Promise<Pick<DashboardKPIs, 'totalCustomers' | 'newCustomers' | 'activeCustomers' | 'churnRate'>> {
  const supabase = getAdminClient();

  // Total customers (cumulative up to end of range)
  const { count: currentTotalCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .lte('created_at', range.to);

  const { count: prevTotalCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .lte('created_at', prevRange.to);

  const currentTotal = currentTotalCount ?? 0;
  const prevTotal = prevTotalCount ?? 0;

  // New customers within the range
  const [currentNew, prevNew] = await Promise.all([
    countRows('customers', 'created_at', range),
    countRows('customers', 'created_at', prevRange),
  ]);

  // Active customers — last_seen_at falls within the range
  const [currentActive, prevActive] = await Promise.all([
    countRows('customers', 'last_seen_at', range),
    countRows('customers', 'last_seen_at', prevRange),
  ]);

  // Churned customers — blocked_at falls within the range
  const [currentChurned, prevChurned] = await Promise.all([
    countRows('customers', 'blocked_at', range),
    countRows('customers', 'blocked_at', prevRange),
  ]);

  const currentChurnRate = currentTotal > 0 ? (currentChurned / currentTotal) * 100 : 0;
  const prevChurnRate = prevTotal > 0 ? (prevChurned / prevTotal) * 100 : 0;

  const totalChange = calcChange(currentTotal, prevTotal);
  const newChange = calcChange(currentNew, prevNew);
  const activeChange = calcChange(currentActive, prevActive);
  const churnChange = calcChange(currentChurnRate, prevChurnRate);

  return {
    totalCustomers: buildCard('総顧客数', currentTotal, totalChange.change, totalChange.trend, 'number'),
    newCustomers: buildCard('新規顧客', currentNew, newChange.change, newChange.trend, 'number'),
    activeCustomers: buildCard('アクティブ顧客', currentActive, activeChange.change, activeChange.trend, 'number'),
    churnRate: buildCard('離脱率', Math.round(currentChurnRate * 100) / 100, churnChange.change, churnChange.trend, 'percentage'),
  };
}

// ---------------------------------------------------------------------------
// Coupon KPIs
// ---------------------------------------------------------------------------

export async function getCouponKPIs(
  range: DateRange,
  prevRange: DateRange,
): Promise<Pick<DashboardKPIs, 'couponIssued' | 'couponUsageRate'>> {
  const [currentIssued, prevIssued, currentUsed, prevUsed] = await Promise.all([
    countRows('coupon_issues', 'created_at', range),
    countRows('coupon_issues', 'created_at', prevRange),
    countRows('coupon_issues', 'created_at', range, (q) => q.not('used_at', 'is', null)),
    countRows('coupon_issues', 'created_at', prevRange, (q) => q.not('used_at', 'is', null)),
  ]);

  const currentUsageRate = currentIssued > 0 ? (currentUsed / currentIssued) * 100 : 0;
  const prevUsageRate = prevIssued > 0 ? (prevUsed / prevIssued) * 100 : 0;

  const issuedChange = calcChange(currentIssued, prevIssued);
  const usageChange = calcChange(currentUsageRate, prevUsageRate);

  return {
    couponIssued: buildCard('クーポン発行数', currentIssued, issuedChange.change, issuedChange.trend, 'number'),
    couponUsageRate: buildCard('クーポン使用率', Math.round(currentUsageRate * 100) / 100, usageChange.change, usageChange.trend, 'percentage'),
  };
}

// ---------------------------------------------------------------------------
// Booking KPIs
// ---------------------------------------------------------------------------

export async function getBookingKPIs(
  range: DateRange,
  prevRange: DateRange,
): Promise<Pick<DashboardKPIs, 'totalReservations' | 'reservationRate' | 'cancelRate'>> {
  const [
    currentTotal,
    prevTotal,
    currentConfirmed,
    prevConfirmed,
    currentCancelled,
    prevCancelled,
  ] = await Promise.all([
    countRows('reservations', 'created_at', range),
    countRows('reservations', 'created_at', prevRange),
    countRows('reservations', 'created_at', range, (q) => q.eq('status', 'confirmed')),
    countRows('reservations', 'created_at', prevRange, (q) => q.eq('status', 'confirmed')),
    countRows('reservations', 'created_at', range, (q) => q.eq('status', 'cancelled')),
    countRows('reservations', 'created_at', prevRange, (q) => q.eq('status', 'cancelled')),
  ]);

  const currentReservationRate = currentTotal > 0 ? (currentConfirmed / currentTotal) * 100 : 0;
  const prevReservationRate = prevTotal > 0 ? (prevConfirmed / prevTotal) * 100 : 0;

  const currentCancelRate = currentTotal > 0 ? (currentCancelled / currentTotal) * 100 : 0;
  const prevCancelRate = prevTotal > 0 ? (prevCancelled / prevTotal) * 100 : 0;

  const totalChange = calcChange(currentTotal, prevTotal);
  const resRateChange = calcChange(currentReservationRate, prevReservationRate);
  const cancelChange = calcChange(currentCancelRate, prevCancelRate);

  return {
    totalReservations: buildCard('予約数', currentTotal, totalChange.change, totalChange.trend, 'number'),
    reservationRate: buildCard('予約確定率', Math.round(currentReservationRate * 100) / 100, resRateChange.change, resRateChange.trend, 'percentage'),
    cancelRate: buildCard('キャンセル率', Math.round(currentCancelRate * 100) / 100, cancelChange.change, cancelChange.trend, 'percentage'),
  };
}

// ---------------------------------------------------------------------------
// Main — aggregate all KPI groups
// ---------------------------------------------------------------------------

export async function getDashboardKPIs(range: DateRange): Promise<DashboardKPIs> {
  const prevRange = getPreviousPeriod(range);

  const [delivery, customer, coupon, booking] = await Promise.all([
    getDeliveryKPIs(range, prevRange),
    getCustomerKPIs(range, prevRange),
    getCouponKPIs(range, prevRange),
    getBookingKPIs(range, prevRange),
  ]);

  return {
    ...delivery,
    ...customer,
    ...coupon,
    ...booking,
  };
}
