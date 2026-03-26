'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Reservation, TimeSlot } from '@/types/booking';
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
} from '@/types/booking';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ReservationStats {
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
  cancelRate: number;
}

interface Consultant {
  id: string;
  name: string;
}

interface CustomerOption {
  id: string;
  displayName: string;
  lineUserName?: string;
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

const SERVICE_TYPE_OPTIONS = [
  { value: 'general', label: '一般相談' },
  { value: 'technical', label: '技術相談' },
  { value: 'career', label: 'キャリア相談' },
] as const;

const DEBOUNCE_MS = 300;

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
// New Reservation Modal
// ---------------------------------------------------------------------------
function NewReservationModal({
  consultants,
  onClose,
  onCreated,
}: {
  consultants: Consultant[];
  onClose: () => void;
  onCreated: () => void;
}) {
  // Customer search
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form fields
  const [selectedConsultantId, setSelectedConsultantId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [serviceType, setServiceType] = useState('general');
  const [notes, setNotes] = useState('');

  // Slots
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Debounced customer search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!customerQuery.trim()) {
      setCustomerResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const params = new URLSearchParams({ search: customerQuery.trim(), perPage: '10' });
        const res = await fetch(`/api/crm/customers?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const customers = data.customers ?? data ?? [];
          setCustomerResults(
            customers.map((c: Record<string, unknown>) => ({
              id: c.id as string,
              displayName: (c.displayName ?? c.lineUserName ?? c.id) as string,
              lineUserName: c.lineUserName as string | undefined,
            })),
          );
        }
      } catch {
        // silently fail
      } finally {
        setCustomerLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [customerQuery]);

  // Fetch available slots when consultant + date change
  useEffect(() => {
    if (!selectedConsultantId || !selectedDate) {
      setAvailableSlots([]);
      setSelectedSlotId('');
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlotId('');

    (async () => {
      try {
        const params = new URLSearchParams({ consultantId: selectedConsultantId });
        const res = await fetch(`/api/booking/slots/${selectedDate}?${params.toString()}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const slots: TimeSlot[] = Array.isArray(data) ? data : data.slots ?? [];
          setAvailableSlots(slots.filter((s) => s.isAvailable));
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedConsultantId, selectedDate]);

  // Submit handler
  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedConsultantId || !selectedSlotId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/booking/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          consultantId: selectedConsultantId,
          timeSlotId: selectedSlotId,
          serviceType,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '予約の作成に失敗しました');
      }

      onCreated();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedCustomer && selectedConsultantId && selectedSlotId && serviceType && !submitting;

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors';
  const labelClass = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">新規予約作成</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* 1. Customer search */}
          <div>
            <label className={labelClass}>顧客検索</label>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                <span className="text-sm font-medium text-green-800 flex-1">
                  {selectedCustomer.displayName}
                </span>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerQuery('');
                    setCustomerResults([]);
                  }}
                  className="text-xs text-green-600 hover:text-green-800 transition-colors"
                >
                  変更
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="名前で検索..."
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  className={inputClass}
                />
                {customerLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
                {customerResults.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {customerResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerQuery('');
                            setCustomerResults([]);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                        >
                          <span className="font-medium text-slate-800">{c.displayName}</span>
                          {c.lineUserName && c.lineUserName !== c.displayName && (
                            <span className="ml-2 text-xs text-slate-400">{c.lineUserName}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!customerLoading && customerQuery.trim() && customerResults.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">該当する顧客が見つかりません</p>
                )}
              </div>
            )}
          </div>

          {/* 2. Consultant selector */}
          <div>
            <label className={labelClass}>相談員</label>
            <select
              value={selectedConsultantId}
              onChange={(e) => setSelectedConsultantId(e.target.value)}
              className={inputClass}
            >
              <option value="">選択してください</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Date picker */}
          <div>
            <label className={labelClass}>予約日</label>
            <input
              type="date"
              value={selectedDate}
              min={todayJST()}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* 4. Time slot selector */}
          <div>
            <label className={labelClass}>時間帯</label>
            {!selectedConsultantId || !selectedDate ? (
              <p className="text-xs text-slate-400">相談員と日付を選択してください</p>
            ) : slotsLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                空き枠を取得中...
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-xs text-slate-400">利用可能な枠がありません</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      selectedSlotId === slot.id
                        ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5. Service type dropdown */}
          <div>
            <label className={labelClass}>相談種別</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className={inputClass}
            >
              {SERVICE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Notes textarea */}
          <div>
            <label className={labelClass}>備考</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="メモがあれば入力..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? '作成中...' : '予約を作成'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ReservationsPage() {
  const pathname = usePathname();
  const subNav = [
    { label: '予約一覧', href: '/dashboard/reservations' },
    { label: 'カレンダー', href: '/dashboard/reservations/calendar' },
    { label: 'スロット設定', href: '/dashboard/reservations/slots' },
  ];

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

  // New reservation modal state
  const [showNewModal, setShowNewModal] = useState(false);

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

  // Handle reservation created
  const handleReservationCreated = () => {
    setShowNewModal(false);
    fetchReservations();
    fetchStats();
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 pb-3">
        {subNav.map((item) => {
          const active = item.href === '/dashboard/reservations'
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
          <h1 className="text-xl font-bold text-slate-800">予約管理</h1>
          <p className="text-sm text-slate-400 mt-1">予約の確認・管理を行います</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新規予約作成
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="今日の予約数" value={stats?.totalToday ?? '-'} color="green" />
        <StatCard label="今週" value={stats?.totalThisWeek ?? '-'} color="blue" />
        <StatCard label="今月" value={stats?.totalThisMonth ?? '-'} color="indigo" />
        <StatCard
          label="キャンセル率"
          value={stats != null ? `${(stats.cancelRate * 100).toFixed(1)}%` : '-'}
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

      {/* New reservation modal */}
      {showNewModal && (
        <NewReservationModal
          consultants={consultants}
          onClose={() => setShowNewModal(false)}
          onCreated={handleReservationCreated}
        />
      )}
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
