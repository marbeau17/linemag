'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

interface KpiData {
  friends: number | null;
  activeScenarios: number | null;
  broadcasts: number | null;
  coupons: number | null;
  reservations: number | null;
  segments: number | null;
}

interface HistoryItem {
  id?: string;
  sentAt?: string;
  createdAt?: string;
  title?: string;
  templateId?: string;
  status?: string;
  recipientCount?: number;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function UsersIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.997M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function BoltIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function MegaphoneIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
    </svg>
  );
}

function TicketIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  );
}

function CalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function TagIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  );
}

function ChartBarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ChevronRightIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="rounded-2xl p-5 bg-slate-100 animate-pulse h-[164px]">
      <div className="flex items-center justify-between mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-200" />
        <div className="w-5 h-5 rounded bg-slate-200" />
      </div>
      <div className="h-10 w-20 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-24 bg-slate-200 rounded mb-1" />
      <div className="h-3 w-32 bg-slate-200 rounded" />
    </div>
  );
}

// ─── KPI Card Config ────────────────────────────────────────────────────────

interface KpiCardConfig {
  key: keyof KpiData;
  label: string;
  description: string;
  link: string;
  gradient: string;
  icon: React.ReactNode;
}

const kpiCards: KpiCardConfig[] = [
  {
    key: 'friends',
    label: '友だち数',
    description: 'LINE友だち登録数',
    link: '/dashboard/crm',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    icon: <UsersIcon className="w-5 h-5 text-white" />,
  },
  {
    key: 'activeScenarios',
    label: 'アクティブシナリオ',
    description: '実行中の自動配信',
    link: '/dashboard/ma',
    gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
    icon: <BoltIcon className="w-5 h-5 text-white" />,
  },
  {
    key: 'broadcasts',
    label: '配信数',
    description: '一斉配信の実績',
    link: '/dashboard/history',
    gradient: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
    icon: <MegaphoneIcon className="w-5 h-5 text-white" />,
  },
  {
    key: 'coupons',
    label: 'クーポン',
    description: '登録済みクーポン数',
    link: '/dashboard/coupons',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    icon: <TicketIcon className="w-5 h-5 text-white" />,
  },
  {
    key: 'reservations',
    label: '予約数',
    description: '今月の予約件数',
    link: '/dashboard/reservations',
    gradient: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
    icon: <CalendarIcon className="w-5 h-5 text-white" />,
  },
  {
    key: 'segments',
    label: 'セグメント',
    description: '顧客セグメント数',
    link: '/dashboard/crm/segments',
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)',
    icon: <TagIcon className="w-5 h-5 text-white" />,
  },
];

// ─── Quick Action Config ────────────────────────────────────────────────────

interface QuickActionConfig {
  label: string;
  description: string;
  href: string;
  iconBg: string;
  icon: React.ReactNode;
}

