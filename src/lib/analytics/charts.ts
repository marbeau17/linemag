// ============================================================================
// src/lib/analytics/charts.ts
// Chart data generation service for the analytics dashboard
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChartDataPoint {
  date: string; // YYYY-MM-DD
  [key: string]: string | number;
}

import type { DateRange } from './kpi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract YYYY-MM-DD from an ISO timestamp string. */
function toDateKey(ts: string): string {
  return ts.slice(0, 10);
}

/** Build a map of dates initialised to zero-valued objects for the range. */
function buildDateMap<T extends Record<string, number>>(
  range: DateRange,
  defaults: T,
): Map<string, T> {
  const map = new Map<string, T>();
  const cur = new Date(range.from);
  const end = new Date(range.to);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    map.set(key, { ...defaults });
    cur.setDate(cur.getDate() + 1);
  }
  return map;
}

/** Convert a date-keyed map into a sorted ChartDataPoint array. */
function mapToPoints<T extends Record<string, number>>(
  map: Map<string, T>,
): ChartDataPoint[] {
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));
}

const DATA_LIMIT = 10_000;

// ---------------------------------------------------------------------------
// Delivery trend (line chart)
// ---------------------------------------------------------------------------

export async function getDeliveryTrend(
  range: DateRange,
): Promise<ChartDataPoint[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('delivery_logs')
    .select('sent_at, status')
    .gte('sent_at', `${range.from}T00:00:00`)
    .lte('sent_at', `${range.to}T23:59:59`)
    .limit(DATA_LIMIT);

  if (error) throw error;

  const map = buildDateMap(range, { sent: 0, opened: 0, clicked: 0 });

  for (const row of data ?? []) {
    const key = toDateKey(row.sent_at);
    const bucket = map.get(key);
    if (!bucket) continue;

    bucket.sent += 1;
    if (row.status === 'opened' || row.status === 'clicked') {
      bucket.opened += 1;
    }
    if (row.status === 'clicked') {
      bucket.clicked += 1;
    }
  }

  return mapToPoints(map);
}

// ---------------------------------------------------------------------------
// Customer growth (area chart)
// ---------------------------------------------------------------------------

