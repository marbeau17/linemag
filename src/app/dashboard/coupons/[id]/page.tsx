'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

/* ───── types ───── */

interface CouponMaster {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase?: number;
  valid_from?: string;
  valid_until?: string;
  max_issues?: number;
  uses_per_customer?: number;
}

interface CouponStats {
  total_issued: number;
  used: number;
  revoked: number;
  expired: number;
}

interface IssuedCoupon {
  id: string;
  issue_code: string;
  customer_id: string;
  customer_name: string;
  status: 'active' | 'used' | 'revoked' | 'expired';
  issued_at: string;
  expires_at?: string;
  used_at?: string;
}

interface CustomerOption {
  id: string;
  display_name: string;
  line_user_id: string;
  picture_url?: string;
}

/* ───── helpers ───── */

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  used: 'bg-blue-50 text-blue-700 border-blue-200',
  revoked: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABELS: Record<string, string> = {
  active: '有効',
  used: '使用済',
  revoked: '取消',
  expired: '期限切れ',
};

/* ───── spinner ───── */

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <svg className="animate-spin w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

/* ───── issue modal ───── */

function IssueModal({
  couponId,
  onClose,
  onIssued,
}: {
  couponId: string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const searchCustomers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setCustomers([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/crm/customers?search=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCustomers(data.customers ?? data);
    } catch {
      setCustomers([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCustomers(value), 300);
  }

  function toggleCustomer(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleIssue() {
    if (selected.size === 0) return;
    setIssuing(true);
    setError(null);
    try {
      const res = await fetch(`/api/coupons/${couponId}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_ids: Array.from(selected),
          expires_at: expiresAt || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? '配布に失敗しました');
      }
      onIssued();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800">クーポン配布</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* search */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">顧客を検索</label>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="名前またはLINE IDで検索..."
              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
            />
          </div>

          {/* customer list */}
          <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto">
            {searching && (
              <div className="flex justify-center py-4">
                <svg className="animate-spin w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
            {!searching && customers.length === 0 && search.trim() && (
              <p className="text-sm text-slate-400 text-center py-4">該当する顧客が見つかりません</p>
            )}
            {!searching && customers.length === 0 && !search.trim() && (
              <p className="text-sm text-slate-400 text-center py-4">検索してください</p>
            )}
            {!searching &&
              customers.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleCustomer(c.id)}
                    className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                  {c.picture_url ? (
                    <img src={c.picture_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 grid place-items-center text-white text-xs font-bold">
                      {c.display_name?.charAt(0) ?? '?'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{c.display_name}</p>
                    <p className="text-xs text-slate-400 truncate">{c.line_user_id}</p>
                  </div>
                </label>
              ))}
          </div>

          {selected.size > 0 && (
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-green-600">{selected.size}名</span> 選択中
            </p>
          )}

          {/* expiry date */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">有効期限（任意）</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleIssue}
            disabled={issuing || selected.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {issuing ? '配布中...' : `配布する（${selected.size}名）`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───── page ───── */

export default function CouponDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [coupon, setCoupon] = useState<CouponMaster | null>(null);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [issued, setIssued] = useState<IssuedCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [showModal, setShowModal] = useState(false);

  /* ── fetch ── */

  const fetchMaster = useCallback(async () => {
    const res = await fetch(`/api/coupons/${id}`);
    if (!res.ok) throw new Error('クーポン情報の取得に失敗しました');
    return res.json();
  }, [id]);

  const fetchIssued = useCallback(async () => {
    const res = await fetch(`/api/coupons/${id}/issue`);
    if (!res.ok) throw new Error('配布一覧の取得に失敗しました');
    return res.json();
  }, [id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [masterData, issuedData] = await Promise.all([fetchMaster(), fetchIssued()]);
      setCoupon(masterData.coupon ?? masterData);
      setStats(masterData.stats ?? null);
      setIssued(issuedData.issued ?? issuedData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [fetchMaster, fetchIssued]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── toggle active ── */

  async function handleToggleActive() {
    if (!coupon) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/coupons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      const updated = await res.json();
      setCoupon(updated.coupon ?? updated);
    } catch {
      // silently fail
    } finally {
      setToggling(false);
    }
  }

  /* ── render ── */

  if (loading) return <Spinner />;

  if (error || !coupon) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/coupons" className="text-sm text-green-600 hover:text-green-700 font-medium">
          &larr; クーポン一覧に戻る
        </Link>
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error ?? 'クーポンが見つかりません'}
        </div>
      </div>
    );
  }

  const usageRate =
    stats && stats.total_issued > 0
      ? ((stats.used / stats.total_issued) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <Link
        href="/dashboard/coupons"
        className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        クーポン一覧に戻る
      </Link>

      {/* ─── Header ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 grid place-items-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800 truncate">{coupon.name}</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  {coupon.code}
                </span>
              </div>
            </div>
          </div>
          {/* active toggle */}
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 disabled:opacity-50 ${
              coupon.is_active ? 'bg-green-500' : 'bg-slate-300'
            }`}
            aria-label={coupon.is_active ? '無効にする' : '有効にする'}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                coupon.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="mt-1 ml-[52px] text-xs text-slate-500">
          {coupon.is_active ? (
            <span className="text-green-600 font-medium">有効</span>
          ) : (
            <span className="text-slate-400 font-medium">無効</span>
          )}
        </p>
      </div>

      {/* ─── Two-column: Info + Stats ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">クーポン情報</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-xs text-slate-500">割引タイプ</dt>
              <dd className="text-sm font-semibold text-slate-800">
                {coupon.discount_type === 'percentage' ? '割引率（%）' : '固定額（円）'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-slate-500">割引値</dt>
              <dd className="text-sm font-semibold text-slate-800">
                {coupon.discount_type === 'percentage'
                  ? `${coupon.discount_value}%`
                  : `${coupon.discount_value.toLocaleString()}円`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-slate-500">最低購入額</dt>
              <dd className="text-sm font-semibold text-slate-800">
                {coupon.min_purchase != null ? `${coupon.min_purchase.toLocaleString()}円` : '-'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-slate-500">有効期間</dt>
              <dd className="text-sm font-semibold text-slate-800">
                {coupon.valid_from && coupon.valid_until
                  ? `${formatDateShort(coupon.valid_from)} ~ ${formatDateShort(coupon.valid_until)}`
                  : coupon.valid_from
                    ? `${formatDateShort(coupon.valid_from)} ~`
                    : coupon.valid_until
                      ? `~ ${formatDateShort(coupon.valid_until)}`
                      : '-'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-slate-500">最大配布数</dt>
              <dd className="text-sm font-semibold text-slate-800">
                {coupon.max_issues != null ? `${coupon.max_issues.toLocaleString()}枚` : '無制限'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-slate-500">1顧客あたり利用回数</dt>
              <dd className="text-sm font-semibold text-slate-800">
                {coupon.uses_per_customer != null ? `${coupon.uses_per_customer}回` : '無制限'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Stats card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">配布統計</h2>
          {stats ? (
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-xs text-slate-500">配布数</dt>
                <dd className="text-sm font-semibold text-slate-800">{stats.total_issued.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-slate-500">使用済</dt>
                <dd className="text-sm font-semibold text-blue-600">{stats.used.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-slate-500">取消</dt>
                <dd className="text-sm font-semibold text-red-600">{stats.revoked.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-slate-500">期限切れ</dt>
                <dd className="text-sm font-semibold text-slate-500">{stats.expired.toLocaleString()}</dd>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between">
                <dt className="text-xs text-slate-500">利用率</dt>
                <dd className="text-sm font-bold text-green-600">{usageRate}%</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">統計データなし</p>
          )}
        </div>
      </div>

      {/* ─── Issue section ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800">配布済みクーポン</h2>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            クーポン配布
          </button>
        </div>

        {issued.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">配布済みのクーポンはありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    配布コード
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    顧客名
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    配布日
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    有効期限
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    使用日
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issued.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{item.issue_code}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{item.customer_name}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          STATUS_STYLES[item.status] ?? STATUS_STYLES.active
                        }`}
                      >
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">{formatDate(item.issued_at)}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">
                      {item.expires_at ? formatDateShort(item.expires_at) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">
                      {item.used_at ? formatDate(item.used_at) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Issue Modal ─── */}
      {showModal && (
        <IssueModal
          couponId={id}
          onClose={() => setShowModal(false)}
          onIssued={loadAll}
        />
      )}
    </div>
  );
}
