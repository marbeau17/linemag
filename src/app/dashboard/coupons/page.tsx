'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CouponMaster, DISCOUNT_TYPE_LABELS } from '@/types/coupon';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function relativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 0) {
    // Future date
    const absSec = Math.abs(diffSec);
    const days = Math.floor(absSec / 86400);
    if (days === 0) return '今日';
    if (days < 30) return `${days}日後`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}ヶ月後`;
    return `${Math.floor(months / 12)}年後`;
  }

  if (diffSec < 60) return 'たった今';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}日前`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}ヶ月前`;
  return `${Math.floor(diffMonth / 12)}年前`;
}

function formatDiscount(type: string, value: number): string {
  switch (type) {
    case 'fixed':
      return `¥${value.toLocaleString()}`;
    case 'percentage':
      return `${value}%`;
    case 'free_shipping':
      return '送料無料';
    default:
      return String(value);
  }
}

function discountTypeBadge(type: string): { label: string; className: string } {
  switch (type) {
    case 'fixed':
      return { label: '固定額', className: 'bg-blue-100 text-blue-700' };
    case 'percentage':
      return { label: 'パーセント', className: 'bg-purple-100 text-purple-700' };
    case 'free_shipping':
      return { label: '送料無料', className: 'bg-amber-100 text-amber-700' };
    default:
      return { label: DISCOUNT_TYPE_LABELS[type] ?? type, className: 'bg-slate-100 text-slate-600' };
  }
}

function couponStatus(coupon: CouponMaster): { label: string; className: string } {
  const now = Date.now();
  const until = new Date(coupon.validUntil).getTime();

  if (!coupon.isActive) {
    return { label: '無効', className: 'bg-slate-100 text-slate-500' };
  }
  if (until < now) {
    return { label: '期限切れ', className: 'bg-red-100 text-red-700' };
  }
  return { label: '有効', className: 'bg-green-100 text-green-700' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coupons?activeOnly=${activeOnly}`);
      if (!res.ok) throw new Error('クーポン一覧の取得に失敗しました');
      const data = await res.json();
      setCoupons(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">クーポン管理</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? '読み込み中...' : `${coupons.length}件のクーポン`}
          </p>
        </div>
        <Link
          href="/dashboard/coupons/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新規作成
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">表示:</span>
          <button
            onClick={() => setActiveOnly(false)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              !activeOnly
                ? 'bg-green-100 text-green-700'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setActiveOnly(true)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeOnly
                ? 'bg-green-100 text-green-700'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            有効のみ
          </button>
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
                  クーポンコード
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  クーポン名
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  割引タイプ
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  割引額
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  有効期間
                </th>
                <th className="text-center px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  発行上限
                </th>
                <th className="text-center px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && coupons.length === 0 ? (
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
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-400">
                    クーポンがまだ登録されていません。「新規作成」ボタンから作成してください。
                  </td>
                </tr>
              ) : (
                coupons.map((c) => {
                  const status = couponStatus(c);
                  const dtBadge = discountTypeBadge(c.discountType);

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Code */}
                      <td className="px-5 py-3">
                        <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {c.code}
                        </code>
                      </td>

                      {/* Name */}
                      <td className="px-5 py-3 text-sm font-medium text-slate-800">
                        {c.name}
                      </td>

                      {/* Discount type badge */}
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${dtBadge.className}`}
                        >
                          {dtBadge.label}
                        </span>
                      </td>

                      {/* Discount value */}
                      <td className="px-5 py-3 text-sm text-slate-700 text-right tabular-nums font-medium">
                        {formatDiscount(c.discountType, c.discountValue)}
                      </td>

                      {/* Valid period */}
                      <td className="px-5 py-3">
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(c.validFrom)}
                        </div>
                        <div className="text-xs text-slate-400 whitespace-nowrap">
                          〜 {formatDate(c.validUntil)}
                          <span className="ml-1 text-slate-300">
                            ({relativeDate(c.validUntil)})
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      {/* Max issues */}
                      <td className="px-5 py-3 text-sm text-slate-500 text-right tabular-nums">
                        {c.maxIssues !== null ? c.maxIssues.toLocaleString() : '無制限'}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3 text-center">
                        <Link
                          href={`/dashboard/coupons/${c.id}`}
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
      </div>
    </div>
  );
}
