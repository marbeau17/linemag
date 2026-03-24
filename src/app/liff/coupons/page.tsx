'use client';

import { useState, useEffect, useCallback } from 'react';
import { CouponIssue } from '@/types/coupon';

// ---------------------------------------------------------------------------
// Hardcoded customer ID (LIFF auth comes later)
// ---------------------------------------------------------------------------
const CUSTOMER_ID = 'demo-customer-001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDiscount(type: string | undefined, value: number | undefined): string {
  if (!type || value === undefined) return '';
  switch (type) {
    case 'fixed':
      return `¥${value.toLocaleString()} OFF`;
    case 'percentage':
      return `${value}% OFF`;
    case 'free_shipping':
      return '送料無料';
    default:
      return String(value);
  }
}

function discountDisplay(type: string | undefined, value: number | undefined): { main: string; sub: string } {
  if (!type || value === undefined) return { main: '', sub: '' };
  switch (type) {
    case 'fixed':
      return { main: `¥${value.toLocaleString()}`, sub: 'OFF' };
    case 'percentage':
      return { main: `${value}%`, sub: 'OFF' };
    case 'free_shipping':
      return { main: '送料', sub: '無料' };
    default:
      return { main: String(value), sub: '' };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = 'available' | 'used';

export default function LiffCouponsPage() {
  const [tab, setTab] = useState<Tab>('available');
  const [coupons, setCoupons] = useState<CouponIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = tab === 'available' ? 'issued' : 'used';
      const res = await fetch(`/api/coupons/customer/${CUSTOMER_ID}?status=${status}`);
      if (!res.ok) throw new Error('クーポンの取得に失敗しました');
      const data = await res.json();
      setCoupons(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const isExpired = (coupon: CouponIssue) => {
    return coupon.status === 'expired' || new Date(coupon.expiresAt) < new Date();
  };

  const isUsedOrExpired = (coupon: CouponIssue) => {
    return coupon.status === 'used' || coupon.status === 'expired' || coupon.status === 'revoked';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#06C755] px-4 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">マイクーポン</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4">
        <div className="flex">
          <button
            onClick={() => setTab('available')}
            className={`flex-1 py-3.5 text-sm font-semibold text-center transition-colors relative ${
              tab === 'available'
                ? 'text-[#06C755]'
                : 'text-slate-400'
            }`}
          >
            利用可能
            {tab === 'available' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06C755] rounded-t" />
            )}
          </button>
          <button
            onClick={() => setTab('used')}
            className={`flex-1 py-3.5 text-sm font-semibold text-center transition-colors relative ${
              tab === 'used'
                ? 'text-[#06C755]'
                : 'text-slate-400'
            }`}
          >
            利用済み
            {tab === 'used' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06C755] rounded-t" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <svg
              className="animate-spin w-8 h-8 text-[#06C755] mb-3"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-slate-400">読み込み中...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && coupons.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
              </svg>
            </div>
            <p className="text-sm text-slate-400">
              {tab === 'available' ? '利用可能なクーポンはありません' : '利用済みのクーポンはありません'}
            </p>
          </div>
        )}

        {/* Coupon cards */}
        {!loading && !error && coupons.map((coupon) => {
          const inactive = isUsedOrExpired(coupon);
          const expired = isExpired(coupon);
          const disc = discountDisplay(coupon.discountType, coupon.discountValue);

          return (
            <div
              key={coupon.id}
              className={`relative rounded-2xl overflow-hidden shadow-sm transition-all ${
                inactive
                  ? 'bg-slate-50 border border-slate-200 opacity-70'
                  : 'bg-white border-2 border-green-200'
              }`}
            >
              {/* Used / Expired overlay stamp */}
              {inactive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div
                    className={`px-6 py-2 rounded-lg border-4 transform -rotate-12 ${
                      coupon.status === 'used'
                        ? 'border-slate-400 text-slate-400'
                        : coupon.status === 'revoked'
                        ? 'border-red-300 text-red-300'
                        : 'border-orange-300 text-orange-300'
                    }`}
                  >
                    <span className="text-2xl font-black tracking-widest">
                      {coupon.status === 'used' ? '利用済み' : coupon.status === 'revoked' ? '取消済み' : '期限切れ'}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex">
                {/* Left: Discount display */}
                <div
                  className={`flex flex-col items-center justify-center w-28 shrink-0 py-5 ${
                    inactive ? 'bg-slate-100' : 'bg-green-50'
                  }`}
                >
                  <span
                    className={`text-2xl font-black leading-none ${
                      inactive ? 'text-slate-400' : 'text-[#06C755]'
                    }`}
                  >
                    {disc.main}
                  </span>
                  {disc.sub && (
                    <span
                      className={`text-sm font-bold mt-0.5 ${
                        inactive ? 'text-slate-400' : 'text-[#06C755]'
                      }`}
                    >
                      {disc.sub}
                    </span>
                  )}
                </div>

                {/* Dotted separator */}
                <div className="flex flex-col items-center justify-center w-0 relative">
                  <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-slate-200" />
                </div>

                {/* Right: Details */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className={`text-sm font-bold leading-snug ${
                        inactive ? 'text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {coupon.couponName || 'クーポン'}
                    </h3>
                    {/* Status badge */}
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        coupon.status === 'issued'
                          ? 'bg-green-100 text-green-700'
                          : coupon.status === 'used'
                          ? 'bg-slate-200 text-slate-500'
                          : coupon.status === 'expired'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {coupon.status === 'issued'
                        ? '利用可能'
                        : coupon.status === 'used'
                        ? '使用済み'
                        : coupon.status === 'expired'
                        ? '期限切れ'
                        : '取消済み'}
                    </span>
                  </div>

                  {/* Coupon code (copyable) */}
                  <button
                    onClick={() => handleCopy(coupon.issueCode)}
                    className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                      inactive
                        ? 'bg-slate-100 text-slate-400'
                        : copiedCode === coupon.issueCode
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                    }`}
                  >
                    {copiedCode === coupon.issueCode ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        コピー済み
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        {coupon.issueCode}
                      </>
                    )}
                  </button>

                  {/* Expiry date */}
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      有効期限: {formatDate(coupon.expiresAt)}
                      {!inactive && expired && (
                        <span className="ml-1 text-orange-500 font-medium">（期限切れ）</span>
                      )}
                    </span>
                  </div>

                  {/* Used date */}
                  {coupon.usedAt && (
                    <div className="mt-1 text-[11px] text-slate-400">
                      使用日: {formatDate(coupon.usedAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
