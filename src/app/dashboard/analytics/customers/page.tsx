'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyCustomers {
  date: string;
  count: number;
}

interface TierDistribution {
  tier: string;
  label: string;
  count: number;
  color: string;
}

interface FunnelStep {
  stage: string;
  label: string;
  count: number;
}

interface TagCount {
  tag: string;
  count: number;
}

interface CustomersData {
  kpi: {
    total_customers: number;
    new_customers: number;
    active_customers: number;
    churn_rate: number;
  };
  daily: DailyCustomers[];
  tags: TagCount[];
}

interface TiersData {
  tiers: TierDistribution[];
}

interface FunnelData {
  funnel: FunnelStep[];
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

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Tier color mapping
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<string, string> = {
  free: 'bg-slate-400',
  silver: 'bg-blue-400',
  gold: 'bg-amber-400',
  platinum: 'bg-purple-500',
};

const TIER_BG_LIGHT: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700',
  silver: 'bg-blue-100 text-blue-700',
  gold: 'bg-amber-100 text-amber-700',
  platinum: 'bg-purple-100 text-purple-700',
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

export default function CustomerAnalyticsPage() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<CustomersData | null>(null);
  const [tiers, setTiers] = useState<TiersData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch customers + tiers + funnel
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, tierRes, funnelRes] = await Promise.all([
        fetch(`/api/analytics/charts?type=customers&from=${from}&to=${to}`),
        fetch(`/api/analytics/charts?type=tiers`),
        fetch(`/api/analytics/charts?type=funnel`),
      ]);
      if (custRes.ok) setData(await custRes.json());
      if (tierRes.ok) setTiers(await tierRes.json());
      if (funnelRes.ok) setFunnel(await funnelRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chart helpers
  const dailyMax = data?.daily?.length
    ? Math.max(...data.daily.map((d) => d.count), 1)
    : 1;

  const tierMax = tiers?.tiers?.length
    ? Math.max(...tiers.tiers.map((t) => t.count), 1)
    : 1;

  const funnelMax = funnel?.funnel?.length
    ? Math.max(...funnel.funnel.map((f) => f.count), 1)
    : 1;

  const tagMax = data?.tags?.length
    ? Math.max(...data.tags.map((t) => t.count), 1)
    : 1;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-800">顧客分析</h1>
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

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* ── KPI Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="総顧客数"
              value={formatNumber(data?.kpi.total_customers ?? 0)}
            />
            <KpiCard
              label="新規顧客"
              value={formatNumber(data?.kpi.new_customers ?? 0)}
              sub={`${from} 〜 ${to}`}
            />
            <KpiCard
              label="アクティブ顧客"
              value={formatNumber(data?.kpi.active_customers ?? 0)}
            />
            <KpiCard
              label="離脱率"
              value={formatPercent(data?.kpi.churn_rate ?? 0)}
            />
          </div>

          {/* ── Customer Growth Chart ──────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">日別新規顧客数</h2>
            {data?.daily?.length ? (
              <div className="flex items-end gap-1 h-40 overflow-x-auto">
                {data.daily.map((d) => {
                  const pct = (d.count / dailyMax) * 100;
                  return (
                    <div
                      key={d.date}
                      className="group relative flex flex-col items-center flex-shrink-0"
                      style={{ width: `${Math.max(100 / data.daily.length, 12)}%`, minWidth: '12px' }}
                    >
                      <div
                        className="w-full rounded-t bg-green-500 transition-all"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute -top-8 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {d.date}: {d.count}人
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-8 text-center">データがありません</p>
            )}
            {/* X-axis labels (first, mid, last) */}
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

          {/* ── Tier Distribution ──────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">ティア分布</h2>
            {tiers?.tiers?.length ? (
              <div className="space-y-3">
                {tiers.tiers.map((t) => {
                  const pct = (t.count / tierMax) * 100;
                  const colorClass = TIER_COLORS[t.tier] ?? 'bg-slate-400';
                  const badgeClass = TIER_BG_LIGHT[t.tier] ?? 'bg-slate-100 text-slate-700';
                  return (
                    <div key={t.tier} className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass} w-20 text-center`}>
                        {t.label}
                      </span>
                      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colorClass} transition-all`}
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-600 w-16 text-right">
                        {formatNumber(t.count)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-8 text-center">データがありません</p>
            )}
          </section>

          {/* ── Customer Lifecycle Funnel ───────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">顧客ライフサイクルファネル</h2>
            {funnel?.funnel?.length ? (
              <div className="space-y-3">
                {funnel.funnel.map((step, idx) => {
                  const pct = (step.count / funnelMax) * 100;
                  const colors = [
                    'bg-green-400',
                    'bg-green-500',
                    'bg-emerald-500',
                    'bg-teal-600',
                  ];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={step.stage} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-600 w-16 shrink-0">
                        {step.label}
                      </span>
                      <div className="flex-1 flex items-center">
                        <div
                          className={`h-8 rounded ${color} flex items-center justify-end pr-3 transition-all`}
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        >
                          <span className="text-xs font-semibold text-white">
                            {formatNumber(step.count)}
                          </span>
                        </div>
                      </div>
                      {idx < funnel.funnel.length - 1 && (
                        <span className="text-slate-300 text-lg shrink-0">→</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-8 text-center">データがありません</p>
            )}
          </section>

          {/* ── Top Tags ───────────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">人気タグ</h2>
            {data?.tags?.length ? (
              <div className="space-y-2">
                {data.tags.map((t) => {
                  const pct = (t.count / tagMax) * 100;
                  return (
                    <div key={t.tag} className="flex items-center gap-3">
                      <span className="text-sm text-slate-600 w-28 truncate shrink-0">
                        {t.tag}
                      </span>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-500 w-12 text-right">
                        {formatNumber(t.count)}
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
