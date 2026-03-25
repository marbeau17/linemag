'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Period = 'today' | '7d' | '30d' | '90d' | 'custom';

interface KpiData {
  deliveryCount: number;
  deliveryCountChange: number;
  openRate: number;
  openRateChange: number;
  totalCustomers: number;
  totalCustomersChange: number;
  bookingCount: number;
  bookingCountChange: number;
  deliveryTrend: number[];
  customerTrend: number[];
  coupon: {
    issued: number;
    used: number;
  };
  booking: {
    weekTotal: number;
    cancelRate: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: '7d', label: '7日' },
  { value: '30d', label: '30日' },
  { value: '90d', label: '90日' },
  { value: 'custom', label: 'カスタム' },
];

const SUB_NAV_LINKS = [
  { href: '/dashboard/analytics/delivery', label: '配信分析' },
  { href: '/dashboard/analytics/customers', label: '顧客分析' },
  { href: '/dashboard/analytics/coupons', label: 'クーポン分析' },
  { href: '/dashboard/analytics/bookings', label: '予約分析' },
  { href: '/dashboard/analytics/reports', label: 'レポート' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function calcDateRange(period: Period): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = formatDate(today);

  switch (period) {
    case 'today':
      return { from: to, to };
    case '7d': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { from: formatDate(d), to };
    }
    case '30d': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { from: formatDate(d), to };
    }
    case '90d': {
      const d = new Date(today);
      d.setDate(d.getDate() - 89);
      return { from: formatDate(d), to };
    }
    default:
      return { from: to, to };
  }
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '-';
  return n.toLocaleString('ja-JP');
}

function formatPercent(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '-';
  return `${n.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Mock data (used when API is not ready)
// ---------------------------------------------------------------------------
function mockKpi(): KpiData {
  return {
    deliveryCount: 1284,
    deliveryCountChange: 12.5,
    openRate: 68.3,
    openRateChange: 3.2,
    totalCustomers: 4521,
    totalCustomersChange: 8.7,
    bookingCount: 342,
    bookingCountChange: -2.1,
    deliveryTrend: [45, 62, 78, 55, 90, 82, 70, 95, 60, 88, 75, 100],
    customerTrend: [120, 135, 142, 160, 175, 190, 210, 225, 240, 258, 270, 290],
    coupon: { issued: 850, used: 623 },
    booking: { weekTotal: 87, cancelRate: 4.2 },
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function TrendIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-slate-400 text-sm">-- 0%</span>;
  const isUp = value > 0;
  return (
    <span className={`text-sm font-medium ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  change,
  format = 'number',
}: {
  label: string;
  value: number;
  change: number;
  format?: 'number' | 'percent';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-800">
        {format === 'percent' ? formatPercent(value) : formatNumber(value)}
      </p>
      <div className="mt-2">
        <TrendIndicator value={change} />
        <span className="ml-1 text-xs text-slate-400">前期比</span>
      </div>
    </div>
  );
}

function BarChart({ data, title, color }: { data: number[]; title: string; color: string }) {
  const safeData = Array.isArray(data) ? data : [];
  const max = safeData.length > 0 ? Math.max(...safeData, 1) : 1;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {safeData.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">データがありません</p>
      ) : (
      <>
        <div className="flex items-end gap-1.5 h-40">
          {safeData.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-t transition-all duration-300"
              style={{
                height: `${(v / max) * 100}%`,
                backgroundColor: color,
                opacity: 0.7 + (v / max) * 0.3,
              }}
              title={String(v)}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>開始</span>
          <span>終了</span>
        </div>
      </>
      )}
    </div>
  );
}

function CouponStatusCard({ issued, used }: { issued: number; used: number }) {
  const rate = issued > 0 ? (used / issued) * 100 : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">クーポン利用状況</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">発行数</span>
          <span className="font-semibold text-slate-800">{formatNumber(issued)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">利用数</span>
          <span className="font-semibold text-slate-800">{formatNumber(used)}</span>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">利用率</span>
            <span className="font-semibold text-slate-800">{formatPercent(rate)}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100">
            <div
              className="h-2.5 rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(rate, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingStatusCard({ weekTotal, cancelRate }: { weekTotal: number; cancelRate: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">予約状況</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">今週の予約数</span>
          <span className="font-semibold text-slate-800">{formatNumber(weekTotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">キャンセル率</span>
          <span className={`font-semibold ${cancelRate > 10 ? 'text-red-500' : 'text-slate-800'}`}>
            {formatPercent(cancelRate)}
          </span>
        </div>
        <div>
          <div className="h-2.5 w-full rounded-full bg-slate-100">
            <div
              className="h-2.5 rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${Math.min(cancelRate, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AnalyticsDashboardPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchKpi = useCallback(async () => {
    setLoading(true);
    setError('');

    let from: string;
    let to: string;
    if (period === 'custom') {
      from = customFrom;
      to = customTo;
      if (!from || !to) {
        setLoading(false);
        return;
      }
    } else {
      ({ from, to } = calcDateRange(period));
    }

    try {
      const res = await fetch(`/api/analytics/kpi?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`データの取得に失敗しました（ステータス: ${res.status}）`);
      const data: KpiData = await res.json();
      setKpi(data);
    } catch (e) {
      // Fall back to mock data during development, but show warning
      console.warn('KPI fetch failed, using mock data:', e);
      setKpi(mockKpi());
      // Uncomment the next line to show errors to the user in production:
      // setError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    fetchKpi();
  }, [fetchKpi]);

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-800">分析ダッシュボード</h1>

        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range inputs */}
      {period === 'custom' && (
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
          <span className="text-slate-400">〜</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Sub-navigation                                                    */}
      {/* ----------------------------------------------------------------- */}
      <nav className="flex flex-wrap gap-2">
        {SUB_NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* ----------------------------------------------------------------- */}
      {/* Loading / Error                                                   */}
      {/* ----------------------------------------------------------------- */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* KPI Cards                                                         */}
      {/* ----------------------------------------------------------------- */}
      {kpi && !loading && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="配信数" value={kpi.deliveryCount ?? 0} change={kpi.deliveryCountChange ?? 0} />
            <KpiCard label="開封率" value={kpi.openRate ?? 0} change={kpi.openRateChange ?? 0} format="percent" />
            <KpiCard label="総顧客数" value={kpi.totalCustomers ?? 0} change={kpi.totalCustomersChange ?? 0} />
            <KpiCard label="予約数" value={kpi.bookingCount ?? 0} change={kpi.bookingCountChange ?? 0} />
          </div>

          {/* --------------------------------------------------------------- */}
          {/* Charts                                                          */}
          {/* --------------------------------------------------------------- */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarChart data={kpi.deliveryTrend ?? []} title="配信効果推移" color="#6366f1" />
            <BarChart data={kpi.customerTrend ?? []} title="顧客成長推移" color="#10b981" />
          </div>

          {/* --------------------------------------------------------------- */}
          {/* Bottom section                                                  */}
          {/* --------------------------------------------------------------- */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CouponStatusCard issued={kpi.coupon?.issued ?? 0} used={kpi.coupon?.used ?? 0} />
            <BookingStatusCard weekTotal={kpi.booking?.weekTotal ?? 0} cancelRate={kpi.booking?.cancelRate ?? 0} />
          </div>
        </>
      )}
    </div>
  );
}
