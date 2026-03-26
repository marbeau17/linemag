'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Customer {
  id: string;
  lineUserId: string;
  displayName: string | null;
  fullName: string | null;
  email?: string | null;
  pictureUrl?: string | null;
  membershipTier: string;
  messageCount: number;
  lastSeenAt: string;
  prefecture?: string | null;
  engagementScore: number;
  lifecycleStage: string;
  ageGroup: string | null;
  acquisitionSource: string | null;
}

interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  perPage: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PER_PAGE = 20;

const TIER_OPTIONS = [
  { value: '', label: '全て' },
  { value: 'free', label: 'Free' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
] as const;

const TIER_STYLES: Record<string, string> = {
  free: 'bg-slate-100 text-slate-600',
  silver: 'bg-blue-100 text-blue-700',
  gold: 'bg-amber-100 text-amber-700',
  platinum: 'bg-purple-100 text-purple-700',
};

const AGE_GROUP_OPTIONS = [
  { value: '', label: '全て' },
  { value: '10代', label: '10代' },
  { value: '20代', label: '20代' },
  { value: '30代', label: '30代' },
  { value: '40代', label: '40代' },
  { value: '50代', label: '50代' },
  { value: '60代以上', label: '60代以上' },
] as const;

const LIFECYCLE_OPTIONS = [
  { value: '', label: '全て' },
  { value: '新規', label: '新規' },
  { value: 'アクティブ', label: 'アクティブ' },
  { value: '休眠', label: '休眠' },
  { value: '離脱', label: '離脱' },
] as const;

const LIFECYCLE_STYLES: Record<string, string> = {
  '新規': 'bg-emerald-100 text-emerald-700',
  'アクティブ': 'bg-blue-100 text-blue-700',
  '休眠': 'bg-amber-100 text-amber-700',
  '離脱': 'bg-red-100 text-red-700',
};

const ACQUISITION_SOURCE_OPTIONS = [
  { value: '', label: '全て' },
  { value: 'QR', label: 'QR' },
  { value: 'URL', label: 'URL' },
  { value: '検索', label: '検索' },
  { value: '広告', label: '広告' },
  { value: '紹介', label: '紹介' },
] as const;

const SORT_OPTIONS = [
  { value: 'last_seen_at', label: '最終接触日' },
  { value: 'message_count', label: 'メッセージ数' },
  { value: 'engagement_score', label: 'エンゲージメント' },
] as const;

const PREFECTURES = [
  '', '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'たった今';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}日前`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}ヶ月前`;
  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear}年前`;
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.slice(0, 1).toUpperCase();
}

function truncate(str: string | null | undefined, len: number): string {
  if (!str) return '-';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function engagementColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  if (score >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CrmPage() {
  const pathname = usePathname();
  const subNav = [
    { label: '顧客一覧', href: '/dashboard/crm' },
    { label: 'セグメント', href: '/dashboard/crm/segments' },
  ];

  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tier, setTier] = useState('');
  const [prefecture, setPrefecture] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [lifecycleStage, setLifecycleStage] = useState('');
  const [acquisitionSource, setAcquisitionSource] = useState('');
  const [sortBy, setSortBy] = useState('last_seen_at');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [tier, prefecture, ageGroup, lifecycleStage, acquisitionSource, sortBy]);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(PER_PAGE),
        sortBy,
        sortOrder: 'desc',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (tier) params.set('tier', tier);
      if (prefecture) params.set('prefecture', prefecture);
      if (ageGroup) params.set('ageGroup', ageGroup);
      if (lifecycleStage) params.set('lifecycleStage', lifecycleStage);
      if (acquisitionSource) params.set('acquisitionSource', acquisitionSource);

      const res = await fetch(`/api/crm/customers?${params.toString()}`);
      if (!res.ok) throw new Error('顧客データの取得に失敗しました');
      const data: CustomersResponse = await res.json();
      setCustomers(data.customers ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, tier, prefecture, ageGroup, lifecycleStage, acquisitionSource, sortBy]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  function pageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  const selectClass =
    'px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 pb-3">
        {subNav.map((item) => {
          const active = item.href === '/dashboard/crm'
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">顧客一覧</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? '読み込み中...' : `${total.toLocaleString()}件の顧客`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 3a7.5 7.5 0 006.15 13.65z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名前・メールで検索..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
            />
          </div>

          {/* Tier filter */}
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className={selectClass}
          >
            {TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Prefecture filter */}
          <select
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className={selectClass}
          >
            <option value="">都道府県</option>
            {PREFECTURES.filter(Boolean).map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>

          {/* Age group filter */}
          <select
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            className={selectClass}
          >
            <option value="">年齢層</option>
            {AGE_GROUP_OPTIONS.filter((o) => o.value).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Lifecycle filter */}
          <select
            value={lifecycleStage}
            onChange={(e) => setLifecycleStage(e.target.value)}
            className={selectClass}
          >
            <option value="">ライフサイクル</option>
            {LIFECYCLE_OPTIONS.filter((o) => o.value).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Acquisition source filter */}
          <select
            value={acquisitionSource}
            onChange={(e) => setAcquisitionSource(e.target.value)}
            className={selectClass}
          >
            <option value="">流入経路</option>
            {ACQUISITION_SOURCE_OPTIONS.filter((o) => o.value).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={selectClass}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  顧客
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  LINE ID
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  会員ランク
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  メッセージ数
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  最終接触
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  エンゲージメント
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  ステージ
                </th>
                <th className="text-center px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-400">
                    <svg
                      className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-300"
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
                    読み込み中...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-400">
                    該当する顧客が見つかりませんでした。
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const name = c.fullName || c.displayName;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Profile + Name */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {c.pictureUrl ? (
                            <img
                              src={c.pictureUrl}
                              alt={name || ''}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 grid place-items-center text-xs font-bold shrink-0">
                              {initials(name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {name || '-'}
                            </p>
                            {c.email && (
                              <p className="text-xs text-slate-400 truncate">{c.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* LINE ID */}
                      <td className="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {truncate(c.lineUserId, 12)}
                      </td>

                      {/* Tier badge */}
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            TIER_STYLES[c.membershipTier] ?? TIER_STYLES.free
                          }`}
                        >
                          {c.membershipTier}
                        </span>
                      </td>

                      {/* Message count */}
                      <td className="px-5 py-3 text-sm text-slate-700 text-right tabular-nums">
                        {(c.messageCount ?? 0).toLocaleString()}
                      </td>

                      {/* Last seen */}
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {relativeTime(c.lastSeenAt)}
                      </td>

                      {/* Engagement score bar */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className={`h-full rounded-full ${engagementColor(c.engagementScore ?? 0)}`}
                              style={{ width: `${Math.min(100, Math.max(0, c.engagementScore ?? 0))}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums w-7 text-right">
                            {c.engagementScore ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Lifecycle stage badge */}
                      <td className="px-5 py-3">
                        {c.lifecycleStage ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              LIFECYCLE_STYLES[c.lifecycleStage] ?? 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {c.lifecycleStage}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3 text-center">
                        <Link
                          href={`/dashboard/crm/${c.id}`}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          詳細
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              {((page - 1) * PER_PAGE + 1).toLocaleString()} -{' '}
              {Math.min(page * PER_PAGE, total).toLocaleString()} / {total.toLocaleString()}件
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 text-xs font-medium text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                前へ
              </button>

              {pageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`dot-${i}`} className="px-1.5 text-xs text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                      p === page
                        ? 'bg-green-100 text-green-700'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1 text-xs font-medium text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
