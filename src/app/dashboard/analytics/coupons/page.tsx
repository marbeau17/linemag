'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyCoupon {
  date: string;
  issued: number;
  used: number;
}

interface TopCoupon {
  code: string;
  name: string;
  issued: number;
  used: number;
  usage_rate: number;
}

interface StatusBreakdown {
  status: string;
  label: string;
  count: number;
}

interface CouponsData {
  kpi: {
    total_issued: number;
    total_used: number;
    usage_rate: number;
    avg_discount: number;
  };
  daily: DailyCoupon[];
  top_coupons: TopCoupon[];
  status_breakdown: StatusBreakdown[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP');
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  issued: 'bg-blue-500',
  used: 'bg-green-500',
  expired: 'bg-amber-500',
  revoked: 'bg-red-500',
};

const STATUS_BG_LIGHT: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-700',
  used: 'bg-green-100 text-green-700',
  expired: 'bg-amber-100 text-amber-700',
  revoked: 'bg-red-100 text-red-700',
};

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <svg className="animate-spin w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CouponAnalyticsPage() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<CouponsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/charts?type=coupons&from=${from}&to=${to}`);
      if (!res.ok) throw new Error('クーポン分析データの取得に失敗しました');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chart helpers
  const dailyMax = data?.daily?.length
    ? Math.max(...data.daily.map((d) => Math.max(d.issued, d.used)), 1)
    : 1;

  const statusMax = data?.status_breakdown?.length
    ? Math.max(...data.status_breakdown.map((s) => s.count), 1)
    : 1;

  return (
    <div className="space-y-8">
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="mb-4">
        <Link href="/dashboard/analytics" className="text-sm text-slate-500 hover:text-green-600 transition-colors flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          分析ダッシュボードに戻る
        </Link>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-800">クーポン分析</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-slate-400 text-sm">〜</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* ── KPI Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="発行数"
              value={formatNumber(data?.kpi?.total_issued ?? 0)}
            />
            <KpiCard
              label="利用数"
              value={formatNumber(data?.kpi?.total_used ?? 0)}
            />
            <KpiCard
              label="利用率"
              value={formatPercent(data?.kpi?.usage_rate ?? 0)}
            />
            <KpiCard
              label="平均割引額"
              value={formatYen(data?.kpi?.avg_discount ?? 0)}
            />
          </div>

          {/* ── Coupon Usage Trend (issued vs used per day) ─────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">日別クーポン推移</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-blue-400" />
                <span className="text-xs text-slate-500">発行</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-500" />
                <span className="text-xs text-slate-500">利用</span>
              </div>
            </div>
            {data?.daily?.length ? (
              <div className="flex items-end gap-1 h-40 overflow-x-auto">
                {data.daily.map((d) => {
                  const issuedPct = (d.issued / dailyMax) * 100;
                  const usedPct = (d.used / dailyMax) * 100;
                  return (
                    <div
                      key={d.date}
                      className="group relative flex items-end gap-px flex-shrink-0"
                      style={{ width: `${Math.max(100 / data.daily.length, 16)}%`, minWidth: '16px' }}
                    >
                      {/* Issued bar */}
                      <div
                        className="flex-1 rounded-t bg-blue-400 transition-all"
                        style={{ height: `${Math.max(issuedPct, 2)}%` }}
                      />
                      {/* Used bar */}
                      <div
                        className="flex-1 rounded-t bg-green-500 transition-all"
                        style={{ height: `${Math.max(usedPct, 2)}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {d.date}: 発行{d.issued} / 利用{d.used}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-8 text-center">データがありません</p>
            )}
            {data?.daily && data.daily.length > 0 && (
              <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                <span>{data.daily[0]?.date}</span>
                {data.daily.length > 2 && (
                  <span>{data.daily[Math.floor(data.daily.length / 2)]?.date}</span>
                )}
                <span>{data.daily[data.daily.length - 1]?.date}</span>
              </div>
            )}
          </section>

          {/* ── Top Coupons Table ──────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">人気クーポン</h2>
            </div>
            {data?.top_coupons?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-100">
                      <th className="px-6 py-3">コード</th>
                      <th className="px-6 py-3">名前</th>
                      <th className="px-6 py-3 text-right">発行数</th>
                      <th className="px-6 py-3 text-right">利用数</th>
                      <th className="px-6 py-3 text-right">利用率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.top_coupons.map((c) => (
                      <tr key={c.code} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-slate-700">{c.code}</td>
                        <td className="px-6 py-3 text-slate-700">{c.name}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{formatNumber(c.issued)}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{formatNumber(c.used)}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.usage_rate >= 50
                              ? 'bg-green-100 text-green-700'
                              : c.usage_rate >= 20
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {formatPercent(c.usage_rate)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-8 text-center">データがありません</p>
            )}
          </section>

          {/* ── Status Breakdown ────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">ステータス内訳</h2>
            {data?.status_breakdown?.length ? (
              <div className="space-y-3">
                {data.status_breakdown.map((s) => {
                  const pct = (s.count / statusMax) * 100;
                  const barColor = STATUS_COLORS[s.status] ?? 'bg-slate-400';
                  const badgeClass = STATUS_BG_LIGHT[s.status] ?? 'bg-slate-100 text-slate-700';
                  return (
                    <div key={s.status} className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass} w-20 text-center`}>
                        {s.label}
                      </span>
                      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all`}
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-600 w-16 text-right">
                        {formatNumber(s.count)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-8 text-center">データがありません</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
