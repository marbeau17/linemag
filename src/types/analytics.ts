export interface KPICard {
  label: string;
  value: number | string;
  change: number;
  trend: 'up' | 'down' | 'flat';
  format: 'number' | 'percentage' | 'currency' | 'string';
}

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export type DateRange = { from: string; to: string };

export interface ReportConfig {
  type: 'delivery' | 'customers' | 'coupons' | 'bookings' | 'summary';
  dateRange: DateRange;
  format: 'json' | 'csv';
  filters?: Record<string, unknown>;
}

export const PERIOD_OPTIONS = [
  { label: '今日', value: 'today' },
  { label: '7日間', value: '7d' },
  { label: '30日間', value: '30d' },
  { label: '90日間', value: '90d' },
  { label: 'カスタム', value: 'custom' },
] as const;

export const REPORT_TYPE_LABELS: Record<string, string> = {
  delivery: '配信レポート',
  customers: '顧客レポート',
  coupons: 'クーポンレポート',
  bookings: '予約レポート',
  summary: 'サマリーレポート',
};

export const METRIC_LABELS: Record<string, string> = {
  totalDeliveries: '配信数',
  openRate: '開封率',
  clickRate: 'クリック率',
  totalCustomers: '総顧客数',
  newCustomers: '新規顧客',
  activeCustomers: 'アクティブ顧客',
  churnRate: '離脱率',
  couponIssued: 'クーポン発行数',
  couponUsageRate: 'クーポン利用率',
  totalReservations: '予約数',
  reservationRate: '予約率',
  cancelRate: 'キャンセル率',
};

export const TREND_COLORS = {
  up: 'text-green-600',
  down: 'text-red-600',
  flat: 'text-slate-400',
};