const quickActions: QuickActionConfig[] = [
  {
    label: '友だち管理',
    description: '友だちの一覧・タグ管理',
    href: '/dashboard/crm',
    iconBg: 'bg-green-50',
    icon: <UsersIcon className="w-5 h-5 text-green-600" />,
  },
  {
    label: 'シナリオ配信',
    description: '自動配信シナリオの作成',
    href: '/dashboard/ma',
    iconBg: 'bg-blue-50',
    icon: <BoltIcon className="w-5 h-5 text-blue-600" />,
  },
  {
    label: '一斉配信',
    description: '記事を選んで一斉配信',
    href: '/dashboard/broadcast',
    iconBg: 'bg-purple-50',
    icon: <MegaphoneIcon className="w-5 h-5 text-purple-600" />,
  },
  {
    label: 'クーポン管理',
    description: 'クーポンの作成・配布',
    href: '/dashboard/coupons',
    iconBg: 'bg-amber-50',
    icon: <TicketIcon className="w-5 h-5 text-amber-600" />,
  },
  {
    label: '予約管理',
    description: '相談予約の管理',
    href: '/dashboard/reservations',
    iconBg: 'bg-rose-50',
    icon: <CalendarIcon className="w-5 h-5 text-rose-600" />,
  },
  {
    label: '分析レポート',
    description: 'KPI分析・レポート',
    href: '/dashboard/analytics',
    iconBg: 'bg-teal-50',
    icon: <ChartBarIcon className="w-5 h-5 text-teal-600" />,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCount(value: number | null): string {
  if (value === null) return '-';
  return value.toLocaleString();
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

function statusBadge(status?: string) {
  switch (status) {
    case 'sent':
    case 'success':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          送信済み
        </span>
      );
    case 'failed':
    case 'error':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          失敗
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          送信中
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          {status || '不明'}
        </span>
      );
  }
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KpiData>({
    friends: null,
    activeScenarios: null,
    broadcasts: null,
    coupons: null,
    reservations: null,
    segments: null,
  });
  const [loading, setLoading] = useState(true);
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    async function fetchKpis() {
      try {
        const [
          friendsRes,
          scenariosRes,
          historyRes,
          couponsRes,
          reservationsRes,
          segmentsRes,
        ] = await Promise.allSettled([
          fetch('/api/crm/customers/count'),
          fetch('/api/ma/scenarios'),
          fetch('/api/line/history'),
          fetch('/api/coupons'),
          fetch('/api/booking/reservations/stats'),
          fetch('/api/crm/segments'),
        ]);

        const data: KpiData = {
          friends: null,
          activeScenarios: null,
          broadcasts: null,
          coupons: null,
          reservations: null,
          segments: null,
        };

        // Friends count
        if (friendsRes.status === 'fulfilled' && friendsRes.value.ok) {
          const json = await friendsRes.value.json();
          data.friends = json.count ?? 0;
        }

        // Active scenarios count
        if (scenariosRes.status === 'fulfilled' && scenariosRes.value.ok) {
          const json = await scenariosRes.value.json();
          const scenarios = json.scenarios ?? [];
          data.activeScenarios = scenarios.filter(
            (s: { status?: string }) => s.status === 'active'
          ).length;
        }

        // Broadcasts count
        if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
          const json = await historyRes.value.json();
          const history = json.history ?? [];
          data.broadcasts = history.length;
        }

        // Coupons count
        if (couponsRes.status === 'fulfilled' && couponsRes.value.ok) {
          const json = await couponsRes.value.json();
          // API returns array directly or { masters: [...] }
          const list = Array.isArray(json) ? json : json.masters ?? [];
          data.coupons = list.length;
        }

        // Reservations count (this month)
        if (reservationsRes.status === 'fulfilled' && reservationsRes.value.ok) {
          const json = await reservationsRes.value.json();
          data.reservations = json.totalThisMonth ?? 0;
        }

        // Segments count
        if (segmentsRes.status === 'fulfilled' && segmentsRes.value.ok) {
          const json = await segmentsRes.value.json();
          const segments = json.segments ?? [];
          data.segments = segments.length;
        }

        setKpi(data);
      } catch (err) {
        console.error('Failed to fetch KPI data:', err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchRecentHistory() {
      try {
        const res = await fetch('/api/line/history?limit=5');
        if (res.ok) {
          const json = await res.json();
          setRecentHistory(json.history ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setHistoryLoading(false);
      }
    }

    fetchKpis();
    fetchRecentHistory();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>
          <p className="text-sm text-slate-500">LINE公式アカウント CRM 管理画面</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-700">システム稼働中</span>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpiCards.map((card) => (
              <Link
                key={card.key}
                href={card.link}
                className="block rounded-2xl p-5 text-white shadow-sm hover:shadow-md transition-shadow"
                style={{ background: card.gradient }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 rounded-xl bg-white/20 grid place-items-center">
                    {card.icon}
                  </div>
                  <ChevronRightIcon className="w-5 h-5 opacity-60" />
                </div>
                <div className="text-4xl font-bold mb-1">
                  {formatCount(kpi[card.key])}
                </div>
                <div className="text-sm font-semibold opacity-90">{card.label}</div>
                <div className="text-xs opacity-70">{card.description}</div>
              </Link>
            ))}
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">クイックアクション</h2>
          <span className="text-sm text-slate-400">6件のアクション</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-green-200 hover:shadow-sm transition-all group"
            >
              <div
                className={`w-12 h-12 rounded-xl ${action.iconBg} grid place-items-center shrink-0`}
              >
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">{action.label}</div>
                <div className="text-xs text-slate-500">{action.description}</div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-green-500 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent Activity ────────────────────────────────────────────── */}
      <div className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">最近のアクティビティ</h2>
          <Link
            href="/dashboard/history"
            className="text-sm text-green-600 hover:text-green-700 font-medium"
          >
            すべて表示
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {historyLoading ? (
            <div className="p-6">
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-slate-100" />
                    <div className="flex-1">
                      <div className="h-4 w-48 bg-slate-100 rounded mb-1" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </div>
                    <div className="h-5 w-16 bg-slate-100 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ) : recentHistory.length === 0 ? (
            <div className="p-8 text-center">
              <MegaphoneIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">まだ配信履歴がありません</p>
            </div>
          ) : (
            recentHistory.map((item, idx) => (
              <div key={item.id ?? idx} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 grid place-items-center shrink-0">
                  <MegaphoneIcon className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">
                    {item.title || item.templateId || '一斉配信'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <ClockIcon className="w-3.5 h-3.5" />
                    <span>
                      {formatTime(item.sentAt || item.createdAt || '')}
                    </span>
                    {item.recipientCount != null && (
                      <span className="ml-2">{item.recipientCount}人に送信</span>
                    )}
                  </div>
                </div>
                {statusBadge(item.status)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
