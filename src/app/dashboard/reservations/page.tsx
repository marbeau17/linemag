'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Reservation } from '@/types/booking';
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
} from '@/types/booking';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ReservationStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  cancelRate: number;
}

interface Consultant {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_OPTIONS = [
  { value: '', label: '全て' },
  { value: 'confirmed', label: '確定' },
  { value: 'completed', label: '完了' },
  { value: 'cancelled', label: 'キャンセル' },
  { value: 'no_show', label: 'ノーショー' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateJST(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || '-';
    return d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr || '-';
  }
}

function formatTime(time: string): string {
  if (!time || time.length < 5) return '--:--';
  return time.slice(0, 5);
}

function todayJST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ReservationsPage() {
  // Data state
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [stats, setStats] = useState<ReservationStats | null>(null);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter state
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [consultantId, setConsultantId] = useState('');

  // Fetch consultants (once)
  useEffect(() => {
    fetch('/api/booking/consultants')
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => {
        if (data) setConsultants(Array.isArray(data) ? data : data.consultants ?? []);
      })
      .catch(() => {});
  }, []);

  // Fetch stats (once + after actions)
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/booking/reservations/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // stats are non-critical
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch reservations
  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (status) params.set('status', status);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (consultantId) params.set('consultantId', consultantId);

      const res = await fetch(`/api/booking/reservations?${params.toString()}`);
      if (!res.ok) throw new Error('予約データの取得に失敗しました');
      const data = await res.json();
      setReservations(data.reservations ?? data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [status, dateFrom, dateTo, consultantId]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Actions
  const handleAction = async (id: string, action: 'confirm' | 'cancel' | 'complete') => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/booking/reservations/${id}/${action}`, { method: 'PATCH' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '操作に失敗しました');
      }
      await Promise.all([fetchReservations(), fetchStats()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">予約管理</h1>
        <p className="text-sm text-slate-400 mt-1">予約の確認・管理を行います</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="今日の予約数" value={stats?.today ?? '-'} color="green" />
        <StatCard label="今週" value={stats?.thisWeek ?? '-'} color="blue" />
        <StatCard label="今月" value={stats?.thisMonth ?? '-'} color="indigo" />
        <StatCard
          label="キャンセル率"
          value={stats ? `${stats.cancelRate.toFixed(1)}%` : '-'}
          color="red"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Date from */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
            />
          </div>

          {/* Date to */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
            />
          </div>

          {/* Consultant */}
          <select
            value={consultantId}
            onChange={(e) => setConsultantId(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
          >
            <option value="">全相談員</option>
            {consultants.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Reset button */}
          {(status || dateFrom || dateTo || consultantId) && (
            <button
              onClick={() => {
                setStatus('');
                setDateFrom('');
                setDateTo('');
                setConsultantId('');
              }}
              className="px-3 py-2 text-xs font-medium text-slate-500 rounded-lg hover:bg-slate-100 transition-colors"
            >
              リセット
            </button>
          )}
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
                  予約日時
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  顧客名
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  相談員
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  種別
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="text-center px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Meet
                </th>
                <th className="text-center px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-400">
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
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-400">
                    該当する予約が見つかりませんでした。
                  </td>
                </tr>
              ) : (
                reservations.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Date + time */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-slate-800">
                        {r.date ? formatDateJST(r.date) : '-'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {r.startTime ? formatTime(r.startTime) : '--:--'} -{' '}
                        {r.endTime ? formatTime(r.endTime) : '--:--'}
                      </p>
                    </td>

                    {/* Customer name */}
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/crm/${r.customerId}`}
                        className="text-sm font-medium text-green-700 hover:text-green-800 hover:underline transition-colors"
                      >
                        {r.customerName || r.customerId}
                      </Link>
                    </td>

                    {/* Consultant */}
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {r.consultantName || '-'}
                    </td>

                    {/* Service type */}
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {SERVICE_TYPE_LABELS[r.serviceType] || r.serviceType}
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          RESERVATION_STATUS_COLORS[r.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {RESERVATION_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>

                    {/* Meet URL */}
                    <td className="px-5 py-3 text-center">
                      {r.meetUrl ? (
                        <a
                          href={r.meetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Google Meet を開く"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3l3-3m0 0l-3-3m3 3H9" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {(r.status === 'pending' || r.status === 'reminded') && (
                          <button
                            onClick={() => handleAction(r.id, 'confirm')}
                            disabled={actionLoading === r.id}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            確定
                          </button>
                        )}
                        {(r.status === 'pending' || r.status === 'confirmed' || r.status === 'reminded') && (
                          <button
                            onClick={() => handleAction(r.id, 'cancel')}
                            disabled={actionLoading === r.id}
                            className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            取消
                          </button>
                        )}
                        {r.status === 'confirmed' && (
                          <button
                            onClick={() => handleAction(r.id, 'complete')}
                            disabled={actionLoading === r.id}
                            className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                          >
                            完了
                          </button>
                        )}
                        {(r.status === 'completed' || r.status === 'cancelled' || r.status === 'no_show') && (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card sub-component
// ---------------------------------------------------------------------------
const STAT_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-400' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-400' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-400' },
  red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-400' },
};

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const c = STAT_COLORS[color] ?? STAT_COLORS.green;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${c.text}`}>{value}</p>
    </div>
  );
}
