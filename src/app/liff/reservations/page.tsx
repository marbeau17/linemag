'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Hardcoded customer ID (LIFF auth comes later)
// ---------------------------------------------------------------------------
const CUSTOMER_ID = 'demo-customer-001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Reservation {
  id: string;
  customerId: string;
  consultantId: string;
  status: 'pending' | 'confirmed' | 'reminded' | 'completed' | 'cancelled' | 'no_show';
  serviceType: string;
  notes: string | null;
  meetUrl: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  consultantName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = weekdays[d.getDay()];
  return `${month}/${day}（${weekday}）`;
}

function formatTime(time: string): string {
  // "09:00:00" -> "9:00"
  const [h, m] = time.split(':');
  return `${parseInt(h, 10)}:${m}`;
}

function serviceLabel(type: string): string {
  const labels: Record<string, string> = {
    online_consultation: 'オンライン相談',
    career_counseling: 'キャリアカウンセリング',
    tax_consultation: '税務相談',
    legal_consultation: '法律相談',
    general: '一般相談',
  };
  return labels[type] || type;
}

function statusBadge(status: Reservation['status']): { label: string; className: string } {
  switch (status) {
    case 'pending':
      return { label: '承認待ち', className: 'bg-yellow-100 text-yellow-700' };
    case 'confirmed':
      return { label: '確定', className: 'bg-green-100 text-green-700' };
    case 'reminded':
      return { label: 'リマインド済', className: 'bg-blue-100 text-blue-700' };
    case 'completed':
      return { label: '完了', className: 'bg-slate-200 text-slate-600' };
    case 'cancelled':
      return { label: 'キャンセル', className: 'bg-red-100 text-red-600' };
    case 'no_show':
      return { label: '無断欠席', className: 'bg-orange-100 text-orange-600' };
    default:
      return { label: status, className: 'bg-slate-100 text-slate-500' };
  }
}

function isUpcoming(r: Reservation): boolean {
  if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'no_show') {
    return false;
  }
  if (!r.date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rDate = new Date(r.date + 'T00:00:00');
  return rDate >= today;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = 'upcoming' | 'past';

export default function LiffReservationsPage() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/reservations?customerId=${CUSTOMER_ID}`);
      if (!res.ok) throw new Error('予約の取得に失敗しました');
      const data = await res.json();
      setReservations(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const filtered = reservations.filter((r) =>
    tab === 'upcoming' ? isUpcoming(r) : !isUpcoming(r),
  );

  // Sort: upcoming by date asc, past by date desc
  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    return tab === 'upcoming'
      ? dateA.localeCompare(dateB) || (a.startTime || '').localeCompare(b.startTime || '')
      : dateB.localeCompare(dateA) || (b.startTime || '').localeCompare(a.startTime || '');
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#06C755] px-4 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/liff/mypage"
            className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center active:bg-white/30 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-white">予約履歴</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4">
        <div className="flex">
          <button
            onClick={() => setTab('upcoming')}
            className={`flex-1 py-3.5 text-sm font-semibold text-center transition-colors relative ${
              tab === 'upcoming' ? 'text-[#06C755]' : 'text-slate-400'
            }`}
          >
            今後の予約
            {tab === 'upcoming' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06C755] rounded-t" />
            )}
          </button>
          <button
            onClick={() => setTab('past')}
            className={`flex-1 py-3.5 text-sm font-semibold text-center transition-colors relative ${
              tab === 'past' ? 'text-[#06C755]' : 'text-slate-400'
            }`}
          >
            過去の予約
            {tab === 'past' && (
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
        {error && !loading && (
          <div className="flex flex-col items-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 w-full mb-4">
              {error}
            </div>
            <button
              onClick={fetchReservations}
              className="text-sm text-[#06C755] font-semibold active:opacity-70 transition"
            >
              再読み込み
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <p className="text-sm text-slate-400">
              {tab === 'upcoming' ? '今後の予約はありません' : '過去の予約はありません'}
            </p>
            {tab === 'upcoming' && (
              <Link
                href="/liff/booking"
                className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#06C755] text-white text-sm font-semibold active:opacity-80 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                予約する
              </Link>
            )}
          </div>
        )}

        {/* Reservation cards */}
        {!loading && !error && sorted.map((r) => {
          const badge = statusBadge(r.status);
          const isPast = !isUpcoming(r);

          return (
            <div
              key={r.id}
              className={`rounded-2xl overflow-hidden shadow-sm border transition-all ${
                isPast
                  ? 'bg-white/80 border-slate-200'
                  : 'bg-white border-green-200'
              }`}
            >
              {/* Date header bar */}
              <div
                className={`px-4 py-2.5 flex items-center justify-between ${
                  isPast ? 'bg-slate-50' : 'bg-green-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-[#06C755]'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span className={`text-sm font-bold ${isPast ? 'text-slate-500' : 'text-slate-700'}`}>
                    {r.date ? formatDate(r.date) : '日付未定'}
                  </span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              {/* Card body */}
              <div className="px-4 py-3 space-y-2.5">
                {/* Time */}
                {r.startTime && r.endTime && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-slate-600">
                      {formatTime(r.startTime)} - {formatTime(r.endTime)}
                    </span>
                  </div>
                )}

                {/* Consultant */}
                {r.consultantName && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    <span className="text-sm text-slate-600">
                      {r.consultantName}
                    </span>
                  </div>
                )}

                {/* Service type */}
                {r.serviceType && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                    </svg>
                    <span className="text-sm text-slate-600">
                      {serviceLabel(r.serviceType)}
                    </span>
                  </div>
                )}

                {/* Google Meet link (upcoming only) */}
                {!isPast && r.meetUrl && (
                  <a
                    href={r.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 active:bg-blue-100 transition-colors"
                  >
                    <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <span className="text-sm font-semibold text-blue-600">
                      Google Meet に参加
                    </span>
                    <svg className="w-3.5 h-3.5 text-blue-400 ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}

                {/* Notes */}
                {r.notes && (
                  <div className="flex items-start gap-2 pt-0.5">
                    <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    <span className="text-xs text-slate-400 leading-relaxed">
                      {r.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom padding */}
      <div className="h-8" />
    </div>
  );
}
