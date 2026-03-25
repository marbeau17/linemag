'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyTrend {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
}

interface TypeBreakdown {
  type: 'broadcast' | 'push' | 'scenario' | 'ab_test';
  count: number;
}

interface RecentDelivery {
  date: string;
  type: string;
  template: string;
  status: 'success' | 'failed' | 'partial';
  count: number;
}

interface DeliveryAnalytics {
  kpi: {
    totalSent: number;
    openRate: number;
    clickRate: number;
    failureRate: number;
  };
  trend: DailyTrend[];
  typeBreakdown: TypeBreakdown[];
  recentDeliveries: RecentDelivery[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  broadcast: '一斉配信',
  push: 'プッシュ配信',
  scenario: 'シナリオ配信',
  ab_test: 'A/Bテスト',
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  success: { label: '成功', cls: 'bg-green-100 text-green-700' },
  failed: { label: '失敗', cls: 'bg-red-100 text-red-700' },
  partial: { label: '一部失敗', cls: 'bg-amber-100 text-amber-700' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatNumber(n: number) {
  return n.toLocaleString('ja-JP');
}

function formatPercent(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeliveryAnalyticsPage() {
  const today = useMemo(() => new Date(), []);
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return d;
  }, [today]);

  const [from, setFrom] = useState(toDateInputValue(thirtyDaysAgo));
  const [to, setTo] = useState(toDateInputValue(today));
  const [data, setData] = useState<DeliveryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/delivery?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('配信分析データの取得に失敗しました');
      const json: DeliveryAnalytics = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute max value for the trend chart y-axis
  const trendMax = useMemo(() => {
    if (!data?.trend?.length) return 100;
    const max = Math.max(...data.trend.map((d) => d.sent));
    // Round up to a nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(max || 1)));
    return Math.ceil(max / magnitude) * magnitude || 100;
  }, [data]);

  // Compute max for type breakdown
  const typeMax = useMemo(() => {
    if (!data?.typeBreakdown?.length) return 100;
    return Math.max(...data.typeBreakdown.map((t) => t.count)) || 100;
  }, [data]);

  // Y-axis scale ticks (5 ticks)
  const yTicks = useMemo(() => {
    const step = trendMax / 4;
    return [trendMax, step * 3, step * 2, step, 0];
  }, [trendMax]);

  // ---------------------------------------------------------------------------
  // Spinner
  // ---------------------------------------------------------------------------
  const spinner = (
    <div className="flex items-center justify-center py-20">
      <svg
        className="animate-spin w-6 h-6 text-slate-300"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="ml-2 text-sm text-slate-400">読み込み中...</span>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ---- Breadcrumb ---- */}
      <div className="mb-4">
        <Link href="/dashboard/analytics" className="text-sm text-slate-500 hover:text-green-600 transition-colors flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          分析ダッシュボードに戻る
        </Link>
      </div>

      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">配信分析</h1>
          <p className="text-sm text-slate-400 mt-1">
            配信パフォーマンスの詳細分析
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
          />
          <span className="text-sm text-slate-400">〜</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '取得中...' : '適用'}
          </button>
        </div>
      </div>

      {/* ---- Error ---- */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {loading && !data ? (
        spinner
      ) : data ? (
        <>
          {/* ---- KPI Cards ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: '配信数',
                value: formatNumber(data.kpi?.totalSent ?? 0),
                sub: '合計配信メッセージ数',
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                  />
                ),
              },
              {
                label: '開封率',
                value: formatPercent(data.kpi?.openRate ?? 0),
                sub: 'メッセージ開封率',
                color: 'text-green-600',
                bg: 'bg-green-50',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                ),
              },
              {
                label: 'クリック率',
                value: formatPercent(data.kpi?.clickRate ?? 0),
                sub: 'リンククリック率',
                color: 'text-amber-600',
                bg: 'bg-amber-50',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
                  />
                ),
              },
              {
                label: '配信失敗率',
                value: formatPercent(data.kpi?.failureRate ?? 0),
                sub: 'エラー発生率',
                color: 'text-red-600',
                bg: 'bg-red-50',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                ),
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white rounded-xl border border-slate-200 p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`${kpi.bg} w-9 h-9 rounded-lg flex items-center justify-center`}
                  >
                    <svg
                      className={`w-5 h-5 ${kpi.color}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      {kpi.icon}
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {kpi.label}
                  </span>
                </div>
                <div className={`text-2xl font-bold ${kpi.color}`}>
                  {kpi.value}
                </div>
                <p className="text-xs text-slate-400 mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* ---- Delivery Trend Chart ---- */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              配信トレンド
            </h2>

            {!data.trend?.length ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                データがありません
              </p>
            ) : (
              <div className="flex">
                {/* Y-axis */}
                <div className="flex flex-col justify-between pr-2 text-right w-12 shrink-0 h-52">
                  {yTicks.map((t, i) => (
                    <span
                      key={i}
                      className="text-[10px] text-slate-400 leading-none"
                    >
                      {formatNumber(Math.round(t))}
                    </span>
                  ))}
                </div>

                {/* Chart area */}
                <div className="flex-1 overflow-x-auto">
                  <div className="flex items-end gap-3 h-52 min-w-max border-l border-b border-slate-200 pl-2 pb-1">
                    {data.trend.map((d) => {
                      const sentH =
                        trendMax > 0 ? (d.sent / trendMax) * 100 : 0;
                      const openH =
                        trendMax > 0 ? (d.opened / trendMax) * 100 : 0;
                      const clickH =
                        trendMax > 0 ? (d.clicked / trendMax) * 100 : 0;

                      return (
                        <div
                          key={d.date}
                          className="flex flex-col items-center gap-1"
                        >
                          {/* Bar group */}
                          <div className="flex items-end gap-0.5 h-44">
                            <div
                              className="w-3 rounded-t bg-blue-500 transition-all"
                              style={{ height: `${sentH}%` }}
                              title={`配信: ${formatNumber(d.sent)}`}
                            />
                            <div
                              className="w-3 rounded-t bg-green-500 transition-all"
                              style={{ height: `${openH}%` }}
                              title={`開封: ${formatNumber(d.opened)}`}
                            />
                            <div
                              className="w-3 rounded-t bg-amber-500 transition-all"
                              style={{ height: `${clickH}%` }}
                              title={`クリック: ${formatNumber(d.clicked)}`}
                            />
                          </div>
                          {/* X label */}
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {formatShortDate(d.date)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 ml-14">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span className="text-xs text-slate-500">配信</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-500" />
                <span className="text-xs text-slate-500">開封</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                <span className="text-xs text-slate-500">クリック</span>
              </div>
            </div>
          </div>

          {/* ---- Delivery by Type Breakdown ---- */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              配信タイプ別内訳
            </h2>

            {!data.typeBreakdown?.length ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                データがありません
              </p>
            ) : (
              <div className="space-y-3">
                {data.typeBreakdown.map((t) => {
                  const pct =
                    typeMax > 0 ? (t.count / typeMax) * 100 : 0;
                  const colors: Record<string, string> = {
                    broadcast: 'bg-blue-500',
                    push: 'bg-green-500',
                    scenario: 'bg-purple-500',
                    ab_test: 'bg-amber-500',
                  };
                  return (
                    <div key={t.type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-600">
                          {TYPE_LABELS[t.type] || t.type}
                        </span>
                        <span className="text-sm font-medium text-slate-700">
                          {formatNumber(t.count)}
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors[t.type] || 'bg-slate-400'} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---- Recent Deliveries Table ---- */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">
                最近の配信
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    日時
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    タイプ
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    テンプレート
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    配信数
                  </th>
                </tr>
              </thead>
              <tbody>
                {!data.recentDeliveries?.length ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-slate-400"
                    >
                      最近の配信データがありません
                    </td>
                  </tr>
                ) : (
                  (data.recentDeliveries ?? []).map((d, i) => {
                    const st = STATUS_LABELS[d.status] || {
                      label: d.status,
                      cls: 'bg-slate-100 text-slate-600',
                    };
                    return (
                      <tr
                        key={`${d.date}-${i}`}
                        className="border-b border-slate-50 hover:bg-slate-50/50"
                      >
                        <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(d.date)}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {TYPE_LABELS[d.type] || d.type}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {d.template}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700 text-right font-medium tabular-nums">
                          {formatNumber(d.count)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