export async function getCustomerGrowth(
  range: DateRange,
): Promise<ChartDataPoint[]> {
  const supabase = getAdminClient();

  // Fetch all customers to compute running total and churn
  const { data, error } = await supabase
    .from('customers')
    .select('first_seen_at, blocked_at')
    .limit(DATA_LIMIT);

  if (error) throw error;

  const map = buildDateMap(range, { total: 0, new: 0, churned: 0 });

  // Count new and churned per day
  for (const row of data ?? []) {
    const seenKey = toDateKey(row.first_seen_at);
    const seenBucket = map.get(seenKey);
    if (seenBucket) {
      seenBucket.new += 1;
    }

    if (row.blocked_at) {
      const blockedKey = toDateKey(row.blocked_at);
      const blockedBucket = map.get(blockedKey);
      if (blockedBucket) {
        blockedBucket.churned += 1;
      }
    }
  }

  // Count customers existing before range start for running total
  const rangeStart = range.from;
  let runningTotal = (data ?? []).filter(
    (r) => toDateKey(r.first_seen_at) < rangeStart && !r.blocked_at,
  ).length;

  // Also subtract customers blocked before range start
  const blockedBefore = (data ?? []).filter(
    (r) => r.blocked_at && toDateKey(r.blocked_at) < rangeStart,
  ).length;
  runningTotal -= blockedBefore;

  // Walk through the range computing running total
  const sorted = mapToPoints(map);
  for (const point of sorted) {
    runningTotal += (point.new as number) - (point.churned as number);
    point.total = runningTotal;
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Coupon usage trend (bar chart)
// ---------------------------------------------------------------------------

export async function getCouponUsageTrend(
  range: DateRange,
): Promise<ChartDataPoint[]> {
  const supabase = getAdminClient();

  const [issuesRes, usagesRes] = await Promise.all([
    supabase
      .from('coupon_issues')
      .select('issued_at')
      .gte('issued_at', `${range.from}T00:00:00`)
      .lte('issued_at', `${range.to}T23:59:59`)
      .limit(DATA_LIMIT),
    supabase
      .from('coupon_issues')
      .select('used_at')
      .not('used_at', 'is', null)
      .gte('used_at', `${range.from}T00:00:00`)
      .lte('used_at', `${range.to}T23:59:59`)
      .limit(DATA_LIMIT),
  ]);

  if (issuesRes.error) throw issuesRes.error;
  if (usagesRes.error) throw usagesRes.error;

  const map = buildDateMap(range, { issued: 0, used: 0 });

  for (const row of issuesRes.data ?? []) {
    const key = toDateKey(row.issued_at);
    const bucket = map.get(key);
    if (bucket) bucket.issued += 1;
  }

  for (const row of usagesRes.data ?? []) {
    const key = toDateKey(row.used_at);
    const bucket = map.get(key);
    if (bucket) bucket.used += 1;
  }

  return mapToPoints(map);
}

// ---------------------------------------------------------------------------
// Reservation trend (bar chart)
// ---------------------------------------------------------------------------

export async function getReservationTrend(
  range: DateRange,
): Promise<ChartDataPoint[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('reservations')
    .select('created_at, status')
    .gte('created_at', `${range.from}T00:00:00`)
    .lte('created_at', `${range.to}T23:59:59`)
    .limit(DATA_LIMIT);

  if (error) throw error;

  const map = buildDateMap(range, { total: 0, completed: 0, cancelled: 0 });

  for (const row of data ?? []) {
    const key = toDateKey(row.created_at);
    const bucket = map.get(key);
    if (!bucket) continue;

    bucket.total += 1;
    if (row.status === 'completed') {
      bucket.completed += 1;
    } else if (row.status === 'cancelled') {
      bucket.cancelled += 1;
    }
  }

  return mapToPoints(map);
}

// ---------------------------------------------------------------------------
// Customer tier distribution (pie chart)
// ---------------------------------------------------------------------------

export async function getTierDistribution(): Promise<
  { tier: string; count: number }[]
> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('customers')
    .select('membership_tier')
    .is('blocked_at', null)
    .limit(DATA_LIMIT);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const tier = row.membership_tier ?? 'free';
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }

  const order = ['free', 'silver', 'gold', 'platinum'];
  return order.map((tier) => ({ tier, count: counts.get(tier) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Top performing content (horizontal bar chart)
// ---------------------------------------------------------------------------

export async function getTopContent(
  range: DateRange,
  limit = 10,
): Promise<{ title: string; opens: number; clicks: number }[]> {
  const supabase = getAdminClient();

  // Fetch delivery logs with broadcast_id in the range
  const { data: logs, error: logsError } = await supabase
    .from('delivery_logs')
    .select('broadcast_id, status')
    .not('broadcast_id', 'is', null)
    .gte('sent_at', `${range.from}T00:00:00`)
    .lte('sent_at', `${range.to}T23:59:59`)
    .limit(DATA_LIMIT);

  if (logsError) throw logsError;

  // Aggregate by broadcast_id
  const agg = new Map<string, { opens: number; clicks: number }>();
  for (const log of logs ?? []) {
    if (!log.broadcast_id) continue;
    let entry = agg.get(log.broadcast_id);
    if (!entry) {
      entry = { opens: 0, clicks: 0 };
      agg.set(log.broadcast_id, entry);
    }
    if (log.status === 'opened' || log.status === 'clicked') {
      entry.opens += 1;
    }
    if (log.status === 'clicked') {
      entry.clicks += 1;
    }
  }

  if (agg.size === 0) return [];

  // Fetch broadcast titles
  const broadcastIds = Array.from(agg.keys());
  const { data: broadcasts, error: bError } = await supabase
    .from('broadcasts')
    .select('id, title')
    .in('id', broadcastIds);

  if (bError) throw bError;

  const titleMap = new Map<string, string>();
  for (const b of broadcasts ?? []) {
    titleMap.set(b.id, b.title);
  }

  // Merge and sort by opens desc, then take top N
  return Array.from(agg.entries())
    .map(([id, stats]) => ({
      title: titleMap.get(id) ?? '(不明)',
      opens: stats.opens,
      clicks: stats.clicks,
    }))
    .sort((a, b) => b.opens - a.opens)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Hourly activity heatmap
// ---------------------------------------------------------------------------

export async function getHourlyActivity(
  range: DateRange,
): Promise<{ hour: number; dayOfWeek: number; count: number }[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('customer_actions')
    .select('acted_at')
    .gte('acted_at', `${range.from}T00:00:00`)
    .lte('acted_at', `${range.to}T23:59:59`)
    .limit(DATA_LIMIT);

  if (error) throw error;

  // 7 days x 24 hours grid
  const grid = new Map<string, number>();
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.set(`${d}-${h}`, 0);
    }
  }

  for (const row of data ?? []) {
    const dt = new Date(row.acted_at);
    const dayOfWeek = dt.getUTCDay(); // 0 = Sunday
    const hour = dt.getUTCHours();
    const key = `${dayOfWeek}-${hour}`;
    grid.set(key, (grid.get(key) ?? 0) + 1);
  }

  const result: { hour: number; dayOfWeek: number; count: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      result.push({
        hour: h,
        dayOfWeek: d,
        count: grid.get(`${d}-${h}`) ?? 0,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Customer lifecycle funnel
// ---------------------------------------------------------------------------

export async function getLifecycleFunnel(): Promise<
  { stage: string; count: number }[]
> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('customers')
    .select('message_count, last_seen_at')
    .is('blocked_at', null)
    .limit(DATA_LIMIT);

  if (error) throw error;

  // Thresholds:
  //   新規       : message_count <= 1
  //   アクティブ : message_count 2-9  AND last_seen within 30 days
  //   定着       : message_count 10-49 AND last_seen within 30 days
  //   ロイヤル   : message_count >= 50
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  let newCount = 0;
  let activeCount = 0;
  let settledCount = 0;
  let loyalCount = 0;

  for (const row of data ?? []) {
    const mc = row.message_count ?? 0;
    const lastSeen = new Date(row.last_seen_at).getTime();
    const isRecent = now - lastSeen < thirtyDaysMs;

    if (mc >= 50) {
      loyalCount += 1;
    } else if (mc >= 10 && isRecent) {
      settledCount += 1;
    } else if (mc >= 2 && isRecent) {
      activeCount += 1;
    } else {
      newCount += 1;
    }
  }

  return [
    { stage: '新規', count: newCount },
    { stage: 'アクティブ', count: activeCount },
    { stage: '定着', count: settledCount },
    { stage: 'ロイヤル', count: loyalCount },
  ];
}
