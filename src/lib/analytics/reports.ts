// ============================================================================
// src/lib/analytics/reports.ts
// レポート生成・データエクスポートサービス
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportConfig {
  type: 'delivery' | 'customers' | 'coupons' | 'bookings' | 'summary';
  dateRange: { from: string; to: string };
  format: 'json' | 'csv';
  filters?: Record<string, unknown>;
}

export interface ReportResult {
  title: string;
  generatedAt: string;
  dateRange: { from: string; to: string };
  summary: Record<string, number | string>;
  rows: Record<string, unknown>[];
  columns: { key: string; label: string; type: 'string' | 'number' | 'date' | 'currency' }[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate report data based on configuration */
export async function generateReport(config: ReportConfig): Promise<ReportResult> {
  const { type, dateRange } = config;

  switch (type) {
    case 'delivery':
      return generateDeliveryReport(dateRange);
    case 'customers':
      return generateCustomerReport(dateRange);
    case 'coupons':
      return generateCouponReport(dateRange);
    case 'bookings':
      return generateBookingReport(dateRange);
    case 'summary':
      return generateSummaryReport(dateRange);
    default:
      throw new Error(`Unknown report type: ${type}`);
  }
}

/** Convert ReportResult to CSV string (BOM + UTF-8 for Japanese Excel compatibility) */
export function reportToCSV(report: ReportResult): string {
  const BOM = '\uFEFF';
  const headers = report.columns.map((c) => c.label);
  const keys = report.columns.map((c) => c.key);

  const lines: string[] = [headers.map(escapeCSVField).join(',')];

  for (const row of report.rows) {
    const values = keys.map((key) => {
      const val = row[key];
      if (val === null || val === undefined) return '';
      return escapeCSVField(String(val));
    });
    lines.push(values.join(','));
  }

  return BOM + lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// CSV Helpers
// ---------------------------------------------------------------------------

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

// ---------------------------------------------------------------------------
// Delivery Report
// ---------------------------------------------------------------------------

async function generateDeliveryReport(
  range: { from: string; to: string },
): Promise<ReportResult> {
  const supabase = getAdminClient();

  // Fetch broadcasts within the date range
  const { data: broadcasts, error } = await supabase
    .from('broadcasts')
    .select('id, title, template_id, status, sent_at')
    .gte('sent_at', range.from)
    .lte('sent_at', range.to)
    .order('sent_at', { ascending: false });

  if (error) throw new Error(`Delivery report query failed: ${error.message}`);

  const rows: Record<string, unknown>[] = [];

  for (const b of broadcasts ?? []) {
    // Count delivery logs per broadcast
    const { count } = await supabase
      .from('delivery_logs')
      .select('*', { count: 'exact', head: true })
      .eq('broadcast_id', b.id);

    rows.push({
      date: formatDate(b.sent_at),
      title: b.title,
      template: b.template_id ?? '-',
      status: b.status,
      sent_count: count ?? 0,
    });
  }

  const totalSent = rows.reduce((sum, r) => sum + (r.sent_count as number), 0);
  const successCount = rows.filter((r) => r.status === 'SUCCESS').length;

  return {
    title: '配信レポート',
    generatedAt: new Date().toISOString(),
    dateRange: range,
    summary: {
      total_broadcasts: rows.length,
      total_sent: totalSent,
      success_count: successCount,
      failure_count: rows.length - successCount,
    },
    rows,
    columns: [
      { key: 'date', label: '配信日', type: 'date' },
      { key: 'title', label: 'タイトル', type: 'string' },
      { key: 'template', label: 'テンプレート', type: 'string' },
      { key: 'status', label: 'ステータス', type: 'string' },
      { key: 'sent_count', label: '送信数', type: 'number' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Customer Report
// ---------------------------------------------------------------------------

async function generateCustomerReport(
  range: { from: string; to: string },
): Promise<ReportResult> {
  const supabase = getAdminClient();

  const { data: customers, error } = await supabase
    .from('customers')
    .select('display_name, line_user_id, membership_tier, message_count, first_seen_at, last_seen_at')
    .gte('created_at', range.from)
    .lte('created_at', range.to)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Customer report query failed: ${error.message}`);

  const rows: Record<string, unknown>[] = (customers ?? []).map((c) => ({
    display_name: c.display_name ?? '(未設定)',
    line_user_id: c.line_user_id,
    tier: c.membership_tier,
    message_count: c.message_count,
    first_seen: formatDate(c.first_seen_at),
    last_seen: formatDate(c.last_seen_at),
  }));

  const tierCounts: Record<string, number> = {};
  for (const row of rows) {
    const tier = row.tier as string;
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
  }

  const totalMessages = rows.reduce((sum, r) => sum + (r.message_count as number), 0);

  return {
    title: '顧客レポート',
    generatedAt: new Date().toISOString(),
    dateRange: range,
    summary: {
      total_customers: rows.length,
      total_messages: totalMessages,
      ...tierCounts,
    },
    rows,
    columns: [
      { key: 'display_name', label: '表示名', type: 'string' },
      { key: 'line_user_id', label: 'LINE ID', type: 'string' },
      { key: 'tier', label: '会員ランク', type: 'string' },
      { key: 'message_count', label: 'メッセージ数', type: 'number' },
      { key: 'first_seen', label: '初回', type: 'date' },
      { key: 'last_seen', label: '最終', type: 'date' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Coupon Report
// ---------------------------------------------------------------------------

async function generateCouponReport(
  range: { from: string; to: string },
): Promise<ReportResult> {
  const supabase = getAdminClient();

  const { data: coupons, error } = await supabase
    .from('coupon_masters')
    .select('id, code, name, discount_type, discount_value')
    .gte('created_at', range.from)
    .lte('created_at', range.to)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Coupon report query failed: ${error.message}`);

  const rows: Record<string, unknown>[] = [];

  for (const c of coupons ?? []) {
    const { count: issuedCount } = await supabase
      .from('coupon_issues')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_master_id', c.id);

    const { count: usedCount } = await supabase
      .from('coupon_issues')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_master_id', c.id)
      .eq('status', 'used');

    const issued = issuedCount ?? 0;
    const used = usedCount ?? 0;
    const usageRate = issued > 0 ? Math.round((used / issued) * 100) : 0;

    const discountLabel =
      c.discount_type === 'percentage'
        ? `${c.discount_value}%`
        : c.discount_type === 'free_shipping'
          ? '送料無料'
          : `¥${Number(c.discount_value).toLocaleString()}`;

    rows.push({
      code: c.code,
      name: c.name,
      discount: discountLabel,
      issued,
      used,
      usage_rate: `${usageRate}%`,
    });
  }

  const totalIssued = rows.reduce((sum, r) => sum + (r.issued as number), 0);
  const totalUsed = rows.reduce((sum, r) => sum + (r.used as number), 0);

  return {
    title: 'クーポンレポート',
    generatedAt: new Date().toISOString(),
    dateRange: range,
    summary: {
      total_coupons: rows.length,
      total_issued: totalIssued,
      total_used: totalUsed,
      overall_usage_rate: totalIssued > 0 ? `${Math.round((totalUsed / totalIssued) * 100)}%` : '0%',
    },
    rows,
    columns: [
      { key: 'code', label: 'クーポンコード', type: 'string' },
      { key: 'name', label: 'クーポン名', type: 'string' },
      { key: 'discount', label: '割引', type: 'string' },
      { key: 'issued', label: '発行数', type: 'number' },
      { key: 'used', label: '使用数', type: 'number' },
      { key: 'usage_rate', label: '使用率', type: 'string' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Booking Report
// ---------------------------------------------------------------------------

async function generateBookingReport(
  range: { from: string; to: string },
): Promise<ReportResult> {
  const supabase = getAdminClient();

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select(`
      id,
      status,
      created_at,
      customer_id,
      time_slot_id,
      consultant_id
    `)
    .gte('created_at', range.from)
    .lte('created_at', range.to)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Booking report query failed: ${error.message}`);

  // Collect unique IDs for batch lookups
  const customerIds = Array.from(new Set((reservations ?? []).map((r) => r.customer_id)));
  const slotIds = Array.from(new Set((reservations ?? []).map((r) => r.time_slot_id)));
  const consultantIds = Array.from(new Set((reservations ?? []).map((r) => r.consultant_id)));

  // Batch fetch related data
  const [customersResult, slotsResult, consultantsResult] = await Promise.all([
    customerIds.length > 0
      ? supabase.from('customers').select('id, display_name').in('id', customerIds)
      : { data: [], error: null },
    slotIds.length > 0
      ? supabase.from('time_slots').select('id, date, start_time').in('id', slotIds)
      : { data: [], error: null },
    consultantIds.length > 0
      ? supabase.from('consultants').select('id, name').in('id', consultantIds)
      : { data: [], error: null },
  ]);

  const customerMap = new Map(
    (customersResult.data ?? []).map((c) => [c.id, c.display_name ?? '(未設定)']),
  );
  const slotMap = new Map(
    (slotsResult.data ?? []).map((s) => [s.id, { date: s.date, start_time: s.start_time }]),
  );
  const consultantMap = new Map(
    (consultantsResult.data ?? []).map((c) => [c.id, c.name]),
  );

  const rows: Record<string, unknown>[] = (reservations ?? []).map((r) => {
    const slot = slotMap.get(r.time_slot_id);
    return {
      date: slot?.date ?? '-',
      time: slot?.start_time ?? '-',
      customer: customerMap.get(r.customer_id) ?? '-',
      consultant: consultantMap.get(r.consultant_id) ?? '-',
      status: r.status,
    };
  });

  const statusCounts: Record<string, number> = {};
  for (const row of rows) {
    const status = row.status as string;
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  return {
    title: '予約レポート',
    generatedAt: new Date().toISOString(),
    dateRange: range,
    summary: {
      total_bookings: rows.length,
      ...statusCounts,
    },
    rows,
    columns: [
      { key: 'date', label: '予約日', type: 'date' },
      { key: 'time', label: '時間', type: 'string' },
      { key: 'customer', label: '顧客', type: 'string' },
      { key: 'consultant', label: '相談員', type: 'string' },
      { key: 'status', label: 'ステータス', type: 'string' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Summary Report
// ---------------------------------------------------------------------------

async function generateSummaryReport(
  range: { from: string; to: string },
): Promise<ReportResult> {
  const supabase = getAdminClient();

  // Aggregate KPIs in parallel
  const [
    broadcastsResult,
    deliveryResult,
    customersResult,
    couponsIssuedResult,
    couponsUsedResult,
    bookingsResult,
    bookingsCompletedResult,
  ] = await Promise.all([
    supabase
      .from('broadcasts')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', range.from)
      .lte('sent_at', range.to),
    supabase
      .from('delivery_logs')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', range.from)
      .lte('sent_at', range.to),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', range.from)
      .lte('created_at', range.to),
    supabase
      .from('coupon_issues')
      .select('*', { count: 'exact', head: true })
      .gte('issued_at', range.from)
      .lte('issued_at', range.to),
    supabase
      .from('coupon_issues')
      .select('*', { count: 'exact', head: true })
      .gte('issued_at', range.from)
      .lte('issued_at', range.to)
      .eq('status', 'used'),
    supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', range.from)
      .lte('created_at', range.to),
    supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', range.from)
      .lte('created_at', range.to)
      .eq('status', 'completed'),
  ]);

  const totalBroadcasts = broadcastsResult.count ?? 0;
  const totalDeliveries = deliveryResult.count ?? 0;
  const newCustomers = customersResult.count ?? 0;
  const couponsIssued = couponsIssuedResult.count ?? 0;
  const couponsUsed = couponsUsedResult.count ?? 0;
  const totalBookings = bookingsResult.count ?? 0;
  const completedBookings = bookingsCompletedResult.count ?? 0;

  const couponUsageRate = couponsIssued > 0
    ? `${Math.round((couponsUsed / couponsIssued) * 100)}%`
    : '0%';
  const bookingCompletionRate = totalBookings > 0
    ? `${Math.round((completedBookings / totalBookings) * 100)}%`
    : '0%';

  const rows: Record<string, unknown>[] = [
    { metric: '配信回数', value: totalBroadcasts, unit: '回' },
    { metric: '総送信数', value: totalDeliveries, unit: '通' },
    { metric: '新規顧客数', value: newCustomers, unit: '人' },
    { metric: 'クーポン発行数', value: couponsIssued, unit: '枚' },
    { metric: 'クーポン使用数', value: couponsUsed, unit: '枚' },
    { metric: 'クーポン使用率', value: couponUsageRate, unit: '' },
    { metric: '予約件数', value: totalBookings, unit: '件' },
    { metric: '予約完了件数', value: completedBookings, unit: '件' },
    { metric: '予約完了率', value: bookingCompletionRate, unit: '' },
  ];

  return {
    title: 'サマリーレポート',
    generatedAt: new Date().toISOString(),
    dateRange: range,
    summary: {
      total_broadcasts: totalBroadcasts,
      total_deliveries: totalDeliveries,
      new_customers: newCustomers,
      coupons_issued: couponsIssued,
      coupons_used: couponsUsed,
      coupon_usage_rate: couponUsageRate,
      total_bookings: totalBookings,
      completed_bookings: completedBookings,
      booking_completion_rate: bookingCompletionRate,
    },
    rows,
    columns: [
      { key: 'metric', label: '指標', type: 'string' },
      { key: 'value', label: '値', type: 'number' },
      { key: 'unit', label: '単位', type: 'string' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toISOString().slice(0, 10);
  } catch {
    return '-';
  }
}
