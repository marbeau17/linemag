'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Reservation, BookingSettings } from '@/types/booking';
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
} from '@/types/booking';

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */
const DAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'] as const;

/** Pad to 2 digits */
function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Monday-based day index: Mon=0 .. Sun=6 */
function mondayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

/** Build 6-week grid of dates covering the given month */
function buildCalendarGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = mondayIndex(first);
  const start = new Date(year, month, 1 - startOffset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/* ------------------------------------------------------------------ */
/*  Status badge colors for calendar mini-blocks                       */
/* ------------------------------------------------------------------ */
const STATUS_DOT_COLORS: Record<string, string> = {
  pending: 'bg-yellow-400',
  confirmed: 'bg-blue-400',
  reminded: 'bg-indigo-400',
  completed: 'bg-green-400',
  cancelled: 'bg-slate-300',
  no_show: 'bg-red-400',
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default function ReservationCalendarPage() {
  const pathname = usePathname();
  const subNav = [
    { label: '予約一覧', href: '/dashboard/reservations' },
    { label: 'カレンダー', href: '/dashboard/reservations/calendar' },
    { label: 'スロット設定', href: '/dashboard/reservations/slots' },
  ];

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Side panel
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ----- fetch data whenever month changes ----- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateFrom = `${year}-${pad(month + 1)}-01`;
      const dateTo = `${year}-${pad(month + 1)}-${pad(lastDayOfMonth(year, month))}`;

      const [resRes, settingsRes] = await Promise.all([
        fetch(`/api/booking/reservations?dateFrom=${dateFrom}&dateTo=${dateTo}`).catch(() => null),
        fetch('/api/booking/settings').catch(() => null),
      ]);

      if (resRes && resRes.ok) {
        const data = await resRes.json().catch(() => null);
        if (data) {
          setReservations(Array.isArray(data) ? data : data.reservations ?? []);
        } else {
          setReservations([]);
        }
      } else {
        setReservations([]);
        if (resRes && !resRes.ok) {
          setError('予約データの取得に失敗しました');
        }
      }

      if (settingsRes && settingsRes.ok) {
        const settingsData = await settingsRes.json().catch(() => null);
        if (settingsData) setSettings(settingsData);
      }
    } catch {
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ----- derived data ----- */
  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month]);
  const holidaySet = useMemo(() => new Set(settings?.holidays ?? []), [settings]);

  /** Map date string -> reservations for that date */
  const reservationsByDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const r of reservations) {
      const d = r.date ?? '';
      if (!d) continue;
      (map[d] ??= []).push(r);
    }
    return map;
  }, [reservations]);

  /* ----- navigation ----- */
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(null);
  }

  /* ----- quick actions ----- */
  async function handleAction(reservationId: string, action: 'confirm' | 'cancel') {
    setActionLoading(reservationId);
    setError(null);
    try {
      const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';
      const res = await fetch(`/api/booking/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || '操作に失敗しました');
      }
    } catch {
      setError('操作に失敗しました');
    } finally {
      setActionLoading(null);
    }
  }

  /* ----- reservations for selected day ----- */
  const selectedDayStr = selectedDate ? fmtDate(selectedDate) : '';
  const selectedReservations = selectedDayStr ? (reservationsByDate[selectedDayStr] ?? []) : [];
  const isSelectedHoliday = selectedDayStr ? holidaySet.has(selectedDayStr) : false;

  /* ----- build business hours timeline for selected day ----- */
  const businessHoursForDay = useMemo(() => {
    if (!settings || !selectedDate) return null;
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const idx = mondayIndex(selectedDate);
    const key = dayKeys[idx];
    return settings.businessHours?.[key] ?? null;
  }, [settings, selectedDate]);

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
      <div>
        <h1 className="text-xl font-bold text-slate-800">予約カレンダー</h1>
        <p className="text-sm text-slate-400 mt-1">月間の予約状況を確認</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700 text-xs font-medium">
            閉じる
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ============== Calendar ============== */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Month navigator */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <button
              onClick={prevMonth}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              &lt; 前月
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-800">
                {year}年{month + 1}月
              </span>
              <button
                onClick={goToday}
                className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
              >
                今日
              </button>
            </div>
            <button
              onClick={nextMonth}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              次月 &gt;
            </button>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="h-1 bg-green-100 overflow-hidden">
              <div className="h-full w-1/3 bg-green-500 animate-pulse rounded" />
            </div>
          )}

          {/* Day names header */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={`py-2 text-center text-xs font-semibold ${
                  i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : 'text-slate-500'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {grid.map((date, i) => {
              const dateStr = fmtDate(date);
              const isCurrentMonth = date.getMonth() === month;
              const isToday = isSameDay(date, today);
              const isWeekend = mondayIndex(date) >= 5;
              const isHoliday = holidaySet.has(dateStr);
              const dayReservations = reservationsByDate[dateStr] ?? [];
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  className={`
                    relative min-h-[5rem] p-1.5 border-b border-r border-slate-100
                    text-left transition-colors cursor-pointer
                    ${isWeekend && !isSelected ? 'bg-slate-50/60' : ''}
                    ${isSelected ? 'bg-green-50 ring-1 ring-inset ring-green-300' : 'hover:bg-slate-50'}
                    ${i % 7 === 0 ? 'border-l-0' : ''}
                  `}
                >
                  {/* Date number */}
                  <span
                    className={`
                      inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full
                      ${isToday ? 'bg-green-600 text-white' : ''}
                      ${!isToday && isHoliday ? 'text-red-500' : ''}
                      ${!isToday && !isHoliday && !isCurrentMonth ? 'text-slate-300' : ''}
                      ${!isToday && !isHoliday && isCurrentMonth && isWeekend && mondayIndex(date) === 6 ? 'text-red-500' : ''}
                      ${!isToday && !isHoliday && isCurrentMonth && isWeekend && mondayIndex(date) === 5 ? 'text-blue-500' : ''}
                      ${!isToday && !isHoliday && isCurrentMonth && !isWeekend ? 'text-slate-700' : ''}
                    `}
                  >
                    {date.getDate()}
                  </span>

                  {/* Holiday label */}
                  {isHoliday && isCurrentMonth && (
                    <span className="block text-[9px] text-red-400 font-medium leading-tight mt-0.5 truncate">
                      休業日
                    </span>
                  )}

                  {/* Reservation count */}
                  {dayReservations.length > 0 && isCurrentMonth && (
                    <span className="absolute top-1.5 right-1.5 min-w-[1.125rem] h-[1.125rem] flex items-center justify-center text-[10px] font-bold bg-green-100 text-green-700 rounded-full px-1">
                      {dayReservations.length}
                    </span>
                  )}

                  {/* Mini reservation blocks */}
                  {isCurrentMonth && dayReservations.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayReservations.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] leading-tight bg-slate-50 truncate"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT_COLORS[r.status] ?? 'bg-slate-300'}`} />
                          <span className="truncate text-slate-600">
                            {r.startTime?.slice(0, 5)} {r.customerName ?? '予約'}
                          </span>
                        </div>
                      ))}
                      {dayReservations.length > 3 && (
                        <span className="block text-[9px] text-slate-400 pl-1">
                          +{dayReservations.length - 3}件
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 border-t border-slate-100">
            {Object.entries(STATUS_DOT_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-[10px] text-slate-500">{RESERVATION_STATUS_LABELS[status]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ============== Side Panel ============== */}
        {selectedDate && (
          <div className="w-full lg:w-80 shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden self-start">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({DAY_NAMES[mondayIndex(selectedDate)]})
                  </span>
                </h2>
                {isSelectedHoliday && (
                  <span className="text-[10px] font-medium text-red-500">休業日</span>
                )}
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Timeline bar */}
            {businessHoursForDay && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                  営業時間 {businessHoursForDay.start} - {businessHoursForDay.end}
                </p>
                <TimelineBar
                  start={businessHoursForDay.start}
                  end={businessHoursForDay.end}
                  reservations={selectedReservations}
                />
              </div>
            )}

            {/* Reservations list */}
            <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
              {selectedReservations.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  予約はありません
                </div>
              ) : (
                selectedReservations
                  .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
                  .map((r) => (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">
                              {r.startTime?.slice(0, 5)} - {r.endTime?.slice(0, 5)}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                RESERVATION_STATUS_COLORS[r.status] ?? 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {RESERVATION_STATUS_LABELS[r.status] ?? r.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {r.customerName ?? '顧客不明'}
                          </p>
                          {r.consultantName && (
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              担当: {r.consultantName}
                            </p>
                          )}
                          {r.notes && (
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              {r.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Quick actions */}
                      {(r.status === 'pending' || r.status === 'confirmed') && (
                        <div className="flex items-center gap-2 mt-2">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => handleAction(r.id, 'confirm')}
                              disabled={actionLoading === r.id}
                              className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
                            >
                              {actionLoading === r.id ? '...' : '確定する'}
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(r.id, 'cancel')}
                            disabled={actionLoading === r.id}
                            className="px-2.5 py-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                          >
                            {actionLoading === r.id ? '...' : 'キャンセル'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>

            {/* Summary footer */}
            {selectedReservations.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                <span className="text-[10px] text-slate-500">
                  合計 {selectedReservations.length}件
                  {' / '}
                  確定 {selectedReservations.filter(r => r.status === 'confirmed' || r.status === 'reminded').length}件
                  {' / '}
                  仮予約 {selectedReservations.filter(r => r.status === 'pending').length}件
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline Bar sub-component                                         */
/* ------------------------------------------------------------------ */
function TimelineBar({
  start,
  end,
  reservations,
}: {
  start: string;
  end: string;
  reservations: Reservation[];
}) {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const totalMin = endMin - startMin;
  if (totalMin <= 0) return null;

  // Hour markers
  const startHour = Math.ceil(startMin / 60);
  const endHour = Math.floor(endMin / 60);
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  return (
    <div className="relative">
      {/* Background bar */}
      <div className="relative h-5 bg-slate-100 rounded overflow-hidden">
        {/* Booked slots */}
        {reservations
          .filter(r => r.startTime && r.endTime && r.status !== 'cancelled')
          .map((r) => {
            const rStart = Math.max(timeToMinutes(r.startTime!), startMin);
            const rEnd = Math.min(timeToMinutes(r.endTime!), endMin);
            const left = ((rStart - startMin) / totalMin) * 100;
            const width = ((rEnd - rStart) / totalMin) * 100;
            const bgColor =
              r.status === 'pending'
                ? 'bg-yellow-300/70'
                : r.status === 'confirmed' || r.status === 'reminded'
                  ? 'bg-blue-300/70'
                  : 'bg-green-300/70';
            return (
              <div
                key={r.id}
                className={`absolute top-0 h-full ${bgColor} rounded-sm`}
                style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                title={`${r.startTime?.slice(0, 5)}-${r.endTime?.slice(0, 5)} ${r.customerName ?? ''}`}
              />
            );
          })}
      </div>
      {/* Hour labels */}
      <div className="relative mt-0.5" style={{ height: '0.75rem' }}>
        {hours.map((h) => {
          const pos = ((h * 60 - startMin) / totalMin) * 100;
          return (
            <span
              key={h}
              className="absolute text-[8px] text-slate-400 -translate-x-1/2"
              style={{ left: `${pos}%` }}
            >
              {h}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function timeToMinutes(t: string): number {
  if (!t || typeof t !== 'string') return 0;
  const parts = t.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}
